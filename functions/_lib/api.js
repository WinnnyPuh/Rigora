// Router for the planner endpoints. Keys stay on the server.
//   GET  /api/search?q=&limit=
//   POST /api/route    {locations:[[lon,lat]...], vehicleWeight(kg), vehicleHeight(m), vehicleLength(m), vehicleMaxSpeed(km/h), avoid:[], maxAlternatives}
//   POST /api/along    {points:[[lon,lat]...], query, code}
//   GET  /api/traffic?bbox=minLon,minLat,maxLon,maxLat
//   GET  /api/wx?kind=current|daily|hourly|alerts&loc=lat,lon|place&at=ISO
import { json } from "./handler.js";
import { search, route, along, traffic, UpstreamError } from "./tomtom.js";
import { weather } from "./nws.js";

const CACHE = { search: 3600, traffic: 120, wx: 600 };

// GET /api/tile/{basic|night|sat|hybrid|hybridnight}/{z}/{x}/{y}
const TILE = {
  basic: ["basic/main", "png", 22], night: ["basic/night", "png", 22],
  sat: ["sat/main", "jpg", 19], hybrid: ["hybrid/main", "png", 22], hybridnight: ["hybrid/night", "png", 22],
};
const TILE_AGE = 7 * 86400;
export async function tile(name, env, waitUntil = () => {}, fetcher = fetch) {
  const m = /^tile\/([a-z]+)\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})$/.exec(name);
  const t = m && TILE[m[1]];
  const z = m ? +m[2] : -1, x = m ? +m[3] : -1, y = m ? +m[4] : -1;
  if (!t || z > t[2] || x >= 2 ** z || y >= 2 ** z) return new Response("bad tile", { status: 400 });
  if (!env.TOMTOM_KEY) return new Response("no key", { status: 502 });
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const key = new Request(`https://tiles.rigora.internal/${m[1]}/${z}/${x}/${y}`);
  if (cache) { const hit = await cache.match(key); if (hit) return hit; }
  const r = await fetcher(`https://api.tomtom.com/map/1/tile/${t[0]}/${z}/${x}/${y}.${t[1]}?key=${encodeURIComponent(env.TOMTOM_KEY)}`,
    { cf: { cacheTtl: TILE_AGE, cacheEverything: true } });
  if (!r.ok) return new Response("tile " + r.status, { status: r.status === 404 ? 404 : 502, headers: { "cache-control": "no-store" } });
  const res = new Response(r.body, { status: 200, headers: {
    "content-type": t[1] === "jpg" ? "image/jpeg" : "image/png",
    "cache-control": `public, max-age=${TILE_AGE}`, "access-control-allow-origin": "*" } });
  if (cache) waitUntil(cache.put(key, res.clone()));
  return res;
}

export async function api(request, env, waitUntil = () => {}) {
  const url = new URL(request.url);
  const name = url.pathname.replace(/^\/api\//, "").replace(/\/$/, "");
  const q = Object.fromEntries(url.searchParams);
  try {
    // map tiles from TomTom through our server so the key stays private; cached at the edge and in the browser
    if (name.startsWith("tile/")) return await tile(name, env, waitUntil);
    // setup check: which keys the server sees and whether TomTom accepts ours (never shows the keys)
    if (name === "health") {
      const out = { fmcsa_key: !!env.FMCSA_KEY, tomtom_key: !!env.TOMTOM_KEY, tomtom: null };
      if (env.TOMTOM_KEY) {
        try { await search({ q: "Denver, CO", limit: 1 }, env); out.tomtom = "ok"; }
        catch (e) { out.tomtom = String(e.message || e).replace(env.TOMTOM_KEY, "***").slice(0, 300); }
        try {
          const r = await fetch(`https://api.tomtom.com/map/1/tile/basic/main/5/9/12.png?key=${encodeURIComponent(env.TOMTOM_KEY)}`);
          out.tiles = r.ok ? "ok" : `${r.status} ${(await r.text()).slice(0, 200)}`;
        } catch (e) { out.tiles = String(e.message || e).slice(0, 200); }
        try { const t = await tile("tile/sat/10/301/384", env); out.tile_proxy = t.status + " " + t.headers.get("content-type"); }
        catch (e) { out.tile_proxy = "error " + String(e.message || e).slice(0, 200); }
      }
      return json(out, 200, 0);
    }
    if (request.method === "GET" && (name === "search" || name === "traffic" || name === "wx")) {
      const cache = typeof caches !== "undefined" ? caches.default : null;
      const key = new Request(url.toString(), { method: "GET" });
      if (cache) { const hit = await cache.match(key); if (hit) return hit; }
      const out = name === "search" ? await search(q, env) : name === "traffic" ? await traffic(q, env) : await weather(q, env);
      const res = json(out, 200, CACHE[name]);
      if (cache) waitUntil(cache.put(key, res.clone()));
      return res;
    }
    if (request.method === "POST" && (name === "route" || name === "along")) {
      const body = await request.json().catch(() => null);
      if (!body) return json({ error: "bad_request" }, 400);
      return json(name === "route" ? await route(body, env) : await along(body, env));
    }
    return json({ error: "not_found" }, 404);
  } catch (e) {
    const st = e instanceof UpstreamError && e.status === 400 ? 400 : 502;
    return json({ error: st === 400 ? "bad_request" : "upstream", detail: String(e.message || e).slice(0, 300) }, st);
  }
}
