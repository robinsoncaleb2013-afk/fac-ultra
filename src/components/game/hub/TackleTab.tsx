import { lazy, Suspense, useEffect, useState } from "react";
import { BAITS, BOSS_CHUM_INDEX, bossChumPrice, compact, GEAR, LURES, money, PACKS, SIG_LURES, type GearKind } from "@/game/content";
import { useGame } from "@/game/engine";
import { GEAR_TEXT, gearFacts } from "@/game/hubcopy";
import { useHubUi } from "@/game/hubstate";
import { MODES } from "@/game/modes";
import { FAMILY_INFO } from "@/game/presentation";
import { BagPanel } from "@/components/game/panels/BagPanel";
import { RigPicker } from "@/components/game/layout/RigControl";
import { Framed, TackleArt } from "@/components/game/hub/art";
import { Icon, type IconName } from "@/components/game/hub/icons";
import { DarkPanel } from "@/components/game/hub/panel-shell";
import { DetailPaper, Facts, ListColumn, PaperButton, Title, type HubItem } from "@/components/game/hub/parts";
import { cn } from "@/lib/cn";

const CampPanel = lazy(() => import("@/components/game/panels/CampPanel").then((m) => ({ default: m.CampPanel })));

type CatId = "satchel" | "camp" | "rig" | "rod" | "reel" | "line" | "boat" | "box" | "sig" | "bait" | "pack";

const CATS: Record<CatId, { title: string; sub: string; icon: IconName; group: string }> = {
  satchel: { title: "Satchel", sub: "Your catch and what it is worth", icon: "satchel", group: "Your bag" },
  camp: { title: "Camp", sub: "Eat, rest and get ready", icon: "flag", group: "Your bag" },
  rig: { title: "How to fish", sub: "Depth and how fast you reel", icon: "hook", group: "Your bag" },
  rod: { title: "Rods", sub: "Wider green, more luck", icon: "tackle", group: "Gear" },
  reel: { title: "Reels", sub: "Quicker bites, steadier reeling", icon: "wheel", group: "Gear" },
  line: { title: "Lines", sub: "Hold bigger fish", icon: "hook", group: "Gear" },
  boat: { title: "Boats", sub: "More luck on the water", icon: "waters", group: "Gear" },
  box: { title: "Lure box", sub: "The lures you own", icon: "hook", group: "Lures and bait" },
  sig: { title: "Special lures", sub: "One strong trick each", icon: "hook", group: "Lures and bait" },
  bait: { title: "Bait", sub: "Used up one cast at a time", icon: "hook", group: "Lures and bait" },
  pack: { title: "Lure packs", sub: "Three surprise lures", icon: "satchel", group: "Lures and bait" },
};

/** Which categories a mode shows. Survival has a camp and no shop; the rest have everything but the camp. */
export function catsFor(mode: ReturnType<typeof useGame.getState>["mode"]): CatId[] {
  if (MODES[mode].survival) return ["camp", "satchel"];
  return ["satchel", "rig", "rod", "reel", "line", "boat", "box", "sig", "bait", "pack"];
}

type TItem = {
  id: string;
  title: string;
  status: string;
  level: number;
  icon: IconName;
  kind: "rod" | "reel" | "line" | "boat" | "lure" | "bait" | "sig" | "pack" | "bag" | "camp";
  summary: string;
  facts: string[];
  actions: { label: string; run: () => void; disabled?: boolean; quiet?: boolean }[];
  current?: boolean;
};

