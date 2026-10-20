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

export async function api(request, env, waitUntil = () => {}) {
  const url = new URL(request.url);
  const name = url.pathname.replace(/^\/api\//, "").replace(/\/$/, "");
  const q = Object.fromEntries(url.searchParams);
  try {
    // setup check: which keys the server sees and whether TomTom accepts ours (never shows the keys)
    if (name === "health") {
      const out = { fmcsa_key: !!env.FMCSA_KEY, tomtom_key: !!env.TOMTOM_KEY, tomtom: null };
      if (env.TOMTOM_KEY) {
        try { await search({ q: "Denver, CO", limit: 1 }, env); out.tomtom = "ok"; }
        catch (e) { out.tomtom = String(e.message || e).replace(env.TOMTOM_KEY, "***").slice(0, 300); }
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
