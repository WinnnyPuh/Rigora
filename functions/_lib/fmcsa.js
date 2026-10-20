// FMCSA company check: merges QCMobile (official API, needs a web key) with
// FMCSA's open Motus datasets on data.transportation.gov (no key needed).
// QCMobile gives insurance amounts, out-of-service rates, crashes and the
// "allowed to operate" flag; Motus covers brand-new registrations that
// QCMobile doesn't know yet, plus per-authority filings, BOC-3 and authority history.

const QC = "https://mobile.fmcsa.dot.gov/qc/services";
const SODA = "https://data.transportation.gov/resource";
const DS = { carrier: "inys-ebih", authhist: "yu5v-wbh6", boc3: "6snj-ed7q" };

export function parseQuery(q) {
  const s = String(q || "").toUpperCase().replace(/\s/g, "");
  const m = s.match(/^(MC|FF|MX)-?(\d{1,8})$/);
  if (m) return { kind: "docket", prefix: m[1], num: m[2], key: m[1] + m[2] };
  const d = s.replace(/^(USDOT|DOT)#?/, "").replace(/\D/g, "");
  if (d && d.length <= 8) return { kind: "dot", dot: d, key: d };
  return null;
}

async function getJSON(url, fetcher, headers = {}) {
  const r = await fetcher(url, { headers: { accept: "application/json", ...headers } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url.replace(/webKey=[^&]+/, "webKey=***")}`);
  return r.json();
}

const yn = v => String(v || "").toUpperCase() === "Y";
const money = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const round1 = v => { const n = parseFloat(v); return isFinite(n) ? Math.round(n * 10) / 10 : 0; };
const ymd8 = s => (s && /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null);
const RATING = { S: "Satisfactory", C: "Conditional", U: "Unsatisfactory" };
const STATUS = { A: "ACTIVE", I: "INACTIVE", P: "PENDING" };
function phone(p) {
  const d = String(p || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : (p || "");
}

export async function fetchSources(q, env, fetcher = fetch) {
  const key = env.FMCSA_KEY;
  const soda = (ds, where) => getJSON(`${SODA}/${ds}.json?${where}&$limit=50`, fetcher,
    env.SOCRATA_TOKEN ? { "X-App-Token": env.SOCRATA_TOKEN } : {}).catch(e => ({ __err: String(e.message || e) }));
  const qc = path => key
    ? getJSON(`${QC}${path}${path.includes("?") ? "&" : "?"}webKey=${encodeURIComponent(key)}`, fetcher).catch(e => ({ __err: String(e.message || e) }))
    : Promise.resolve({ __err: "no FMCSA_KEY" });

  let dot = q.kind === "dot" ? q.dot : null;
  // a docket number: ask both sources which USDOT it belongs to
  if (!dot) {
    const [qcd, mc] = await Promise.all([qc(`/carriers/docket-number/${q.num}`), soda(DS.carrier, `docket_number=${q.key}`)]);
    const fromQc = qcd && Array.isArray(qcd.content) && qcd.content[0] && (qcd.content[0].carrier || qcd.content[0]).dotNumber;
    const fromMotus = Array.isArray(mc) && mc[0] && mc[0].usdot_number;
    dot = String(fromQc || fromMotus || "");
    if (!dot) return { dot: null };
  }
  const [qcCarrier, qcCargo, motusCarrier, motusHist, motusBoc3] = await Promise.all([
    qc(`/carriers/${dot}`),
    qc(`/carriers/${dot}/cargo-carried`),
    soda(DS.carrier, `usdot_number=${dot}`),
    soda(DS.authhist, `usdot_number=${dot}`),
    soda(DS.boc3, `usdot_number=${dot}`),
  ]);
  return { dot, qcCarrier, qcCargo, motusCarrier, motusHist, motusBoc3 };
}

// Build the report object the Rigora UI renders (same shape the prototype used).
export function buildCompany(src, now = new Date()) {
  const { dot } = src;
  const qc = src.qcCarrier && src.qcCarrier.content && (src.qcCarrier.content.carrier || src.qcCarrier.content);
  const qcOk = qc && qc.dotNumber;
  const mc = Array.isArray(src.motusCarrier) ? src.motusCarrier : [];
  const hist = Array.isArray(src.motusHist) ? src.motusHist : [];
  const boc = Array.isArray(src.motusBoc3) ? src.motusBoc3 : [];
  if (!qcOk && !mc.length) return null;

  const first = mc[0] || {};
  const sources = [];
  if (qcOk) sources.push("FMCSA QCMobile");
  if (mc.length) sources.push("FMCSA Motus Carrier");
  if (hist.length) sources.push("FMCSA Motus AuthHist");
  if (boc.length) sources.push("FMCSA Motus BOC3");

  // one row per authority type, from Motus (it has per-authority filings)
  const seen = new Set();
  const auth = mc.filter(r => { const k = r.docket_number + "|" + r.op_auth_type; if (seen.has(k)) return false; seen.add(k); return true; })
    .map(r => ({
      docket: r.docket_number, type: r.op_auth_type, status: r.op_auth_status,
      bipd_req: money(r.min_cov_amount), bipd_file: money(r.bipd_file),
      cargo_req: yn(r.cargo_req), cargo_file: yn(r.cargo_file),
      bond_req: yn(r.bond_req), bond_file: yn(r.bond_file),
    }));
  // QCMobile only: rebuild a coarse authority list from its status letters
  if (!auth.length && qcOk) {
    const st = c => (c === "A" ? "Active" : c === "I" ? "Inactive" : c === "P" ? "Pending" : null);
    const bipdFile = money(qc.bipdInsuranceOnFile) * 1000, bipdReq = money(qc.bipdRequiredAmount) * 1000;
    [["commonAuthorityStatus", "Common carrier"], ["contractAuthorityStatus", "Contract carrier"], ["brokerAuthorityStatus", "Broker"]]
      .forEach(([k, label]) => { const s = st(qc[k]);
        if (s) auth.push({ docket: "", type: label, status: s,
          bipd_req: label === "Broker" ? 0 : bipdReq, bipd_file: bipdFile,
          cargo_req: label !== "Broker" && yn(qc.cargoInsuranceRequired), cargo_file: money(qc.cargoInsuranceOnFile) > 0,
          bond_req: label === "Broker" && yn(qc.bondInsuranceRequired), bond_file: money(qc.bondInsuranceOnFile) > 0 }); });
  }
  // when authority was last granted
  const granted = hist.filter(h => /active/i.test(h.op_auth_status) && /grant/i.test(h.reason || ""))
    .map(h => ymd8(h.status_change_date)).filter(Boolean).sort();
  const dockets = [...new Set(mc.map(r => r.docket_number).filter(Boolean))];

  const cargo = (src.qcCargo && Array.isArray(src.qcCargo.content) ? src.qcCargo.content : [])
    .map(x => x.cargoClassDesc || (x.cargoClass && x.cargoClass.cargoClassDesc)).filter(Boolean);
  const hhg = auth.some(a => /household goods/i.test(a.type));
  if (!cargo.length && hhg) cargo.push("Household Goods");

  const addr = qcOk
    ? [qc.phyStreet, qc.phyCity, [qc.phyState, qc.phyZipcode].filter(Boolean).join(" ")].filter(Boolean).join(", ")
    : [first.bus_street_po, first.bus_city, [first.bus_state_code, first.bus_zip_code].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const insp = qcOk ? {
    veh: { n: +qc.vehicleInsp || 0, oos: +qc.vehicleOosInsp || 0, rate: round1(qc.vehicleOosRate), nat: round1(qc.vehicleOosRateNationalAverage) },
    drv: { n: +qc.driverInsp || 0, oos: +qc.driverOosInsp || 0, rate: round1(qc.driverOosRate), nat: round1(qc.driverOosRateNationalAverage) },
  } : null;

  return {
    dot: String(dot),
    legal_name: (qcOk && qc.legalName) || first.legal_name || "",
    dba: (qcOk && qc.dbaName) || first.dba_name || "",
    entity: qcOk && qc.censusTypeId && qc.censusTypeId.censusTypeDesc
      ? qc.censusTypeId.censusTypeDesc.toLowerCase().replace(/^\w/, c => c.toUpperCase())
      : (auth.some(a => /broker/i.test(a.type)) ? "Broker" : "Carrier"),
    usdot_status: qcOk ? (STATUS[qc.statusCode] || qc.statusCode || "") : (auth.some(a => /active/i.test(a.status)) ? "ACTIVE" : ""),
    allowed_to_operate: qcOk ? yn(qc.allowedToOperate) : null,
    oos_date: qcOk ? (qc.oosDate || null) : null,
    dockets,
    phone: phone(first.bus_telno),
    address: addr,
    auth,
    auth_since: granted.length ? granted[granted.length - 1] : null,
    boc3: boc[0] ? { agent: boc[0].co_name, city: boc[0].city, state: boc[0].state_code } : null,
    cargo,
    power_units: qcOk ? +qc.totalPowerUnits || 0 : null,
    drivers: qcOk ? +qc.totalDrivers || 0 : null,
    mcs150: null,
    mcs150_outdated: qcOk ? yn(qc.mcs150Outdated) : null,
    safety: { rating: qcOk ? (RATING[qc.safetyRating] || "None") : "None", date: qcOk ? qc.safetyRatingDate || null : null },
    insp,
    crashes: qcOk ? { fatal: +qc.fatalCrash || 0, injury: +qc.injCrash || 0, tow: +qc.towawayCrash || 0, total: +qc.crashTotal || 0 } : null,
    checked_at: now.toISOString(),
    sources,
    partial: !qcOk ? "qcmobile" : (!mc.length ? "motus" : null),
  };
}

export async function checkCompany(q, env, fetcher = fetch) {
  const pq = typeof q === "string" ? parseQuery(q) : q;
  if (!pq) return { error: "bad_query" };
  const src = await fetchSources(pq, env, fetcher);
  if (!src.dot) return { error: "not_found", query: pq.key };
  const company = buildCompany(src);
  if (!company) return { error: "not_found", query: pq.key };
  return { company };
}
