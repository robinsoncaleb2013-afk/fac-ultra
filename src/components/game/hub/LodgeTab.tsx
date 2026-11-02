import { lazy, Suspense, type ComponentType } from "react";
import { useGame } from "@/game/engine";
import { useHubUi } from "@/game/hubstate";
import { eventModeOn } from "@/game/events";
import { MODES } from "@/game/modes";
import { useFunOn } from "@/components/game/fun-hooks";
import { EventsView } from "@/components/game/events";
import { ModeLabel } from "@/components/game/mode-label";
import { Logbook } from "@/components/game/trips";
import { PetView, RegularsView } from "@/components/game/fun";
import { RunsLog } from "@/components/game/survival";
import { TrophyShelf } from "@/components/game/trophies";
import { Icon, type IconName } from "@/components/game/hub/icons";
import { DarkPanel } from "@/components/game/hub/panel-shell";
import { MasterDetail, type HubItem } from "@/components/game/hub/parts";
import { Painting } from "@/components/game/hub/art";
import { AchievementsRoom } from "@/components/game/achievements-ui";
import { KidsBook, PbRoom } from "@/components/game/trophy-room";
import { StoryRoom } from "@/components/game/story-ui";

const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, key: K) => lazy(() => load().then((m) => ({ default: m[key] })));
const Lodge = () => import("@/components/game/panels/LodgePanel");
const RecordView = named(Lodge, "Record");
const SurvivalRecord = named(Lodge, "SurvivalRecord");
const Aquarium = named(Lodge, "Aquarium");
const DerbyView = named(Lodge, "DerbyView");
const CrewView = named(Lodge, "CrewView");
const DexPanel = lazy(() => import("@/components/game/panels/DexPanel").then((m) => ({ default: m.DexPanel })));

type Entry = { id: string; title: string; sub: string; icon: IconName; art: string; view: ComponentType };

/** Which rooms each tab shows (WP-12). The Lodge (Expedition, Co-op and an event's trophies), Survival's Log, and Recreational's
    Collection and Logbook are cuts of the same rooms, so nothing was lost, only moved to the tab of the mode it belongs to. */
export type LodgeScope = "lodge" | "log" | "collection";

