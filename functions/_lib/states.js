// Miles by state, computed on the server from US state boundaries (us-atlas TopoJSON),
// so a route costs zero extra map API calls. Boundaries load once per Worker instance.

export const ATLAS_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json";
const FIPS = { "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY", "72": "PR" };

let STATES = null, loading = null;

// Decode a TopoJSON topology's object into [{st, bbox, polys:[[ring...]...]}]
export function decodeStates(topo, objectName = "states") {
  const tf = topo.transform;
  const arcs = topo.arcs.map(arc => {
    let x = 0, y = 0;
    return arc.map(p => {
      if (tf) { x += p[0]; y += p[1]; return [x * tf.scale[0] + tf.translate[0], y * tf.scale[1] + tf.translate[1]]; }
      return [p[0], p[1]];
    });
  });
  const ring = idxs => {
    const out = [];
    idxs.forEach((i, k) => {
      const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
      out.push(...(k ? a.slice(1) : a));
    });
    return out;
  };
  const geoms = (topo.objects[objectName] || {}).geometries || [];
  return geoms.map(g => {
    const st = FIPS[String(g.id).padStart(2, "0")] || (g.properties && g.properties.abbr) || null;
    const polys = g.type === "Polygon" ? [g.arcs.map(ring)] : g.type === "MultiPolygon" ? g.arcs.map(p => p.map(ring)) : [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    polys.forEach(p => p[0] && p[0].forEach(([x, y]) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }));
    return { st, bbox: [x0, y0, x1, y1], polys };
  }).filter(s => s.st && s.polys.length);
}

function inRing(x, y, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function stateAt(states, lon, lat, hint) {
  const test = s => {
    const b = s.bbox; if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) return false;
    return s.polys.some(p => inRing(lon, lat, p[0]) && !p.slice(1).some(h => inRing(lon, lat, h)));
  };
  if (hint) { const h = states.find(s => s.st === hint); if (h && test(h)) return h.st; }
  const hit = states.find(test);
  return hit ? hit.st : null;
}

export async function loadStates(fetcher = fetch) {
  if (STATES) return STATES;
  if (!loading) loading = (async () => {
    const r = await fetcher(ATLAS_URL, { cf: { cacheTtl: 86400 * 30, cacheEverything: true } });
    if (!r.ok) throw new Error("atlas " + r.status);
    STATES = decodeStates(await r.json());
    return STATES;
  })().catch(e => { loading = null; throw e; });
  return loading;
}
export function _setStatesForTest(s) { STATES = s; }

const hav = (a, b) => { const R = 6371008.8, k = Math.PI / 180;
  const x = Math.sin((b[1] - a[1]) * k / 2) ** 2 + Math.cos(a[1] * k) * Math.cos(b[1] * k) * Math.sin((b[0] - a[0]) * k / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x)); };

// Walk the route, test a point about every 3 km, and return spans [{st, i0, i1}]
// where i0..i1 are indexes into coords. Unknown points (water, Canada) take the previous state.
export function spansFor(states, coords, stepM = 3000) {
  if (!coords || coords.length < 2) return [];
  const probes = [0];
  let acc = 0;
  for (let i = 1; i < coords.length; i++) { acc += hav(coords[i - 1], coords[i]); if (acc >= stepM) { probes.push(i); acc = 0; } }
  if (probes[probes.length - 1] !== coords.length - 1) probes.push(coords.length - 1);
  let prev = null;
  const lab = probes.map(i => { const s = stateAt(states, coords[i][0], coords[i][1], prev); if (s) prev = s; return s; });
  const firstKnown = lab.find(Boolean) || "US";
  for (let k = 0; k < lab.length; k++) if (!lab[k]) lab[k] = k ? lab[k - 1] : firstKnown;
  // refine each change between two probes down to the exact coordinate index
  const spans = []; let cur = lab[0], start = 0;
  for (let k = 1; k < probes.length; k++) {
    if (lab[k] === cur) continue;
    let lo = probes[k - 1], hi = probes[k];
    for (let i = lo + 1; i <= hi; i++) { const s = stateAt(states, coords[i][0], coords[i][1], cur); if (s && s !== cur) { hi = i; break; } }
    spans.push({ st: cur, i0: start, i1: hi }); cur = lab[k]; start = hi;
  }
  spans.push({ st: cur, i0: start, i1: coords.length - 1 });
  return spans.filter(s => s.i1 > s.i0 || spans.length === 1);
}

export async function stateSpans(coords, fetcher = fetch) {
  const states = await loadStates(fetcher);
  return spansFor(states, coords);
}
