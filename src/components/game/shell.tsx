import { useEffect } from "react";
import { hydrate, useGame } from "@/game/engine";
import { useKeys } from "@/components/game/keys";
import { DesktopLayout } from "@/components/game/layout/DesktopLayout";
import { MobileLayout } from "@/components/game/layout/MobileLayout";
import { countSession } from "@/components/game/sessions";
import { useForm } from "@/components/game/layout/use-form";
import { MainMenu } from "@/components/game/menu";
import { Toasts, WelcomeBack } from "@/components/game/overlays";

/** The screen router: menu or game, in the layout this device gets (docs/architecture/03 §1, 09 §2). */
export function Game() {
  const screen = useGame((s) => s.screen);
  const { ready, plan, height } = useForm();
  useEffect(() => {
    hydrate();
    countSession();
  }, []);
  useKeys();

  if (!ready) return <div className="h-dvh bg-bg" />;
  return (
    <div className="h-dvh bg-bg text-fg">
      {screen === "menu" ? (
        <>
          <MainMenu plan={plan} />
          <Toasts />
        </>
      ) : plan.kind === "desktop" ? (
        <DesktopLayout plan={plan} />
      ) : (
        <MobileLayout plan={plan} height={height} />
      )}
      <WelcomeBack />
    </div>
  );
}
