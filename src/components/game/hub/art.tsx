import { useState, type CSSProperties, type ReactNode } from "react";
import { artUrl } from "@/game/art";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/game/hub/icons";

/* Painted pictures for the Hub. Real paintings exist for the fifteen waters; everything else gets a
   painted-style placeholder made from those paintings (a crop and a tint) or from an original SVG scene.
   The list of placeholders is in the pull request. */

/** A water's painting, cropped to the box it sits in. `tint` lays a colour wash over it; `mystery` turns it into a silhouette. */
export function Painting({
  id,
  size = 800,
  tint,
  mystery,
  focus = "50% 60%",
  className,
  children,
}: {
  id: string;
  size?: 800 | 1600;
  tint?: string;
  mystery?: boolean;
  focus?: string;
  className?: string;
  children?: ReactNode;
}) {
  const [bad, setBad] = useState(false);
  return (
    <div className={cn("relative overflow-hidden bg-[#16303c]", className)}>
      {bad ? null : (
        <img
          src={artUrl(id, size)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setBad(true)}
          style={{ objectPosition: focus }}
          className={cn("absolute inset-0 size-full object-cover", mystery && "hub-mystery")}
        />
      )}
      {tint ? <div aria-hidden className="absolute inset-0 mix-blend-multiply" style={{ background: tint }} /> : null}
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(20_12_4_/_0.35))]" />
      {mystery ? (
        <div aria-hidden className="absolute inset-0 grid place-items-center">
          <span className="font-serif text-6xl text-[#f1e5c9]/80">?</span>
        </div>
      ) : null}
      {children}
    </div>
  );
}

const KIND_HUE: Record<string, number> = { rod: 38, reel: 200, line: 150, boat: 18, lure: 330, bait: 85, sig: 270, pack: 48, bag: 30, camp: 24 };

/** A small painted-style picture of a piece of tackle: an original SVG scene, tinted by how good the piece is (0 to 1). */
export function TackleArt({ kind, level = 0, icon, className, style }: { kind: keyof typeof KIND_HUE; level?: number; icon: IconName; className?: string; style?: CSSProperties }) {
  const hue = KIND_HUE[kind] ?? 40;
  const l = Math.min(1, Math.max(0, level));
  const a = `hsl(${hue} ${45 + l * 25}% ${30 + l * 18}%)`;
  const b = `hsl(${(hue + 40) % 360} ${40 + l * 20}% ${16 + l * 8}%)`;
  return (
    <div
      aria-hidden
      className={cn("relative grid place-items-center overflow-hidden", className)}
      style={{ background: `radial-gradient(circle at 30% 25%, ${a}, ${b} 75%)`, ...style }}
    >
      <svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 size-full opacity-40">
        <path d="M0 62c14-8 26 6 40 0s26-8 40 0 26 6 40 0V80H0z" fill="#0c1a22" opacity=".55" />
        <path d="M0 70c14-6 26 6 40 0s26-6 40 0 26 4 40 0V80H0z" fill="#0c1a22" opacity=".7" />
        <circle cx="96" cy="16" r="8" fill="#ffe9b0" opacity=".7" />
      </svg>
      <Icon name={icon} className="relative size-1/2 text-[#fff4d6] drop-shadow-[0_2px_2px_rgb(0_0_0/0.5)]" strokeWidth={1.3} />
      {l > 0.85 ? <span className="absolute top-1 right-2 text-xs text-[#ffe9b0]">✦</span> : null}
    </div>
  );
}

/** A framed picture on paper: the big picture at the top of a detail panel. */
export function Framed({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border-2 border-[#8a6a2c] shadow-[0_3px_0_rgb(80_55_20/0.5),inset_0_0_0_2px_rgb(255_240_200/0.4)]", className)}>
      {children}
    </div>
  );
}