/** Every room, in plain English. The id is the old Lodge view name, so the old routes still land on the right one. */
function entries(scope: LodgeScope, rules: { trips: boolean; aquarium: boolean; economy: boolean; survival?: true; id: string }, fun: boolean): Entry[] {
  const book: Entry = { id: "book", title: "Fish book", sub: "Every fish you have found, as stickers", icon: "lodge", art: "pond", view: DexPanel };
  if (scope === "log") {
    return [
      { id: "record", title: "Best runs", sub: "Your longest survivals and best fish", icon: "flag", art: "arctic", view: SurvivalRecord },
      { id: "logbook", title: "Runs", sub: "Every run you have finished", icon: "map", art: "arctic", view: RunsLog },
      book,
    ];
  }
  const record: Entry = { id: "record", title: "Records", sub: "Your biggest fish and best days", icon: "flag", art: "river", view: RecordView };
  const logbook: Entry = { id: "logbook", title: "Logbook", sub: "Your fishing trips", icon: "map", art: "lake", view: Logbook };
  const pet: Entry = { id: "pet", title: "Your buddy", sub: "A friend who finds lures", icon: "players", art: "mangrove", view: PetView };
  const regulars: Entry = { id: "regulars", title: "The Regulars", sub: "The anglers you race against", icon: "players", art: "swamp", view: RegularsView };
  const events: Entry = { id: "events", title: "Events", sub: "Rare things that happen on long fishing days", icon: "flag", art: "mangrove", view: EventsView };
  const evOn = eventModeOn(rules as Parameters<typeof eventModeOn>[0]);
  const tank: Entry = { id: "tank", title: "Aquarium", sub: "Fish that earn coins", icon: "waters", art: "reef", view: Aquarium };
  const trophies: Entry = { id: "trophies", title: "Trophies and medals", sub: "Prizes from tournaments", icon: "flag", art: "coast", view: TrophyShelf };
  /* WP-16: the Trophy Room, Achievements and the Kids book (12 §1, §6, §8). Events and Survival have none of them. */
  const pb: Entry = { id: "pbroom", title: "Trophy room", sub: "Your biggest fish of every kind", icon: "flag", art: "coast", view: PbRoom };
  const ach: Entry = { id: "achievements", title: "Achievements", sub: "Goals you have reached", icon: "flag", art: "kelp", view: AchievementsRoom };
  const kids: Entry = { id: "kidsbook", title: "Kids book", sub: "Fish from Kid Mode and Super Easy", icon: "lodge", art: "pond", view: KidsBook };
  const storyRoom: Entry = { id: "story", title: "Story", sub: "Your chapters, goals and rewards", icon: "map", art: "swamp", view: StoryRoom };
  if (scope === "collection") {
    const list: Entry[] = [book, record, pb, ach, kids];
    if (evOn) list.push(events);
    if (fun) list.push(pet, regulars);
    if (rules.aquarium) list.push(tank);
    return list;
  }
  /* The Lodge. A tournament shows only what gives no edge: records, the book and trophies. */
  if (rules.id === "tournament") return [trophies, record, book];
  const list: Entry[] = rules.id === "story" ? [storyRoom, trophies, record] : [trophies, record];
  list.push(pb, ach, kids);
  if (rules.trips) list.push(logbook);
  list.push(book);
  if (evOn) list.push(events);
  if (fun) list.push(pet, regulars);
  list.push(
    tank,
    { id: "derby", title: "Derby", sub: "A quick race for a prize", icon: "flag", art: "canyon", view: DerbyView },
    { id: "crew", title: "Fish together online", sub: "Make or join a room", icon: "players", art: "kelp", view: CrewView },
  );
  return list;
}

const LABEL: Record<LodgeScope, string> = { lodge: "Lodge", log: "Log", collection: "Collection" };

function LodgeRooms({ split, scope }: { split: boolean; scope: LodgeScope }) {
  const mode = useGame((s) => s.mode);
  const rules = MODES[mode];
  const fun = useFunOn();
  const list = entries(scope, rules, fun);
  const saved = useHubUi((s) => s.item[scope]);
  const items: HubItem[] = list.map((e) => ({
    id: e.id,
    title: e.title,
    sub: e.sub,
    thumb: <Painting id={e.art} className="size-11 shrink-0 rounded-lg" />,
  }));
  const known = list.some((e) => e.id === saved);
  return (
    <MasterDetail
      tab={scope}
      items={items}
      selectedId={known ? (saved as string) : null}
      listLabel={LABEL[scope]}
      split={split}
      detailLabel={LABEL[scope]}
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
            <ModeLabel className="mb-3" />
            <Suspense fallback={<p className="text-muted">Opening…</p>}>
              <View />
            </Suspense>
          </DarkPanel>
        );
      }}
    />
  );
}

export const LodgeTab = ({ split }: { split: boolean }) => <LodgeRooms split={split} scope="lodge" />;
/** Survival's Log. */
export const LogTab = ({ split }: { split: boolean }) => <LodgeRooms split={split} scope="log" />;
/** Recreational's Collection. */
export const CollectionTab = ({ split }: { split: boolean }) => <LodgeRooms split={split} scope="collection" />;
/** Recreational's Logbook: your trips, nothing else, so it is one page rather than a list. */
export function LogbookTab(_: { split: boolean }) {
  return (
    <DarkPanel label="Logbook" className="h-full">
      <div className="mb-3 flex items-center gap-3 border-b border-line pb-3">
        <Icon name="map" className="size-6 text-brass" />
        <div>
          <h2 className="font-serif text-2xl leading-none">Logbook</h2>
          <p className="mt-1 text-sm text-muted">Your fishing trips</p>
        </div>
      </div>
      <ModeLabel className="mb-3" />
      <Logbook />
    </DarkPanel>
  );
}
