// Run: node test/fmcsa.test.mjs
// Uses real responses captured from FMCSA on Oct 19-20, 2026 (no network needed).
import assert from "node:assert/strict";
import { parseQuery, buildCompany, checkCompany } from "../functions/_lib/fmcsa.js";

// --- parseQuery
assert.deepEqual(parseQuery("77949"), { kind: "dot", dot: "77949", key: "77949" });
assert.deepEqual(parseQuery("USDOT 77949"), { kind: "dot", dot: "77949", key: "77949" });
assert.equal(parseQuery("mc-67234").key, "MC67234");
assert.equal(parseQuery("MC 47107690").num, "47107690");
assert.equal(parseQuery("hello"), null);

// --- fixtures
const uvlQc = { content: { carrier: {
  allowedToOperate: "Y", bipdInsuranceOnFile: "1000", bipdInsuranceRequired: "Y", bipdRequiredAmount: "1000",
  bondInsuranceOnFile: "75", bondInsuranceRequired: "Y", brokerAuthorityStatus: "A", cargoInsuranceOnFile: "5",
  cargoInsuranceRequired: "Y", censusTypeId: { censusType: "C", censusTypeDesc: "CARRIER", censusTypeId: 1 },
  commonAuthorityStatus: "A", contractAuthorityStatus: "A", crashTotal: 70, dbaName: "UNITED VAN LINES", dotNumber: 77949,
  driverInsp: 2105, driverOosInsp: 72, driverOosRate: 3.42042755, driverOosRateNationalAverage: "5.51", fatalCrash: 1,
  injCrash: 29, legalName: "UNITED VAN LINES LLC", mcs150Outdated: "N", oosDate: null, phyCity: "SAINT LOUIS",
  phyState: "MO", phyStreet: "1245 JJ KELLEY MEMORIAL DR STE 200", phyZipcode: "63131-3668", safetyRating: "S",
  safetyRatingDate: "2023-02-16", statusCode: "A", totalDrivers: 3424, totalPowerUnits: 4731, towawayCrash: 40,
  vehicleInsp: 1100, vehicleOosInsp: 263, vehicleOosRate: 23.909090909, vehicleOosRateNationalAverage: "20.72" } } };
const row = (docket, type, min, cr, br, bipd, cf, bf) => ({ docket_number: docket, usdot_number: "77949", op_auth_type: type,
  op_auth_status: "Active", min_cov_amount: String(min), cargo_req: cr, bond_req: br, bipd_file: String(bipd), cargo_file: cf, bond_file: bf,
  legal_name: "UNITED VAN LINES LLC", dba_name: "UNITED VAN LINES", bus_street_po: "1245 JJ Kelley Memorial Dr Ste 200",
  bus_city: "Saint Louis", bus_state_code: "MO", bus_zip_code: "63131-3668", bus_telno: "6363055000" });
const uvlMotus = [
  row("MC67234", "Broker of Household Goods", 0, "N", "Y", 1000000, "N", "Y"),
  row("FF9300", "Freight Forwarder of Household Goods", 0, "Y", "Y", 1000000, "Y", "Y"),
  row("MC67234", "Motor Carrier of Property (Except Household Goods)", 1000000, "N", "N", 1000000, "N", "N"),
  row("MC67234", "Motor Carrier of Household Goods", 750000, "Y", "N", 1000000, "Y", "N"),
];
const uvlBoc = [{ docket_number: "MC67234", usdot_number: "77949", co_name: "American Trucking Associations", city: "WASHINGTON", state_code: "DC" },
                { docket_number: "MC67234", usdot_number: "77949", co_name: "American Trucking Associations", city: "WASHINGTON", state_code: "DC" }];

const winQc = { content: [] };
const winMotus = [{ docket_number: "MC47107690", usdot_number: "7880502", op_auth_type: "Motor Carrier of Household Goods", op_auth_status: "Active",
  min_cov_amount: "750000.000000000000000000", cargo_req: "Y", bond_req: "N", bipd_file: "750000.000000000000000000", cargo_file: "Y", bond_file: "N",
  legal_name: "WINNNYPUH LIMITED", bus_street_po: "12762 Randles Ave", bus_city: "Parker", bus_state_code: "CO", bus_zip_code: "80134-6722", bus_telno: "+1 (606) 499-9666" }];
const winHist = [
  { docket_number: "MC47107690", usdot_number: "7880502", op_auth_type: "Motor Carrier of Household Goods", op_auth_status: "Active", reason: "Granted", status_change_date: "20261016" },
  { docket_number: "MC47107690", usdot_number: "7880502", op_auth_type: "Motor Carrier of Household Goods", op_auth_status: "Pending", reason: "Initial Status", status_change_date: "20260825" }];
