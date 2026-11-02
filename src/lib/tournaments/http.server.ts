/* The thin layer between a route's `Request` and the framework-free handlers: reads the body with a
   size cap, finds the client address, calls the handler with the database, and turns the answer back
   into a `Response`. Routes import this lazily so none of it (or `@/lib/db`) reaches the browser bundle. */

import type { Sql } from "@/lib/db";
import { MAX_BODY_BYTES, type ApiReq, type ApiRes } from "./common.server.ts";

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim();
  return (first || request.headers.get("x-real-ip") || "local").slice(0, 64);
}

/** The body as text, or null if it is bigger than `max` bytes (we stop reading as soon as it is). */
export async function readCapped(request: Request, max: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > max) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

export function toResponse(res: ApiRes): Response {
  return new Response(JSON.stringify(res.body), {
    status: res.status,
    headers: { "content-type": "application/json", "cache-control": res.cache ?? "no-store" },
  });
}

const json = (status: number, body: Record<string, unknown>) => toResponse({ status, body });

export type Handler = (sql: Sql, req: ApiReq) => Promise<ApiRes>;

/** Run `handler` for a request. `maxBytes` caps the POST body (413 above it, 400 for bad JSON). */
export async function serve(request: Request, handler: Handler, maxBytes: number = MAX_BODY_BYTES): Promise<Response> {
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
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    return toResponse(await handler(sql, { method, url, body, ip: clientIp(request), now: Date.now() }));
  } catch (err) {
    console.error("[tournaments] request failed:", err);
    return json(500, { error: "server_error" });
  }
}
