import { useCallback, useEffect, useState } from "react";
import { Copy, Trophy, X } from "lucide-react";
import { BIOMES } from "@/game/content";
import { useGame } from "@/game/engine";
import { CATEGORY_INFO, scoreLabel, type Category } from "@/game/scoring";
import { cleanFriendCode, formatFriendCode, MEDAL_NAMES, shortDate, TEAMS, TEAM_MAX, teamById } from "@/game/social";
import { nameProblem } from "@/game/safe";
import {
  api,
  clock,
  playerId,
  playerName,
  savePlayerName,
  type EventInfo,
  type FriendsReply,
  type InviteInfo,
} from "@/game/tourney";
import { Button } from "@/components/ui/button";
import { useTick } from "@/components/game/use-tick";
import { joinProblem } from "@/components/game/lobby-text";
import { cn } from "@/lib/cn";

/* The Tournaments lobby (docs/architecture/06 §3.1): a full-screen sheet on phones, a card on bigger screens.
   Tabs: On now · Coming up · Private · Friends · History. Pick a category, join, make or join a private
   event by code, make a team event, add friends by code, answer invites, and read how past events went. */

const kindName: Record<EventInfo["kind"], string> = { quick: "Quick", daily: "Daily", weekly: "Weekly", private: "Private", survival: "Survival" };
type Tab = "live" | "soon" | "private" | "friends" | "history";
const TABS: [Tab, string][] = [
  ["live", "On now"],
  ["soon", "Coming up"],
  ["private", "Private"],
  ["friends", "Friends"],
  ["history", "History"],
];
const CATS: ("all" | Exclude<Category, "survival">)[] = ["all", "big", "total", "sprint", "value"];

type Load = { state: "loading" } | { state: "error"; text: string } | { state: "ready"; events: EventInfo[]; privates: EventInfo[]; offset: number };

function friendProblem(error: string): string {
  switch (error) {
    case "no_such_code":
      return "Nobody has that friend code.";
    case "bad_code":
      return "A friend code has six letters and numbers.";
    case "that_is_you":
      return "That's your own code. Share it with a friend instead.";
    case "too_many_friends":
      return "That's a lot of friends already. Remove one first.";
    case "slow_down":
      return "Easy there. Try again in a minute.";
    default:
      return "Couldn't do that. Try again.";
  }
}

