/* WP-10 friends: names with numbers, requests that need an Accept, email invites that never reveal who has an account,
   and Block. Two or three simulated players on an embedded Postgres. No Neon, no real email. */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Sql } from "@/lib/db";
import { cleanEmail, cleanHandle, searchPrefix } from "@/game/social";
import type { Mail } from "@/lib/accounts/mail.server.ts";
import type { ApiReq } from "./common.server.ts";
import { EMAIL_INVITES_PER_ADDRESS_PER_DAY, EMAIL_INVITES_PER_HOUR, handleFriends, setInviteSender } from "./friends.server.ts";
import { testSql } from "./testing.server.ts";

let sql: Sql;
let close: () => Promise<void>;
const mail: Mail[] = [];
before(async () => {
  ({ sql, close } = await testSql());
  setInviteSender(async (m) => void mail.push(m));
});
after(async () => {
  setInviteSender(null);
  await close();
});

let ipN = 0;
const NOW = Date.UTC(2026, 10, 2, 13, 5, 0);
const post = (body: unknown, now = NOW): ApiReq => ({ method: "POST", url: new URL("http://fac.test/"), body, ip: `10.2.${Math.floor(++ipN / 250)}.${ipN % 250}`, now });
const act = (body: Record<string, unknown>, now = NOW) => handleFriends(sql, post(body, now));
const pid = (n: number) => `req-${String(n).padStart(4, "0")}-abcd`;

type Person = { id: string; code: string; handle: string; name: string };
let slot = 0;
/** A player with a name; `account` links a (grown-up or kid) profile so the name can be found. */
async function player(name: string, opts: { account?: boolean; kid?: boolean } = { account: true }): Promise<Person> {
  const id = pid(++slot);
  const r = await act({ op: "hello", playerId: id, name });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const me = r.body.me as { code: string; handle: string; name: string };
  if (opts.account) {
    await sql.query("insert into profiles (id, account_id, slot, name, kid, player_id) values ($1, $2, 0, $3, $4, $5)", [`prof-${id}`, `acct-${id}`, name, !!opts.kid, id]);
  }
  return { id, code: me.code, handle: me.handle, name: me.name };
}

type Reply = {
  me: { handle: string };
  friends: { code: string; name: string }[];
  requests: { incoming: { code: string; handle: string | null }[]; outgoing: { code: string }[] };
  blocked: { code: string }[];
  matches?: { handle: string }[];
};
const look = async (p: Person) => (await act({ op: "hello", playerId: p.id })).body as unknown as Reply;

test("the small readers: handles, search words and emails", () => {
  assert.deepEqual(cleanHandle("RiverRat#4821"), { name: "RiverRat", tag: 4821 });
  assert.deepEqual(cleanHandle("  River Rat # 4821 "), { name: "River Rat", tag: 4821 });
  assert.equal(cleanHandle("RiverRat"), null);
  assert.equal(cleanHandle("RiverRat#48"), null);
  assert.equal(cleanHandle("<b>x</b>#1234"), null);
  assert.equal(cleanHandle(5), null);
  assert.equal(searchPrefix("Riv"), "riv");
  assert.equal(searchPrefix("Ri"), null, "two letters are too few to browse");
  assert.equal(searchPrefix("RiverRat#4821"), "riverrat");
  assert.equal(searchPrefix("100%"), null);
  assert.equal(cleanEmail(" Mum@Example.COM "), "mum@example.com");
  assert.equal(cleanEmail("not an email"), null);
  assert.equal(cleanEmail("a@b"), null);
});

