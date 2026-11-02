import { useGame } from "@/game/engine";
import { useHubUi } from "@/game/hubstate";
import { Icon, type IconName } from "@/components/game/hub/icons";
import { DarkPanel } from "@/components/game/hub/panel-shell";
import { MasterDetail, type HubItem } from "@/components/game/hub/parts";
import { TestingLine, useTesting } from "@/components/game/test-phase";
import { AccountSection, settingsFor } from "@/components/game/hub/settings-sections";

/** Settings: the same panel on both levels (WP-12). Inside a game it also carries the account shortcut and "Your saves" for that mode. */
export function SettingsTab({ split }: { split: boolean }) {
  const inGame = useGame((s) => s.screen === "game");
  const sections = settingsFor(inGame);
  const saved = useHubUi((s) => s.item.settings);
  /* The "Testing build" line sits under the list, so a phone sees it on the list page too. */
  const testing = useTesting();
  const items: HubItem[] = sections.map((s) => ({
    id: s.id,
    title: s.title,
    sub: s.sub,
    icon: <Icon name={s.icon as IconName} className="size-5" />,
  }));
  return (
    <MasterDetail
      tab="settings"
      items={items}
      selectedId={sections.some((s) => s.id === saved) ? (saved as string) : null}
      listLabel="Settings"
      listFooter={testing ? <TestingLine className="px-2 py-1 text-[#c9b890]" /> : undefined}
      split={split}
      detailLabel="Settings"
      bare
      render={(id) => {
        const sec = sections.find((s) => s.id === id) ?? sections[0];
        const View = sec.View;
        return (
          <DarkPanel label={sec.title} className="h-full">
            <h2 className="mb-1 font-serif text-2xl">{sec.title}</h2>
            <p className="mb-3 text-sm text-muted">{sec.sub}</p>
            <View />
          </DarkPanel>
        );
      }}
    />
  );
}

/** The main menu's Account tab: sign in, family profiles and cloud saves (WP-9). */
export function AccountTab(_: { split: boolean }) {
  return (
    <DarkPanel label="Account and cloud saves" className="h-full">
      <h2 className="mb-1 font-serif text-2xl">Account and cloud saves</h2>
      <p className="mb-3 text-sm text-muted">Sign in, family profiles, keep your fish safe</p>
      <AccountSection />
    </DarkPanel>
  );
}
