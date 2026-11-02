import { createFileRoute } from "@tanstack/react-router";

/* Signaling relay for the WebRTC room engine (src/lib/multiplayer/p2p.ts).
   Deliberately dumb: it only introduces peers and ferries SDP/ICE envelopes.
   All game data flows browser-to-browser after the handshake.

   Storage is in-memory on this server instance — right for a family-scale
   game on one host. If the deployment ever spreads across instances, the
   same contract backs onto the Neon tables (rooms/signals) with no client
   change; see docs/EXPANSION-DESIGN.md §7. */

type PeerRow = { id: string; name: string; lastSeen: number };
type SignalRow = { id: number; from: string; to: string; kind: string; payload: unknown; at: number };
type RoomState = { peers: Map<string, PeerRow>; signals: SignalRow[]; nextId: number };

const PEER_TTL_MS = 20_000;
const SIGNAL_TTL_MS = 120_000;

const store: Map<string, RoomState> =
  (globalThis as { __facRtcRooms?: Map<string, RoomState> }).__facRtcRooms ??
  ((globalThis as { __facRtcRooms?: Map<string, RoomState> }).__facRtcRooms = new Map());

function roomState(room: string): RoomState {
  let r = store.get(room);
  if (!r) {
    r = { peers: new Map(), signals: [], nextId: 1 };
    store.set(room, r);
  }
  return r;
}

function prune(r: RoomState, now: number) {
  for (const [id, p] of r.peers) if (now - p.lastSeen > PEER_TTL_MS) r.peers.delete(id);
  r.signals = r.signals.filter((s) => now - s.at < SIGNAL_TTL_MS);
  if (r.signals.length > 400) r.signals = r.signals.slice(-400);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/rtc")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const room = (url.searchParams.get("room") || "").slice(0, 64);
        const peer = (url.searchParams.get("peer") || "").slice(0, 64);
        const name = (url.searchParams.get("name") || "").slice(0, 64);
        const since = Number(url.searchParams.get("since") || 0) || 0;
        if (!room || !peer) return json({ error: "room and peer are required" }, 400);
        const now = Date.now();
        const r = roomState(room);
        prune(r, now);
        r.peers.set(peer, { id: peer, name, lastSeen: now });
        const peers = [...r.peers.values()].map((p) => ({ id: p.id, name: p.name }));
        const signals = r.signals
          .filter((s) => s.to === peer && s.id > since)
          .map((s) => ({ id: s.id, from: s.from, kind: s.kind, payload: s.payload }));
        return json({ peers, signals });
      },
      POST: async ({ request }) => {
        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: "invalid json" }, 400);
        }
        const op = body.op;
        const room = typeof body.room === "string" ? body.room.slice(0, 64) : "";
        if (!room) return json({ error: "room is required" }, 400);
        const now = Date.now();
        const r = roomState(room);
        prune(r, now);
        if (op === "leave") {
          const peer = typeof body.peer === "string" ? body.peer : "";
          if (peer) {
            r.peers.delete(peer);
            r.signals = r.signals.filter((s) => s.to !== peer);
          }
          if (r.peers.size === 0) store.delete(room);
          return json({ ok: true });
        }
        if (op === "signal") {
          const from = typeof body.from === "string" ? body.from.slice(0, 64) : "";
          const to = typeof body.to === "string" ? body.to.slice(0, 64) : "";
          const kind = typeof body.kind === "string" ? body.kind : "";
          if (!from || !to || !kind) return json({ error: "from, to and kind are required" }, 400);
          r.signals.push({ id: r.nextId++, from, to, kind, payload: body.payload, at: now });
          return json({ ok: true });
        }
        return json({ error: "unknown op" }, 400);
      },
    },
  },
});
