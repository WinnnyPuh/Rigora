// TomTom calls made on the server with our own key (env.TOMTOM_KEY).
// Responses are reshaped into the GeoJSON-like objects the planner UI renders.
import { stateSpans } from "./states.js";

const TT = "https://api.tomtom.com";
export class UpstreamError extends Error { constructor(msg, status) { super(msg); this.status = status; } }

async function tt(path, env, fetcher, init) {
  if (!env.TOMTOM_KEY) throw new UpstreamError("TOMTOM_KEY is not set", 500);
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetcher(`${TT}${path}${sep}key=${encodeURIComponent(env.TOMTOM_KEY)}`, init);
  if (!r.ok) {
    let detail = ""; try { detail = JSON.stringify(await r.json()).slice(0, 300); } catch (_) {}
    throw new UpstreamError(`TomTom ${r.status} ${detail}`, r.status);
  }
  return r.json();
}

const r5 = n => Math.round(n * 1e5) / 1e5;
const feature = (lon, lat, address, poi) => ({ type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: { address: address || {}, poi } });

// ---------- search ----------
export async function search({ q, limit = 6, typeahead = true }, env, fetcher = fetch) {
  const query = String(q || "").trim().slice(0, 200);
  if (!query) return { features: [] };
  const p = new URLSearchParams({ countrySet: "US,CA,MX", limit: String(Math.min(10, Math.max(1, +limit || 6))), typeahead: String(!!typeahead), language: "en-US" });
  const j = await tt(`/search/2/search/${encodeURIComponent(query)}.json?${p}`, env, fetcher);
  return { features: (j.results || []).filter(r => r.position).map(r => feature(r5(r.position.lon), r5(r.position.lat), r.address,
    r.poi ? { name: r.poi.name, phone: r.poi.phone, brands: (r.poi.brands || []).map(b => b.name) } : undefined)) };
}

// ---------- truck route with alternatives ----------
const num = (v, lo, hi) => { const n = +v; return isFinite(n) && n >= lo && n <= hi ? n : null; };
export function routeQuery(b) {
  const p = new URLSearchParams({
    travelMode: "truck", vehicleCommercial: "true", routeType: "fastest", traffic: "true",
    routeRepresentation: "polyline", computeTravelTimeFor: "all",
    maxAlternatives: String(Math.min(2, Math.max(0, +b.maxAlternatives || 0))),
  });
  p.append("sectionType", "toll"); p.append("sectionType", "tollRoad");
  const w = num(b.vehicleWeight, 1000, 70000); if (w) p.set("vehicleWeight", String(Math.round(w)));
  const h = num(b.vehicleHeight, 1.5, 5); if (h) p.set("vehicleHeight", h.toFixed(2));
  const l = num(b.vehicleLength, 3, 40); if (l) p.set("vehicleLength", l.toFixed(2));
  const s = num(b.vehicleMaxSpeed, 50, 140); if (s) p.set("vehicleMaxSpeed", String(Math.round(s)));
  if (Array.isArray(b.avoid) && b.avoid.includes("tollRoads")) p.set("avoid", "tollRoads");
  return p;
}
export async function route(b, env, fetcher = fetch) {
  const locs = (b.locations || []).filter(x => Array.isArray(x) && isFinite(x[0]) && isFinite(x[1])).slice(0, 25);
  if (locs.length < 2) throw new UpstreamError("need at least two locations", 400);
  const path = locs.map(([lon, lat]) => `${(+lat).toFixed(6)},${(+lon).toFixed(6)}`).join(":");
  const j = await tt(`/routing/1/calculateRoute/${path}/json?${routeQuery(b)}`, env, fetcher);
  const features = [];
  for (const rt of (j.routes || [])) {
    const coords = [];
    for (const leg of (rt.legs || [])) for (const pt of (leg.points || [])) coords.push([r5(pt.longitude), r5(pt.latitude)]);
    if (coords.length < 2) continue;
    const secs = { leg: (rt.legs || []).map(l => ({ summary: l.summary })), toll: [], tollRoad: [] };
    for (const s of (rt.sections || [])) {
      if (s.sectionType === "TOLL") secs.toll.push({ startPointIndex: s.startPointIndex, endPointIndex: s.endPointIndex });
      if (s.sectionType === "TOLL_ROAD") secs.tollRoad.push({ startPointIndex: s.startPointIndex, endPointIndex: s.endPointIndex });
    }
    let spans = null;
    try { spans = await stateSpans(coords, fetcher); } catch (_) { spans = null; }
    features.push({ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: { summary: rt.summary, sections: secs, stateSpans: spans } });
  }
  return { type: "FeatureCollection", features };
}

