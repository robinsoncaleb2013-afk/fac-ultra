import type { SVGProps } from "react";

/* Original line icons for the Hub, drawn for this game (24 px grid, round ink strokes). */

const PATHS = {
  play: (
    <>
      <path d="M13 3v9" />
      <path d="M13 12a4.5 4.5 0 1 1-4.2 6.1" />
      <path d="M8.2 14.6l.6 3.5 3.3-1" />
      <circle cx="13" cy="3" r="1.3" />
    </>
  ),
  tackle: (
    <>
      <path d="M4 20L18.5 4.5" />
      <path d="M18.5 4.5c2.5 1.2 3 4.5 1.5 8" />
      <path d="M20 12.5v3a2 2 0 1 1-2-2" />
      <circle cx="7.6" cy="16.4" r="1.7" />
    </>
  ),
  lodge: (
    <>
      <path d="M3 11.5L12 4l9 7.5" />
      <path d="M5.5 10v10h13V10" />
      <path d="M10 20v-5.5h4V20" />
      <path d="M16.5 6V4h2v3.5" />
    </>
  ),
  waters: (
    <>
      <path d="M3 9c2.2-2.4 4.4 2.4 6.6 0s4.4 2.4 6.6 0 3.2 1.4 4.8 0" />
      <path d="M3 14.5c2.2-2.4 4.4 2.4 6.6 0s4.4 2.4 6.6 0 3.2 1.4 4.8 0" />
      <path d="M3 20c2.2-2.4 4.4 2.4 6.6 0s4.4 2.4 6.6 0 3.2 1.4 4.8 0" />
      <path d="M12 2.5l1.6 3.4h-3.2z" />
    </>
  ),
  players: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c.4-3.6 2.8-5.6 6-5.6s5.6 2 6 5.6" />
      <circle cx="17.2" cy="9" r="2.5" />
      <path d="M16.8 14.2c2.4.2 4 1.8 4.4 4.6" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  shrink: <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
  wheel: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 3v4.6M12 16.4V21M3 12h4.6M16.4 12H21" />
    </>
  ),
  satchel: (
    <>
      <path d="M6 9h12l1.5 10.5h-15z" />
      <path d="M9 9V6.5A3 3 0 0 1 12 3.5a3 3 0 0 1 3 3V9" />
      <path d="M9.5 13.5h5" />
    </>
  ),
  map: (
    <>
      <path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  back: <path d="M14 5l-7 7 7 7M7 12h13" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9.5" rx="2" />
      <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M9.5 9.8c0-1.2 1-1.8 2.5-1.8s2.5.7 2.5 1.8-1 1.6-2.5 2-2.5.8-2.5 2 1 1.8 2.5 1.8 2.5-.6 2.5-1.8" />
    </>
  ),
  hook: (
    <>
      <path d="M12 3v11a4 4 0 1 1-4-4" />
    </>
  ),
  sound: (
    <>
      <path d="M4 10v4h3.5L12 18V6L7.5 10z" />
      <path d="M15.5 9c1.4 1.6 1.4 4.4 0 6M18 6.5c2.6 3 2.6 8 0 11" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  cloud: (
    <>
      <path d="M7 18a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 9.5a4.2 4.2 0 0 1 .5 8.5z" />
    </>
  ),
  pad: (
    <>
      <path d="M7 8h10a4.5 4.5 0 0 1 4.4 5.4l-.7 3.2a2.4 2.4 0 0 1-4.2.9L15 16H9l-1.5 1.5a2.4 2.4 0 0 1-4.2-.9l-.7-3.2A4.5 4.5 0 0 1 7 8z" />
      <path d="M8 11v3M6.5 12.5h3" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  flag: <path d="M6 21V4M6 5h11l-2.2 3.5L17 12H6" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className, ...rest }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className ?? "size-5"}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

/** The game's mark: a leaping fish over a hook, in one brass stroke. Drawn for this game. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="FAC Ultra">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd37a" />
          <stop offset="1" stopColor="#d08a1e" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="29" fill="#16303c" stroke="url(#logo-g)" strokeWidth="3" />
      <path d="M12 38c6-12 18-16 30-9l9-6-2 10 5 6-9-1c-8 9-24 8-33 0z" fill="url(#logo-g)" />
      <circle cx="42" cy="29" r="1.8" fill="#16303c" />
      <path d="M16 46c5 3 11 3 16 0s11-3 16 0" fill="none" stroke="#2fbfa8" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
