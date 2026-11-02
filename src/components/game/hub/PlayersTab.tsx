import { useEffect, useRef, useState, type ReactNode } from "react";
import { Copy } from "lucide-react";
import { useGame } from "@/game/engine";
import { useHubUi } from "@/game/hubstate";
import { cleanEmail, cleanFriendCode, cleanHandle, formatFriendCode, searchPrefix } from "@/game/social";
import { api, playerId, playerName } from "@/game/tourney";
import { closeHub } from "@/components/game/hub/actions";
import { friendProblem, saveName, useFriends, type FriendsState } from "@/components/game/hub/friends-data";
import { Icon } from "@/components/game/hub/icons";
import { DarkPanel } from "@/components/game/hub/panel-shell";
import { MasterDetail, type HubItem } from "@/components/game/hub/parts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const field = "min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-fg placeholder:text-muted";

function Notice({ text, bad }: { text: string; bad?: boolean }) {
  if (!text) return null;
  return (
    <p className={cn("mt-1 text-sm", bad ? "text-[#ff8f6b]" : "text-lagoon")} role={bad ? "alert" : "status"}>
      {text}
    </p>
  );
}

function Dot({ on }: { on: boolean }) {
  return <span className={cn("inline-block size-2.5 shrink-0 rounded-full", on ? "bg-lagoon" : "bg-line")} aria-label={on ? "here now" : "away"} />;
}

/** Two taps to block, so a mistake costs nothing. */
function BlockButton({ code, name, f }: { code: string; name: string; f: FriendsState }) {
  const [sure, setSure] = useState(false);
  useEffect(() => {
    if (!sure) return;
    const t = window.setTimeout(() => setSure(false), 4000);
    return () => window.clearTimeout(t);
  }, [sure]);
  return (
    <Button
      variant="quiet"
      data-nav="act"
      className="min-h-11 px-3 py-1 text-sm"
      aria-label={`Block ${name}`}
      onClick={() => (sure ? void f.run("block", { code }) : setSure(true))}
    >
      {sure ? "Tap again to block" : "Block"}
    </Button>
  );
}

