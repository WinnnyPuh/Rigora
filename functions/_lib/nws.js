// Weather from the National Weather Service (api.weather.gov): free, official, US only.
// Shapes match what the planner UI renders (current, 7-day, hourly at a time, active alerts).
import { search } from "./tomtom.js";

const NWS = "https://api.weather.gov";
const UA = { "user-agent": "Rigora trip planner (https://rigora.org)", accept: "application/geo+json" };

async function nws(url, fetcher, tries = 2) {
  for (let t = 0; t < tries; t++) {
    const r = await fetcher(url.startsWith("http") ? url : NWS + url, { headers: UA, cf: { cacheTtl: 600, cacheEverything: true } });
    if (r.ok) return r.json();
    if (r.status === 404) return null;
    if (t === tries - 1) throw new Error("NWS " + r.status);
  }
}
const mph = s => { const m = String(s || "").match(/(\d+)(?:\s*to\s*(\d+))?/); return m ? +(m[2] || m[1]) : null; };

export async function resolvePoint(loc, env, fetcher) {
  const m = String(loc || "").match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (m) return { lat: +m[1], lon: +m[2] };
  const s = await search({ q: loc, limit: 1, typeahead: false }, env, fetcher);
  const f = s.features[0];
  return f ? { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] } : null;
}

async function point(lat, lon, fetcher) {
  const j = await nws(`/points/${lat.toFixed(4)},${lon.toFixed(4)}`, fetcher);
  if (!j || !j.properties) return null;
  const rl = (j.properties.relativeLocation || {}).properties || {};
  return { hourly: j.properties.forecastHourly, daily: j.properties.forecast, place: { city: rl.city || "", state: rl.state || "" } };
}
async function alertsAt(lat, lon, fetcher) {
  const j = await nws(`/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`, fetcher).catch(() => null);
  return ((j && j.features) || []).map(f => ({ name: f.properties.event, severity: f.properties.severity, headline: f.properties.headline }));
}

export async function weather({ kind, loc, at }, env, fetcher = fetch) {
  const p = await resolvePoint(loc, env, fetcher);
  if (!p) return { error: "not_found" };
  if (kind === "alerts") return { alerts: await alertsAt(p.lat, p.lon, fetcher) };
  const pt = await point(p.lat, p.lon, fetcher);
  if (!pt) return { error: "outside_us", place: {}, forecasts: [], alerts: [] };
  if (kind === "daily") {
    const j = await nws(pt.daily, fetcher);
    const per = (j && j.properties && j.properties.periods) || [];
    const days = [];
    per.forEach(x => {
      const d = x.startTime.slice(0, 10);
      let day = days.find(y => y.date === d);
      if (!day) { day = { date: d, dateTimeISO: x.startTime }; days.push(day); }
      if (x.isDaytime) { day.maxTempF = x.temperature; day.weather = x.shortForecast; }
      else { day.minTempF = x.temperature; if (!day.weather) day.weather = x.shortForecast; }
      const pop = x.probabilityOfPrecipitation && x.probabilityOfPrecipitation.value;
      if (pop != null) day.pop = Math.max(day.pop || 0, pop);
      const w = mph(x.windSpeed); if (w != null) day.windSpeedMaxMPH = Math.max(day.windSpeedMaxMPH || 0, w);
    });
    return { place: pt.place, forecasts: days.slice(0, 7) };
  }
  const j = await nws(pt.hourly, fetcher);
  const per = (j && j.properties && j.properties.periods) || [];
  const hour = x => ({ dateTimeISO: x.startTime, tempF: x.temperature, windSpeedMPH: mph(x.windSpeed), windDir: x.windDirection,
    weather: x.shortForecast, pop: x.probabilityOfPrecipitation ? x.probabilityOfPrecipitation.value : null,
    humidity: x.relativeHumidity ? x.relativeHumidity.value : null, precipMM: null });
  if (kind === "current") {
    const now = per[0] ? hour(per[0]) : {};
    return { place: pt.place, weather: { ...now, feelslikeF: null, visibilityMI: null, windGustMPH: null }, alerts: await alertsAt(p.lat, p.lon, fetcher) };
  }
  // hourly at a given time (or the next hour)
  const t = at ? Date.parse(at) : Date.now();
  const hit = per.find(x => Date.parse(x.startTime) <= t && t < Date.parse(x.endTime)) || (t < Date.parse((per[0] || {}).startTime) ? per[0] : null);
  return { place: pt.place, forecasts: hit ? [hour(hit)] : [] };
}
