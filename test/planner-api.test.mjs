// Run: node test/planner-api.test.mjs — server endpoints with fake TomTom / NWS / atlas responses.
import assert from "node:assert/strict";
import { decodeStates, stateAt, spansFor } from "../functions/_lib/states.js";
import { search, route, along, traffic, routeQuery } from "../functions/_lib/tomtom.js";
import { weather } from "../functions/_lib/nws.js";
import { api, tile } from "../functions/_lib/api.js";

// --- synthetic TopoJSON: CO = x0..10, KS = x10..20 (y 0..10), sharing arc 1, quantized + delta-encoded
const topo = { type: "Topology", transform: { scale: [1, 1], translate: [0, 0] },
  arcs: [ [[10, 10], [-10, 0], [0, -10], [10, 0]],   // arc0: (10,10)->(0,10)->(0,0)->(10,0)
          [[10, 10], [0, -10]],                        // arc1: (10,10)->(10,0)
          [[10, 0], [10, 0], [0, 10], [-10, 0]] ],     // arc2: (10,0)->(20,0)->(20,10)->(10,10)
  objects: { states: { type: "GeometryCollection", geometries: [
    { type: "Polygon", id: "08", arcs: [[0, -2]], properties: { name: "Colorado" } },
    { type: "MultiPolygon", id: "20", arcs: [[[2, 1]]], properties: { name: "Kansas" } } ] } } };
const S = decodeStates(topo);
assert.deepEqual(S.map(s => s.st), ["CO", "KS"]);
assert.deepEqual(S[0].polys[0][0], [[10, 10], [0, 10], [0, 0], [10, 0], [10, 10]]);
assert.equal(stateAt(S, 5, 5), "CO");
assert.equal(stateAt(S, 15, 5), "KS");
assert.equal(stateAt(S, 25, 5), null);
const line = []; for (let x = 2; x <= 18.001; x += 0.5) line.push([+x.toFixed(2), 5]);
const sp = spansFor(S, line);
assert.equal(sp.length, 2);
assert.equal(sp[0].st, "CO"); assert.equal(sp[1].st, "KS");
assert.equal(line[sp[0].i1][0] >= 10, true);
assert.equal(sp[1].i1, line.length - 1);
// a point in the water between states keeps the previous state
const gap = [[5, 5], [9, 5], [30, 5], [15, 5], [16, 5]];
assert.deepEqual(spansFor(S, gap, 1).map(s => s.st), ["CO", "KS"]);