function FriendsList({ f }: { f: FriendsState }) {
  const friends = f.data?.friends ?? [];
  return (
    <div>
      {f.offline ? <Notice bad text={friendProblem("")} /> : null}
      {!friends.length ? <p className="text-sm text-muted">No friends yet. Use Add a friend to ask someone to fish with you.</p> : null}
      <ul className="flex flex-col" data-testid="friends-list">
        {friends.map((fr) => (
          <li key={fr.code} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2 first:border-0">
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-base">
                <Dot on={fr.online} />
                <span className="truncate">{fr.name}</span>
              </span>
              <span className="block truncate text-sm text-muted">{fr.fishing ? `Fishing: ${fr.fishing.title}` : fr.online ? "Here, not in an event" : "Away"}</span>
            </span>
            <span className="flex shrink-0 gap-1">
              <Button variant="quiet" data-nav="act" className="min-h-11 px-3 py-1 text-sm" aria-label={`Remove ${fr.name}`} onClick={() => void f.run("remove", { code: fr.code })}>
                Remove
              </Button>
              <BlockButton code={fr.code} name={fr.name} f={f} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Requests({ f }: { f: FriendsState }) {
  const inc = f.data?.requests?.incoming ?? [];
  const out = f.data?.requests?.outgoing ?? [];
  const [note, setNote] = useState("");
  const go = async (op: "accept" | "decline" | "cancel", code: string) => setNote(await f.run(op, { code }));
  return (
    <div>
      <h3 className="font-serif text-lg">Asking to be your friend</h3>
      {!inc.length ? <p className="text-sm text-muted">Nobody is waiting for you.</p> : null}
      <ul className="flex flex-col" data-testid="requests-in">
        {inc.map((p) => (
          <li key={p.code} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2 first:border-0">
            <span className="min-w-0 truncate text-base">{p.handle ?? p.name}</span>
            <span className="flex shrink-0 gap-1">
              <Button data-nav="act" className="min-h-11 px-4 py-1 text-sm" onClick={() => void go("accept", p.code)}>
                Accept
              </Button>
              <Button variant="quiet" data-nav="act" className="min-h-11 px-3 py-1 text-sm" onClick={() => void go("decline", p.code)}>
                No thanks
              </Button>
              <BlockButton code={p.code} name={p.name} f={f} />
            </span>
          </li>
        ))}
      </ul>
      <Notice text={note} bad />
      <h3 className="mt-5 font-serif text-lg">You asked</h3>
      {!out.length ? <p className="text-sm text-muted">No requests waiting.</p> : null}
      <ul className="flex flex-col" data-testid="requests-out">
        {out.map((p) => (
          <li key={p.code} className="flex items-center justify-between gap-2 border-t border-line py-2 first:border-0">
            <span className="min-w-0 truncate text-base">
              {p.handle ?? p.name} <span className="text-sm text-muted">· waiting</span>
            </span>
            <Button variant="quiet" data-nav="act" className="min-h-11 px-3 py-1 text-sm" onClick={() => void go("cancel", p.code)}>
              Cancel
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BlockedList({ f }: { f: FriendsState }) {
  const list = f.data?.blocked ?? [];
  return (
    <div>
      <p className="mb-2 text-sm text-muted">Blocked players can&apos;t ask to be your friend, and you won&apos;t see their boat or their emotes.</p>
      {!list.length ? <p className="text-sm text-muted">You haven&apos;t blocked anyone.</p> : null}
      <ul className="flex flex-col">
        {list.map((p) => (
          <li key={p.code} className="flex items-center justify-between gap-2 border-t border-line py-2 first:border-0">
            <span className="truncate text-base">{p.handle ?? p.name}</span>
            <Button variant="ghost" data-nav="act" className="min-h-11 px-3 py-1 text-sm" onClick={() => void f.run("unblock", { code: p.code })}>
              Unblock
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddFriend({ f }: { f: FriendsState }) {
  const [name, setName] = useState(() => playerName());
  const [nameNote, setNameNote] = useState("");
  const [handle, setHandle] = useState("");
  const [matches, setMatches] = useState<{ handle: string }[]>([]);
  const [handleNote, setHandleNote] = useState<{ text: string; bad: boolean }>({ text: "", bad: false });
  const [email, setEmail] = useState("");
  const [emailNote, setEmailNote] = useState<{ text: string; bad: boolean }>({ text: "", bad: false });
  const [code, setCode] = useState("");
  const [codeNote, setCodeNote] = useState("");
  const [copied, setCopied] = useState(false);
  const seq = useRef(0);
  const me = f.data?.me;

  /* Type-ahead: after three letters, ask for up to five grown-up players whose names start that way. */
  useEffect(() => {
    const q = searchPrefix(handle);
    const mine = ++seq.current;
    if (!q || handle.includes("#")) return void setMatches([]);
    const t = window.setTimeout(async () => {
      try {
        const { status, body } = await api.friendSearch(playerId(), q);
        if (status === 200 && mine === seq.current) setMatches(body.matches);
      } catch {
        /* suggestions are a nicety */
      }
    }, 280);
    return () => window.clearTimeout(t);
  }, [handle]);

  const saveMyName = async () => {
    const issue = saveName(name);
    setNameNote(issue || "Saved.");
    if (!issue) await f.refresh(name.trim());
  };
  const sendByName = async (h: string) => {
    const parsed = cleanHandle(h);
    if (!parsed) return setHandleNote({ text: friendProblem("bad_handle"), bad: true });
    const err = await f.run("request", { handle: `${parsed.name}#${parsed.tag}` });
    setHandleNote(err ? { text: err, bad: true } : { text: `Asked ${parsed.name}. They need to accept.`, bad: false });
    if (!err) {
      setHandle("");
      setMatches([]);
    }
  };
  const sendByEmail = async () => {
    const e = cleanEmail(email);
    if (!e) return setEmailNote({ text: friendProblem("bad_email"), bad: true });
    const err = await f.run("invite_email", { email: e });
    /* The same words whoever the address belongs to. */
    setEmailNote(err ? { text: err, bad: true } : { text: "Done. If that address can get email, an invite is on its way.", bad: false });
    if (!err) setEmail("");
  };
  const addByCode = async () => {
    const c = cleanFriendCode(code);
    if (!c) return setCodeNote(friendProblem("bad_code"));
    const err = await f.run("add", { code: c });
    setCodeNote(err || "Added.");
    if (!err) setCode("");
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-line p-3" aria-label="Who you are">
        <h3 className="font-serif text-lg">Your name</h3>
        <p className="text-sm text-muted">Friends find you by this name and a number the game gives you.</p>
        <div className="mt-2 flex gap-2">
          <input aria-label="Your name" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Angler" className={field} />
          <Button variant="ghost" data-nav="act" className="min-h-11 shrink-0" onClick={() => void saveMyName()}>
            Save
          </Button>
        </div>
        <Notice text={nameNote} bad={nameNote !== "Saved."} />
        {me ? (
          <p className="mt-2 text-sm">
            You are <span className="font-serif text-lg text-brass" data-testid="my-handle">{me.handle ?? me.name}</span>
            <span className="text-muted"> · code </span>
            <span className="font-serif tracking-widest text-brass" data-testid="my-friend-code">{formatFriendCode(me.code)}</span>
            <Button
              variant="quiet"
              data-nav="act"
              className="ml-1 min-h-11 px-2 py-1 text-sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(me.handle ?? me.code);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                } catch {
                  /* it is on screen to read out */
                }
              }}
            >
              <Copy className="size-4" aria-hidden /> {copied ? "Copied" : "Copy"}
            </Button>
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-line p-3" aria-label="Add by name">
        <h3 className="font-serif text-lg">By name</h3>
        <p className="text-sm text-muted">Type their name. Pick them from the list, or type the full name with its number.</p>
        <div className="mt-2 flex gap-2">
          <input
            aria-label="A player's name"
            value={handle}
            maxLength={26}
            onChange={(e) => setHandle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handle.includes("#") && void sendByName(handle)}
            placeholder="RiverRat#4821"
            autoComplete="off"
            className={field}
          />
          <Button variant="ghost" data-nav="act" className="min-h-11 shrink-0" disabled={!cleanHandle(handle)} onClick={() => void sendByName(handle)}>
            Ask
          </Button>
        </div>
        {matches.length ? (
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Suggestions">
            {matches.map((m) => (
              <li key={m.handle}>
                <button type="button" data-nav="act" onClick={() => void sendByName(m.handle)} className="min-h-11 rounded-full border border-brass px-4 text-sm text-fg hover:bg-surface-2">
                  {m.handle}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <Notice text={handleNote.text} bad={handleNote.bad} />
      </section>

      <section className="rounded-2xl border border-line p-3" aria-label="Add by email">
        <h3 className="font-serif text-lg">By email</h3>
        <p className="text-sm text-muted">We send them a link. We never tell you whether they already play.</p>
        <div className="mt-2 flex gap-2">
          <input aria-label="A friend's email" type="email" value={email} maxLength={120} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" className={field} />
          <Button variant="ghost" data-nav="act" className="min-h-11 shrink-0" disabled={!cleanEmail(email)} onClick={() => void sendByEmail()}>
            Send invite
          </Button>
        </div>
        <Notice text={emailNote.text} bad={emailNote.bad} />
      </section>

      <section className="rounded-2xl border border-line p-3" aria-label="Add by code">
        <h3 className="font-serif text-lg">By friend code</h3>
        <p className="text-sm text-muted">Sitting together? Type their code and you are friends straight away.</p>
        <div className="mt-2 flex gap-2">
          <input
            aria-label="A friend's code"
            value={code}
            maxLength={8}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC-XYZ"
            className={cn(field, "w-40 text-center font-serif text-lg tracking-widest")}
          />
          <Button variant="ghost" data-nav="act" className="min-h-11 shrink-0" disabled={!cleanFriendCode(code)} onClick={() => void addByCode()}>
            Add friend
          </Button>
        </div>
        <Notice text={codeNote} bad={codeNote !== "Added." && !!codeNote} />
      </section>
    </div>
  );
}

function Events() {
  const mode = useGame((s) => s.mode);
  const openLobby = useGame((s) => s.openLobby);
  return (
    <div>
      <p className="text-base">Tournaments are short events everyone can join. You all fish the same water with the same rules, and the leaderboard is checked.</p>
      <p className="mt-2 text-sm text-muted">In an event you can send small emotes, like a thumbs up. There is no typing, so it stays friendly.</p>
      <Button
        className="mt-3"
        data-nav="act"
        disabled={mode === "tournament"}
        onClick={() => {
          closeHub();
          openLobby();
        }}
      >
        <Icon name="flag" className="size-5" /> {mode === "tournament" ? "You are in an event" : "See the events"}
      </Button>
    </div>
  );
}

/* Friends live in two places (WP-12). The MAIN menu has all of it: your name and code, add by name, email or code, accept,
   remove and block. The IN-GAME menu keeps a compact version: your friends, who is asking, and the events (join, emotes). */
function Friends({ split, scope }: { split: boolean; scope: "main" | "game" }) {
  const tabId = scope === "main" ? "friends" : "players";
  const saved = useHubUi((s) => s.item[tabId]);
  const f = useFriends(true);
  const inc = f.data?.requests?.incoming.length ?? 0;
  const all: (HubItem & { body: ReactNode; title2: string; main?: boolean; game?: boolean })[] = [
    { id: "friends", title: "Friends", sub: f.data ? `${f.data.friends.length} ${f.data.friends.length === 1 ? "friend" : "friends"}` : "Your fishing friends", icon: <Icon name="players" className="size-5" />, title2: "Friends", body: <FriendsList key="f" f={f} />, main: true, game: true },
    { id: "requests", title: "Requests", sub: inc ? `${inc} waiting for you` : "People asking to be friends", icon: <Icon name="flag" className="size-5" />, badge: inc ? String(inc) : undefined, title2: "Requests", body: <Requests key="r" f={f} />, main: true, game: true },
    { id: "add", title: "Add a friend", sub: "By name, email or code", icon: <Icon name="hook" className="size-5" />, title2: "Add a friend", body: <AddFriend key="a" f={f} />, main: true },
    { id: "blocked", title: "Blocked", sub: "Players you don't want to see", icon: <Icon name="lock" className="size-5" />, title2: "Blocked players", body: <BlockedList key="b" f={f} />, main: true },
    { id: "events", title: "Events", sub: "Tournaments to join", icon: <Icon name="waters" className="size-5" />, title2: "Events", body: <Events key="e" />, game: true },
  ];
  const here = all.filter((x) => (scope === "main" ? x.main : x.game));
  const items: HubItem[] = here.map(({ body: _b, title2: _t, main: _m, game: _g, ...item }) => item);
  const view: Record<string, [string, ReactNode]> = Object.fromEntries(here.map((x) => [x.id, [x.title2, x.body]]));
  return (
    <MasterDetail
      tab={tabId}
      items={items}
      selectedId={saved && view[saved] ? saved : null}
      listLabel={scope === "main" ? "Friends" : "Players"}
      split={split}
      detailLabel="Players"
      bare
      render={(id) => {
        const [title, body] = view[id] ?? view.friends;
        return (
          <DarkPanel label={title} className="h-full">
            <h2 className="mb-3 font-serif text-2xl">{title}</h2>
            {body}
          </DarkPanel>
        );
      }}
    />
  );
}

/** The main menu's Friends tab: everything about who you fish with, and nothing about a game. */
export const FriendsTab = ({ split }: { split: boolean }) => <Friends split={split} scope="main" />;
/** The in-game Players tab: friends, requests and events. */
export const PlayersTab = ({ split }: { split: boolean }) => <Friends split={split} scope="game" />;
