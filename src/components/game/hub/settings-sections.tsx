import { useRef, useState, type ReactNode } from "react";
import { downloadSave, useGame } from "@/game/engine";
import { LEVELS, type GfxPref } from "@/game/device";
import { HOME_SCREEN_HINT, landscapeLockWanted, setLandscapeLockWanted } from "@/game/fullscreen";
import { LEVEL_INFO } from "@/game/graphics";
import { probeResult } from "@/game/probe";
import { bookOf } from "@/game/hubcopy";
import { MODES } from "@/game/modes";
import { CloudSettings } from "@/components/game/account";
import { useFullscreen } from "@/components/game/fullscreen";
import { useKidOn } from "@/components/game/use-kid";
import { Toggle } from "@/components/game/panels/shared";
import { TestingLine } from "@/components/game/test-phase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const Card = ({ children }: { children: ReactNode }) => <div className="rounded-2xl border border-line bg-surface p-3">{children}</div>;

export function SoundSection() {
  const sound = useGame((s) => s.sound);
  const volume = useGame((s) => s.volume);
  const setVolume = useGame((s) => s.setVolume);
  const toggle = useGame((s) => s.toggleSetting);
  return (
    <div className="flex flex-col gap-2">
      <Toggle on={sound} onClick={() => toggle("sound")}>
        Sound
      </Toggle>
      <Card>
        <label htmlFor="ambience-volume" className="flex items-center justify-between">
          <h4 className="font-serif">Water sounds</h4>
          <span className="text-sm text-brass">{sound ? `${volume}%` : "Sound is off"}</span>
        </label>
        <p className="mt-1 text-sm text-muted">
          Quiet music of the water you are fishing: frogs, waves, wind and rain. It starts after your first tap. Turn Sound off above to hush
          everything.
        </p>
        <input
          id="ambience-volume"
          type="range"
          min={0}
          max={100}
          step={5}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="mt-2 h-11 w-full accent-[var(--color-brass)]"
        />
      </Card>
    </div>
  );
}

export function GraphicsSection() {
  const gfx = useGame((s) => s.gfx);
  const level = useGame((s) => s.level);
  const setGfx = useGame((s) => s.setGfx);
  const followClock = useGame((s) => s.followClock);
  const toggle = useGame((s) => s.toggleSetting);
  const probe = probeResult();
  const options: { id: GfxPref; label: string; line: string }[] = [
    { id: "auto", label: "Auto", line: "We pick the best picture for this device and ease off if the game gets choppy." },
    ...LEVELS.map((l) => ({ id: l as GfxPref, label: LEVEL_INFO[l].label, line: LEVEL_INFO[l].line })),
  ];
  return (
    <div className="flex flex-col gap-2">
      <Card>
        <h4 className="font-serif">Picture quality</h4>
        <p className="mt-1 text-sm text-muted">A lower level makes the water simpler so the game runs smoothly on an older device. Nothing about the fishing changes.</p>
        <div role="radiogroup" aria-label="Picture quality" className="mt-2 flex flex-col gap-1.5">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={gfx === o.id}
              data-nav="act"
              onClick={() => setGfx(o.id)}
              className={cn(
                "min-h-14 rounded-xl border px-3 py-2 text-left",
                gfx === o.id ? "border-brass bg-surface-2" : "border-line bg-surface-2/40 hover:border-brass/70",
              )}
            >
              <span className="flex items-center justify-between">
                <span className="font-serif text-lg">{o.label}</span>
                {gfx === o.id ? <span className="text-sm text-brass">Chosen</span> : null}
              </span>
              <span className="block text-sm text-muted">{o.line}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm" role="status">
          Showing now: <span className="text-brass">{LEVEL_INFO[level].label}</span>
          {gfx === "auto" ? " (picked by Auto)" : ""}
          {probe ? <span className="text-muted"> · Speed test: about {Math.round(probe.fps)} frames a second</span> : null}
        </p>
        <p className="mt-1 text-xs text-muted">
          Auto goes down quickly if the game stutters, and goes up one step if it stays smooth for half a minute. If you pick a level yourself, we
          never change it.
        </p>
      </Card>
      <Toggle on={followClock} onClick={() => toggle("followClock")}>
        Follow the clock (dawn, dusk and night light)
      </Toggle>
    </div>
  );
}