// --- fake upstream
const env = { TOMTOM_KEY: "tt" };
const calls = [];
const respond = body => ({ ok: true, status: 200, json: async () => body });
const fake = async (url, init) => {
  calls.push({ url, init });
  if (url.includes("us-atlas")) return respond(topo);
  if (url.includes("/search/2/search/")) return respond({ results: [{ type: "Geography", position: { lat: 39.5186, lon: -104.7614 }, address: { freeformAddress: "Parker, CO", municipality: "Parker", countrySubdivision: "CO" } }] });
  if (url.includes("/routing/1/calculateRoute/")) return respond({ routes: [
    { summary: { lengthInMeters: 1000, travelTimeInSeconds: 60 }, legs: [{ summary: { lengthInMeters: 1000 }, points: line.map(([lon, lat]) => ({ latitude: lat, longitude: lon })) }],
      sections: [{ sectionType: "TRAVEL_MODE" }, { sectionType: "TOLL_ROAD", startPointIndex: 3, endPointIndex: 9 }, { sectionType: "TOLL", startPointIndex: 3, endPointIndex: 9 }] },
    { summary: { lengthInMeters: 1200, travelTimeInSeconds: 70 }, legs: [{ summary: {}, points: [{ latitude: 5, longitude: 2 }, { latitude: 5, longitude: 18 }] }], sections: [] } ] });
  if (url.includes("/searchAlongRoute/")) return respond({ results: [
    { id: "a", position: { lat: 5, lon: 6 }, address: { freeformAddress: "I-70, Limon, CO" }, poi: { name: "Limon Port of Entry", classifications: [{ code: "WEIGH_STATION" }] } },
    { id: "b", position: { lat: 5, lon: 7 }, address: {}, poi: { name: "Burger place", classifications: [{ code: "RESTAURANT" }] } } ] });
  if (url.includes("/traffic/services/5/incidentDetails")) return respond({ incidents: [
    { type: "Feature", geometry: { type: "LineString", coordinates: [[6, 5], [7, 5]] }, properties: { iconCategory: 1, magnitudeOfDelay: 3, from: "Exit 1", to: "Exit 2", length: 900, delay: 600, roadNumbers: ["I-70"], events: [{ description: "Accident" }] } } ] });
  if (url.includes("api.weather.gov/points/")) return respond({ properties: { forecastHourly: "https://api.weather.gov/gridpoints/BOU/1,1/forecast/hourly", forecast: "https://api.weather.gov/gridpoints/BOU/1,1/forecast", relativeLocation: { properties: { city: "Parker", state: "CO" } } } });
  if (url.includes("/forecast/hourly")) return respond({ properties: { periods: [
    { startTime: "2026-10-20T10:00:00-06:00", endTime: "2026-10-20T11:00:00-06:00", temperature: 41, windSpeed: "10 to 15 mph", windDirection: "NW", shortForecast: "Light Snow", probabilityOfPrecipitation: { value: 70 }, relativeHumidity: { value: 80 } },
    { startTime: "2026-10-20T11:00:00-06:00", endTime: "2026-10-20T12:00:00-06:00", temperature: 43, windSpeed: "5 mph", windDirection: "N", shortForecast: "Cloudy", probabilityOfPrecipitation: { value: 20 } } ] } });
  if (url.includes("/forecast")) return respond({ properties: { periods: [
    { startTime: "2026-10-20T06:00:00-06:00", isDaytime: true, temperature: 55, shortForecast: "Sunny", windSpeed: "5 to 10 mph", probabilityOfPrecipitation: { value: 0 } },
    { startTime: "2026-10-20T18:00:00-06:00", isDaytime: false, temperature: 30, shortForecast: "Clear", windSpeed: "5 mph", probabilityOfPrecipitation: { value: 10 } },
    { startTime: "2026-10-21T06:00:00-06:00", isDaytime: true, temperature: 60, shortForecast: "Windy", windSpeed: "20 to 35 mph", probabilityOfPrecipitation: { value: null } } ] } });
  if (url.includes("/alerts/active")) return respond({ features: [{ properties: { event: "Winter Weather Advisory", severity: "Moderate", headline: "x" } }] });
  return { ok: false, status: 404, json: async () => ({}) };
};

// search
const s = await search({ q: "Parker" }, env, fake);
assert.deepEqual(s.features[0].geometry.coordinates, [-104.7614, 39.5186]);
assert.equal(s.features[0].properties.address.countrySubdivision, "CO");
assert.ok(calls.at(-1).url.includes("key=tt") && calls.at(-1).url.includes("countrySet=US%2CCA%2CMX"));

// route: truck params, alternatives, toll sections, state spans
const q = routeQuery({ vehicleWeight: 36287, vehicleHeight: 4.11, vehicleLength: 21.9, vehicleMaxSpeed: 105, avoid: ["tollRoads"], maxAlternatives: 2 });
assert.equal(q.get("travelMode"), "truck"); assert.equal(q.get("vehicleHeight"), "4.11"); assert.equal(q.get("avoid"), "tollRoads");
assert.deepEqual(q.getAll("sectionType"), ["toll", "tollRoad"]);
const rt = await route({ locations: [[2, 5], [18, 5]], vehicleWeight: 36287, maxAlternatives: 2 }, env, fake);
assert.equal(rt.features.length, 2);
assert.equal(rt.features[0].geometry.coordinates.length, line.length);
assert.deepEqual(rt.features[0].properties.sections.toll, [{ startPointIndex: 3, endPointIndex: 9 }]);
assert.deepEqual(rt.features[0].properties.stateSpans.map(x => x.st), ["CO", "KS"]);
assert.ok(calls.find(c => c.url.includes("calculateRoute/5.000000,2.000000:5.000000,18.000000/json")));

