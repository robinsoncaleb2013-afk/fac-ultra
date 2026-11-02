import { useEffect, useState } from "react";
import { Cloud, CloudOff, X } from "lucide-react";
import { money } from "@/game/content";
import { describe, newerOf, type SyncMode } from "@/game/cloud";
import { parseSyncId } from "@/game/slots";
import { useGame } from "@/game/engine";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  activeProfile,
  backupCode,
  cancelSent,
  closeSheet,
  createProfile,
  deleteMyAccount,
  exportMyData,
  openSheet,
  reconcile,
  removeProfile,
  renameProfile,
  requestLink,
  resolveConflict,
  restoreBackup,
  selectProfile,
  signOut,
  startCloud,
  useCloud,
  type Choice,
  type Conflict,
} from "@/lib/accounts/client";

/* The account screens (WP-9, docs/architecture/07 §3-4): a quiet "Save to the cloud" button, a sheet to sign in
   and pick who is fishing, and the chooser that appears only when two saves each have something the other lacks.
   The game is fully playable without any of this. Words are short and kind: kids read them. */

const BASE_NAME: Record<string, string> = { expedition: "Expedition", story: "Story", recreational: "Relaxed Fishing", survival: "Survival", coop: "Co-op" };
/** "Expedition", or "Expedition, slot 2" for the numbered save slots (WP-16). */
const modeName = (id: SyncMode): string => {
  const p = parseSyncId(id);
  return p ? `${BASE_NAME[p.mode] ?? p.mode}${p.slot ? `, slot ${p.slot + 1}` : ""}` : id;
};

