import { useEffect, useRef, useState } from "react";
import { BIOMES, dexCount, rankName, TOTAL_SPECIES } from "@/game/content";
import { useGame } from "@/game/engine";
import { useHubUi } from "@/game/hubstate";
import type { LayoutPlan } from "@/game/device";
import { Stage } from "@/components/game/stage";
import { FotdLine } from "@/components/game/fun";
import { CloudButton } from "@/components/game/account";
import { FullscreenButton } from "@/components/game/fullscreen";
import { Icon, Logo } from "@/components/game/hub/icons";
import { Motes } from "@/components/game/hub/Hub";
import { lastPlayed, openCard } from "@/components/game/hub/PlayTab";
import { Button } from "@/components/ui/button";
import { TestingLine } from "@/components/game/test-phase";

/** The front door, and the first level of the menu (WP-12): the water painted behind the logo, one big Play button, and Continue, Settings,
    Friends and Collections underneath (the cloud button is top right). Nothing on this level is about one mode, and nothing changes a game. */
export function TitleScreen({ plan }: { plan: LayoutPlan }) {
  const dex = useGame((s) => dexCount(s.dex));
  const lv = useGame((s) => s.lv);
  const ub = useGame((s) => s.ub);
  const biome = useGame((s) => s.biome);
  const hydrated = useGame((s) => s.hydrated);
  const hubOpen = useHubUi((s) => s.open);
  const openHub = useHubUi((s) => s.openHub);
  const [preview, setPreview] = useState<number | null>(null);
  const touch = useRef(0);
  const shown = preview ?? biome;
  const mobile = plan.kind === "mobile";
  const started = hydrated && (lv > 1 || dex > 0);

  const swipe = (dx: number) => {
    if (Math.abs(dx) < 50) return;
    const list = ub.length ? ub : [0];
    const i = Math.max(0, list.indexOf(shown));
    setPreview(list[(i + (dx < 0 ? 1 : -1) + list.length) % list.length]);
  };

  /* Enter plays when nothing else has the keys. */
  useEffect(() => {
    if (hubOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Enter" || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("button, a, input, textarea, select, [role=dialog]")) return;
      openHub("play");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hubOpen, openHub]);

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-bg"
      onTouchStart={(e) => {
        touch.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => swipe(e.changedTouches[0].clientX - touch.current)}
    >
      <div className="hub-sway absolute -inset-[3%]">
        <Stage menu className="absolute inset-0" biomeOverride={shown} big={mobile} />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgb(20_12_4/0.1),rgb(20_12_4/0.7))]" />
      <Motes />
      {hubOpen ? null : (
        <div className="safe-top safe-x pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-end gap-2 p-3">
          <CloudButton />
          <FullscreenButton />
        </div>
      )}
      <main className="safe-top safe-bot safe-x absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center text-[#fff4d6]">
        <div className="hub-in flex flex-col items-center gap-2 drop-shadow-[0_4px_14px_rgb(0_0_0/0.65)]">
          <Logo className="size-24" />
          <h1 className="font-serif text-6xl leading-none tracking-wide sm:text-7xl">FAC Ultra</h1>
        </div>
        <p className="max-w-md text-sm text-[#f1e5c9] [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
          {started ? `${rankName(lv)} · Lv ${lv} · ${dex}/${TOTAL_SPECIES} fish found` : "A painted fishing game. Fifteen waters, fifteen big fish."}
        </p>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <Button data-testid="title-play" className="min-h-14 text-xl" onClick={() => openHub("play")} autoFocus>
            <Icon name="play" className="size-6" /> Play
          </Button>
          <div className="flex gap-3">
            {started ? (
              <Button variant="ghost" className="flex-1" onClick={() => openCard(lastPlayed() ?? "expedition")}>
                Continue
              </Button>
            ) : null}
            <Button variant="ghost" className="flex-1" onClick={() => openHub("settings")}>
              Settings
            </Button>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" data-testid="title-friends" onClick={() => openHub("friends")}>
              Friends
            </Button>
            <Button variant="ghost" className="flex-1" data-testid="title-collections" onClick={() => openHub("collections")}>
              Collections
            </Button>
          </div>
        </div>
        <p className="text-xs text-[#f1e5c9]/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
          {BIOMES[shown].name}
          {ub.length > 1 ? " · swipe to look at other waters" : ""}
        </p>
        <p className="text-xs text-[#f1e5c9]/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
          <FotdLine />
        </p>
        <TestingLine className="text-[#f1e5c9]/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]" />
      </main>
      <WhoIsFishing />
    </div>
  );
}

/** First launch: "Who's fishing today?" Kid and Both turn Kid Mode on; Grown-up leaves it off. */
function WhoIsFishing() {
  const ask = useGame((s) => s.askWho);
  const answer = useGame((s) => s.answerWho);
  if (!ask) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg/80 p-4">
      <div role="dialog" aria-label="Who is fishing today" className="w-full max-w-sm rounded-2xl border border-brass bg-surface p-5 text-left text-fg">
        <p className="font-serif text-2xl">Who&apos;s fishing today?</p>
        <p className="mt-1 text-sm text-muted">Kid Mode makes the writing bigger and the fishing a little friendlier. You can change it any time in Settings.</p>
        <div className="mt-4 flex flex-col gap-2">
          <Button onClick={() => answer("kid")}>A kid</Button>
          <Button variant="ghost" onClick={() => answer("both")}>
            A grown-up and a kid
          </Button>
          <Button variant="ghost" onClick={() => answer("grown")}>
            A grown-up
          </Button>
        </div>
      </div>
    </div>
  );
}
