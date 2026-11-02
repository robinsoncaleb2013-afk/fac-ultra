import { useCallback, useEffect, useState } from "react";
import { joinEventRoom, leaveEventRoom, sendEmote, useEventRoom } from "@/game/eventroom";
import { useGame } from "@/game/engine";
import { canEmote, EMOTES } from "@/game/social";
import { api, playerId, playerName, type FriendInfo } from "@/game/tourney";
import { Button } from "@/components/ui/button";
import { useTick } from "@/components/game/use-tick";
import { cn } from "@/lib/cn";

/* The friendly layer over an event (docs/architecture/06 §3.3): the P2P room, the eight emotes, the live
   catch feed and inviting a friend. Nothing here touches a score. */

/** Keeps you in the event's room while you are on the water, and out of it otherwise. */
export function EventRoomLink() {
  const eventId = useGame((s) => (s.mode === "tournament" && s.screen === "game" ? (s.tourney?.event.id ?? "") : ""));
  useEffect(() => {
    if (!eventId) return;
    void joinEventRoom(eventId, playerName() || "Angler");
    return () => leaveEventRoom();
  }, [eventId]);
  return null;
}

/** Eight presets in a row, above the cast button during an event (09 §7). No typing. */
export function EmoteBar({ className }: { className?: string }) {
  const active = useGame((s) => s.mode === "tournament" && !!s.tourney);
  const status = useEventRoom((s) => s.status);
  const lastSent = useEventRoom((s) => s.lastSent);
  useTick(400);
  if (!active) return null;
  const cooling = !canEmote(lastSent, Date.now());
  const ready = status === "on" && !cooling;
  return (
    <div
      data-testid="emote-bar"
      role="group"
      aria-label="Send an emote"
      className={cn("mb-2 flex w-max max-w-[calc(100vw-2rem)] gap-1 self-center overflow-x-auto [scrollbar-width:none]", className)}
    >
      {EMOTES.map((e) => (
        <button
          key={e.id}
          type="button"
          disabled={!ready}
          title={e.text}
          aria-label={e.text}
          onPointerDown={(ev) => ev.stopPropagation()}
          onClick={() => sendEmote(e.id)}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-bg/70 text-xl backdrop-blur-sm transition-opacity enabled:hover:border-brass disabled:opacity-40"
        >
          <span aria-hidden>{e.glyph}</span>
        </button>
      ))}
    </div>
  );
}

/** Who is in the room, the live feed, and (for private events) the code to share. */
export function RoomSection() {
  const run = useGame((s) => s.tourney);
  const status = useEventRoom((s) => s.status);
  const peers = useEventRoom((s) => s.peers);
  const others = useEventRoom((s) => s.others);
  const cap = useEventRoom((s) => s.cap);
  const feed = useEventRoom((s) => s.feed);
  if (!run) return null;
  const linked = peers.filter((p) => p.connectionState === "connected").length;
  const code = run.event.kind === "private" ? run.event.id.slice(2) : null;
  return (
    <section className="rounded-2xl border border-line bg-surface p-3" aria-label="Friends on the water" data-testid="room-section">
      <h3 className="font-serif text-lg">On the water with you</h3>
      <p className="text-sm text-muted" role="status">
        {status === "joining"
          ? "Joining the room…"
          : status === "off"
            ? "The room isn't open right now. The board still works."
            : others === 0
              ? "Nobody else is in the room yet."
              : `${linked} of ${others} ${others === 1 ? "angler" : "anglers"} connected. Boats and emotes show for up to ${cap} on this device.`}
      </p>
      {code ? (
        <p className="mt-1 text-sm">
          Event code <span className="font-serif text-lg tracking-widest text-brass">{code}</span>
          <span className="text-muted"> · tell your friends</span>
        </p>
      ) : null}
      {feed.length ? (
        <ul className="mt-2 flex flex-col gap-0.5 text-sm" aria-label="What's happening" aria-live="polite" data-testid="room-feed">
          {feed.slice(-5).map((f) => (
            <li key={f.id} className="truncate text-muted">
              {f.text}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Ask a friend to join the event you are in. */
export function InviteSection() {
  const run = useGame((s) => s.tourney);
  const [friends, setFriends] = useState<FriendInfo[] | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const eventId = run?.event.id;
  const load = useCallback(async () => {
    try {
      const { status, body } = await api.friends(playerId());
      if (status === 200) setFriends(body.friends);
    } catch {
      /* offline */
    }
  }, []);
  useEffect(() => {
    if (!eventId) return;
    void load();
    const t = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(t);
  }, [eventId, load]);
  if (!run || !friends || friends.length === 0) return null;
  const invite = async (code: string) => {
    setNote("");
    try {
      const { status } = await api.friendOp("invite", playerId(), { code, eventId: run.event.id });
      if (status === 200) setSent((s) => [...s, code]);
      else setNote("Couldn't send that invite. Try again in a moment.");
    } catch {
      setNote("Couldn't send that invite. Check your connection.");
    }
  };
  return (
    <section className="rounded-2xl border border-line bg-surface p-3" aria-label="Invite a friend" data-testid="invite-section">
      <h3 className="font-serif text-lg">Invite a friend</h3>
      <ul className="mt-1 flex flex-col">
        {friends.map((f) => (
          <li key={f.code} className="flex items-center justify-between gap-2 border-t border-line py-1.5 first:border-0">
            <span className="min-w-0 truncate text-sm">
              <span className={cn("mr-1.5 inline-block size-2 rounded-full", f.online ? "bg-lagoon" : "bg-line")} aria-label={f.online ? "here now" : "away"} />
              {f.name}
            </span>
            <Button variant="ghost" className="min-h-11 px-3 py-1 text-sm" disabled={sent.includes(f.code)} onClick={() => invite(f.code)}>
              {sent.includes(f.code) ? "Asked" : "Invite"}
            </Button>
          </li>
        ))}
      </ul>
      {note ? <p className="mt-1 text-xs text-[#e4572e]">{note}</p> : null}
    </section>
  );
}
