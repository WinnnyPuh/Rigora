// Run: node test/worker.test.mjs — routes through the Worker entry with a fake FMCSA.
import assert from "node:assert/strict";
import fs from "node:fs";
import worker from "../src/worker.js";
const t = fs.readFileSync(new URL("./fmcsa.test.mjs", import.meta.url), "utf8");
const block = t.slice(t.indexOf("// --- fixtures"), t.indexOf("// --- United Van Lines"));
const f = new Function(block + ";return {winMotus,winHist,winBoc}")();
const routes = [[/docket-number\/47107690/, { content: [] }], [/inys-ebih\.json\?docket_number=MC47107690/, f.winMotus],
  [/carriers\/7880502/, { content: [] }], [/inys-ebih\.json\?usdot_number=7880502/, f.winMotus],
  [/yu5v-wbh6/, f.winHist], [/6snj-ed7q/, f.winBoc]];
globalThis.fetch = async url => { const h = routes.find(([re]) => re.test(url)); return { ok: !!h, status: h ? 200 : 404, json: async () => h[1] }; };
let assetHits = 0;
const env = { FMCSA_KEY: "k", ASSETS: { fetch: async () => { assetHits++; return new Response("<html>"); } } };
const ctx = { waitUntil() {} };
const r1 = await worker.fetch(new Request("https://x.dev/api/check?q=MC47107690"), env, ctx);
assert.equal(r1.status, 200);
assert.equal((await r1.json()).company.legal_name, "WINNNYPUH LIMITED");
const r2 = await worker.fetch(new Request("https://x.dev/api/check?q=???"), env, ctx);
assert.equal(r2.status, 400);
const r3 = await worker.fetch(new Request("https://x.dev/"), env, ctx);
assert.equal(await r3.text(), "<html>"); assert.equal(assetHits, 1);
const r4 = await worker.fetch(new Request("https://x.dev/api/nope"), env, ctx);
assert.equal(r4.status, 404);
// Pages Function entry still works too
const { onRequestGet } = await import("../functions/api/check.js");
const r5 = await onRequestGet({ request: new Request("https://x.dev/api/check?q=7880502"), env, waitUntil() {} });
assert.equal(r5.status, 200);
console.log("worker tests passed");
