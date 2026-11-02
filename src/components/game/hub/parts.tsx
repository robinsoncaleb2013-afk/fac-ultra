import { useCallback, useRef, type ReactNode } from "react";
import { useForm } from "@/components/game/layout/use-form";
import { useHubUi } from "@/game/hubstate";
import type { HubTab } from "@/game/hubnav";
import { Icon } from "@/components/game/hub/icons";
import { cn } from "@/lib/cn";

/** How this screen shows the Hub. `split` = a list on the left and a large detail panel on the right (PC and big tablets).
    Otherwise one column: tap an item and its detail opens full screen with a Back button. */
export function useHubLayout() {
  const { form, width, height } = useForm();
  const split = form === "desktop" || (form === "tablet" && width >= 1024);
  return { split, form, width, height, bottomTabs: !split && height > width };
}

export type HubItem = {
  id: string;
  title: string;
  sub?: string;
  group?: string;
  icon?: ReactNode;
  thumb?: ReactNode;
  badge?: string;
  locked?: boolean;
};

/** One row in a list. Hover and arrow-key focus both highlight it, which updates the detail panel. */
export function Row({ item, selected, onPick, onHighlight }: { item: HubItem; selected: boolean; onPick: () => void; onHighlight: () => void }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-disabled={item.locked || undefined}
      data-nav="row"
      data-item={item.id}
      onPointerEnter={(e) => e.pointerType === "mouse" && onHighlight()}
      onFocus={onHighlight}
      onClick={onPick}
      className="hub-row"
    >
      {item.thumb ?? (item.icon ? <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-black/25 text-brass">{item.icon}</span> : null)}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-serif text-[17px] leading-tight">{item.title}</span>
        {item.sub ? <span className="block truncate text-[13px] text-[#c9b890]">{item.sub}</span> : null}
      </span>
      {item.locked ? <Icon name="lock" className="size-4 shrink-0 text-[#c9b890]" /> : null}
      {item.badge ? <span className="shrink-0 rounded-full bg-brass px-2 py-0.5 text-xs font-semibold text-brass-ink">{item.badge}</span> : null}
    </button>
  );
}

/** A list column with optional group headings. */
export function ListColumn({ label, items, selected, onPick, onHighlight, footer, className }: {
  label: string;
  items: HubItem[];
  selected: string | null;
  onPick: (id: string) => void;
  onHighlight: (id: string) => void;
  footer?: ReactNode;
  className?: string;
}) {
  let last: string | undefined;
  return (
    <div className={cn("hub-wood flex min-h-0 flex-col rounded-2xl border border-[#caa45a]/50 p-2", className)}>
      <div role="listbox" aria-label={label} className="no-scrollbar min-h-0 flex-1 overflow-y-auto pr-0.5">
        {items.map((it) => {
          const head = it.group && it.group !== last ? it.group : null;
          last = it.group ?? last;
          return (
            <div key={it.id}>
              {head ? <p className="px-3 pt-3 pb-1 text-xs tracking-widest text-[#c9b890] uppercase">{head}</p> : null}
              <Row item={it} selected={selected === it.id} onPick={() => onPick(it.id)} onHighlight={() => onHighlight(it.id)} />
            </div>
          );
        })}
      </div>
      {footer ? <div className="mt-2 border-t border-[#caa45a]/30 pt-2">{footer}</div> : null}
    </div>
  );
}

/** The paper panel a detail sits on. */
export function DetailPaper({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <section aria-label={label} className={cn("hub-paper hub-fade min-h-0 overflow-y-auto p-4", className)}>
      {children}
    </section>
  );
}

export function Facts({ facts }: { facts: string[] }) {
  return (
    <ul className="mt-3 flex flex-col gap-1.5">
      {facts.map((f) => (
        <li key={f} className="flex items-start gap-2 text-[15px]">
          <Icon name="check" className="mt-0.5 size-4 shrink-0 text-[#8a5a14]" />
          <span>{f}</span>
        </li>
      ))}
    </ul>
  );
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <h2 className="font-serif text-3xl leading-tight">{children}</h2>
      {sub ? <p className="hub-ink-muted mt-1 text-[15px]">{sub}</p> : null}
    </div>
  );
}

/** A button on paper. */
export function PaperButton({ children, onClick, disabled, quiet, className }: { children: ReactNode; onClick: () => void; disabled?: boolean; quiet?: boolean; className?: string }) {
  return (
    <button type="button" data-nav="act" disabled={disabled} onClick={onClick} className={cn("hub-btn", quiet && "hub-btn-quiet", className)}>
      {children}
    </button>
  );
}

/** The usual master/detail screen: list on the left, detail on the right (PC); list, then full-screen detail (phone). */
export function MasterDetail({ tab, items, selectedId, render, listLabel, listFooter, split, detailLabel = "Details", bare = false }: {
  tab: HubTab;
  items: HubItem[];
  selectedId: string | null;
  render: (id: string) => ReactNode;
  listLabel: string;
  listFooter?: ReactNode;
  split: boolean;
  detailLabel?: string;
  /** The detail brings its own card (the older dark panels), so do not lay paper under it. */
  bare?: boolean;
}) {
  const detailOpen = useHubUi((s) => s.detail);
  const select = useHubUi((s) => s.selectItem);
  const setDetail = useHubUi((s) => s.setDetail);
  const pane = useRef<HTMLDivElement>(null);
  const sel = items.find((i) => i.id === selectedId) ?? items[0];
  const pick = useCallback(
    (id: string) => {
      select(tab, id);
      if (split) window.setTimeout(() => pane.current?.querySelector<HTMLElement>("[data-nav]")?.focus(), 30);
      else setDetail(true);
    },
    [select, setDetail, split, tab],
  );
  if (!sel) return <p className="p-6 text-center text-[#c9b890]">Nothing here yet.</p>;
  if (!split && detailOpen) {
    return (
      <div className="hub-from-right flex h-full min-h-0 flex-col gap-2">
        <button type="button" data-nav="back" onClick={() => setDetail(false)} className="hub-btn hub-btn-quiet self-start text-[#f1e5c9]">
          <Icon name="back" className="size-5" /> Back
        </button>
        {bare ? <div className="min-h-0 flex-1">{render(sel.id)}</div> : <DetailPaper label={detailLabel} className="flex-1">{render(sel.id)}</DetailPaper>}
      </div>
    );
  }
  return (
    <div className={cn("h-full min-h-0", split ? "grid grid-cols-[minmax(260px,360px)_minmax(0,1fr)] gap-4" : "flex flex-col")}>
      <ListColumn
        label={listLabel}
        items={items}
        selected={split ? sel.id : null}
        onPick={pick}
        onHighlight={(id) => split && select(tab, id)}
        footer={listFooter}
        className="min-h-0 flex-1"
      />
      {split ? (
        <div ref={pane} className="min-h-0">
          {bare ? render(sel.id) : <DetailPaper label={detailLabel} className="h-full">{render(sel.id)}</DetailPaper>}
        </div>
      ) : null}
    </div>
  );
}
