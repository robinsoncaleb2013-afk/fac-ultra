import { useEffect } from "react";
import { applySpeedTest, hydrate, useGame } from "@/game/engine";
import { useKeys } from "@/components/game/keys";
import { DesktopLayout } from "@/components/game/layout/DesktopLayout";
import { MobileLayout } from "@/components/game/layout/MobileLayout";
import { countSession } from "@/components/game/sessions";
import { useForm } from "@/components/game/layout/use-form";
import { Hub } from "@/components/game/hub/Hub";
import { HubKeys } from "@/components/game/hub/HubKeys";
import { TitleScreen } from "@/components/game/hub/TitleScreen";
import { Wheel } from "@/components/game/hub/Wheel";
import { Satchel } from "@/components/game/hub/Satchel";
import { InviteLinkHost } from "@/components/game/hub/friends-data";
import { runSpeedTest } from "@/game/probe";
import { Toasts, WelcomeBack } from "@/components/game/overlays";
import { useKidAttr } from "@/components/game/use-kid";
import { Ambience } from "@/components/game/fun";
import { useCbAttr } from "@/components/game/fun-hooks";
import { TripCard, TripStart } from "@/components/game/trips";
import { SurvivalEnd, SurvivalStart } from "@/components/game/survival";
import { TournamentTicker } from "@/components/game/tournament";
import { TournamentLobby } from "@/components/game/lobby";
import { CloudHost } from "@/components/game/account";
import { ResetNotice } from "@/components/game/test-phase";
import { startEpochGate } from "@/game/epoch-gate";
import { resetCloudMemory } from "@/lib/accounts/client";

/** The screen router: menu or game, in the layout this device gets (docs/architecture/03 §1, 09 §2). */
export function Game() {
  const screen = useGame((s) => s.screen);
  const { ready, plan, height } = useForm();
  useEffect(() => {
    let alive = true;
    /* Test phase: on a new build, old progress is wiped BEFORE any save is read (docs/TEST-PHASE.md). */
    void startEpochGate(resetCloudMemory).then(() => {
      if (!alive) return;
      hydrate();
      countSession();
      void runSpeedTest().then(() => applySpeedTest()).catch(() => {});
    });
    return () => {
      alive = false;
    };
  }, []);
  useKeys();
  useKidAttr();
  useCbAttr();

  if (!ready) return <div className="h-dvh bg-bg" />;
  return (
    <div className="h-dvh bg-bg text-fg">
      {screen === "menu" ? (
        <>
          <TitleScreen plan={plan} />
          <Toasts />
        </>
      ) : plan.kind === "desktop" ? (
        <DesktopLayout plan={plan} />
      ) : (
        <MobileLayout plan={plan} height={height} />
      )}
      <Hub />
      <HubKeys />
      <Wheel />
      <Satchel />
      <InviteLinkHost />
      <Ambience />
      <TournamentTicker />
      <TournamentLobby />
      <CloudHost />
      <ResetNotice />
      <WelcomeBack />
      <TripCard />
      <TripStart />
      <SurvivalStart />
      <SurvivalEnd />
    </div>
  );
}
