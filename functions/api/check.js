// Cloudflare Pages Function: GET /api/check?q=77949  or  ?q=MC67234
import { handleCheck } from "../_lib/handler.js";

export function onRequestGet({ request, env, waitUntil }) {
  return handleCheck(request, env, waitUntil);
}
