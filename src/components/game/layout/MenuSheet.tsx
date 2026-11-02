import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { Maximize, Settings as Cog, Home } from "lucide-react";
import { useGame } from "@/game/engine";
import { toggleFullscreen } from "@/components/game/keys";

import { hintDismissed, dismissHint, sessionCount } from "@/components/game/sessions";

function Row({ icon, children, onClick }: { icon: React.ReactNode; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 text-left"
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

/** The ☰ sheet on phones: menu, settings, full screen, and an "add to home screen" hint. */
export function MenuSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const setScreen = useGame((s) => s.setScreen);
  const setLodgeView = useGame((s) => s.setLodgeView);
  const [hint, setHint] = useState(false);
  useEffect(() => {
    setHint(sessionCount() >= 2 && !hintDismissed());
  }, [open]);
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Drawer.Content className="safe-bot fixed inset-x-0 bottom-0 z-50 flex flex-col gap-2 rounded-t-3xl border border-line bg-bg p-4 outline-none">
          <Drawer.Title className="font-serif text-xl">Menu</Drawer.Title>
          <Drawer.Description className="sr-only">Main menu, settings and full screen</Drawer.Description>
          <Row icon={<Home className="size-5 text-brass" aria-hidden />} onClick={() => (onOpenChange(false), setScreen("menu"))}>
            Main menu
          </Row>
          <Row
            icon={<Cog className="size-5 text-brass" aria-hidden />}
            onClick={() => {
              onOpenChange(false);
              setLodgeView("settings");
            }}
          >
            Settings
          </Row>
          <Row icon={<Maximize className="size-5 text-brass" aria-hidden />} onClick={() => (toggleFullscreen(), onOpenChange(false))}>
            Full screen
          </Row>
          {hint ? (
            <div className="rounded-2xl border border-line bg-surface p-3 text-sm text-muted">
              <p className="font-serif text-base text-fg">Add to home screen</p>
              <p className="mt-1">iPhone (Safari): tap Share, then Add to Home Screen.</p>
              <p>Android (Chrome): tap the ⋮ menu, then Add to Home screen.</p>
              <button
                type="button"
                className="mt-2 min-h-11 rounded-full bg-surface-2 px-4 text-fg"
                onClick={() => {
                  dismissHint();
                  setHint(false);
                }}
              >
                Got it
              </button>
            </div>
          ) : null}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