const winBoc = [{ docket_number: "MC47107690", usdot_number: "7880502", co_name: "#1A BOC-3 Filing, Inc.", city: "Burbank", state_code: "CA" }];

// --- United Van Lines: both sources
const uvl = buildCompany({ dot: "77949", qcCarrier: uvlQc, qcCargo: null, motusCarrier: uvlMotus, motusHist: [], motusBoc3: uvlBoc });
assert.equal(uvl.legal_name, "UNITED VAN LINES LLC");
assert.equal(uvl.usdot_status, "ACTIVE");
assert.equal(uvl.allowed_to_operate, true);
assert.equal(uvl.auth.length, 4);
assert.deepEqual(uvl.dockets, ["MC67234", "FF9300"]);
assert.equal(uvl.auth.find(a => a.type === "Motor Carrier of Household Goods").bipd_req, 750000);
assert.equal(uvl.boc3.agent, "American Trucking Associations");
assert.equal(uvl.safety.rating, "Satisfactory");
assert.deepEqual(uvl.insp.veh, { n: 1100, oos: 263, rate: 23.9, nat: 20.7 });
assert.equal(uvl.crashes.total, 70);
assert.equal(uvl.mcs150_outdated, false);
assert.equal(uvl.phone, "(636) 305-5000");
assert.equal(uvl.entity, "Carrier");
assert.ok(uvl.cargo.includes("Household Goods"));
assert.equal(uvl.partial, null);

// --- new carrier QCMobile doesn't know yet: Motus only
const win = buildCompany({ dot: "7880502", qcCarrier: winQc, qcCargo: winQc, motusCarrier: winMotus, motusHist: winHist, motusBoc3: winBoc });
assert.equal(win.legal_name, "WINNNYPUH LIMITED");
assert.equal(win.usdot_status, "ACTIVE");
assert.equal(win.auth_since, "2026-10-16");
assert.equal(win.auth[0].bipd_file, 750000);
assert.equal(win.boc3.agent, "#1A BOC-3 Filing, Inc.");
assert.equal(win.phone, "(606) 499-9666");
assert.equal(win.insp, null);
assert.equal(win.partial, "qcmobile");
assert.deepEqual(win.cargo, ["Household Goods"]);

// --- QCMobile only (Motus has no rows): authority rebuilt from status letters, amounts in thousands
const qcOnly = buildCompany({ dot: "77949", qcCarrier: uvlQc, qcCargo: null, motusCarrier: [], motusHist: [], motusBoc3: [] });
assert.equal(qcOnly.auth.length, 3);
assert.equal(qcOnly.auth[0].bipd_file, 1000000);
assert.equal(qcOnly.auth.find(a => a.type === "Broker").bond_file, true);
assert.equal(qcOnly.partial, "motus");

// --- nothing anywhere
assert.equal(buildCompany({ dot: "1", qcCarrier: { content: [] }, motusCarrier: [], motusHist: [], motusBoc3: [] }), null);

// --- end to end with a fake fetch, looked up by MC number
const routes = [
  [/docket-number\/47107690/, { content: [] }],
  [/inys-ebih\.json\?docket_number=MC47107690/, winMotus],
  [/qc\/services\/carriers\/7880502\/cargo-carried/, { content: [] }],
  [/qc\/services\/carriers\/7880502\?/, { content: [] }],
  [/inys-ebih\.json\?usdot_number=7880502/, winMotus],
  [/yu5v-wbh6\.json\?usdot_number=7880502/, winHist],
  [/6snj-ed7q\.json\?usdot_number=7880502/, winBoc],
];
const seenUrls = [];
const fakeFetch = async url => { seenUrls.push(url); const hit = routes.find(([re]) => re.test(url));
  return { ok: !!hit, status: hit ? 200 : 404, json: async () => hit[1] }; };
const out = await checkCompany("MC-47107690", { FMCSA_KEY: "test" }, fakeFetch);
assert.equal(out.company.dot, "7880502");
assert.equal(out.company.auth_since, "2026-10-16");
assert.ok(seenUrls.every(u => !u.includes("qc/services") || u.includes("webKey=test")));
const nf = await checkCompany("999999", { FMCSA_KEY: "test" }, async () => ({ ok: false, status: 404 }));
assert.equal(nf.error, "not_found");
assert.equal((await checkCompany("nope", {}, fakeFetch)).error, "bad_query");

console.log("all fmcsa tests passed");