export function TournamentLobby() {
  const open = useGame((s) => s.lobby);
  const close = useGame((s) => s.closeLobby);
  const enter = useGame((s) => s.enterEvent);
  const sync = useGame((s) => s.syncTrophies);
  const [tab, setTab] = useState<Tab>("live");
  const [cat, setCat] = useState<(typeof CATS)[number]>("all");
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [social, setSocial] = useState<FriendsReply | null>(null);
  const [name, setName] = useState(() => playerName());
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  const [picking, setPicking] = useState<{ id: string; title: string } | null>(null);
  useTick();

  const refresh = useCallback(async () => {
    try {
      const t0 = Date.now();
      const { status, body } = await api.events(playerId());
      const t1 = Date.now();
      if (status !== 200) throw new Error(body.error ?? String(status));
      setLoad({ state: "ready", events: body.events, privates: body.privates ?? [], offset: body.serverNow - (t0 + t1) / 2 });
    } catch {
      setLoad({ state: "error", text: "Couldn't reach the event board. Check your connection and try again." });
    }
  }, []);

  const refreshFriends = useCallback(async (hello?: string) => {
    try {
      const { status, body } = hello ? await api.friendOp("hello", playerId(), { name: hello }) : await api.friends(playerId());
      if (status === 200) setSocial(body);
    } catch {
      /* friends are optional: the events still work */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoad({ state: "loading" });
    void refresh();
    void refreshFriends(playerName() && !nameProblem(playerName()) ? playerName() : undefined);
    void sync(true);
    const t = window.setInterval(() => {
      void refresh();
      void refreshFriends();
    }, 20_000);
    return () => window.clearInterval(t);
  }, [open, refresh, refreshFriends, sync]);

  if (!open) return null;

  const who = name.trim();
  const nameIssue = nameProblem(who);

  const join = async (eventId: string, title = "", team?: string) => {
    setBusy(eventId);
    setProblem("");
    try {
      if (who && !nameIssue) savePlayerName(who);
      const t0 = Date.now();
      const { status, body } = await api.join(eventId, playerId(), nameIssue ? "" : who, fetch, team);
      const t1 = Date.now();
      if (status !== 200) {
        if (body.error === "pick_a_team") setPicking({ id: eventId, title });
        else setProblem(joinProblem(body.error ?? "", status));
        return;
      }
      setPicking(null);
      enter(body, body.serverNow - (t0 + t1) / 2);
    } catch {
      setProblem("Couldn't join. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const events = load.state === "ready" ? load.events : [];
  const now = Date.now() + (load.state === "ready" ? load.offset : 0);
  const fits = (e: EventInfo) => e.kind !== "survival" && (cat === "all" || e.category === cat);
  const live = events.filter((e) => now >= e.startsAt && now < e.endsAt && fits(e));
  const soon = events.filter((e) => now < e.startsAt && fits(e));
  const invites = social?.invites ?? [];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg/80 p-3 max-md:p-0" data-testid="lobby">
      <div
        role="dialog"
        aria-label="Tournaments"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-2xl border border-brass bg-surface max-md:h-dvh max-md:max-h-none max-md:rounded-none max-md:border-0"
      >
        <div className="safe-top flex items-start justify-between gap-3 p-5 pb-2 max-md:px-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brass uppercase">
              <Trophy className="size-4" aria-hidden /> Tournaments
            </p>
            <h2 className="font-serif text-2xl leading-tight">Pick an event</h2>
            <p className="mt-1 text-sm text-muted">Everybody fishes the same water with the same tackle. The server checks every catch.</p>
          </div>
          <Button variant="quiet" className="min-h-11 px-3 py-2 text-sm" onClick={close} aria-label="Close the lobby">
            <X className="size-5 md:hidden" aria-hidden />
            <span className="max-md:hidden">Close</span>
          </Button>
        </div>

        <div className="px-5 max-md:px-4">
          <label className="block text-sm text-muted" htmlFor="tourney-name">
            Your name on the board
          </label>
          <input
            id="tourney-name"
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (who && !nameIssue) {
                savePlayerName(who);
                void refreshFriends(who);
              }
            }}
            placeholder="Angler"
            className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-fg"
          />
          <p className={cn("mt-1 text-xs", nameIssue ? "text-[#e4572e]" : "text-muted")} role={nameIssue ? "alert" : undefined}>
            {nameIssue ?? "No sign-in yet, so anyone can pick any name. Keep it friendly."}
          </p>
        </div>

        {invites.length ? <Invites invites={invites} busy={busy} onJoin={(i) => join(i.event.id, i.event.title)} onDismiss={async (i) => setSocial((await api.friendOp("dismiss", playerId(), { inviteId: i.id })).body)} /> : null}

        <div className="flex gap-1 overflow-x-auto px-5 pt-3 max-md:px-4" role="tablist" aria-label="Lobby sections">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                setTab(id);
                setProblem("");
              }}
              className={cn("min-h-11 shrink-0 rounded-full px-3 text-sm", tab === id ? "bg-brass text-brass-ink" : "bg-surface-2 text-muted")}
            >
              {label}
              {id === "friends" && invites.length ? ` (${invites.length})` : ""}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-5 max-md:px-4 safe-bot">
          {load.state === "loading" ? (
            <p className="mt-3 text-sm text-muted" role="status">
              Finding the water…
            </p>
          ) : null}
          {load.state === "error" ? (
            <div className="mt-3">
              <p className="text-sm text-[#e4572e]" role="alert">
                {load.text}
              </p>
              <Button variant="ghost" className="mt-2" onClick={refresh}>
                Try again
              </Button>
            </div>
          ) : null}
          {problem ? (
            <p className="mt-3 text-sm text-[#e4572e]" role="alert">
              {problem}
            </p>
          ) : null}

          {picking ? <TeamPicker title={picking.title} busy={busy === picking.id} onPick={(team) => join(picking.id, picking.title, team)} onCancel={() => setPicking(null)} /> : null}

          {tab === "live" || tab === "soon" ? (
            <>
              <div className="mt-2 flex gap-1 overflow-x-auto" role="group" aria-label="Pick a kind of event">
                {CATS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={cat === c}
                    onClick={() => setCat(c)}
                    className={cn("min-h-11 shrink-0 rounded-full border px-3 text-sm", cat === c ? "border-brass text-brass" : "border-line text-muted")}
                  >
                    {c === "all" ? "All kinds" : CATEGORY_INFO[c].name}
                  </button>
                ))}
              </div>
              <ul className="mt-2 flex flex-col gap-2" data-testid={tab === "live" ? "events-live" : "events-soon"}>
                {(tab === "live" ? live : soon).map((e) => (
                  <EventRow key={e.id} e={e} now={now} busy={busy === e.id} onJoin={() => join(e.id, e.title)} />
                ))}
              </ul>
              {load.state === "ready" && !(tab === "live" ? live : soon).length ? (
                <p className="mt-3 text-sm text-muted">{cat === "all" ? "Nothing here right now." : "Nothing of that kind here right now. Try another kind."}</p>
              ) : null}
            </>
          ) : null}

          {tab === "private" ? (
            <PrivateTab
              privates={load.state === "ready" ? load.privates : []}
              now={now}
              busy={busy}
              join={join}
              setProblem={setProblem}
              name={nameIssue ? "" : who}
            />
          ) : null}

          {tab === "friends" ? (
            <FriendsTab
              social={social}
              onChange={setSocial}
              busy={busy}
              onJoinFriend={(f) => f.fishing && join(f.fishing.id, f.fishing.title)}
              setProblem={setProblem}
              nameOk={!!who && !nameIssue}
              name={who}
            />
          ) : null}

          {tab === "history" ? <HistoryTab /> : null}
        </div>
      </div>
    </div>
  );
}