// ---------- POIs along a route ----------
// TomTom returns at most 20 results per call, so long routes are split into chunks.
export async function along({ points, query, code }, env, fetcher = fetch) {
  const pts = (points || []).filter(p => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1])).slice(0, 1500);
  const q = String(query || "").trim().slice(0, 60);
  if (pts.length < 2 || !q) return { pois: { type: "FeatureCollection", features: [] } };
  const CH = 120, chunks = [];
  for (let i = 0; i < pts.length - 1; i += CH - 1) chunks.push(pts.slice(i, i + CH));
  const seen = new Set(), out = [];
  const p = new URLSearchParams({ maxDetourTime: "300", limit: "20", spreadingMode: "auto" });
  await Promise.all(chunks.slice(0, 16).map(async ch => {
    const j = await tt(`/search/2/searchAlongRoute/${encodeURIComponent(q)}.json?${p}`, env, fetcher, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ route: { points: ch.map(([lon, lat]) => ({ lat, lon })) } }),
    }).catch(() => ({ results: [] }));
    for (const r of (j.results || [])) {
      if (!r.position || !r.poi) continue;
      const codes = (r.poi.classifications || []).map(c => c.code);
      if (code && !codes.includes(code)) continue;
      const id = r.id || `${r.poi.name}|${r.position.lat}|${r.position.lon}`;
      if (seen.has(id)) continue; seen.add(id);
      out.push({ ...feature(r5(r.position.lon), r5(r.position.lat), r.address, {
        name: r.poi.name, phone: r.poi.phone, categories: codes, brands: (r.poi.brands || []).map(b => b.name) }), id });
    }
  }));
  return { pois: { type: "FeatureCollection", features: out } };
}

// ---------- traffic incidents ----------
const ICON = { 0: "other", 1: "accident", 2: "fog", 3: "danger", 4: "rain", 5: "frost", 6: "jam", 7: "lane-closed", 8: "road-closed", 9: "roadworks", 10: "wind", 11: "flooding", 14: "broken-down-vehicle" };
const MAG = { 0: "unknown", 1: "minor", 2: "moderate", 3: "major", 4: "indefinite" };
const FIELDS = "{incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code,iconCategory},from,to,length,delay,roadNumbers,timeValidity}}}";
export async function traffic({ bbox }, env, fetcher = fetch) {
  const b = String(bbox || "").split(",").map(Number);
  if (b.length !== 4 || b.some(x => !isFinite(x))) throw new UpstreamError("bad bbox", 400);
  const p = new URLSearchParams({ bbox: b.map(x => x.toFixed(4)).join(","), fields: FIELDS, language: "en-GB", timeValidityFilter: "present" });
  const j = await tt(`/traffic/services/5/incidentDetails?${p}`, env, fetcher);
  const incidents = [], features = [];
  (j.incidents || []).forEach(inc => {
    const pr = inc.properties || {};
    const k = incidents.length;
    incidents.push({ category: ICON[pr.iconCategory] || "other", magnitudeOfDelay: MAG[pr.magnitudeOfDelay] || "unknown",
      from: pr.from, to: pr.to, lengthInMeters: pr.length, delayInSeconds: pr.delay, roadNumbers: pr.roadNumbers || [],
      events: (pr.events || []).map(e => e.description).filter(Boolean) });
    if (inc.geometry) features.push({ type: "Feature", geometry: inc.geometry, properties: { incident: k } });
  });
  return { incidents, geometry: { type: "FeatureCollection", features } };
}
