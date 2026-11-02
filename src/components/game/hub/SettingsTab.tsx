import { useHubUi } from "@/game/hubstate";
import { Icon, type IconName } from "@/components/game/hub/icons";
import { DarkPanel } from "@/components/game/hub/panel-shell";
import { MasterDetail, type HubItem } from "@/components/game/hub/parts";
import { TestingLine } from "@/components/game/test-phase";
import { SETTINGS_SECTIONS } from "@/components/game/hub/settings-sections";

export function SettingsTab({ split }: { split: boolean }) {
  const saved = useHubUi((s) => s.item.settings);
  const items: HubItem[] = SETTINGS_SECTIONS.map((s) => ({
    id: s.id,
    title: s.title,
    sub: s.sub,
    icon: <Icon name={s.icon as IconName} className="size-5" />,
  }));
  return (
    <MasterDetail
      tab="settings"
      items={items}
      selectedId={SETTINGS_SECTIONS.some((s) => s.id === saved) ? (saved as string) : null}
      listLabel="Settings"
      split={split}
      detailLabel="Settings"
      bare
      render={(id) => {
        const sec = SETTINGS_SECTIONS.find((s) => s.id === id) ?? SETTINGS_SECTIONS[0];
        const View = sec.View;
        return (
          <DarkPanel label={sec.title} className="h-full">
            <h2 className="mb-1 font-serif text-2xl">{sec.title}</h2>
            <p className="mb-3 text-sm text-muted">{sec.sub}</p>
            <View />
            <TestingLine className="mt-4 text-muted" />
          </DarkPanel>
        );
      }}
    />
  );
}
