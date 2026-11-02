import { BIOMES, biomeSpeciesCaught, money, STAGE_NAMES } from "@/game/content";
import { useGame } from "@/game/engine";
import { MODES, stageIn } from "@/game/modes";
import { waterBlurb } from "@/game/hubcopy";
import { useHubUi } from "@/game/hubstate";
import { spotsOf } from "@/game/spots";
import { BossControls } from "@/components/game/panels/CastPanel";
import { Framed, Painting } from "@/components/game/hub/art";
import { DetailPaper, Facts, MasterDetail, PaperButton, Title, type HubItem } from "@/components/game/hub/parts";
import { closeHub } from "@/components/game/hub/actions";

/** The picture of a water with its fishing spots as small brass pins: this is the map. */
function SpotMap({ index, mystery }: { index: number; mystery: boolean }) {
  const place = BIOMES[index];
  const spots = spotsOf(index);
  return (
    <Framed>
      <Painting id={place.id} mystery={mystery} className="aspect-[16/9]" focus="50% 50%">
        {mystery
          ? null
          : spots.map((sp) => (
              <span
                key={sp.id}
                title={sp.name}
                className="absolute grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-[#fff4d6] bg-[#d79a2c] text-[10px] font-bold text-[#2a1c08] shadow-[0_1px_3px_rgb(0_0_0/0.6)]"
                style={{ left: `${sp.x * 100}%`, top: `${sp.y * 100}%` }}
              >
                {spots.indexOf(sp) + 1}
              </span>
            ))}
      </Painting>
    </Framed>
  );
}

function Detail({ index }: { index: number }) {
  const place = BIOMES[index];
  const ub = useGame((s) => s.ub);
  const biome = useGame((s) => s.biome);
  const coins = useGame((s) => s.c);
  const dex = useGame((s) => s.dex);
  const mode = useGame((s) => s.mode);
  const mastered = useGame((s) => s.mastered);
  const phase = useGame((s) => s.phase);
  const travel = useGame((s) => s.travel);
  const owned = ub.includes(index);
  const here = biome === index;
  const afford = coins >= place.price;
  const caught = biomeSpeciesCaught(dex, index);
  const stage = stageIn(MODES[mode], dex, index);
  const busy = phase !== "idle";
  const spots = spotsOf(index);
  return (
    <DetailPaper label={place.name} className="flex h-full flex-col">
      <SpotMap index={index} mystery={!owned} />
      <div className="mt-4">
        <Title sub={owned ? waterBlurb(index) : `Costs ${money(place.price)} to unlock. You have ${money(coins)}.`}>{owned ? place.name : `${place.name} (locked)`}</Title>
        {owned ? (
          <Facts
            facts={[
              `${caught} of 24 fish found here`,
              `You are in ${STAGE_NAMES[stage]}`,
              mastered.includes(index) ? "Mastered: you beat the boss" : "The boss is still out there",
            ]}
          />
        ) : null}
        {owned ? (
          <div className="mt-3">
            <p className="hub-ink-muted text-[13px] tracking-widest uppercase">Places to cast (the numbers on the picture)</p>
            <ol className="mt-1 flex flex-col gap-1 text-[14px]">
              {spots.map((sp, i) => (
                <li key={sp.id}>
                  <span className="font-semibold">
                    {i + 1}. {sp.name}
                  </span>
                  <span className="hub-ink-muted"> · {sp.tip}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {here ? (
          <div className="mt-3 rounded-xl bg-[#1b130b] p-2">
            <BossControls />
          </div>
        ) : null}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
        <PaperButton
          disabled={busy || here || (!owned && !afford)}
          onClick={() => {
            travel(index);
            closeHub();
          }}
        >
          {here ? "You are here" : owned ? "Go fishing here" : afford ? `Unlock for ${money(place.price)}` : `Needs ${money(place.price)}`}
        </PaperButton>
        {busy ? <span className="hub-ink-muted text-[14px]">Land or lose this fish before you travel.</span> : null}
      </div>
    </DetailPaper>
  );
}

export function WatersTab({ split }: { split: boolean }) {
  const ub = useGame((s) => s.ub);
  const biome = useGame((s) => s.biome);
  const dex = useGame((s) => s.dex);
  const saved = useHubUi((s) => s.item.waters);
  const items: HubItem[] = BIOMES.map((b, i) => ({
    id: String(i),
    title: b.name,
    sub: ub.includes(i) ? (biome === i ? "You are here" : `${biomeSpeciesCaught(dex, i)} of 24 fish`) : `Locked · ${money(b.price)}`,
    locked: !ub.includes(i),
    thumb: <Painting id={b.id} mystery={!ub.includes(i)} className="size-11 shrink-0 rounded-lg" />,
  }));
  return (
    <MasterDetail
      tab="waters"
      items={items}
      selectedId={saved ?? String(biome)}
      listLabel="Waters"
      split={split}
      detailLabel="About this water"
      render={(id) => <Detail index={Number(id)} />}
    />
  );
}
