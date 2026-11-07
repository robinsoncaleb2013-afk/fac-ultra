import { useEffect, useRef, useState } from "react";
import { FIGHT_STEP } from "@/game/fight";
import { FIGHT_FISH, type RoomView } from "@/game/fightroom";
import { joinFightQueue, leaveFightQueue, myFightId, readyFight, sendFightChat, tickFight, useFightRoomLive } from "@/game/fightroom-live";
import { playerName } from "@/game/tourney";
import { Button } from "@/components/ui/button";
import { useKidOn } from "@/components/game/use-kid";
import { cn } from "@/lib/cn";

/* Fish-fight rooms (Update Three, P6): the queue, the tank and the chat, as one
   section for the Players hub tab. All the rules live in src/game/fightroom.ts;
   this file only reads the live store and calls its actions.

   HARD RULE: the whole section is hidden in Kids Mode — it returns null before
   it renders anything, and if Kids Mode is switched on while you are queued or
   in a room, it takes you out of both. */

const ZONE_BAR: Record<string, string> = { slack: "bg-line", green: "bg-lagoon", high: "bg-brass", red: "bg-[#e4572e]" };

export function FightRoomSection() {
  const kidOn = useKidOn();
  const status = useFightRoomLive((s) => s.status);
  const queued = useFightRoomLive((s) => s.queued);
  const waiting = useFightRoomLive((s) => s.waiting);
  const view = useFightRoomLive((s) => s.view);
  const problem = useFightRoomLive((s) => s.problem);
  const [fishId, setFishId] = useState("perch");
  const heldRef = useRef(false);

  /* Kids Mode switched on mid-visit: out of the queue and out of any room. */
  useEffect(() => {
    if (kidOn) leaveFightQueue();
  }, [kidOn]);

  /* While the fight runs, step your fish on fight.ts's own fixed step. */
  const fighting = view?.phase === "fighting";
  const roomId = view?.id;
  useEffect(() => {
    if (!fighting) return;
    const t = window.setInterval(() => tickFight(heldRef.current), FIGHT_STEP * 1000);
    return () => window.clearInterval(t);
  }, [fighting, roomId]);

  if (kidOn) return null;

  const me = view?.players.find((p) => p.id === myFightId());
  const other = view?.players.find((p) => p.id !== myFightId());

  return (
    <div data-testid="fight-room">
      <p className="text-sm text-muted">
        Queue up, get matched with another real angler, and race to land your fish in the tank. First fish landed wins. You can chat in the room — keep it friendly.
      </p>
      {problem ? (
        <p className="mt-2 text-sm text-[#ff8f6b]" role="alert">
          {problem}
        </p>
      ) : null}

      {status === "off" ? (
        <div className="mt-3">
          <h3 className="font-serif text-lg">Pick your fish</h3>
          <div className="mt-2 flex flex-col gap-2" role="group" aria-label="Pick your fish">
            {FIGHT_FISH.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={fishId === f.id}
                onClick={() => setFishId(f.id)}
                className={cn("min-h-11 rounded-2xl border px-3 py-2 text-left", fishId === f.id ? "border-brass bg-brass/10" : "border-line bg-surface-2")}
              >
                <span className="block font-serif text-base">{f.name}</span>
                <span className="block text-sm text-muted">{f.blurb}</span>
              </button>
            ))}
          </div>
          <Button className="mt-3 min-h-11 px-4 py-2" onClick={() => void joinFightQueue(playerName() || "Angler", fishId)}>
            Join the queue
          </Button>
        </div>
      ) : null}

      {status !== "off" && !view ? (
        <div className="mt-3">
          <p className="text-sm" role="status">
            {status === "joining" ? "Joining the queue…" : queued ? `Looking for another angler… ${waiting > 1 ? `${waiting} in the queue.` : ""}` : "Joining the queue…"}
          </p>
          <Button variant="quiet" className="mt-2 min-h-11 px-3 py-2 text-sm" onClick={() => leaveFightQueue()}>
            Leave the queue
          </Button>
        </div>
      ) : null}

      {view ? (
        <div className="mt-3 flex flex-col gap-3">
          {view.phase === "waiting" ? (
            <div>
              <p className="font-serif text-lg">You are matched with {other?.name ?? "another angler"}.</p>
              <p className="text-sm text-muted">When you are both ready, the fight starts. Same kind of fish, same luck — the seed is shared, so it is fair.</p>
              <p className="mt-1 text-sm text-muted" role="status">
                {view.players.map((p) => `${p.name}: ${p.ready ? "ready" : "not ready yet"}`).join(" · ")}
              </p>
              <Button className="mt-2 min-h-11 px-4 py-2" disabled={!!me?.ready} onClick={() => readyFight()}>
                {me?.ready ? "Ready — waiting for them" : "I am ready"}
              </Button>
            </div>
          ) : null}

          {view.phase === "fighting" || view.phase === "done" ? (
            <div>
              {view.players.map((p) => (
                <div key={p.id} className="mt-2 first:mt-0">
                  <p className="flex items-baseline justify-between text-sm">
                    <span className="font-serif text-base">
                      {p.name}
                      {p.id === myFightId() ? " (you)" : ""}
                    </span>
                    <span className="text-muted">{p.result ? (p.result === "landed" ? "Landed it!" : "It got away") : `${Math.round(p.progress * 100)}% in`}</span>
                  </p>
                  <div className="mt-1 h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                    <div className="h-full bg-lagoon transition-[width] duration-100" style={{ width: `${Math.round(p.progress * 100)}%` }} />
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                    <div className={cn("h-full transition-[width] duration-100", ZONE_BAR[p.zone])} style={{ width: `${Math.round(p.tension * 100)}%` }} />
                  </div>
                </div>
              ))}
              {view.phase === "fighting" ? (
                <button
                  type="button"
                  className="mt-3 min-h-14 w-full select-none rounded-2xl border border-brass bg-brass/15 px-4 py-3 font-serif text-lg touch-none"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    heldRef.current = true;
                  }}
                  onPointerUp={() => (heldRef.current = false)}
                  onPointerLeave={() => (heldRef.current = false)}
                  onPointerCancel={() => (heldRef.current = false)}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  Hold to reel — let go when the bar turns red
                </button>
              ) : (
                <p className="mt-3 font-serif text-xl" role="status">
                  {view.endText}
                </p>
              )}
            </div>
          ) : null}

          <FightChat view={view} />
          <Button variant="quiet" className="min-h-11 self-start px-3 py-2 text-sm" onClick={() => leaveFightQueue()}>
            {view.phase === "done" ? "Done — back to the start" : view.phase === "fighting" ? "Leave the fight (you lose)" : "Leave the room"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** The room's chat: the newest lines last, a box, and a Send button. Lines were
    cleaned and checked in fightroom.ts before they were stored — this only draws them. */
function FightChat({ view }: { view: RoomView }) {
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const send = () => {
    const problem = sendFightChat(draft);
    if (problem) return setNote(problem);
    setNote("");
    setDraft("");
  };
  return (
    <section className="rounded-2xl border border-line p-3" aria-label="Room chat" data-testid="fight-chat">
      <h3 className="font-serif text-lg">Chat</h3>
      {view.chat.length ? (
        <ul className="mt-1 flex flex-col gap-0.5 text-sm" aria-live="polite">
          {view.chat.slice(-12).map((m) => (
            <li key={m.id} className="break-words">
              <b>{m.name}:</b> <span className="text-muted">{m.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted">No messages yet. Say hello!</p>
      )}
      <div className="mt-2 flex gap-2">
        <input
          aria-label="Type a message"
          value={draft}
          maxLength={120}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a friendly message"
          className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-fg placeholder:text-muted"
        />
        <Button className="min-h-11 shrink-0 px-4 py-2 text-sm" disabled={!draft.trim()} onClick={send}>
          Send
        </Button>
      </div>
      {note ? (
        <p className="mt-1 text-xs text-[#ff8f6b]" role="alert">
          {note}
        </p>
      ) : null}
    </section>
  );
}
