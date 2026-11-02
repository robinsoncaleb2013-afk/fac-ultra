import { useCallback, useEffect, useRef, useState } from "react";
import { setBlockedNames } from "@/game/eventroom";
import { useGame } from "@/game/engine";
import { useHubUi } from "@/game/hubstate";
import { nameProblem } from "@/game/safe";
import { api, playerId, playerName, savePlayerName, type FriendOp, type FriendsReply } from "@/game/tourney";

/** Plain-English reasons the friends service can give. */
export function friendProblem(error: string): string {
  switch (error) {
    case "no_such_player":
      return "We couldn't find that player. Check the name and the four numbers.";
    case "bad_handle":
      return "Type a name and its four numbers, like RiverRat#4821.";
    case "no_such_code":
      return "Nobody has that friend code.";
    case "bad_code":
      return "A friend code has six letters and numbers.";
    case "bad_email":
      return "That doesn't look like an email address.";
    case "that_is_you":
      return "That's you! Share your name or code with a friend instead.";
    case "too_many_friends":
      return "That's a lot of friends already. Remove one first.";
    case "slow_down":
      return "That's a lot of tries. Wait a minute and try again.";
    case "invite_expired":
      return "That invite link has run out. Ask your friend to send a new one.";
    default:
      return "Couldn't reach the friends service. Try again in a moment.";
  }
}

export type FriendsState = {
  data: FriendsReply | null;
  offline: boolean;
  refresh: (hello?: string) => Promise<void>;
  /** Run an action. Resolves to an error sentence, or "" when it worked. */
  run: (op: FriendOp, extra?: Record<string, unknown>) => Promise<string>;
};

/** The friends picture for the Players tab: loads when `active`, refreshes every 20 s, and keeps the block list for the rooms. */
export function useFriends(active: boolean): FriendsState {
  const [data, setData] = useState<FriendsReply | null>(null);
  const [offline, setOffline] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const take = useCallback((body: FriendsReply) => {
    if (!alive.current) return;
    setData(body);
    setOffline(false);
    if (body.blocked) setBlockedNames(body.blocked.map((b) => b.name));
  }, []);
  const refresh = useCallback(
    async (hello?: string) => {
      try {
        const name = hello ?? (playerName() && !nameProblem(playerName()) ? playerName() : undefined);
        const { status, body } = hello || name ? await api.friendOp("hello", playerId(), { name: hello ?? name }) : await api.friends(playerId());
        if (status === 200) take(body);
        else if (alive.current) setOffline(true);
      } catch {
        if (alive.current) setOffline(true);
      }
    },
    [take],
  );
  const run = useCallback(
    async (op: FriendOp, extra: Record<string, unknown> = {}) => {
      try {
        const { status, body } = await api.friendOp(op, playerId(), extra);
        if (status !== 200) return friendProblem(body.error ?? "");
        take(body);
        return "";
      } catch {
        return friendProblem("");
      }
    },
    [take],
  );
  useEffect(() => {
    if (!active) return;
    void refresh();
    const t = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(t);
  }, [active, refresh]);
  return { data, offline, refresh, run };
}

/** Save the display name (the same one the tournament boards use). Returns a sentence if it is not allowed. */
export function saveName(name: string): string {
  const who = name.trim();
  const issue = nameProblem(who);
  if (issue) return issue;
  savePlayerName(who);
  return "";
}

/** An invite link from an email (`/?friend=…`): turn it into a request, take the secret out of the address bar, and say what happened. */
export function InviteLinkHost() {
  useEffect(() => {
    let token: string | null = null;
    try {
      token = new URL(window.location.href).searchParams.get("friend");
    } catch {
      return;
    }
    if (!token) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("friend");
      window.history.replaceState(null, "", url.pathname + (url.search ? url.search : "") + url.hash);
    } catch {
      /* leave the address alone */
    }
    const notify = useGame.getState().notify;
    void (async () => {
      try {
        const { status, body } = await api.friendOp("redeem", playerId(), { token });
        if (status !== 200) return notify(friendProblem(body.error ?? ""));
        const n = body.requests?.incoming.length ?? 0;
        notify(n ? "A friend wants to fish with you. Open Players → Requests to say yes." : "That invite is already done.");
        if (n) useHubUi.getState().openHub("players", "requests");
      } catch {
        notify(friendProblem(""));
      }
    })();
  }, []);
  return null;
}
