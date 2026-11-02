import { useEffect, useRef } from "react";
import { dexCount, rankName, TOTAL_SPECIES } from "@/game/content";
import { useGame } from "@/game/engine";
import { playMeta } from "@/game/hubcopy";
import { useHubUi } from "@/game/hubstate";
import { MENU_CARDS, type MenuCard } from "@/game/modes";
import { closeHub } from "@/components/game/hub/actions";
import { Framed, Painting } from "@/components/game/hub/art";
import { Icon } from "@/components/game/hub/icons";
import { DetailPaper, Facts, PaperButton, Title } from "@/components/game/hub/parts";
import { cn } from "@/lib/cn";

type G = ReturnType<typeof useGame.getState>;

/** The cards: every mode card from modes.ts, plus Kid-Friendly Play, which turns Kid Mode on and opens Relaxed Fishing. */
type Card = { id: string; card?: MenuCard };
const CARDS: Card[] = [
  ...MENU_CARDS.slice(0, 4).map((card) => ({ id: card.id, card })),
  { id: "kid" },
  ...MENU_CARDS.slice(4).map((card) => ({ id: card.id, card })),
];

/** Why a card cannot be opened right now, in plain English, or null. */
export function lockOf(c: MenuCard | undefined, g: G): string | null {
  if (!c) return null;
  if (c.id === "derby" && g.derby) return "A derby is already running.";
  if (c.needsBosses && g.bosses < c.needsBosses) return `Beat ${c.needsBosses} bosses to unlock this (${g.bosses} of ${c.needsBosses} so far).`;
  return null;
}

const LAST = "fac-ultra-last-mode";
export function lastPlayed(): string | null {
  try {
    return localStorage.getItem(LAST);
  } catch {
    return null;
  }
}

/** Open a card: close the menu, then start the mode, the event list, or the Lodge view it points at. */
export function openCard(id: string) {
  const g = useGame.getState();
  try {
    localStorage.setItem(LAST, id);
  } catch {
    /* private mode: it just will not be remembered */
  }
  closeHub();
  if (id === "kid") {
    if (!g.kid) g.setKid(true);
    return void useGame.getState().switchMode("recreational");
  }
  const c = MENU_CARDS.find((m) => m.id === id);
  if (!c) return;
  if (c.lobby) return g.openLobby();
  g.switchMode(c.mode);
  if (c.view) useGame.getState().setLodgeView(c.view);
}

function CardView({ id, selected, onHighlight, stack }: { id: string; selected: boolean; onHighlight: () => void; stack: boolean }) {
  const meta = playMeta(id)!;
  const c = CARDS.find((x) => x.id === id)?.card;
  const locked = useGame((g) => (g.hydrated ? lockOf(c, g) : null));
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-disabled={!!locked}
      data-nav="card"
      data-item={id}
      onPointerEnter={(e) => e.pointerType === "mouse" && onHighlight()}
      onFocus={onHighlight}
      onClick={() => !locked && openCard(id)}
      className={cn("hub-card", stack ? "h-full w-[min(76vw,300px)]" : "h-full w-[clamp(190px,17vw,250px)]", locked && "cursor-not-allowed")}
    >
      <Painting id={meta.art} mystery={!!locked} className="absolute inset-0" />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#120b05] via-[#120b05]/40 to-transparent" />
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4">
        <span className="font-serif text-[26px] leading-[1.05] [text-shadow:0_2px_4px_rgb(0_0_0/0.7)]">{locked ? "Not yet…" : meta.title}</span>
        {stack || locked ? <span className="text-[14px] leading-snug text-[#f1e5c9]/90">{locked ?? meta.summary}</span> : null}
        {stack && !locked ? (
          <span className="hub-btn mt-1 self-start">
            <Icon name="play" className="size-5" /> Play
          </span>
        ) : null}
      </span>
      {locked ? <Icon name="lock" className="absolute top-3 right-3 size-6 text-[#f1e5c9]" /> : null}
    </button>
  );
}

function Detail({ id }: { id: string }) {
  const meta = playMeta(id)!;
  const c = CARDS.find((x) => x.id === id)?.card;
  const locked = useGame((g) => (g.hydrated ? lockOf(c, g) : null));
  const hydrated = useGame((g) => g.hydrated);
  const lv = useGame((g) => g.lv);
  const dex = useGame((g) => dexCount(g.dex));
  const kid = useGame((g) => g.kid);
  return (
    <DetailPaper label={locked ? "Locked" : meta.title} className="flex h-full flex-col">
      <Framed>
        <Painting id={meta.art} size={800} mystery={!!locked} className="aspect-[16/8]" />
      </Framed>
      <div className="mt-4">
        <Title sub={locked ? undefined : meta.summary}>{locked ? "A mystery" : meta.title}</Title>
        {locked ? <p className="mt-2 text-[16px]">{locked}</p> : <Facts facts={meta.facts} />}
        {id === "expedition" && hydrated ? (
          <p className="hub-ink-muted mt-3 text-[14px]">
            You are {rankName(lv)}, level {lv}, with {dex} of {TOTAL_SPECIES} fish in your book.
          </p>
        ) : null}
        {id === "kid" && kid ? <p className="hub-ink-muted mt-3 text-[14px]">Kid Mode is already on.</p> : null}
      </div>
      <div className="mt-auto flex flex-wrap gap-3 pt-4">
        <PaperButton disabled={!!locked} onClick={() => openCard(id)}>
          <Icon name="play" className="size-5" /> {locked ? "Locked" : "Play"}
        </PaperButton>
      </div>
    </DetailPaper>
  );
}

/** The Play tab: tall painted cards you scroll sideways, and (on a PC) a big panel about the one you point at. */
export function PlayTab({ split }: { split: boolean }) {
  const last = lastPlayed();
  const selected = useHubUi((s) => s.item.play) ?? (CARDS.some((c) => c.id === last) ? last : CARDS[0].id)!;
  const select = useHubUi((s) => s.selectItem);
  const screen = useGame((s) => s.screen);
  const scroller = useRef<HTMLDivElement>(null);
  const setScreen = useGame((s) => s.setScreen);
  useEffect(() => {
    scroller.current?.querySelector<HTMLElement>(`[data-item="${selected}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [selected]);
  return (
    <div className={cn("h-full min-h-0", split ? "grid grid-cols-[minmax(0,1fr)_minmax(380px,480px)] gap-5" : "flex flex-col gap-3")}>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div
          ref={scroller}
          role="listbox"
          aria-label="Ways to play"
          className="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory items-stretch gap-4 overflow-x-auto px-2 pt-3 pb-5"
        >
          {CARDS.map((c) => (
            <CardView key={c.id} id={c.id} selected={selected === c.id} onHighlight={() => select("play", c.id)} stack={!split} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 px-1">
          {screen === "game" ? (
            <button type="button" data-nav="act" className="hub-btn" onClick={closeHub}>
              <Icon name="hook" className="size-5" /> Back to the water
            </button>
          ) : null}
          {screen === "game" ? (
            <button
              type="button"
              data-nav="act"
              className="hub-btn hub-btn-quiet text-[#f1e5c9]"
              onClick={() => {
                closeHub();
                setScreen("menu");
              }}
            >
              Title screen
            </button>
          ) : null}
          <p className="text-[13px] text-[#c9b890]">Your fish are saved on this device. Sign in under Settings to keep them safe in the cloud.</p>
        </div>
      </div>
      {split ? <Detail id={selected} /> : null}
    </div>
  );
}
