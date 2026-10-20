// GET /api/check?q=77949  or  ?q=MC67234
// Returns { company } in the shape the Rigora report renders, or { error }.
import { checkCompany, parseQuery } from "../_lib/fmcsa.js";

const TTL = 6 * 3600; // FMCSA data changes daily at most; cache for 6 hours

export async function onRequestGet({ request, env, waitUntil }) {
  const url = new URL(request.url);
  const pq = parseQuery(url.searchParams.get("q"));
  if (!pq) return json({ error: "bad_query" }, 400);

  const cache = caches.default;
  const cacheKey = new Request(`${url.origin}/api/check?k=${pq.key}`);
  const hit = await cache.match(cacheKey);
  if (hit && !url.searchParams.has("fresh")) return hit;

  try {
    const out = await checkCompany(pq, env);
    const res = json(out, out.error === "not_found" ? 404 : 200, out.company ? TTL : 300);
    waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  } catch (e) {
    return json({ error: "upstream", detail: String(e.message || e) }, 502);
  }
}

function json(body, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": maxAge ? `public, max-age=${maxAge}` : "no-store",
    },
  });
}
