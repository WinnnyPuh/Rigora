// Cloudflare Worker entry: /api/* runs here, everything else is served from ./public.
import { handleCheck, json } from "../functions/_lib/handler.js";
import { api } from "../functions/_lib/api.js";

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/check") {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
      return handleCheck(request, env, p => ctx.waitUntil(p));
    }
    if (pathname.startsWith("/api/")) return api(request, env, p => ctx.waitUntil(p));
    return env.ASSETS.fetch(request);
  },
};
