import { useMemo } from "react";
import { BIOMES, SPECIES_PER_BIOME } from "@/game/content";
import { useHubUi } from "@/game/hubstate";
import { MODES } from "@/game/modes";
import { collectionEntries, type CollectionEntry } from "@/game/peek";
import { Icon } from "@/components/game/hub/icons";
import { DarkPanel } from "@/components/game/hub/panel-shell";
import { MasterDetail, type HubItem } from "@/components/game/hub/parts";

/* The main menu's Collections tab (WP-12): a LOOK at what each mode has collected, read straight from the saved text on this
   device. It has no buttons that do anything: no selling, no buying, no crafting. To change a collection you play that mode. */

const kinds = (n: number) => `${n} ${n === 1 ? "kind" : "kinds"} of fish`;

function Detail({ e }: { e: CollectionEntry }) {
  const p = e.peek;
  const rules = { ...MODES[p.mode], title: e.title };
  if (!p.saved)
    return (
      <DarkPanel label={rules.title} className="h-full">
        <h2 className="font-serif text-2xl">{rules.title}</h2>
        <p className="mt-2 text-muted">Nothing here yet. Pick {rules.title} under Play and your fish will show up here.</p>
      </DarkPanel>
    );
  return (
    <DarkPanel label={rules.title} className="h-full" >
      <h2 className="font-serif text-2xl">{rules.title}</h2>
      <p className="mt-1 text-muted">
        {kinds(p.found)} found out of {p.total}.{p.level > 1 && !e.kids && !MODES[p.mode].survival ? ` You are level ${p.level}.` : ""}
        {p.trophies ? ` ${p.trophies} ${p.trophies === 1 ? "medal" : "medals"} in the trophy cabinet.` : ""}
      </p>
      {e.kids ? <p className="mt-1 text-sm text-muted">Fish caught in Kid Mode and on Super Easy live in their own book. They never count in the main book.</p> : null}
      {e.kids ? null : <h3 className="mt-4 font-serif text-lg">Your five heaviest</h3>}
      {e.kids ? null : p.best.length ? (
        <ol className="mt-1 flex flex-col" data-testid="collection-best">
          {p.best.map((b) => (
            <li key={`${b.b}-${b.i}`} className="flex items-baseline justify-between gap-2 border-t border-line py-2 first:border-0">
              <span className="min-w-0 truncate">{b.name}</span>
              <span className="shrink-0 text-sm text-muted">
                {BIOMES[b.b].name} · {b.w} lb
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-1 text-sm text-muted">No records yet.</p>
      )}
      <h3 className="mt-4 font-serif text-lg">Fish found in each water</h3>
      <ul className="mt-1 flex flex-col gap-1.5">
        {BIOMES.map((b, i) => (
          <li key={b.id} className="flex items-center gap-3 text-sm">
            <span className="w-32 shrink-0 truncate">{b.name}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/40" aria-hidden>
              <span className="block h-full bg-brass" style={{ width: `${(p.perWater[i] / SPECIES_PER_BIOME) * 100}%` }} />
            </span>
            <span className="w-12 shrink-0 text-right text-muted">
              {p.perWater[i]}/{SPECIES_PER_BIOME}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted">This is a look only. To change anything, play the mode.</p>
    </DarkPanel>
  );
}

export function CollectionsTab({ split }: { split: boolean }) {
  const saved = useHubUi((s) => s.item.collections);
  const entries = useMemo(
    () =>
      collectionEntries((k) => {
        try {
          return localStorage.getItem(k);
        } catch {
          return null;
        }
      }),
    [],
  );
  const items: HubItem[] = entries.map((e) => ({
    id: e.id,
    title: e.title,
    sub: e.sub,
    icon: <Icon name="lodge" className="size-5" />,
  }));
  return (
    <MasterDetail
      tab="collections"
      items={items}
      selectedId={entries.some((e) => e.id === saved) ? (saved as string) : null}
      listLabel="Collections"
      split={split}
      detailLabel="Collection"
      bare
      render={(id) => <Detail e={entries.find((e) => e.id === id) ?? entries[0]} />}
    />
  );
}
