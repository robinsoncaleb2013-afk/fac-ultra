import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** The older panels (bag, camp, lodge views, settings) were written for the dark teal look. They sit on a dark card inside
    the Hub, so their colours stay readable. */
export function DarkPanel({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <section
      aria-label={label}
      className={cn("hub-fade min-h-0 overflow-y-auto rounded-2xl border border-[#caa45a]/50 bg-bg/95 p-4 text-fg shadow-[0_16px_36px_rgb(0_0_0/0.45)]", className)}
    >
      {children}
    </section>
  );
}
