import { Suspense, useEffect, useState } from "react";
import { BAITS, BOSS_CHUM_INDEX, bossChumPrice, compact, GEAR, LINES, LURES, money, PACKS, SIG_LURES, type GearKind } from "@/game/content";
import { checkGear, gatesOn } from "@/game/gear-rules";
import { MODES } from "@/game/modes";
import { kidActive } from "@/game/kid";
import { canUse, checkCraft, CRAFT_GATE, healthOf, LINE_PACKS, LINE_TIERS, RECIPE_DUPES, secondsAgainst } from "@/game/lines";
import { useGame } from "@/game/engine";
import { GEAR_TEXT, gearFacts } from "@/game/hubcopy";
import { useHubUi } from "@/game/hubstate";
import { FAMILY_INFO } from "@/game/presentation";
import { BagPanel } from "@/components/game/panels/BagPanel";
import { RigPicker } from "@/components/game/layout/RigControl";
import { Framed, TackleArt } from "@/components/game/hub/art";
import { Icon, type IconName } from "@/components/game/hub/icons";
import { DarkPanel } from "@/components/game/hub/panel-shell";
import { DetailPaper, Facts, ListColumn, PaperButton, Title, type HubItem } from "@/components/game/hub/parts";
import { cn } from "@/lib/cn";

/* Two views of the same gear (WP-12). TACKLE is what you carry and use: look at your catch, set up how you fish, pick the rod
   you hold, the lure and the bait. SHOP & SELL is where money changes hands: sell fish, buy gear, lures, bait and packs. The
   second one is a tab only for modes with an economy (modes.ts menuTabs), so Recreational, Survival and Tournaments have no
   way to sell or buy anything. */
export type TackleView = "tackle" | "shop";

type CatId = "sell" | "satchel" | "rig" | "rod" | "reel" | "line" | "linepack" | "boat" | "box" | "sig" | "bait" | "pack";

const CATS: Record<CatId, { title: string; sub: string; icon: IconName; group: string }> = {
  sell: { title: "Sell your catch", sub: "Turn your fish into coins", icon: "coin", group: "Your catch" },
  satchel: { title: "Satchel", sub: "Your catch", icon: "satchel", group: "Your bag" },
  rig: { title: "How to fish", sub: "Depth and how fast you reel", icon: "hook", group: "Your bag" },
  rod: { title: "Rods", sub: "Wider green, more luck", icon: "tackle", group: "Gear" },
  reel: { title: "Reels", sub: "Quicker bites, steadier reeling", icon: "wheel", group: "Gear" },
  line: { title: "Line workshop", sub: "Craft stronger line from spares", icon: "hook", group: "Gear" },
  linepack: { title: "Line packs", sub: "Open them to find lines", icon: "satchel", group: "Gear" },
  boat: { title: "Boats", sub: "More luck on the water", icon: "waters", group: "Gear" },
  box: { title: "Lure box", sub: "The lures you own", icon: "hook", group: "Lures and bait" },
  sig: { title: "Special lures", sub: "One strong trick each", icon: "hook", group: "Lures and bait" },
  bait: { title: "Bait", sub: "Used up one cast at a time", icon: "hook", group: "Lures and bait" },
  pack: { title: "Lure packs", sub: "Three surprise lures", icon: "satchel", group: "Lures and bait" },
};

/** Which categories each view shows. Tackle: your catch, how you fish, and what you own. Shop: selling, then everything for sale. */
export function catsFor(view: TackleView): CatId[] {
  /* Lines are not sold (WP-14): they are found in packs and crafted, so the workshop and the packs live in Tackle. */
  if (view === "shop") return ["sell", "rod", "reel", "boat", "sig", "bait", "pack"];
  return ["satchel", "rig", "rod", "reel", "line", "linepack", "boat", "box", "sig", "bait"];
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
  /** "buy" actions are for the shop, "use" actions are for the tackle tab. */
  actions: { label: string; run: () => void; disabled?: boolean; quiet?: boolean; t?: "buy" | "use" }[];
  current?: boolean;
  /** You have it (or it is a "none" choice). The tackle tab lists only these. */
  owned: boolean;
  /** A "none" choice (bare hook, no bait): never for sale. */
  none?: boolean;
  /** Why this cannot be bought yet, as one plain sentence. Greyed out when set. */
  lock?: string;
};