// along: only the requested POI type, posted as route points
const al = await along({ points: line, query: "weigh station", code: "WEIGH_STATION" }, env, fake);
assert.equal(al.pois.features.length, 1);
assert.equal(al.pois.features[0].properties.poi.name, "Limon Port of Entry");
assert.equal(JSON.parse(calls.findLast(c => c.url.includes("searchAlongRoute")).init.body).route.points[0].lat, 5);

// traffic
const tr = await traffic({ bbox: "1,1,9,9" }, env, fake);
assert.deepEqual(tr.incidents[0], { category: "accident", magnitudeOfDelay: "major", from: "Exit 1", to: "Exit 2", lengthInMeters: 900, delayInSeconds: 600, roadNumbers: ["I-70"], events: ["Accident"] });
assert.equal(tr.geometry.features[0].properties.incident, 0);

// weather
const cur = await weather({ kind: "current", loc: "39.5186,-104.7614" }, env, fake);
assert.equal(cur.weather.tempF, 41); assert.equal(cur.weather.windSpeedMPH, 15); assert.equal(cur.place.city, "Parker");
assert.equal(cur.alerts[0].name, "Winter Weather Advisory");
const day = await weather({ kind: "daily", loc: "Parker, CO" }, env, fake);
assert.equal(day.forecasts.length, 2);
assert.deepEqual([day.forecasts[0].maxTempF, day.forecasts[0].minTempF, day.forecasts[1].windSpeedMaxMPH], [55, 30, 35]);
const hr = await weather({ kind: "hourly", loc: "39.5,-104.7", at: "2026-10-20T17:30:00Z" }, env, fake);
assert.equal(hr.forecasts[0].weather, "Cloudy");
const al2 = await weather({ kind: "alerts", loc: "39.5,-104.7" }, env, fake);
assert.equal(al2.alerts.length, 1);

// router errors
globalThis.fetch = fake;
const bad = await api(new Request("https://x/api/route", { method: "POST", body: "{}" }), env);
assert.equal(bad.status, 400);
const nokey = await api(new Request("https://x/api/search?q=a"), {});
assert.equal(nokey.status, 502);
const ok = await api(new Request("https://x/api/search?q=Parker"), env);
assert.equal(ok.status, 200);
// map tiles through our server
const tcalls = [];
const tfake = async (url) => { tcalls.push(url); return { ok: true, status: 200, body: "PNG" }; };
let tr1 = await tile("tile/basic/5/9/12", env, () => {}, tfake);
assert.equal(tr1.status, 200); assert.equal(tr1.headers.get("content-type"), "image/png");
assert.ok(tcalls[0].startsWith("https://api.tomtom.com/map/1/tile/basic/main/5/9/12.png?key=tt"));
tr1 = await tile("tile/sat/4/3/5", env, () => {}, tfake);
assert.equal(tr1.headers.get("content-type"), "image/jpeg"); assert.ok(tcalls[1].includes("/sat/main/4/3/5.jpg"));
assert.equal((await tile("tile/sat/20/1/1", env, () => {}, tfake)).status, 400);
assert.equal((await tile("tile/basic/2/9/1", env, () => {}, tfake)).status, 400);
assert.equal((await tile("tile/evil/2/1/1", env, () => {}, tfake)).status, 400);
assert.equal((await tile("tile/basic/2/1/1", {}, () => {}, tfake)).status, 502);
console.log("planner api tests passed");