function useItems(cat: CatId): TItem[] {
  const s = useGame();
  if (cat === "rod" || cat === "reel" || cat === "line" || cat === "boat") {
    const kind: GearKind = cat;
    const owned = s[kind];
    return GEAR[kind].map((g, i) => {
      const equipped = owned === i;
      const have = owned > i;
      const afford = s.c >= g.price;
      return {
        id: `${kind}:${i}`,
        title: g.name,
        status: equipped ? "In use" : have ? "Replaced" : money(g.price),
        level: i / (GEAR[kind].length - 1),
        icon: kind === "rod" ? "tackle" : kind === "boat" ? "waters" : kind === "reel" ? "wheel" : "hook",
        kind,
        summary: GEAR_TEXT[kind].one,
        facts: gearFacts(kind, i),
        current: equipped,
        actions: equipped
          ? [{ label: "In use", run: () => undefined, disabled: true }]
          : have
            ? [{ label: "You have a better one", run: () => undefined, disabled: true }]
            : [{ label: afford ? `Buy for ${money(g.price)}` : `Needs ${money(g.price)}`, run: () => s.buyGear(kind, i), disabled: !afford }],
      };
    });
  }
  if (cat === "box") {
    const owned = Object.keys(s.box).map(Number).filter((i) => s.box[String(i)] > 0).sort((a, b) => a - b);
    const bare: TItem = {
      id: "box:-1",
      title: "Bare hook",
      status: s.lure < 0 ? "In use" : "Free",
      level: 0,
      icon: "hook",
      kind: "lure",
      summary: "No lure at all. Fish still bite, just not as well.",
      facts: ["Never runs out"],
      current: s.lure < 0,
      actions: [{ label: s.lure < 0 ? "In use" : "Use the bare hook", run: () => s.equipLure(-1), disabled: s.lure < 0 }],
    };
    return [
      bare,
      ...owned.map<TItem>((i) => ({
        id: `box:${i}`,
        title: LURES[i].name,
        status: s.lure === i ? "In use" : `x${s.box[String(i)]}`,
        level: i / 49,
        icon: "hook",
        kind: "lure",
        summary: `${FAMILY_INFO[LURES[i].family].label} lure. Bigger numbers mean better luck and quicker bites.`,
        facts: [`Luck ${compact(LURES[i].luck)}`, `Bites ${compact(LURES[i].speed)} quicker`, `You have ${s.box[String(i)]}`],
        current: s.lure === i,
        actions: [{ label: s.lure === i ? "In use" : "Use this lure", run: () => s.equipLure(i), disabled: s.lure === i }],
      })),
    ];
  }
  if (cat === "sig") {
    return [
      {
        id: "sig:-1",
        title: "No special lure",
        status: s.sig < 0 ? "In use" : "",
        level: 0,
        icon: "hook",
        kind: "sig",
        summary: "A special lure rides along with your tackle-box lure. Pick one below.",
        facts: [],
        current: s.sig < 0,
        actions: [{ label: s.sig < 0 ? "In use" : "Put it away", run: () => s.equipSig(-1), disabled: s.sig < 0 }],
      },
      ...SIG_LURES.map<TItem>((g, i) => {
        const have = s.sigBox.includes(i);
        const equipped = s.sig === i;
        const afford = s.c >= g.price;
        return {
          id: `sig:${i}`,
          title: g.name,
          status: equipped ? "In use" : have ? "Owned" : money(g.price),
          level: Math.min(1, g.price / 60000),
          icon: "hook",
          kind: "sig",
          summary: g.desc,
          facts: [`${FAMILY_INFO[g.family].label} style`, "Yours for good once bought"],
          current: equipped,
          actions: have
            ? [{ label: equipped ? "In use" : "Use this lure", run: () => s.equipSig(i), disabled: equipped }]
            : [{ label: afford ? `Buy for ${money(g.price)}` : `Needs ${money(g.price)}`, run: () => s.buySig(i), disabled: !afford }],
        };
      }),
    ];
  }
  if (cat === "bait") {
    return [
      {
        id: "bait:-1",
        title: "No bait",
        status: s.bait < 0 ? "In use" : "",
        level: 0,
        icon: "hook",
        kind: "bait",
        summary: "Bait is used up one cast at a time.",
        facts: [],
        current: s.bait < 0,
        actions: [{ label: s.bait < 0 ? "In use" : "Use no bait", run: () => s.equipBait(-1), disabled: s.bait < 0 }],
      },
      ...BAITS.map<TItem>((g, i) => {
        const count = s.baitBox[String(i)] || 0;
        const price = i === BOSS_CHUM_INDEX ? bossChumPrice(s.biome) : g.price;
        return {
          id: `bait:${i}`,
          title: g.name,
          status: s.bait === i ? "In use" : `Have ${count}`,
          level: i / 3,
          icon: "hook",
          kind: "bait",
          summary: g.desc,
          facts: [`${FAMILY_INFO[g.family].label}`, `You have ${count}`],
          current: s.bait === i,
          actions: [
            { label: s.c >= price ? `Buy one for ${money(price)}` : `Needs ${money(price)}`, run: () => s.buyBait(i), disabled: s.c < price },
            { label: s.bait === i ? "In use" : "Use it", run: () => s.equipBait(i), disabled: count <= 0 || s.bait === i, quiet: true },
          ],
        };
      }),
    ];
  }
  if (cat === "pack") {
    return PACKS.map<TItem>((p, i) => ({
      id: `pack:${i}`,
      title: p.name,
      status: money(p.price),
      level: i / 2,
      icon: "satchel",
      kind: "pack",
      summary: "Three lures picked for you, with a handful of casts each.",
      facts: s.pull ? [`Last time you pulled: ${s.pull}`] : ["A surprise every time"],
      actions: [{ label: s.c >= p.price ? `Buy for ${money(p.price)}` : `Needs ${money(p.price)}`, run: () => s.buyPack(i), disabled: s.c < p.price }],
    }));
  }
  return [];
}

