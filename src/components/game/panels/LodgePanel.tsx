import { useEffect, useRef, useState } from "react";
import {
  BIOMES,
  BOATS,
  compact,
  dexCount,
  exhibitValue,
  GIFT_PRICES,
  LIGHT_PRICE,
  luckTotal,
  LURES,
  money,
  multOf,
  MUTATIONS,
  rarityOf,
  RODS,
  SHOWCASE_SLOTS,
  TANK_TIERS,
  tankExhibitValue,
  tankRatePerHour,
  WEATHER,
  xpNeed,
} from "@/game/content";
import { downloadSave, sim, useGame } from "@/game/engine";
import { createRoom, joinRoom, leaveRoom, useCrew } from "@/game/multiplayer";
import { FishPortrait } from "@/components/game/portrait";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { drawFish } from "@/game/fish-draw";
import { biomeArt, fitCanvas } from "@/game/art";
import { Toggle } from "@/components/game/panels/shared";

export function LodgePanel() {
  const view = useGame((s) => s.lodgeView);
  const setView = useGame((s) => s.setLodgeView);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 overflow-x-auto">
        {(
          [
            ["record", "Record"],
            ["tank", "Aquarium"],
            ["derby", "Derby"],
            ["crew", "Crew"],
            ["settings", "Settings"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={cn(
              "min-h-11 flex-1 shrink-0 rounded-full px-2 text-sm",
              view === id ? "bg-brass text-brass-ink" : "bg-surface text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "record" ? <Record /> : null}
      {view === "tank" ? <Aquarium /> : null}
      {view === "derby" ? <DerbyView /> : null}
      {view === "crew" ? <CrewView /> : null}
      {view === "settings" ? <Settings /> : null}
    </div>
  );
}

function Record() {
  const s = useGame();
  const rebirth = useGame((st) => st.rebirth);
  const ready = s.tot >= 1e7 && s.ub.length === BIOMES.length && (s.phase === "idle" || sim.phase === "idle");
  const parts = [
    ["Rod", RODS[s.rod].luck],
    ["Boat", BOATS[s.boat].luck],
    ["Lure", s.lure >= 0 ? LURES[s.lure].luck : 0],
    ["Weather", WEATHER[s.weather].luck],
    ["Level", s.lv * 0.4],
    ["Rebirth", s.rb * 10],
    ["Dex", dexCount(s.dex) * 0.1],
  ] as const;
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-line bg-surface p-3 text-sm leading-6">
        <p>
          Level {s.lv} · {s.xp}/{xpNeed(s.lv)} xp
        </p>
        <p>Caught {s.caught}</p>
        <p>Earned this run {money(s.tot)}</p>
        <p>Sale multiplier ×{multOf(s.dex, s.rb).toFixed(2)}</p>
        <p>Luck {Math.round(luckTotal(s, s.lure))}</p>
        <p>
          Rebirths {s.rb} · streak best {s.bestStreak}
        </p>
        <p>
          Perfect hooks {s.perfects} · bosses landed {s.bosses} · waters mastered {s.mastered.length}/15
        </p>
        <p>
          Derbies won {s.derbiesWon}
          {s.rushBest ? ` · best Boss Rush ${Math.round(s.rushBest / 1000)}s` : ""}
        </p>
      </div>
      <ul className="rounded-2xl border border-line bg-surface p-3 text-sm">
        {parts.map(([label, value]) => (
          <li key={label} className="flex justify-between border-b border-line py-1 last:border-0">
            <span className="text-muted">{label}</span>
            <span>{compact(value)}</span>
          </li>
        ))}
      </ul>
      <div className="rounded-2xl border border-line bg-surface p-3">
        <h3 className="font-serif text-lg">Rebirth</h3>
        <p className="mt-1 text-sm text-muted">
          Needs {money(1e7)} earned this run and every water unlocked. Coins, gear, lures, waters, and this run’s
          earnings reset. Level, dex, mastered waters, signature lures, and the aquarium stay. Each rebirth adds
          50% sale value and 10 luck.
        </p>
        <p className="mt-2 text-sm">
          Earned {money(s.tot)} / {money(1e7)} · waters {s.ub.length}/{BIOMES.length}
        </p>
        <Button className="mt-3" disabled={!ready} onClick={rebirth}>
          {s.armRebirth ? "Tap again to rebirth" : "Rebirth"}
        </Button>
      </div>
    </div>
  );
}

function Aquarium() {
  const tank = useGame((s) => s.tank);
  const dex = useGame((s) => s.dex);
  const biome = useGame((s) => s.biome);
  const coins = useGame((s) => s.c);
  const mode = useGame((s) => s.mode);
  const motion = useGame((s) => s.motion);
  const addExhibit = useGame((s) => s.addExhibit);
  const removeExhibit = useGame((s) => s.removeExhibit);
  const togglePed = useGame((s) => s.togglePed);
  const autoStock = useGame((s) => s.autoStock);
  const feedTank = useGame((s) => s.feedTank);
  const buyTankTier = useGame((s) => s.buyTankTier);
  const buyGift = useGame((s) => s.buyGift);
  const buyLight = useGame((s) => s.buyLight);
  const [showPicker, setShowPicker] = useState(false);
  const ref = useRef<HTMLCanvasElement>(null);

  const tier = TANK_TIERS[tank.tier];
  const now = Date.now();
  const rate = tankRatePerHour(tank, dex, now);
  const totalValue = tankExhibitValue(tank, dex);
  const feedLeft = Math.max(0, Math.ceil((tank.feedUntil - now) / 60000));
  const nextTier = TANK_TIERS[tank.tier + 1];
  const giftPrice = GIFT_PRICES[tank.gift];

  const swimmers = tank.exhibits.slice(0, 14);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const fish = swimmers
      .map((key, n) => {
        const [b, i] = key.split("-").map(Number);
        const entry = dex[key];
        if (!entry) return null;
        return {
          b,
          i,
          rarity: rarityOf(i),
          m: entry.m,
          x: Math.random(),
          dir: Math.random() < 0.5 ? -1 : 1,
          y: 0.3 + ((n * 29) % 45) / 100,
          v: 0.05 + ((n * 13) % 5) * 0.012,
          phase: Math.random() * 6,
        };
      })
      .filter((row): row is NonNullable<typeof row> => !!row);
    let raf = 0;
    let last = performance.now();
    const loop = (tNow: number) => {
      const dt = Math.min(0.05, (tNow - last) / 1000);
      last = tNow;
      const box = fitCanvas(canvas);
      if (box) {
        const { ctx, w, h } = box;
        const img = biomeArt(biome);
        if (img) {
          ctx.drawImage(img, 0, 0, w, h);
          ctx.fillStyle = "rgba(12, 26, 34, 0.35)";
          ctx.fillRect(0, 0, w, h);
        } else {
          ctx.fillStyle = "#12343c";
          ctx.fillRect(0, 0, w, h);
        }
        for (const one of fish) {
          if (motion) {
            one.x += one.v * one.dir * dt;
            one.phase += dt;
          }
          if (one.x > 1.1) one.dir = -1;
          if (one.x < -0.1) one.dir = 1;
          drawFish(ctx, one.x * w, one.y * h + (motion ? Math.sin(one.phase * 2.2 + one.x * 4) * 3 : 0), Math.min(w, h) * 0.26, one.dir, {
            biome: one.b,
            species: one.i,
            rarity: one.rarity,
            mutation: one.m,
            wag: motion ? Math.sin(one.phase * 6) * 0.35 : 0,
          });
        }
      }
      /* Motion off: the loop paints one still frame and stops. */
      if (motion) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tank.exhibits.join(","), biome, motion]);

  const candidates = Object.keys(dex)
    .filter((k) => dex[k]?.c && !tank.exhibits.includes(k))
    .map((k) => {
      const [b, i] = k.split("-").map(Number);
      return { k, b, i, v: exhibitValue(dex[k], b, i) };
    })
    .sort((a, b) => b.v - a.v)
    .slice(0, 40);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-line bg-surface p-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-serif text-xl">{tier.name}</h3>
          <span className="text-sm text-brass">{money(Math.round(rate))}/hr</span>
        </div>
        <p className="mt-1 text-sm text-muted">
          Exhibits {tank.exhibits.length}/{tier.slots} · glass worth {money(totalValue)} · offline cap {tier.capHours}h
          {tank.gift ? ` · gift shop +${tank.gift * 25}%` : ""}
          {mode === "sandbox" ? " · Zen Waters exhibits are for the love of it — no rent" : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button disabled={feedLeft > 0 || tank.exhibits.length === 0} onClick={feedTank}>
            {feedLeft > 0 ? `Fed · +50% for ${feedLeft}m` : "Feed the tank"}
          </Button>
          <Button variant="ghost" onClick={autoStock}>
            Stock the best
          </Button>
          <Button variant="ghost" onClick={() => setShowPicker((v) => !v)}>
            {showPicker ? "Hide choices" : "Choose exhibits"}
          </Button>
        </div>
      </div>

      <div className="relative h-56 overflow-hidden rounded-2xl border border-line">
        <canvas ref={ref} className="h-full w-full" />
        {tank.exhibits.length === 0 ? (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-fg">
            The glass is empty. Stock your best fish and they will earn while you sleep.
          </p>
        ) : null}
      </div>

      {tank.exhibits.length ? (
        <ul className="flex flex-col">
          {tank.exhibits.map((key) => {
            const [b, i] = key.split("-").map(Number);
            const entry = dex[key];
            if (!entry) return null;
            const onPed = tank.ped.includes(key);
            const lit = tank.lights.includes(b);
            const v = exhibitValue(entry, b, i);
            return (
              <li key={key} className="flex items-center gap-2 border-b border-line py-2">
                <FishPortrait biome={b} species={i} rarity={rarityOf(i)} mutation={entry.m} className="size-12 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    {entry.m ? `${MUTATIONS[entry.m].name} ` : ""}
                    {BIOMES[b].fish[i]}
                  </span>
                  <span className="block text-xs text-muted">
                    {BIOMES[b].name} · glass {money(v)}
                    {onPed ? " · showcase ×3" : ""}
                    {lit ? " · lit ×1.5" : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => togglePed(key)}
                  className={cn(
                    "min-h-11 rounded-full px-3 text-xs",
                    onPed ? "bg-brass text-brass-ink" : "text-muted",
                  )}
                >
                  Showcase
                </button>
                <button type="button" onClick={() => removeExhibit(key)} className="min-h-11 rounded-full px-3 text-xs text-muted">
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {showPicker ? (
        <div className="flex flex-col gap-1">
          <h4 className="font-serif">Add exhibits ({tank.exhibits.length}/{tier.slots})</h4>
          {candidates.length === 0 ? (
            <p className="text-sm text-muted">Nothing else caught yet — or the tank is full.</p>
          ) : (
            candidates.map(({ k, b, i, v }) => (
              <button
                key={k}
                type="button"
                disabled={tank.exhibits.length >= tier.slots}
                onClick={() => addExhibit(k)}
                className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2 py-1.5 text-left enabled:hover:border-brass disabled:opacity-50"
              >
                <FishPortrait biome={b} species={i} rarity={rarityOf(i)} mutation={dex[k].m} className="size-10 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{BIOMES[b].fish[i]}</span>
                  <span className="block text-xs text-muted">{BIOMES[b].name}</span>
                </span>
                <span className="text-sm text-brass">{money(v)}</span>
              </button>
            ))
          )}
        </div>
      ) : null}

      <section className="flex flex-col gap-2">
        <h4 className="font-serif text-lg">Upgrades</h4>
        {nextTier ? (
          <Button disabled={coins < nextTier.price} onClick={buyTankTier}>
            {nextTier.name} · {nextTier.slots} slots · {nextTier.capHours}h cap · {money(nextTier.price)}
          </Button>
        ) : (
          <p className="text-sm text-muted">The Grand Dome is as grand as it gets.</p>
        )}
        {giftPrice != null ? (
          <Button variant="ghost" disabled={coins < giftPrice} onClick={buyGift}>
            Gift Shop level {tank.gift + 1} · +25% income · {money(giftPrice)}
          </Button>
        ) : (
          <p className="text-sm text-muted">Gift shop fully stocked (+75% income).</p>
        )}
        <p className="text-sm text-muted">
          Lighting rigs boost exhibits from one water by 50% ({money(LIGHT_PRICE)} each). Showcase pedestals (×3)
          hold {SHOWCASE_SLOTS}.
        </p>
        <div className="flex flex-wrap gap-1">
          {BIOMES.map((place, b) =>
            tank.lights.includes(b) ? null : (
              <button
                key={place.id}
                type="button"
                disabled={coins < LIGHT_PRICE}
                onClick={() => buyLight(b)}
                className="min-h-11 rounded-full border border-line px-3 text-xs text-muted enabled:hover:border-brass disabled:opacity-50"
              >
                Light: {place.name}
              </button>
            ),
          )}
        </div>
      </section>
    </div>
  );
}

function DerbyView() {
  const derby = useGame((s) => s.derby);
  const startDerby = useGame((s) => s.startDerby);
  const derbiesWon = useGame((s) => s.derbiesWon);
  const bosses = useGame((s) => s.bosses);
  const mastered = useGame((s) => s.mastered);
  const rush = useGame((s) => s.rush);
  const startRush = useGame((s) => s.startRush);
  const rushBest = useGame((s) => s.rushBest);
  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-2xl border border-line bg-surface p-3">
        <h3 className="font-serif text-lg">Derby</h3>
        <p className="mt-1 text-sm text-muted">
          Ten minutes against three rival anglers. Most catch value wins the purse — prizes are money and bragging
          rights, never power. Derbies won: {derbiesWon}.
        </p>
        {derby ? (
          <p className="mt-2 text-sm text-brass">A derby is running — watch the Cast tab for live standings.</p>
        ) : (
          <Button className="mt-3" onClick={startDerby}>
            Start derby
          </Button>
        )}
      </section>
      <section className="rounded-2xl border border-line bg-surface p-3">
        <h3 className="font-serif text-lg">Boss Rush</h3>
        <p className="mt-1 text-sm text-muted">
          Every boss you have mastered, back to back, against the clock. Boss Chum is free during a rush.
          {rushBest ? ` Best clear: ${Math.floor(rushBest / 60000)}:${String(Math.floor((rushBest / 1000) % 60)).padStart(2, "0")}.` : ""}
        </p>
        <p className="mt-2 text-sm">
          Bosses landed {bosses} · waters mastered {mastered.length}
        </p>
        {rush ? (
          <p className="mt-2 text-sm text-brass">
            Rush in progress — boss {rush.pos + 1} of {rush.list.length} waits in {BIOMES[rush.list[rush.pos]].name}.
          </p>
        ) : (
          <Button className="mt-3" disabled={bosses < 3 || mastered.length === 0} onClick={startRush}>
            {bosses < 3 ? `Locked — land 3 bosses (${bosses}/3)` : "Start Boss Rush"}
          </Button>
        )}
      </section>
    </div>
  );
}

function CrewView() {
  const status = useCrew((s) => s.status);
  const code = useCrew((s) => s.code);
  const isHost = useCrew((s) => s.isHost);
  const peers = useCrew((s) => s.peers);
  const feed = useCrew((s) => s.feed);
  const error = useCrew((s) => s.error);
  const notify = useGame((s) => s.notify);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-2xl border border-line bg-surface p-3">
        <h3 className="font-serif text-lg">Online co-op</h3>
        <p className="mt-1 text-sm text-muted">
          Fish the same water with friends, browser to browser. The room creator sets the weather; everyone sees
          each other's boats and catches. Saves and dex stay your own — no trading, nothing to cheat.
        </p>
        {status === "off" ? (
          <div className="mt-3 flex flex-col gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your angler name"
              maxLength={24}
              className="min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-muted"
            />
            <Button
              onClick={async () => {
                const created = await createRoom(name || "Angler");
                if (created) notify(`Room ${created} — share the code.`);
              }}
            >
              Create a room
            </Button>
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="CODE"
                maxLength={8}
                className="min-h-11 w-28 rounded-xl border border-line bg-surface-2 px-3 text-center font-serif text-lg tracking-widest text-fg placeholder:text-muted"
              />
              <Button variant="ghost" className="flex-1" onClick={() => void joinRoom(joinCode, name || "Angler")}>
                Join with code
              </Button>
            </div>
            {error ? <p className="text-sm text-brass">{error}</p> : null}
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm">
              Room <span className="font-serif text-xl tracking-widest text-brass">{code}</span>{" "}
              <span className="text-muted">
                {status === "joining" ? "· joining…" : isHost ? "· you host the weather" : "· connected"}
              </span>
            </p>
            <ul className="text-sm">
              {peers.length === 0 ? (
                <li className="text-muted">Waiting for partners — share the code.</li>
              ) : (
                peers.map((p) => (
                  <li key={p.id} className="flex justify-between border-b border-line py-1 last:border-0">
                    <span>{p.name || "Partner"}</span>
                    <span className="text-muted">
                      {p.connectionState}
                      {p.rttMs != null ? ` · ${p.rttMs}ms` : ""}
                    </span>
                  </li>
                ))
              )}
            </ul>
            <Button variant="ghost" onClick={leaveRoom}>
              Leave room
            </Button>
          </div>
        )}
      </section>
      {feed.length ? (
        <section className="rounded-2xl border border-line bg-surface p-3">
          <h4 className="font-serif">On the water</h4>
          <ul className="mt-1 flex flex-col gap-1 text-sm text-muted">
            {[...feed].reverse().map((f) => (
              <li key={f.id}>{f.text}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

const CONTROLS: [string, string, string][] = [
  ["Space", "Cast, hook and reel (Enter works too)", "Click the water for the same thing"],
  ["1–7", "Open a tab (press again to close it)", "1 Cast, 2 Bag, 3 Gear, 4 Lures, 5 Waters, 6 Dex, 7 Lodge"],
  ["Esc", "Close the panel or the catch card", "Closes whatever is open on top of the water"],
  ["F", "Full screen on or off", "Fills the whole screen. Press F again or Esc to leave."],
  ["H", "Hide the buttons for a clean picture", "Photo mode. Press any key or click to bring the buttons back."],
  ["M", "Sound on or off", "Mute"],
  ["J", "Player 2 reel tap (Local Co-op)", "Same band, shared glory"],
];
function Settings() {
  const sound = useGame((s) => s.sound);
  const motion = useGame((s) => s.motion);
  const flash = useGame((s) => s.flash);
  const assist = useGame((s) => s.assist);
  const followClock = useGame((s) => s.followClock);
  const gfx = useGame((s) => s.gfx);
  const tier = useGame((s) => s.tier);
  const setGfx = useGame((s) => s.setGfx);
  const toggle = useGame((s) => s.toggleSetting);
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
      <Toggle on={sound} onClick={() => toggle("sound")}>
        Sound
      </Toggle>
      <Toggle on={motion} onClick={() => toggle("motion")}>
        Motion and shake
      </Toggle>
      <Toggle on={flash} onClick={() => toggle("flash")}>
        Flashes
      </Toggle>
      <Toggle on={assist} onClick={() => toggle("assist")}>
        Helping Hand (wider band when reeling is tough)
      </Toggle>
      <Toggle on={followClock} onClick={() => toggle("followClock")}>
        Follow the clock (dawn, dusk and night light)
      </Toggle>
      <div className="rounded-2xl border border-line bg-surface p-3">
        <h4 className="font-serif">Graphics</h4>
        <p className="mt-1 text-sm text-muted">
          Auto picks the best look for this device and eases off if the game gets choppy. Pick one to keep it.
        </p>
        <div className="mt-2 grid grid-cols-4 gap-1">
          {(
            [
              ["auto", "Auto"],
              ["full", "Full"],
              ["lite", "Light"],
              ["mobile", "Mobile"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={gfx === id}
              onClick={() => setGfx(id)}
              className={cn(
                "min-h-11 rounded-full px-2 text-sm",
                gfx === id ? "bg-brass text-brass-ink" : "bg-surface-2 text-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Showing: {tier === "full" ? "Full" : tier === "lite" ? "Light" : "Mobile"}</p>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-3">
        <h4 className="font-serif">Controls</h4>
        <ul className="mt-1 grid grid-cols-1 gap-x-4 gap-y-1 text-sm text-muted sm:grid-cols-2">
          {CONTROLS.map(([key, what, tip]) => (
            <li key={key} title={tip} className="flex gap-2">
              <kbd className="min-w-8 rounded-md border border-line bg-surface-2 px-1.5 text-center text-xs text-fg">{key}</kbd>
              <span>{what}</span>
            </li>
          ))}
        </ul>
      </div>
      <Button variant="ghost" onClick={downloadSave}>
        Export ledger (file)
      </Button>
      <Button variant="ghost" onClick={() => file.current?.click()}>
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
      <div className="rounded-2xl border border-line bg-surface p-3">
        <h4 className="font-serif">Save code</h4>
        <p className="mt-1 text-sm text-muted">
          One code carries this mode's whole ledger ({mode}). Paste it on another device to pick up where you left
          off — importing replaces this slot's save.
        </p>
        <Button
          variant="ghost"
          className="mt-2"
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
          disabled={!code.trim()}
          onClick={() => {
            if (importCode(code)) setCode("");
            else notify("That code is not a ledger.");
          }}
        >
          Import this code
        </Button>
      </div>
      <Button variant="ghost" onClick={wipe}>
        {armed ? "Tap again to erase" : "Erase this ledger"}
      </Button>
    </div>
  );
}

