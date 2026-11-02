import { lazy, Suspense, type ComponentType } from "react";
import { useGame } from "@/game/engine";
import { useHubUi } from "@/game/hubstate";
import { MODES } from "@/game/modes";
import { useFunOn } from "@/components/game/fun-hooks";
import { Logbook } from "@/components/game/trips";
import { PetView, RegularsView } from "@/components/game/fun";
import { RunsLog } from "@/components/game/survival";
import { TrophyShelf } from "@/components/game/trophies";
import { Icon, type IconName } from "@/components/game/hub/icons";
import { DarkPanel } from "@/components/game/hub/panel-shell";
import { MasterDetail, type HubItem } from "@/components/game/hub/parts";
import { Painting } from "@/components/game/hub/art";

const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, key: K) => lazy(() => load().then((m) => ({ default: m[key] })));
const Lodge = () => import("@/components/game/panels/LodgePanel");
const RecordView = named(Lodge, "Record");
const SurvivalRecord = named(Lodge, "SurvivalRecord");
const Aquarium = named(Lodge, "Aquarium");
const DerbyView = named(Lodge, "DerbyView");
const CrewView = named(Lodge, "CrewView");
const DexPanel = lazy(() => import("@/components/game/panels/DexPanel").then((m) => ({ default: m.DexPanel })));

type Entry = { id: string; title: string; sub: string; icon: IconName; art: string; view: ComponentType };

/** Every Lodge room, in plain English. The id is the old Lodge view name, so the old routes still land on the right one. */
function entries(survival: boolean, trips: boolean, fun: boolean, tournament: boolean): Entry[] {
  const book: Entry = { id: "book", title: "Fish book", sub: "Every fish you have found, as stickers", icon: "lodge", art: "pond", view: DexPanel };
  if (survival) {
    return [
      { id: "record", title: "Best runs", sub: "Your longest survivals and best fish", icon: "flag", art: "arctic", view: SurvivalRecord },
      { id: "logbook", title: "Runs", sub: "Every run you have finished", icon: "map", art: "arctic", view: RunsLog },
      book,
    ];
  }
  const list: Entry[] = [
    { id: "trophies", title: "Trophies and medals", sub: "Prizes from tournaments", icon: "flag", art: "coast", view: TrophyShelf },
    { id: "record", title: "Records", sub: "Your biggest fish and best days", icon: "flag", art: "river", view: RecordView },
  ];
  if (trips) list.push({ id: "logbook", title: "Logbook", sub: "Your fishing trips", icon: "map", art: "lake", view: Logbook });
  list.push(book);
  if (fun) {
    list.push({ id: "pet", title: "Your buddy", sub: "A friend who finds lures", icon: "players", art: "mangrove", view: PetView });
    list.push({ id: "regulars", title: "The Regulars", sub: "The anglers you race against", icon: "players", art: "swamp", view: RegularsView });
  }
  list.push(
    { id: "tank", title: "Aquarium", sub: "Fish that earn coins", icon: "waters", art: "reef", view: Aquarium },
    { id: "derby", title: "Derby", sub: "A quick race for a prize", icon: "flag", art: "canyon", view: DerbyView },
    { id: "crew", title: "Fish together online", sub: "Make or join a room", icon: "players", art: "kelp", view: CrewView },
  );
  return tournament ? list.filter((e) => e.id === "record" || e.id === "book" || e.id === "trophies") : list;
}

export function LodgeTab({ split }: { split: boolean }) {
  const mode = useGame((s) => s.mode);
  const rules = MODES[mode];
  const fun = useFunOn();
  const list = entries(!!rules.survival, !!rules.trips, fun, mode === "tournament");
  const saved = useHubUi((s) => s.item.lodge);
  const items: HubItem[] = list.map((e) => ({
    id: e.id,
    title: e.title,
    sub: e.sub,
    thumb: <Painting id={e.art} className="size-11 shrink-0 rounded-lg" />,
  }));
  const known = list.some((e) => e.id === saved);
  return (
    <MasterDetail
      tab="lodge"
      items={items}
      selectedId={known ? (saved as string) : null}
      listLabel="Lodge"
      split={split}
      detailLabel="Lodge"
      bare
      render={(id) => {
        const e = list.find((x) => x.id === id) ?? list[0];
        const View = e.view;
        return (
          <DarkPanel label={e.title} className="h-full">
            <div className="mb-3 flex items-center gap-3 border-b border-line pb-3">
              <Icon name={e.icon} className="size-6 text-brass" />
              <div>
                <h2 className="font-serif text-2xl leading-none">{e.title}</h2>
                <p className="mt-1 text-sm text-muted">{e.sub}</p>
              </div>
            </div>
            <Suspense fallback={<p className="text-muted">Opening…</p>}>
              <View />
            </Suspense>
          </DarkPanel>
        );
      }}
    />
  );
}