export function FullscreenSection() {
  const { active, support, toggle } = useFullscreen();
  const [lock, setLock] = useState(landscapeLockWanted());
  const canLock = typeof screen !== "undefined" && !!(screen as Screen & { orientation?: { lock?: unknown } }).orientation?.lock && matchMedia("(pointer: coarse)").matches;
  return (
    <div className="flex flex-col gap-2">
      <Card>
        <h4 className="font-serif">Full screen</h4>
        {support === "installed" ? (
          <p className="mt-1 text-sm text-muted">You are playing from your Home Screen, so the browser bars are already gone. Nothing more to do.</p>
        ) : support === "no" ? (
          <p className="mt-1 text-sm text-muted">This browser does not allow full screen here. Try another browser, or add the game to your Home Screen.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">Hides the browser bars so the water fills the whole screen. On a computer you can also press F. Esc brings the bars back.</p>
            <Button data-nav="act" className="mt-2" onClick={toggle}>
              {active ? "Leave full screen" : "Go full screen"}
            </Button>
          </>
        )}
        {support === "home-screen" ? (
          <p className="mt-3 rounded-xl border border-line bg-surface-2 p-3 text-sm" role="note">
            {HOME_SCREEN_HINT}
          </p>
        ) : null}
      </Card>
      {canLock ? (
        <Toggle
          on={lock}
          onClick={() => {
            setLandscapeLockWanted(!lock);
            setLock(!lock);
          }}
        >
          Keep the screen sideways in full screen
        </Toggle>
      ) : null}
    </div>
  );
}

export function AccountSection() {
  return <CloudSettings />;
}

export function HelpSection() {
  const motion = useGame((s) => s.motion);
  const flash = useGame((s) => s.flash);
  const cb = useGame((s) => s.cb);
  const assist = useGame((s) => s.assist);
  const kidSetting = useGame((s) => s.kid);
  const setKid = useGame((s) => s.setKid);
  const kidIn = useKidOn();
  const assistAllowed = MODES[useGame((s) => s.mode)].assistAllowed;
  const toggle = useGame((s) => s.toggleSetting);
  return (
    <div className="flex flex-col gap-2">
      <Toggle on={cb} onClick={() => toggle("cb")}>
        Colour-blind colours (rarity shapes always show)
      </Toggle>
      <Toggle on={motion} onClick={() => toggle("motion")}>
        Motion and shake
      </Toggle>
      <Toggle on={flash} onClick={() => toggle("flash")}>
        Flashes
      </Toggle>
      <Card>
        <Toggle on={kidSetting} onClick={() => setKid(!kidSetting)}>
          Kid Mode
        </Toggle>
        <p className="mt-2 text-sm text-muted">
          For younger anglers. Helping Hand stays on and always glows, the writing gets bigger, hints come sooner and the coaching never stops.
          Messages get a speaker button that reads them out loud. Rare fish and Rebirth ask &quot;Are you sure?&quot; first. Tournaments ignore Kid
          Mode so every score stays fair.
        </p>
        {kidSetting && !assistAllowed ? <p className="mt-1 text-sm text-brass">Not used in this mode.</p> : null}
      </Card>
      <Toggle on={assist || kidIn} onClick={() => (kidIn ? undefined : toggle("assist"))}>
        {kidIn ? "Helping Hand (on with Kid Mode)" : "Helping Hand (a wider green when fights are tough)"}
      </Toggle>
    </div>
  );
}

const CONTROLS: [string, string][] = [
  ["Space", "Cast, hook, then hold to reel (let go to give line). Enter works too."],
  ["Esc", "Open or close the game menu"],
  ["1–6", "Open the menu at a section: Play, Tackle, Lodge, Waters, Players, Settings"],
  ["Tab (hold)", "Quick wheel: swap lures or send an emote. Let go to choose."],
  ["B (hold)", "Satchel: your catch and your tackle"],
  ["[ ]", "Looser or tighter drag in a fight"],
  ["K / R", "Keep or release the fish you just landed"],
  ["F", "Full screen on or off"],
  ["H", "Hide the buttons for a clean picture"],
  ["P", "Save a picture of the water"],
  ["M", "Sound on or off"],
  ["J", "Player 2 holds the reel too (Fish Together, one screen)"],
  ["In menus", "Arrows or WASD to move, Enter to choose, Q and E for sections, Esc to go back"],
  ["Gamepad", "Stick or d-pad to move, A to choose, B to go back, LB and RB for sections, Start for the menu, hold LT for the wheel, hold Y for the satchel"],
];