function Grid({ items, selected, onSelect, wide }: { items: TItem[]; selected: string; onSelect: (id: string) => void; wide: boolean }) {
  return (
    <div role="listbox" aria-label="Items" className={cn("no-scrollbar grid min-h-0 content-start gap-3 overflow-y-auto p-2", wide ? "grid-cols-[repeat(auto-fill,minmax(132px,1fr))]" : "grid-cols-2")}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="option"
          aria-selected={selected === it.id}
          data-nav="card"
          data-item={it.id}
          onPointerEnter={(e) => e.pointerType === "mouse" && onSelect(it.id)}
          onFocus={() => onSelect(it.id)}
          onClick={() => onSelect(it.id)}
          className={cn("hub-card flex min-h-[148px] flex-col text-left", it.current && "border-[#ffd37a]")}
        >
          <TackleArt kind={it.kind} level={it.level} icon={it.icon} className="h-[84px] w-full" />
          <span className="flex flex-1 flex-col gap-0.5 p-2">
            <span className="line-clamp-2 text-[14px] leading-tight font-semibold">{it.title}</span>
            <span className="text-[12px] text-[#e2c98a]">{it.status}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function ItemDetail({ item }: { item: TItem }) {
  return (
    <DetailPaper label={item.title} className="flex h-full flex-col">
      <Framed>
        <TackleArt kind={item.kind} level={item.level} icon={item.icon} className="aspect-[16/8] w-full" />
      </Framed>
      <div className="mt-4">
        <Title sub={item.summary}>{item.title}</Title>
        {item.facts.length ? <Facts facts={item.facts} /> : null}
      </div>
      <div className="mt-auto flex flex-wrap gap-3 pt-4">
        {item.actions.map((a) => (
          <PaperButton key={a.label} onClick={a.run} disabled={a.disabled} quiet={a.quiet}>
            {a.label}
          </PaperButton>
        ))}
      </div>
    </DetailPaper>
  );
}

export function TackleTab({ split }: { split: boolean }) {
  const mode = useGame((s) => s.mode);
  const cats = catsFor(mode);
  const saved = useHubUi((s) => s.item.tackle) as CatId | undefined;
  const cat: CatId = saved && cats.includes(saved) ? saved : cats[0];
  const select = useHubUi((s) => s.selectItem);
  const detail = useHubUi((s) => s.detail);
  const setDetail = useHubUi((s) => s.setDetail);
  const [sel, setSel] = useState<string>("");
  const items = useItems(cat);
  const isPanel = cat === "satchel" || cat === "camp" || cat === "rig";
  useEffect(() => setSel(""), [cat]);
  const chosen = items.find((i) => i.id === sel) ?? items.find((i) => i.current) ?? items.find((i) => i.actions.some((a) => !a.disabled)) ?? items[0];

  const catItems: HubItem[] = cats.map((id) => ({
    id,
    title: CATS[id].title,
    sub: CATS[id].sub,
    group: CATS[id].group,
    icon: <Icon name={CATS[id].icon} className="size-5" />,
  }));

  const panel = (
    <DarkPanel label={CATS[cat].title} className="h-full">
      <Suspense fallback={<p className="text-muted">Opening…</p>}>
        {cat === "satchel" ? <BagPanel /> : null}
        {cat === "camp" ? <CampPanel /> : null}
        {cat === "rig" ? (
          <div>
            <h3 className="font-serif text-xl">How to fish</h3>
            <p className="mt-1 mb-3 text-sm text-muted">Pick how deep your line goes and how fast you reel it. Different fish like different choices.</p>
            <RigPicker />
          </div>
        ) : null}
      </Suspense>
    </DarkPanel>
  );

  if (!split && !detail) {
    return (
      <ListColumn
        label="Tackle"
        items={catItems}
        selected={null}
        onPick={(id) => {
          select("tackle", id);
          setDetail(true);
        }}
        onHighlight={() => undefined}
        className="h-full"
      />
    );
  }
  if (!split) {
    return (
      <div className="hub-from-right flex h-full min-h-0 flex-col gap-2">
        <button type="button" data-nav="back" onClick={() => setDetail(false)} className="hub-btn hub-btn-quiet self-start text-[#f1e5c9]">
          <Icon name="back" className="size-5" /> Back
        </button>
        {isPanel ? (
          panel
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            <Grid items={items} selected={chosen?.id ?? ""} onSelect={setSel} wide={false} />
            {chosen ? <ItemDetail item={chosen} /> : null}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(230px,290px)_minmax(0,1fr)] gap-4">
      <ListColumn label="Tackle" items={catItems} selected={cat} onPick={(id) => select("tackle", id)} onHighlight={(id) => select("tackle", id)} className="min-h-0" />
      {isPanel ? (
        panel
      ) : (
        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(340px,430px)] gap-4">
          <Grid items={items} selected={chosen?.id ?? ""} onSelect={setSel} wide />
          {chosen ? <ItemDetail item={chosen} /> : <div />}
        </div>
      )}
    </div>
  );
}