function ago(ms: number, now = Date.now()): string {
  if (!ms) return "a while ago";
  const m = Math.max(0, Math.round((now - ms) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** Starts the cloud layer once and shows the sheet and the chooser. Mounted once, by the shell. */
export function CloudHost() {
  useEffect(() => {
    void startCloud();
  }, []);
  return (
    <>
      <CloudSheet />
      <ConflictChooser />
    </>
  );
}

/** The one-line state of the cloud, in plain words. */
type Status = { signedIn: boolean; profile: string; status: string; lastSync: number; conflicts: number };

function statusLine(s: Status): string {
  if (!s.signedIn) return "Not signed in. Your fish are saved on this device.";
  if (!s.profile) return "Pick who is fishing.";
  if (s.status === "syncing") return "Saving to the cloud…";
  if (s.status === "offline") return "No connection right now. We'll save to the cloud when it's back.";
  if (s.status === "error") return "The cloud didn't answer. We'll try again soon.";
  if (s.conflicts > 0) return "Two saves need a decision.";
  return s.lastSync ? `Saved to the cloud ${ago(s.lastSync)}.` : "Signed in.";
}

function useStatus() {
  const signedIn = useCloud((s) => s.signedIn);
  const profile = useCloud((s) => activeProfile(s)?.name ?? "");
  const status = useCloud((s) => s.status);
  const lastSync = useCloud((s) => s.lastSync);
  const conflicts = useCloud((s) => s.conflicts.length);
  return { signedIn, profile, status, lastSync, conflicts };
}

/** The menu chip. */
export function CloudButton({ className }: { className?: string }) {
  const st = useStatus();
  const bad = st.signedIn && (st.status === "offline" || st.status === "error");
  const Icon = bad ? CloudOff : Cloud;
  return (
    <button
      type="button"
      onClick={openSheet}
      data-testid="cloud-button"
      className={cn(
        "pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-bg/75 px-4 text-sm text-fg backdrop-blur-md hover:border-brass",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
      {st.signedIn && st.profile ? `Cloud: ${st.profile}` : "Save to the cloud"}
    </button>
  );
}

/** A short line for the tournament lobby: sign-in is optional, and what it adds. */
export function CloudHint() {
  const st = useStatus();
  const kid = useGame((s) => s.kid);
  if (st.signedIn && st.profile) return <p className="mt-1 text-xs text-muted">Fishing as {st.profile}. Your trophies and friends follow you to any device.</p>;
  if (kid) return null;
  return (
    <p className="mt-1 text-xs text-muted">
      You don&apos;t need an account.{" "}
      <button type="button" className="underline hover:text-fg" onClick={openSheet}>
        Sign in
      </button>{" "}
      to keep your trophies and friends on every device.
    </p>
  );
}

/* ── The sheet ──────────────────────────────────────────────────────────── */

function Shell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-bg/80 p-3 max-md:p-0" data-testid="cloud-sheet">
      <div
        role="dialog"
        aria-label={title}
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-brass bg-surface p-5 max-md:h-dvh max-md:max-h-none max-md:rounded-none max-md:border-0"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-serif text-2xl leading-tight">{title}</h2>
          {onClose ? (
            <Button variant="quiet" className="min-h-11 px-3 py-2 text-sm" onClick={onClose} aria-label="Close">
              <X className="size-5" aria-hidden />
            </Button>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function CloudSheet() {
  const open = useCloud((s) => s.sheet);
  const conflicts = useCloud((s) => s.conflicts.length);
  const signedIn = useCloud((s) => s.signedIn);
  const profileId = useCloud((s) => s.profileId);
  const error = useCloud((s) => s.error);
  const notice = useCloud((s) => s.notice);
  if (!open || conflicts) return null;
  return (
    <Shell title={signedIn ? (profileId ? "Your cloud save" : "Who is fishing?") : "Save to the cloud"} onClose={closeSheet}>
      {error ? (
        <p className="mt-3 rounded-xl border border-[#e4572e] p-2 text-sm text-[#e4572e]" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-3 rounded-xl border border-brass p-2 text-sm" role="status">
          {notice}
        </p>
      ) : null}
      {signedIn ? <SignedIn /> : <SignedOut />}
    </Shell>
  );
}

function SignedOut() {
  const kid = useGame((s) => s.kid);
  const sentTo = useCloud((s) => s.sentTo);
  const busy = useCloud((s) => s.busy);
  const google = useCloud((s) => s.providers.google);
  const logOnly = useCloud((s) => s.providers.emailDelivery === "log");
  const [email, setEmail] = useState("");
  if (kid) {
    return (
      <>
        <p className="mt-3 text-sm">Cloud saves are set up by a grown-up.</p>
        <p className="mt-2 text-sm text-muted">
          Kid Mode is on, so we won&apos;t ask for an email here. Ask a grown-up to turn Kid Mode off in Settings, sign in once, and then
          everyone in the family can have their own profile. You can keep playing right now, your fish are saved on this device.
        </p>
        <Button variant="ghost" className="mt-4" onClick={closeSheet}>
          Back to the game
        </Button>
      </>
    );
  }
  if (sentTo) {
    return (
      <>
        <p className="mt-3 text-sm">
          Check your email! We sent a link to <b>{sentTo}</b>. Tap it and you&apos;re in. It works once, for 15 minutes.
        </p>
        {logOnly ? (
          <p className="mt-2 text-xs text-muted">
            This game server isn&apos;t set up to send email yet, so the link was written to the server&apos;s log instead (the window where
            the game is running).
          </p>
        ) : null}
        <Button variant="ghost" className="mt-4" onClick={cancelSent}>
          Use a different email
        </Button>
      </>
    );
  }
  return (
    <>
      <p className="mt-3 text-sm text-muted">
        You don&apos;t need an account to play. Signing in keeps your fish safe in the cloud, so you can pick up on any phone or computer,
        and your trophies and friends come with you.
      </p>
      <form
        className="mt-4 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) void requestLink(email);
        }}
      >
        <label htmlFor="cloud-email" className="text-sm text-muted">
          A grown-up&apos;s email
        </label>
        <input
          id="cloud-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          maxLength={254}
          className="min-h-12 rounded-xl border border-line bg-surface-2 px-3 text-fg"
        />
        <Button type="submit" disabled={busy || !email.trim()}>
          {busy ? "Sending…" : "Email me a sign-in link"}
        </Button>
      </form>
      {google ? (
        <a
          href="/api/google-start"
          className="mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-line bg-surface px-4 py-3 text-base font-semibold hover:border-brass"
        >
          Sign in with Google
        </a>
      ) : null}
      <p className="mt-3 text-xs text-muted">
        No password. Kids never type an email: once a grown-up is signed in, each family member just picks their nickname.
      </p>
    </>
  );
}

function SignedIn() {
  const profiles = useCloud((s) => s.profiles);
  const profileId = useCloud((s) => s.profileId);
  const max = useCloud((s) => s.max);
  const email = useCloud((s) => s.email);
  const busy = useCloud((s) => s.busy);
  const status = useStatus();
  const kidMode = useGame((s) => s.kid);
  const active = profiles.find((p) => p.id === profileId) ?? null;
  const restricted = kidMode;
  const [name, setName] = useState("");
  const [kidPick, setKidPick] = useState<boolean | null>(null);
  /* The first person added is usually the grown-up themselves; everyone after is usually a kid. */
  const forKid = kidPick ?? profiles.length > 0;
  const setForKid = setKidPick;
  const [ask, setAsk] = useState<"" | "delete" | "remove">("");
  const [target, setTarget] = useState("");
  const [typed, setTyped] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; text: string } | null>(null);

  return (
    <>
      {active ? (
        <p className="mt-2 text-sm text-muted" data-testid="cloud-status">
          {statusLine({ ...status, profile: active.name })}
        </p>
      ) : null}
      <h3 className="mt-4 font-serif text-lg">{profiles.length ? "Who is fishing?" : "Add the first angler"}</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {profiles.map((p) => (
          <li key={p.id} className={cn("rounded-2xl border p-3", p.id === profileId ? "border-brass" : "border-line")}>
            <div className="flex items-center justify-between gap-2">
              {renaming?.id === p.id ? (
                <input
                  aria-label="New nickname"
                  value={renaming.text}
                  maxLength={20}
                  onChange={(e) => setRenaming({ id: p.id, text: e.target.value })}
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3"
                />
              ) : (
                <span className="min-w-0 truncate font-serif text-lg">
                  {p.name}
                  {p.kid ? <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 align-middle font-sans text-xs text-muted">Kid</span> : null}
                </span>
              )}
              {renaming?.id === p.id ? (
                <Button
                  className="min-h-11 px-4 py-2 text-sm"
                  onClick={async () => {
                    await renameProfile(p.id, renaming.text);
                    setRenaming(null);
                  }}
                >
                  Save
                </Button>
              ) : p.id === profileId ? (
                <span className="text-sm text-brass">Fishing now</span>
              ) : (
                <Button className="min-h-11 px-4 py-2 text-sm" disabled={busy} onClick={() => void selectProfile(p.id)}>
                  Fish as {p.name}
                </Button>
              )}
            </div>
            {!restricted && renaming?.id !== p.id ? (
              <div className="mt-2 flex gap-3 text-sm">
                <button type="button" className="text-muted underline hover:text-fg" onClick={() => setRenaming({ id: p.id, text: p.name })}>
                  Rename
                </button>
                <button
                  type="button"
                  className="text-muted underline hover:text-fg"
                  onClick={() => {
                    setAsk("remove");
                    setTarget(p.id);
                  }}
                >
                  Remove
                </button>
              </div>
            ) : null}
            {ask === "remove" && target === p.id ? (
              <div className="mt-2 rounded-xl border border-line p-2 text-sm">
                <p>Remove {p.name} and their cloud saves? The fish on this device stay.</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="ghost"
                    className="min-h-11 px-4 py-2 text-sm"
                    onClick={async () => {
                      await removeProfile(p.id);
                      setAsk("");
                    }}
                  >
                    Yes, remove
                  </Button>
                  <Button variant="quiet" className="min-h-11 px-4 py-2 text-sm" onClick={() => setAsk("")}>
                    No, keep
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {!restricted && profiles.length < max ? (
        <form
          className="mt-3 rounded-2xl border border-line p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            await createProfile(name, forKid);
            setName("");
          }}
        >
          <label htmlFor="profile-name" className="text-sm text-muted">
            Add someone ({profiles.length} of {max})
          </label>
          <input
            id="profile-name"
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            placeholder="A nickname"
            className="mt-1 min-h-12 w-full rounded-xl border border-line bg-surface-2 px-3 text-fg"
          />
          <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={forKid} onChange={(e) => setForKid(e.target.checked)} className="size-5 accent-[var(--color-brass)]" />
            This is a kid. (Just a nickname, no email.)
          </label>
          <Button type="submit" className="mt-2 w-full" disabled={busy || !name.trim()}>
            Add to the family
          </Button>
        </form>
      ) : null}
      {restricted && profiles.length < max ? <p className="mt-3 text-xs text-muted">A grown-up adds and removes profiles. Turn Kid Mode off in Settings first.</p> : null}

      <div className="mt-4 flex flex-col gap-2">
        <Button variant="ghost" onClick={() => void reconcile()} disabled={!profileId}>
          Save now
        </Button>
        {!restricted ? (
          <>
            <p className="mt-2 text-xs text-muted">Signed in as {email}</p>
            <Button variant="ghost" onClick={() => void exportMyData()}>
              Download everything we hold
            </Button>
            <Button variant="ghost" onClick={() => void signOut()}>
              Sign out of the cloud
            </Button>
            {ask === "delete" ? (
              <div className="rounded-2xl border border-[#e4572e] p-3 text-sm">
                <p>This erases the account, every profile and every cloud save, and unlinks your friends. The fish on this device stay.</p>
                <label htmlFor="del" className="mt-2 block text-muted">
                  Type DELETE to be sure
                </label>
                <input id="del" value={typed} onChange={(e) => setTyped(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3" />
                <div className="mt-2 flex gap-2">
                  <Button variant="ghost" className="min-h-11 px-4 py-2 text-sm" disabled={typed !== "DELETE"} onClick={() => void deleteMyAccount(typed)}>
                    Delete it all
                  </Button>
                  <Button variant="quiet" className="min-h-11 px-4 py-2 text-sm" onClick={() => setAsk("")}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="quiet" onClick={() => setAsk("delete")}>
                Delete my account…
              </Button>
            )}
          </>
        ) : (
          <p className="text-xs text-muted">A grown-up can sign out or delete the account with Kid Mode off.</p>
        )}
      </div>
    </>
  );
}

/* ── The chooser ────────────────────────────────────────────────────────── */

function ConflictCard({ c, onPick, busy }: { c: Conflict; onPick: (choice: Choice) => void; busy: boolean }) {
  const dev = c.device ? ` from your ${c.device.toLowerCase()}` : "";
  const newer = newerOf(c.localAt, c.cloudAt);
  return (
    <section className="mt-3 rounded-2xl border border-line p-3" aria-label={`${modeName(c.mode)} saves`}>
      <h3 className="font-serif text-lg">{modeName(c.mode)}</h3>
      <dl className="mt-1 grid gap-2 text-sm">
        <div className="rounded-xl bg-surface-2 p-2">
          <dt className="text-muted">This device</dt>
          <dd className="font-semibold" data-testid="conflict-local">
            {describe(c.local, money, c.mode)}
          </dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-2">
          <dt className="text-muted">The cloud{dev}, saved {ago(c.cloudAt)}</dt>
          <dd className="font-semibold" data-testid="conflict-cloud">
            {describe(c.cloud, money, c.mode)}
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-col gap-2">
        <Button disabled={busy} onClick={() => onPick("device")}>
          Keep this device&apos;s fish
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => onPick("cloud")}>
          Keep the cloud&apos;s fish
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => onPick("newer")}>
          Keep the newer one ({newer === "device" ? "this device" : "the cloud"})
        </Button>
      </div>
    </section>
  );
}

export function ConflictChooser() {
  const conflicts = useCloud((s) => s.conflicts);
  const busy = useCloud((s) => s.busy);
  const error = useCloud((s) => s.error);
  if (!conflicts.length) return null;
  return (
    <Shell title="Two saves, one game!">
      <p className="mt-2 text-sm text-muted">
        This device and the cloud each have fish the other one doesn&apos;t. Pick the one you want to play. We keep the other for 7 days in
        Settings, just in case.
      </p>
      {error ? (
        <p className="mt-2 text-sm text-[#e4572e]" role="alert">
          {error}
        </p>
      ) : null}
      {conflicts.map((c) => (
        <ConflictCard key={c.mode} c={c} busy={busy} onPick={(choice) => void resolveConflict(c.mode as SyncMode, choice)} />
      ))}
    </Shell>
  );
}

/* ── Lodge → Settings ───────────────────────────────────────────────────── */

export function CloudSettings() {
  const st = useStatus();
  const backups = useCloud((s) => s.backups);
  const notify = useGame((s) => s.notify);
  return (
    <div className="rounded-2xl border border-line bg-surface p-3" data-testid="cloud-settings">
      <h4 className="font-serif">Cloud save</h4>
      <p className="mt-1 text-sm text-muted">
        {statusLine(st)}
      </p>
      <Button variant="ghost" className="mt-2" onClick={openSheet}>
        {st.signedIn ? "Profiles and account" : "Save to the cloud"}
      </Button>
      {backups.length ? (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-sm text-muted">The other copy from your last choice is kept for 7 days.</p>
          {backups.map((b) => (
            <div key={b.mode} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-0 flex-1">
                {modeName(b.mode)}, saved {ago(b.at)}
              </span>
              <Button
                variant="ghost"
                className="min-h-11 px-3 py-2 text-sm"
                onClick={() => {
                  if (window.confirm("Put this copy back? It replaces the fish on this device right now.")) restoreBackup(b.mode);
                }}
              >
                Put it back
              </Button>
              <Button
                variant="quiet"
                className="min-h-11 px-3 py-2 text-sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(backupCode(b)).then(() => notify("Code copied. Paste it in Save code below."));
                }}
              >
                Copy as a code
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