function useAllItems(cat: CatId): TItem[] {
  const s = useGame();
  const gated = gatesOn(MODES[s.mode], kidActive(s.kid, MODES[s.mode]));
  if (cat === "line") {
    const bosses = new Set(s.mastered).size;
    return Array.from({ length: LINE_TIERS }, (_, t): TItem => {
      const have = s.lineGear.lines[t] ?? 0;
      const inUse = s.line === t;
      const craftable = t > 0 ? checkCraft(s.lineGear, t, s.lv, bosses) : null;
      const gate = t > 0 ? CRAFT_GATE[t] : null;
      const facts = [
        `Health ${healthOf(t)}. Fish wear it down as you fight.`,
        `Lasts ${secondsAgainst(t, 0, false, false)} seconds against a common fish and ${secondsAgainst(t, 4, false, false)} against a legendary one. Reeling in the green makes it last twice as long.`,
        t > 0 ? `Craft it from ${craftable!.need} copies of ${LINES[t - 1].name}.` : "The line you start with. Packs can give you more.",
        `Copies you own: ${have}.`,
        ...(t < LINE_TIERS - 1 ? [`The next line up needs ${RECIPE_DUPES[t]} copies of this one.`] : ["The best line there is."]),
        ...(gate ? [`To craft it: level ${gate.lv}${gate.bosses ? ` and ${gate.bosses} ${gate.bosses === 1 ? "boss" : "bosses"} beaten` : ""}.`] : []),
      ];
      return {
        id: `line:${t}`,
        title: LINES[t].name,
        status: inUse ? "In use" : have > 0 ? `x${have}` : craftable?.ok ? "Can craft" : craftable ? "Locked" : "Spare",
        level: t / (LINE_TIERS - 1),
        icon: "hook",
        kind: "line",
        summary: "Lines are found in packs and crafted from spares. A stronger line lasts longer against big fish.",
        facts,
        current: inUse,
        owned: true,
        lock: !canUse(s.lineGear, t) && craftable && !craftable.ok ? craftable.why : undefined,
        actions: [
          { label: inUse ? "In use" : "Use this line", run: () => s.equipLine(t), disabled: inUse || !canUse(s.lineGear, t), t: "use" },
          ...(t > 0 ? [{ label: craftable!.ok ? `Craft (uses ${craftable!.need})` : "Craft", run: () => s.craftLine(t), disabled: !craftable!.ok, quiet: true, t: "use" as const }] : []),
        ],
      };
    });
  }
  if (cat === "linepack") {
    return LINE_PACKS.map<TItem>((p, i) => {
      const n = s.lineGear.packs[i] ?? 0;
      return {
        id: `linepack:${i}`,
        title: p.name,
        status: n > 0 ? `x${n}` : "None",
        level: i / (LINE_PACKS.length - 1),
        icon: "satchel",
        kind: "pack",
        summary: "Three lines in every pack. Packs come from levelling up, beating bosses, contracts and lucky catches.",
        facts: [
          `You have ${n}.`,
          s.lineGear.last.length ? `Last pack: ${s.lineGear.last.map((t) => LINES[t].name).join(", ")}.` : "Nothing opened yet.",
          "Spare copies are good: craft them into a better line.",
        ],
        owned: true,
        actions: [{ label: n > 0 ? "Open one" : "None to open", run: () => s.openLinePack(i), disabled: n <= 0, t: "use" }],
      };
    });
  }
  if (cat === "rod" || cat === "reel" || cat === "boat") {
    const kind: GearKind = cat;
    const owned = s[kind];
    return GEAR[kind].map((g, i) => {
      const equipped = owned === i;
      const have = owned > i;
      const afford = s.c >= g.price;
      const gate = gated && !equipped && !have ? checkGear(kind, i, s) : null;
      const lock = gate && !gate.ok ? gate.text : undefined;
      return {
        id: `${kind}:${i}`,
        title: g.name,
        lock,
        status: equipped ? "In use" : have ? "Replaced" : lock ? "Locked" : money(g.price),
        level: i / (GEAR[kind].length - 1),
        icon: kind === "rod" ? "tackle" : kind === "boat" ? "waters" : kind === "reel" ? "wheel" : "hook",
        kind,
        summary: GEAR_TEXT[kind].one,
        facts: gearFacts(kind, i),
        current: equipped,
        owned: owned >= i,
        actions: equipped
          ? [{ label: "In use", run: () => undefined, disabled: true }]
          : have
            ? [{ label: "You have a better one", run: () => undefined, disabled: true }]
            : [{ label: lock ? "Locked" : afford ? `Buy for ${money(g.price)}` : `Needs ${money(g.price)}`, run: () => s.buyGear(kind, i), disabled: !afford || !!lock, t: "buy" }],
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
      owned: true,
      none: true,
      actions: [{ label: s.lure < 0 ? "In use" : "Use the bare hook", run: () => s.equipLure(-1), disabled: s.lure < 0, t: "use" }],
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
        owned: true,
        actions: [{ label: s.lure === i ? "In use" : "Use this lure", run: () => s.equipLure(i), disabled: s.lure === i, t: "use" }],
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
        owned: true,
        none: true,
        actions: [{ label: s.sig < 0 ? "In use" : "Put it away", run: () => s.equipSig(-1), disabled: s.sig < 0, t: "use" }],
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
          owned: have,
          actions: have
            ? [{ label: equipped ? "In use" : "Use this lure", run: () => s.equipSig(i), disabled: equipped, t: "use" }]
            : [{ label: afford ? `Buy for ${money(g.price)}` : `Needs ${money(g.price)}`, run: () => s.buySig(i), disabled: !afford, t: "buy" }],
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
        owned: true,
        none: true,
        actions: [{ label: s.bait < 0 ? "In use" : "Use no bait", run: () => s.equipBait(-1), disabled: s.bait < 0, t: "use" }],
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
          owned: count > 0 || s.bait === i,
          actions: [
            { label: s.c >= price ? `Buy one for ${money(price)}` : `Needs ${money(price)}`, run: () => s.buyBait(i), disabled: s.c < price, t: "buy" },
            { label: s.bait === i ? "In use" : "Use it", run: () => s.equipBait(i), disabled: count <= 0 || s.bait === i, quiet: true, t: "use" },
          ],
        };
      }),
    ];
  }
  if (cat === "pack") {
    return PACKS.map<TItem>((p, i) => {
      const gate = gated ? checkGear("pack", i, s) : null;
      const lock = gate && !gate.ok ? gate.text : undefined;
      return {
      id: `pack:${i}`,
      title: p.name,
      lock,
      status: lock ? "Locked" : money(p.price),
      level: i / 2,
      icon: "satchel",
      kind: "pack",
      summary: "Three lures picked for you, with a handful of casts each.",
      facts: s.pull ? [`Last time you pulled: ${s.pull}`] : ["A surprise every time"],
      owned: false,
      actions: [{ label: lock ? "Locked" : s.c >= p.price ? `Buy for ${money(p.price)}` : `Needs ${money(p.price)}`, run: () => s.buyPack(i), disabled: s.c < p.price || !!lock, t: "buy" }],
    };
    });
  }
  return [];
}

