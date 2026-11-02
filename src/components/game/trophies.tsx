import { useEffect } from "react";
import { BIOMES } from "@/game/content";
import { useGame } from "@/game/engine";
import { CATEGORY_INFO, scoreLabel } from "@/game/scoring";
import { MEDAL_NAMES, shortDate, SKINS, teamById, unlockedSkins, type Trophy } from "@/game/social";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/* The Trophy Shelf and Tournament history in the Lodge (docs/architecture/06 §3.5).
   Everything shown here came from the server's results (api/trophies). Rewards never add power:
   a medal is a trophy to look at, a title to read and a bobber skin to wear. */

const CUP = ["", "#e2b13a", "#b9c4cf", "#c98a52"] as const;

function Cup({ medal, size = 64 }: { medal: 1 | 2 | 3; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={`${MEDAL_NAMES[medal]} trophy`}>
      <rect x="14" y="54" width="36" height="6" rx="2" fill="#3a4651" />
      <rect x="24" y="48" width="16" height="8" rx="1.5" fill="#4a5864" />
      <rect x="29" y="40" width="6" height="10" fill={CUP[medal]} />
      <path d="M14 8h36v12c0 11-8 20-18 20S14 31 14 20z" fill={CUP[medal]} />
      <path d="M14 12H6v4c0 6 4 10 10 11M50 12h8v4c0 6-4 10-10 11" fill="none" stroke={CUP[medal]} strokeWidth="3" strokeLinecap="round" />
      <path d="M22 14c0 8 3 14 8 18" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Pedestal({ t }: { t: Trophy }) {
  const team = teamById(t.team);
  return (
    <li className="flex flex-col items-center rounded-2xl border border-line bg-bg/40 p-2 text-center" data-testid="trophy">
      <Cup medal={t.medal} />
      <span className={cn("text-xs font-semibold", t.medal === 1 ? "text-brass" : "text-muted")}>{MEDAL_NAMES[t.medal]}</span>
      <span className="text-xs leading-tight">
        {BIOMES[t.water]?.name} {team ? `· ${team.emoji} ${team.name}` : `· ${CATEGORY_INFO[t.category]?.name ?? ""}`}
      </span>
      <span className="text-[10px] text-muted">{shortDate(t.at)}</span>
    </li>
  );
}

/** Lodge → Trophies: the shelf, your titles and your bobber skins. */
export function TrophyShelf() {
  const trophies = useGame((s) => s.trophies);
  const titles = useGame((s) => s.titles);
  const skin = useGame((s) => s.bobberSkin);
  const setSkin = useGame((s) => s.setSkin);
  const sync = useGame((s) => s.syncTrophies);
  useEffect(() => {
    void sync(true);
  }, [sync]);
  const have = unlockedSkins(trophies);
  const gold = trophies.filter((t) => t.medal === 1).length;
  return (
    <div className="flex flex-col gap-3" data-testid="trophy-shelf">
      <section className="rounded-2xl border border-line bg-surface p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-serif text-lg">Trophy Shelf</h3>
          <Button variant="quiet" className="min-h-11 px-3 py-1 text-sm" onClick={() => void sync(false)}>
            Check for new trophies
          </Button>
        </div>
        {trophies.length === 0 ? (
          <p className="mt-1 text-sm text-muted">Finish in the top three of a tournament and a trophy goes on the shelf. Win one and you earn a title.</p>
        ) : (
          <>
            <p className="text-sm text-muted">
              {trophies.length} {trophies.length === 1 ? "trophy" : "trophies"} · {gold} gold
            </p>
            <ul className="mt-2 grid grid-cols-3 gap-2 max-sm:grid-cols-2">{trophies.map((t) => <Pedestal key={t.id} t={t} />)}</ul>
          </>
        )}
      </section>
      <section className="rounded-2xl border border-line bg-surface p-3" data-testid="titles">
        <h3 className="font-serif text-lg">Titles</h3>
        {titles.length === 0 ? <p className="text-sm text-muted">Win an event to earn a title like &quot;Pond Champion · Nov 2&quot;.</p> : null}
        <ul className="mt-1 flex flex-col gap-1">
          {titles.slice(0, 12).map((t) => (
            <li key={t} className="rounded-full border border-line px-3 py-1 text-sm text-brass">
              {t}
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border border-line bg-surface p-3" data-testid="skins">
        <h3 className="font-serif text-lg">Bobber skins</h3>
        <p className="text-sm text-muted">Just for show. Medals unlock them, and they never change how the fish bite.</p>
        <ul className="mt-2 grid grid-cols-2 gap-2">
          {SKINS.map((k) => {
            const owned = have.includes(k.id);
            return (
              <li key={k.id}>
                <button
                  type="button"
                  disabled={!owned}
                  aria-pressed={skin === k.id}
                  onClick={() => setSkin(k.id)}
                  className={cn("flex min-h-14 w-full items-center gap-2 rounded-xl border p-2 text-left disabled:opacity-45", skin === k.id ? "border-brass bg-brass/10" : "border-line")}
                >
                  <span className="relative inline-block size-8 shrink-0 rounded-full" style={{ background: `linear-gradient(${k.top} 50%, ${k.bottom} 50%)`, boxShadow: `0 0 0 3px ${k.ring}` }} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm">{k.name}</span>
                    <span className="block text-[11px] leading-tight text-muted">{owned ? (skin === k.id ? "In use" : "Tap to wear") : k.blurb}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** Lodge → Record: your last few events, from the server's results. */
export function TourneyHistory() {
  const history = useGame((s) => s.tourneyHistory);
  if (!history.length) return null;
  return (
    <section className="rounded-2xl border border-line bg-surface p-3" aria-label="Tournament history" data-testid="tourney-history">
      <h3 className="font-serif text-lg">Tournament history</h3>
      <ul className="mt-1 flex flex-col">
        {history.slice(0, 8).map((h) => (
          <li key={h.id} className="flex items-center justify-between gap-2 border-t border-line py-1.5 text-sm first:border-0">
            <span className="min-w-0 truncate">
              {h.medal ? ["", "🥇", "🥈", "🥉"][h.medal] + " " : ""}
              {h.title}
            </span>
            <span className="shrink-0 text-muted">
              #{h.rank}/{h.entrants} · {scoreLabel(h.category, h.score)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
