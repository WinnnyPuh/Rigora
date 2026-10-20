// Shared /api/check handler, used by both the Worker entry (src/worker.js)
// and the Pages Function (functions/api/check.js).
import { checkCompany, parseQuery } from "./fmcsa.js";

const TTL = 6 * 3600; // FMCSA data changes daily at most; cache for 6 hours

export async function handleCheck(request, env, waitUntil = () => {}) {
  const url = new URL(request.url);
  const pq = parseQuery(url.searchParams.get("q"));
  if (!pq) return json({ error: "bad_query" }, 400);

  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cacheKey = new Request(`${url.origin}/api/check?k=${pq.key}`);
  if (cache && !url.searchParams.has("fresh")) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }
  try {
    const out = await checkCompany(pq, env);
    const res = json(out, out.error === "not_found" ? 404 : 200, out.company ? TTL : 300);
    if (cache) waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  } catch (e) {
    return json({ error: "upstream", detail: String(e.message || e) }, 502);
  }
}

export function json(body, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": maxAge ? `public, max-age=${maxAge}` : "no-store",
    },
  });
}
