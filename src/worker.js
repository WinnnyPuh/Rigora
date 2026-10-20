// Cloudflare Worker entry: serves /api/* from code and everything else from ./public.
import { handleCheck, json } from "../functions/_lib/handler.js";

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/check") {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
      return handleCheck(request, env, p => ctx.waitUntil(p));
    }
    if (pathname.startsWith("/api/")) return json({ error: "not_found" }, 404);
    return env.ASSETS.fetch(request);
  },
};