export function ControlsSection() {
  const drag = useGame((s) => s.drag);
  const setDrag = useGame((s) => s.setDrag);
  return (
    <div className="flex flex-col gap-2">
      <Card>
        <h4 className="font-serif">Reel drag</h4>
        <p className="mt-1 text-sm text-muted">
          Loose drag is gentle on the line. Tight drag lands fish faster, but the line snaps more easily. You can also change it in a fight with [ and ].
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {(["Loose", "Normal", "Tight"] as const).map((label, id) => (
            <button
              key={label}
              type="button"
              data-nav="act"
              aria-pressed={drag === id}
              onClick={() => setDrag(id as 0 | 1 | 2)}
              className={cn("min-h-11 rounded-full px-2 text-sm", drag === id ? "bg-brass text-brass-ink" : "bg-surface-2 text-muted")}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>
      <Card>
        <h4 className="font-serif">Controls</h4>
        <ul className="mt-1 grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm text-muted">
          {CONTROLS.map(([key, what]) => (
            <li key={key} className="flex gap-2">
              <kbd className="h-fit min-w-16 shrink-0 rounded-md border border-line bg-surface-2 px-1.5 text-center text-xs text-fg">{key}</kbd>
              <span>{what}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function SavesSection() {
  const wipe = useGame((s) => s.wipe);
  const armed = useGame((s) => s.armReset);
  const notify = useGame((s) => s.notify);
  const importSave = useGame((s) => s.importSave);
  const exportCode = useGame((s) => s.exportCode);
  const importCode = useGame((s) => s.importCode);
  const mode = useGame((s) => s.mode);
  const file = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [codeOut, setCodeOut] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <Button variant="ghost" data-nav="act" onClick={downloadSave}>
        Export ledger (file)
      </Button>
      <Button variant="ghost" data-nav="act" onClick={() => file.current?.click()}>
        Import ledger (file)
      </Button>
      <input
        ref={file}
        type="file"
        accept="application/json"
        className="sr-only"
        onChange={(event) => {
          const picked = event.target.files?.[0];
          event.target.value = "";
          if (!picked) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const ok = importSave(JSON.parse(String(reader.result)));
              if (!ok) notify("That file is not a ledger.");
            } catch {
              notify("That file is not a ledger.");
            }
          };
          reader.readAsText(picked);
        }}
      />
      <Card>
        <h4 className="font-serif">Save code</h4>
        <p className="mt-1 text-sm text-muted">
          One code carries the whole ledger of {bookOf(mode).name}. Each mode has its own, so a code never mixes in your other modes. Paste it on another device to pick up where you left off. Importing replaces
          this slot&apos;s save.
        </p>
        <Button
          variant="ghost"
          className="mt-2"
          data-nav="act"
          onClick={() => {
            setCodeOut(exportCode());
            notify("Save code ready below.");
          }}
        >
          Make my save code
        </Button>
        {codeOut ? (
          <textarea
            readOnly
            value={codeOut}
            rows={3}
            onFocus={(e) => e.target.select()}
            className="mt-2 w-full rounded-xl border border-line bg-surface-2 p-2 text-xs text-fg"
          />
        ) : null}
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={3}
          placeholder="Paste a save code here…"
          className="mt-2 w-full rounded-xl border border-line bg-surface-2 p-2 text-xs text-fg placeholder:text-muted"
        />
        <Button
          className="mt-2"
          data-nav="act"
          disabled={!code.trim()}
          onClick={() => {
            if (importCode(code)) setCode("");
            else notify("That code is not a ledger.");
          }}
        >
          Import this code
        </Button>
      </Card>
      <Button variant="ghost" data-nav="act" onClick={wipe}>
        {armed ? "Tap again to erase" : "Erase this ledger"}
      </Button>
    </div>
  );
}

export const SETTINGS_SECTIONS = [
  { id: "sound", title: "Sound", sub: "Music, water sounds and volume", icon: "sound", View: SoundSection },
  { id: "picture", title: "Picture quality", sub: "Auto, or Ultra down to Potato", icon: "eye", View: GraphicsSection },
  { id: "fullscreen", title: "Full screen", sub: "Hide the browser bars", icon: "expand", View: FullscreenSection },
  { id: "account", title: "Account and cloud saves", sub: "Sign in, family profiles, keep your fish safe", icon: "cloud", View: AccountSection },
  { id: "help", title: "Help for playing", sub: "Colour-blind colours, motion, Kid Mode", icon: "players", View: HelpSection },
  { id: "controls", title: "Controls", sub: "Keys, gamepad and reel drag", icon: "pad", View: ControlsSection },
  { id: "saves", title: "Your saves", sub: "Files, save codes, start over", icon: "satchel", View: SavesSection },
] as const;

/** Everything on one scrolling page: the old Lodge → Settings route. */
export function AllSettings() {
  return (
    <div className="flex flex-col gap-4">
      <TestingLine className="text-muted" />
      {SETTINGS_SECTIONS.map(({ id, title, View }) => (
        <section key={id} aria-label={title}>
          <h3 className="mb-2 font-serif text-xl">{title}</h3>
          <View />
        </section>
      ))}
    </div>
  );
}