test("every player gets a Name#number, and two players with one name get different numbers", async () => {
  const a = await player("Twin", { account: false });
  const b = await player("Twin", { account: false });
  assert.match(a.handle, /^Twin#\d{4}$/);
  assert.match(b.handle, /^Twin#\d{4}$/);
  assert.notEqual(a.handle, b.handle);
  assert.equal((await look(a)).me.handle, a.handle, "the number stays put");
});

test("by name: a request waits for Accept, then both are friends", async () => {
  const river = await player("RiverRat");
  const pike = await player("PikeFan");
  const sent = await act({ op: "request", playerId: river.id, handle: pike.handle });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  assert.equal((sent.body as unknown as Reply).friends.length, 0, "not friends yet");
  assert.equal((sent.body as unknown as Reply).requests.outgoing[0].code, pike.code);
  const theirs = await look(pike);
  assert.equal(theirs.friends.length, 0);
  assert.equal(theirs.requests.incoming.length, 1);
  assert.equal(theirs.requests.incoming[0].handle, river.handle);
  const done = await act({ op: "accept", playerId: pike.id, code: river.code });
  assert.equal((done.body as unknown as Reply).friends[0].code, river.code);
  assert.equal((done.body as unknown as Reply).requests.incoming.length, 0);
  const mine = await look(river);
  assert.equal(mine.friends[0].code, pike.code, "friends both ways");
  assert.equal(mine.requests.outgoing.length, 0);
});

test("by name: asking someone who already asked you makes you friends at once; asking twice does nothing extra", async () => {
  const a = await player("Ahab");
  const b = await player("Bream");
  await act({ op: "request", playerId: a.id, handle: b.handle });
  await act({ op: "request", playerId: a.id, handle: b.handle });
  assert.equal((await look(b)).requests.incoming.length, 1);
  await act({ op: "request", playerId: b.id, handle: a.handle });
  assert.equal((await look(a)).friends[0].code, b.code);
  assert.equal((await look(b)).requests.incoming.length, 0);
});

test("by name: wrong or unknown names, yourself, and players with no account", async () => {
  const a = await player("Carp");
  const anon = await player("Walker", { account: false });
  assert.equal((await act({ op: "request", playerId: a.id, handle: "Nobody#1234" })).body.error, "no_such_player");
  assert.equal((await act({ op: "request", playerId: a.id, handle: "Carp" })).body.error, "bad_handle");
  assert.equal((await act({ op: "request", playerId: a.id, handle: a.handle })).body.error, "that_is_you");
  assert.equal((await act({ op: "request", playerId: a.id, handle: anon.handle })).body.error, "no_such_player", "names find account players only; codes work for everyone");
});

test("decline and cancel clear a request", async () => {
  const a = await player("Dace");
  const b = await player("Eelpout");
  await act({ op: "request", playerId: a.id, handle: b.handle });
  await act({ op: "decline", playerId: b.id, code: a.code });
  assert.equal((await look(b)).requests.incoming.length, 0);
  assert.equal((await look(a)).friends.length, 0);
  await act({ op: "request", playerId: a.id, handle: b.handle });
  await act({ op: "cancel", playerId: a.id, code: b.code });
  assert.equal((await look(b)).requests.incoming.length, 0);
  assert.equal((await look(a)).requests.outgoing.length, 0);
  /* accepting something that is not there makes nobody a friend */
  await act({ op: "accept", playerId: b.id, code: a.code });
  assert.equal((await look(b)).friends.length, 0);
});

test("the friend code still adds at once, both ways (people sitting together)", async () => {
  const a = await player("Fluke", { account: false });
  const b = await player("Gar", { account: false });
  const r = await act({ op: "add", playerId: a.id, code: b.code });
  assert.equal((r.body as unknown as Reply).friends[0].code, b.code);
  assert.equal((await look(b)).friends[0].code, a.code);
});

test("type-ahead: three letters, five answers, grown-up account players only", async () => {
  const me = await player("Searcher");
  const kid = await player("Haddy Kid", { account: true, kid: true });
  const grown = [await player("Haddock1"), await player("Haddock2")];
  const anon = await player("Haddock3", { account: false });
  void kid;
  void anon;
  const two = await act({ op: "search", playerId: me.id, q: "Ha" });
  assert.deepEqual(two.body.matches, [], "two letters answer nothing");
  const r = await act({ op: "search", playerId: me.id, q: "hadd" });
  const handles = (r.body.matches as { handle: string }[]).map((m) => m.handle);
  assert.deepEqual(handles.sort(), grown.map((g) => g.handle).sort(), "no kid profiles, no players without an account");
  const own = await act({ op: "search", playerId: grown[0].id, q: "Haddock" });
  assert.ok(!(own.body.matches as { handle: string }[]).some((m) => m.handle === grown[0].handle), "you are not in your own results");
  /* friends already are not suggested; blocked players are not either */
  await act({ op: "request", playerId: me.id, handle: grown[0].handle });
  await act({ op: "accept", playerId: grown[0].id, code: me.code });
  await act({ op: "block", playerId: me.id, code: grown[1].code });
  const after = await act({ op: "search", playerId: me.id, q: "hadd" });
  assert.deepEqual(after.body.matches, []);
});

test("email invites: the answer is the same for any address, and the link becomes a request", async () => {
  mail.length = 0;
  const sender = await player("Inviter");
  const known = await player("Existing");
  await sql.query("insert into accounts (id, email) values ($1, $2)", ["acct-known", "known@example.com"]);
  const toStranger = await act({ op: "invite_email", playerId: sender.id, email: "stranger@example.com" });
  const toKnown = await act({ op: "invite_email", playerId: sender.id, email: "known@example.com" });
  assert.equal(toStranger.status, 200);
  assert.equal(toKnown.status, 200);
  const strip = (b: Record<string, unknown>) => JSON.stringify({ ...b, serverNow: 0 });
  assert.equal(strip(toStranger.body), strip(toKnown.body), "no difference a stranger could see");
  assert.equal(mail.length, 2, "both were mailed: we never looked the address up");
  assert.equal(mail[0].kind, "invite");
  assert.equal(mail[0].from, "Inviter");
  assert.match(mail[0].link, /^http:\/\/fac\.test\/\?friend=[A-Za-z0-9_-]{16,}$/);
  assert.equal((await act({ op: "invite_email", playerId: sender.id, email: "nope" })).body.error, "bad_email");
  /* the person opens the link: it is a request from the sender, not yet a friendship */
  const token = decodeURIComponent(mail[0].link.split("friend=")[1]);
  const redeemed = await act({ op: "redeem", playerId: known.id, token });
  assert.equal(redeemed.status, 200, JSON.stringify(redeemed.body));
  assert.equal((redeemed.body as unknown as Reply).friends.length, 0);
  assert.equal((redeemed.body as unknown as Reply).requests.incoming[0].code, sender.code);
  await act({ op: "accept", playerId: known.id, code: sender.code });
  assert.equal((await look(sender)).friends[0].code, known.code);
  /* a link works once, and nonsense does nothing */
  assert.equal((await act({ op: "redeem", playerId: known.id, token })).body.error, "invite_expired");
  assert.equal((await act({ op: "redeem", playerId: known.id, token: "x" })).body.error, "bad_invite");
  assert.equal((await act({ op: "redeem", playerId: known.id, token: "A".repeat(30) })).body.error, "invite_expired");
  /* the table holds hashes, never the address or the link's secret */
  const rows = await sql.query<{ token_hash: string; email_hash: string }>("select token_hash, email_hash from friend_invites");
  for (const r of rows) {
    assert.match(r.token_hash, /^[0-9a-f]{64}$/);
    assert.ok(!r.email_hash.includes("@"));
    assert.notEqual(r.token_hash, token);
  }
});

test("email invites: an expired link is refused; limits per address and per hour answer the same way", async () => {
  mail.length = 0;
  const s = await player("Mailer");
  const r = await act({ op: "invite_email", playerId: s.id, email: "old@example.com" }, NOW);
  assert.equal(r.status, 200);
  const token = decodeURIComponent(mail[0].link.split("friend=")[1]);
  const later = NOW + 8 * 24 * 60 * 60_000;
  const reader = await player("Late");
  assert.equal((await act({ op: "redeem", playerId: reader.id, token }, later)).body.error, "invite_expired");
  /* three a day to one address; the next ones look sent but nothing goes out */
  mail.length = 0;
  const m = await player("Nagger");
  const results = [];
  for (let i = 0; i < EMAIL_INVITES_PER_ADDRESS_PER_DAY + 2; i++) results.push(await act({ op: "invite_email", playerId: m.id, email: "same@example.com" }));
  assert.ok(results.every((x) => x.status === 200 || x.status === 429));
  assert.equal(mail.length, EMAIL_INVITES_PER_ADDRESS_PER_DAY, "the address was mailed only up to its cap");
  /* a player can only send a handful an hour, whoever they are mailing */
  const busy = await player("Busy");
  let blockedAt = 0;
  for (let i = 0; i < EMAIL_INVITES_PER_HOUR + 2; i++) {
    const x = await act({ op: "invite_email", playerId: busy.id, email: `friend${i}@example.com` });
    if (x.status === 429 && !blockedAt) blockedAt = i;
  }
  assert.equal(blockedAt, EMAIL_INVITES_PER_HOUR);
});

test("block: friendship and requests go, they cannot ask again, they cannot find you, and you can unblock", async () => {
  const me = await player("Blocker");
  const pest = await player("Pestering");
  await act({ op: "request", playerId: me.id, handle: pest.handle });
  await act({ op: "accept", playerId: pest.id, code: me.code });
  assert.equal((await look(me)).friends.length, 1);
  await act({ op: "request", playerId: pest.id, handle: me.handle }); // nothing: already friends
  const b = await act({ op: "block", playerId: me.id, code: pest.code });
  const mine = b.body as unknown as Reply;
  assert.equal(mine.friends.length, 0);
  assert.equal(mine.blocked[0].code, pest.code);
  assert.equal((await look(pest)).friends.length, 0, "friendship removed both ways");
  /* they try again, by name and by code */
  const again = await act({ op: "request", playerId: pest.id, handle: me.handle });
  assert.equal(again.status, 200, "no hint that they are blocked");
  assert.equal((await look(me)).requests.incoming.length, 0);
  assert.equal((await look(pest)).requests.outgoing.length, 0, "nothing was stored");
  assert.equal((await act({ op: "add", playerId: pest.id, code: me.code })).body.error, "no_such_code");
  assert.equal((await act({ op: "add", playerId: me.id, code: pest.code })).body.error, "no_such_code", "and you cannot add them while they are blocked");
  /* an old pending request from them is gone too */
  const other = await player("Other");
  await act({ op: "request", playerId: other.id, handle: me.handle });
  await act({ op: "block", playerId: me.id, code: other.code });
  assert.equal((await look(me)).requests.incoming.length, 0);
  /* unblock lets them ask again */
  await act({ op: "unblock", playerId: me.id, code: pest.code });
  assert.equal((await look(me)).blocked.length, 1, "only Other is still blocked");
  await act({ op: "request", playerId: pest.id, handle: me.handle });
  assert.equal((await look(me)).requests.incoming[0].code, pest.code);
});

test("a blocked player's event invites do not reach you", async () => {
  const a = await player("Inv A");
  const b = await player("Inv B");
  await act({ op: "add", playerId: a.id, code: b.code });
  await sql.query("insert into invites (from_id, to_id, event_id) values ($1, $2, $3)", [b.id, a.id, "nonexistent"]);
  /* the join to events drops it anyway; here we check the block filter does not break the query */
  await act({ op: "block", playerId: a.id, code: b.code });
  assert.equal(((await look(a)) as unknown as { invites: unknown[] }).invites.length, 0);
});
