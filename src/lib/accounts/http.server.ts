/* Turns a route's `Request` into an `AccReq` and an `AccRes` back into a `Response` (cookies and redirects
   included). Routes import this lazily so none of it reaches the browser bundle. */

import { readCapped } from "@/lib/tournaments/http.server";
import { clientIp } from "@/lib/tournaments/http.server";
import type { Sql } from "@/lib/db";
import { MAX_SAVE_BYTES } from "@/game/cloud";
import { MAX_BODY, parseCookies, type AccReq, type AccRes, type Deps } from "./common.server.ts";
import { senderFromEnv } from "./mail.server.ts";

export function realDeps(): Deps {
  return { send: senderFromEnv(process.env), fetch: globalThis.fetch, env: process.env };
}

/** The site's own address, as the browser used it. `FAC_PUBLIC_URL` wins when set (the safest choice). */
export function baseOf(request: Request, env: Deps["env"]): string {
  const fixed = env.FAC_PUBLIC_URL?.trim();
  if (fixed) return fixed.replace(/\/$/, "");
  const url = new URL(request.url);
  const proto = (request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || url.protocol.replace(":", "")).toLowerCase();
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host") || url.host;
  return `${proto === "https" ? "https" : "http"}://${host}`;
}

export function toResponse(res: AccRes): Response {
  const headers = new Headers({ "cache-control": res.cache ?? "no-store" });
  for (const c of res.setCookies ?? []) headers.append("set-cookie", c);
  if (res.redirect) {
    headers.set("location", res.redirect);
    return new Response(null, { status: res.status, headers });
  }
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(res.body), { status: res.status, headers });
}

export type AccHandler = (sql: Sql, req: AccReq, deps: Deps) => Promise<AccRes>;

export async function serveAccount(request: Request, handler: AccHandler, maxBytes: number = MAX_BODY): Promise<Response> {
  const json = (status: number, body: Record<string, unknown>) => toResponse({ status, body });
  try {
    const url = new URL(request.url);
    const method = request.method === "POST" ? "POST" : request.method === "GET" ? "GET" : null;
    if (!method) return json(405, { error: "method_not_allowed" });
    let body: unknown;
    if (method === "POST") {
      const text = await readCapped(request, maxBytes);
      if (text === null) return json(413, { error: "body_too_large", max: maxBytes });
      try {
        body = text ? JSON.parse(text) : undefined;
      } catch {
        return json(400, { error: "invalid json" });
      }
    }
    const deps = realDeps();
    const base = baseOf(request, deps.env);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const req: AccReq = {
      method,
      url,
      body,
      ip: clientIp(request),
      now: Date.now(),
      cookies: parseCookies(request.headers.get("cookie")),
      origin: request.headers.get("origin"),
      base,
      secure: base.startsWith("https://"),
    };
    return toResponse(await handler(sql, req, deps));
  } catch (err) {
    console.error("[accounts] request failed:", err);
    return json(500, { error: "server_error" });
  }
}

export const SAVE_BODY_MAX = MAX_SAVE_BYTES + 4096;