/** The same items, cut for the view: the tackle tab lists what you own with "use" actions; the shop lists what is for sale with "buy" actions. */
function useItems(cat: CatId, view: TackleView): TItem[] {
  const all = useAllItems(cat);
  if (view === "shop") {
    return all
      .filter((i) => !i.none)
      .map((i) => {
        const buy = i.actions.filter((a) => a.t === "buy");
        return { ...i, actions: buy.length ? buy : [{ label: i.current ? "In use" : "You have this", run: () => undefined, disabled: true }] };
      });
  }
  return all.filter((i) => i.owned).map((i) => ({ ...i, actions: i.actions.filter((a) => a.t !== "buy") }));
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
          className={cn("hub-card flex min-h-[148px] flex-col text-left", it.current && "border-[#ffd37a]", it.lock && "opacity-60 grayscale")}
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
        {item.lock ? <p className="mt-3 rounded-lg bg-black/10 p-2 text-[15px] font-semibold text-[#8a3a14]">{item.lock}</p> : null}
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

export function TackleTab({ split, view = "tackle" }: { split: boolean; view?: TackleView }) {
  const cats = catsFor(view);
  const label = view === "shop" ? "Shop & Sell" : "Tackle";
  const saved = useHubUi((s) => s.item[view]) as CatId | undefined;
  const cat: CatId = saved && cats.includes(saved) ? saved : cats[0];
  const select = useHubUi((s) => s.selectItem);
  const detail = useHubUi((s) => s.detail);
  const setDetail = useHubUi((s) => s.setDetail);
  const [sel, setSel] = useState<string>("");
  const items = useItems(cat, view);
  const isPanel = cat === "satchel" || cat === "sell" || cat === "rig";
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
        {cat === "satchel" ? <BagPanel sell={false} /> : null}
        {cat === "sell" ? <BagPanel /> : null}
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
        label={label}
        items={catItems}
        selected={null}
        onPick={(id) => {
          select(view, id);
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
      <ListColumn label={label} items={catItems} selected={cat} onPick={(id) => select(view, id)} onHighlight={(id) => select(view, id)} className="min-h-0" />
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

/** Shop & Sell: the only place in a game where fish are sold and gear is bought. Only modes with an economy have this tab. */
export function ShopTab({ split }: { split: boolean }) {
  return <TackleTab split={split} view="shop" />;
}
