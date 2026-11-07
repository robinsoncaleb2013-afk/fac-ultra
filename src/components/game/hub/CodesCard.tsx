import { useState } from "react";
import { DarkPanel } from "@/components/game/hub/panel-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** The result of one claim, as the engine action reports it. A bare string is read as the message on its own. */
export type ClaimResult = { ok: boolean; message: string } | string;

const field = "min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-fg placeholder:text-muted";

/**
 * Codes: type a promo code, claim its reward. This card only holds the typing and shows
 * the answer — every rule (what a code is worth, one claim per save) lives in
 * src/game/promo.ts, reached through the `onClaim` prop the engine wires up.
 */
export function CodesCard({ claimed, onClaim }: { claimed: string[]; onClaim: (code: string) => ClaimResult }) {
  const [code, setCode] = useState("");
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);

  const claim = () => {
    const raw = code.trim();
    if (!raw) return;
    const r = onClaim(raw);
    const out = typeof r === "string" ? { ok: true, message: r } : r;
    setNote({ text: out.message, bad: !out.ok });
    if (out.ok) setCode("");
  };

  return (
    <DarkPanel label="Codes">
      <h2 className="mb-1 font-serif text-2xl">Codes</h2>
      <p className="mb-3 text-sm text-muted">Type a code from the FAC Ultra page to claim its reward.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          claim();
        }}
      >
        <div className="flex gap-2">
          <input
            aria-label="Promo code"
            value={code}
            maxLength={24}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Type your code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className={cn(field, "text-center font-serif text-lg tracking-widest")}
          />
          <Button data-nav="act" type="submit" className="min-h-11 shrink-0" disabled={!code.trim()}>
            Claim
          </Button>
        </div>
      </form>
      {note ? (
        <p className={cn("mt-2 text-sm", note.bad ? "text-[#ff8f6b]" : "text-lagoon")} role={note.bad ? "alert" : "status"}>
          {note.text}
        </p>
      ) : null}
      {claimed.length ? (
        <p className="mt-2 text-sm text-muted">
          Claimed: <span className="font-serif tracking-widest text-brass">{claimed.join(", ")}</span>
        </p>
      ) : null}
    </DarkPanel>
  );
}
