// Cloudflare Pages Function wrapper for /api/tile/* (the Worker entry uses the same router).
import { api } from "../_lib/api.js";
export function onRequest({ request, env, waitUntil }) { return api(request, env, waitUntil); }