function EventRow({ e, now, busy, onJoin }: { e: EventInfo; now: number; busy: boolean; onJoin: () => void }) {
  const live = now >= e.startsAt;
  const toStart = e.startsAt - now;
  const canJoin = toStart <= 60_000;
  const info = CATEGORY_INFO[e.category];
  return (
    <li className="rounded-2xl border border-line bg-bg/40 p-3" data-testid="event-row">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">
            {kindName[e.kind]} · {e.waterName} · {e.entrants} {e.entrants === 1 ? "angler" : "anglers"}
            {e.team ? " · Teams" : ""}
          </p>
          <p className="font-serif text-lg leading-tight">{e.team ? "Team Total Weight" : info.name}</p>
          <p className="text-sm text-muted">{info.blurb}</p>
          <p className="mt-1 text-sm text-brass">
            {live ? `${clock(e.endsAt - now)} left` : `Starts in ${clock(toStart)}`}
            <span className="text-muted"> · {e.castBudget} casts</span>
          </p>
        </div>
        <Button className="min-h-11 shrink-0 px-4 py-2 text-sm" disabled={!canJoin || busy} onClick={onJoin} aria-label={`${e.joined ? "Go back to" : "Join"} ${e.title}`}>
          {busy ? "Joining…" : e.joined ? "Resume" : "Join"}
        </Button>
      </div>
    </li>
  );
}

function TeamPicker({ title, busy, onPick, onCancel }: { title: string; busy: boolean; onPick: (team: string) => void; onCancel: () => void }) {
  return (
    <div className="mt-3 rounded-2xl border border-brass p-3" data-testid="team-picker">
      <h3 className="font-serif text-lg">Pick your team</h3>
      <p className="text-sm text-muted">{title ? `${title}. ` : ""}Up to {TEAM_MAX} on a team. Friends on the same team add their fish together.</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {TEAMS.map((t) => (
          <Button key={t.id} variant="ghost" disabled={busy} className="min-h-11 py-2 text-base" onClick={() => onPick(t.id)}>
            <span aria-hidden>{t.emoji}</span> {t.name}
          </Button>
        ))}
      </div>
      <Button variant="quiet" className="mt-1 min-h-11 py-2 text-sm" onClick={onCancel}>
        Never mind
      </Button>
    </div>
  );
}

function Invites({ invites, busy, onJoin, onDismiss }: { invites: InviteInfo[]; busy: string | null; onJoin: (i: InviteInfo) => void; onDismiss: (i: InviteInfo) => void }) {
  return (
    <ul className="mx-5 mt-3 flex flex-col gap-1 rounded-2xl border border-brass bg-brass/10 p-2 max-md:mx-4" aria-label="Invites" data-testid="invites">
      {invites.map((i) => (
        <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
          <span className="min-w-0">
            <b>{i.from.name}</b> asked you to fish <span className="text-brass">{i.event.waterName}</span>
          </span>
          <span className="flex shrink-0 gap-1">
            <Button className="min-h-11 px-3 py-1 text-sm" disabled={busy === i.event.id} onClick={() => onJoin(i)}>
              Join
            </Button>
            <Button variant="quiet" className="min-h-11 px-2 py-1 text-sm" aria-label="No thanks" onClick={() => onDismiss(i)}>
              <X className="size-4" aria-hidden />
            </Button>
          </span>
        </li>
      ))}
    </ul>
  );
}

function PrivateTab({
  privates,
  now,
  busy,
  join,
  setProblem,
  name,
}: {
  privates: EventInfo[];
  now: number;
  busy: string | null;
  join: (id: string, title?: string) => Promise<void>;
  setProblem: (s: string) => void;
  name: string;
}) {
  const [code, setCode] = useState("");
  const [making, setMaking] = useState(false);
  const [water, setWater] = useState(0);
  const [category, setCategory] = useState<"big" | "total" | "sprint" | "value">("total");
  const [minutes, setMinutes] = useState(15);
  const [team, setTeam] = useState(false);

  const byCode = async () => {
    setProblem("");
    const c = code.trim().toUpperCase();
    if (c.length !== 4) return setProblem("A room code has four letters.");
    const { status, body } = await api.byCode(c);
    if (status !== 200) return setProblem(status === 404 ? "No event has that code." : "That code doesn't look right.");
    await join(body.event.id, body.event.title);
  };

  const create = async () => {
    setProblem("");
    const { status, body } = await api.create({ playerId: playerId(), name, water, category, minutes, castBudget: 40, team });
    if (status !== 200) return setProblem(joinProblem(body.error ?? "", status));
    await join(body.event.id, body.event.title);
  };

  return (
    <div className="mt-2">
      <h3 className="font-serif text-lg">With friends</h3>
      <p className="text-sm text-muted">Make a private event, or type a friend&apos;s four-letter code.</p>
      <div className="mt-2 flex gap-2">
        <input
          aria-label="Room code"
          value={code}
          maxLength={4}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCD"
          className="min-h-11 w-28 rounded-xl border border-line bg-surface-2 px-3 text-center font-serif text-lg tracking-widest text-fg"
        />
        <Button variant="ghost" className="min-h-11 py-2" disabled={code.length !== 4 || !!busy} onClick={byCode}>
          Join with code
        </Button>
        <Button variant="ghost" className="min-h-11 py-2" aria-expanded={making} onClick={() => setMaking(!making)}>
          {making ? "Never mind" : "Make one"}
        </Button>
      </div>
      {making ? (
        <div className="mt-3 grid gap-2 rounded-2xl border border-line p-3">
          <label className="text-sm text-muted" htmlFor="mk-water">
            Water
          </label>
          <select id="mk-water" value={water} onChange={(e) => setWater(Number(e.target.value))} className="min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-fg">
            {BIOMES.map((b, i) => (
              <option key={b.id} value={i}>
                {b.name}
              </option>
            ))}
          </select>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={team} onChange={(e) => setTeam(e.target.checked)} className="size-5" />
            Team event: friends pick a team and add up their fish
          </label>
          {!team ? (
            <>
              <label className="text-sm text-muted" htmlFor="mk-cat">
                Winner is
              </label>
              <select id="mk-cat" value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-fg">
                {(["total", "big", "sprint", "value"] as const).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_INFO[c].name}: {CATEGORY_INFO[c].blurb}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <label className="text-sm text-muted" htmlFor="mk-min">
            How long
          </label>
          <select id="mk-min" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-fg">
            {[10, 15, 30, 60].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
          <Button disabled={!!busy} onClick={create}>
            Make it and join
          </Button>
          <p className="text-xs text-muted">Up to 16 anglers{team ? `, ${TEAM_MAX} to a team` : ""}. Share the four-letter code that appears.</p>
        </div>
      ) : null}
      {privates.length ? (
        <>
          <h3 className="mt-5 font-serif text-lg">Your private events</h3>
          <ul className="mt-1 flex flex-col gap-2" data-testid="my-privates">
            {privates.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-bg/40 p-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted">
                    Code <span className="font-serif text-base tracking-widest text-brass">{e.code}</span> · {e.waterName}
                    {e.team ? " · Teams" : ""}
                  </p>
                  <p className="text-sm text-muted">
                    {now < e.startsAt ? `Starts in ${clock(e.startsAt - now)}` : `${clock(e.endsAt - now)} left`} · {e.entrants} {e.entrants === 1 ? "angler" : "anglers"}
                  </p>
                </div>
                <Button className="min-h-11 shrink-0 px-4 py-2 text-sm" disabled={!!busy} onClick={() => join(e.id, e.title)}>
                  Resume
                </Button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function FriendsTab({
  social,
  onChange,
  busy,
  onJoinFriend,
  setProblem,
  nameOk,
  name,
}: {
  social: FriendsReply | null;
  onChange: (s: FriendsReply) => void;
  busy: string | null;
  onJoinFriend: (f: FriendsReply["friends"][number]) => void;
  setProblem: (s: string) => void;
  nameOk: boolean;
  name: string;
}) {
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const mine = social?.me.code ?? "";
  const add = async () => {
    setProblem("");
    const c = cleanFriendCode(code);
    if (!c) return setProblem(friendProblem("bad_code"));
    const { status, body } = await api.friendOp("add", playerId(), { code: c });
    if (status !== 200) return setProblem(friendProblem(body.error ?? ""));
    onChange(body);
    setCode("");
  };
  const remove = async (c: string) => {
    const { status, body } = await api.friendOp("remove", playerId(), { code: c });
    if (status === 200) onChange(body);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(mine);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the code is on screen to read out */
    }
  };
  return (
    <div className="mt-2" data-testid="friends-tab">
      <div className="rounded-2xl border border-line p-3">
        <p className="text-sm text-muted">Your friend code. Give it to a friend, or type theirs below.</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="font-serif text-3xl tracking-widest text-brass" data-testid="my-friend-code">
            {mine ? formatFriendCode(mine) : "······"}
          </span>
          <Button variant="ghost" className="min-h-11 px-3 py-1 text-sm" disabled={!mine} onClick={copy}>
            <Copy className="size-4" aria-hidden /> {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted">
          {nameOk ? `Friends see you as ${name}.` : "Type a friendly name above so friends know it's you."} They can see when you&apos;re here and which event you&apos;re fishing. Nothing else.
        </p>
      </div>
      <div className="mt-3 flex gap-2">
        <input
          aria-label="A friend's code"
          value={code}
          maxLength={8}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC-XYZ"
          className="min-h-11 w-36 rounded-xl border border-line bg-surface-2 px-3 text-center font-serif text-lg tracking-widest text-fg"
        />
        <Button variant="ghost" className="min-h-11 py-2" disabled={!cleanFriendCode(code)} onClick={add}>
          Add friend
        </Button>
      </div>
      <h3 className="mt-4 font-serif text-lg">Your friends</h3>
      {!social?.friends.length ? <p className="text-sm text-muted">No friends yet. Add one with their code.</p> : null}
      <ul className="mt-1 flex flex-col" data-testid="friends-list">
        {social?.friends.map((f) => (
          <li key={f.code} className="flex items-center justify-between gap-2 border-t border-line py-2 first:border-0">
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm">
                <span className={cn("inline-block size-2.5 shrink-0 rounded-full", f.online ? "bg-lagoon" : "bg-line")} aria-label={f.online ? "here now" : "away"} />
                <span className="truncate">{f.name}</span>
              </span>
              <span className="block truncate text-xs text-muted">{f.fishing ? `Fishing: ${f.fishing.title}` : f.online ? "Here, not in an event" : "Away"}</span>
            </span>
            <span className="flex shrink-0 gap-1">
              {f.fishing ? (
                <Button className="min-h-11 px-3 py-1 text-sm" disabled={!!busy} onClick={() => onJoinFriend(f)}>
                  Join them
                </Button>
              ) : null}
              <Button variant="quiet" className="min-h-11 px-2 py-1 text-sm" aria-label={`Remove ${f.name}`} onClick={() => remove(f.code)}>
                <X className="size-4" aria-hidden />
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HistoryTab() {
  const history = useGame((s) => s.tourneyHistory);
  const sync = useGame((s) => s.syncTrophies);
  return (
    <div className="mt-2" data-testid="history-tab">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg">How you did</h3>
        <Button variant="quiet" className="min-h-11 px-3 py-1 text-sm" onClick={() => void sync(false)}>
          Check for results
        </Button>
      </div>
      {!history.length ? <p className="text-sm text-muted">Finish an event and it shows up here, with your place and any medal.</p> : null}
      <ul className="flex flex-col">
        {history.map((h) => (
          <li key={h.id} className="flex items-center justify-between gap-2 border-t border-line py-2 first:border-0">
            <span className="min-w-0">
              <span className="block truncate text-sm">
                {h.medal ? <span aria-label={`${MEDAL_NAMES[h.medal]} medal`}>{["", "🥇", "🥈", "🥉"][h.medal]} </span> : null}
                {h.title}
              </span>
              <span className="block text-xs text-muted">
                {shortDate(h.at)} · {BIOMES[h.water]?.name}
                {h.team ? ` · ${teamById(h.team)?.name ?? ""}` : ""}
              </span>
            </span>
            <span className="shrink-0 text-right text-sm">
              <span className="block text-brass">
                #{h.rank} of {h.entrants}
              </span>
              <span className="block text-xs text-muted">{scoreLabel(h.category, h.score)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
