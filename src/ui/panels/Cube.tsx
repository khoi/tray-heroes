import { useState } from "react";
import {
  CRAFT_TIERS,
  SYNTH_INPUTS,
  alchemize,
  corrode,
  craft,
  craftCost,
  craftOdds,
  craftTierUnlocked,
  cubeUnlocked,
  featureUnlocked,
  maxCraftLevel,
  offer,
  offeringFee,
  plagueUnlocked,
  removalFee,
  socket,
  synthesize,
  unsocket,
  type SocketKind,
  type SynthOutcome,
} from "../../game/cube";
import { GRADES, MAX_GRADE, grade } from "../../game/data/grades";
import { BASES, BASE_KEYS, type BaseKey } from "../../game/data/items";
import { MATERIAL_KEYS, material, type MaterialKey } from "../../game/data/materials";
import { PLAGUE_MAX_CONTAMINATION } from "../../game/data/world";
import { alchemyValue, itemLevel, synthFee } from "../../game/loot";
import type { Item, ItemId } from "../../game/schema";
import { CUBE_FEATURES, CUBE_MAX_LEVEL, CUBE_UNLOCK_HERO_LEVEL, cubeXpToNext, type CubeFeature } from "../../game/tuning";
import { engine, useGame } from "../engine";
import { compact, percent } from "../format";
import { EmptyTile, ItemDetails, ItemTile, MaterialChip } from "../items";
import "./cube.css";

type Mode = "synthesis" | "alchemy" | "craft" | "sockets" | "offering" | "corrosion";
const MODE_LABEL: Record<Mode, string> = { synthesis: "Synthesis", alchemy: "Alchemy", craft: "Craft", sockets: "Sockets", offering: "Offering", corrosion: "Corrosion" };
const MODE_FEATURE: Record<Exclude<Mode, "corrosion">, CubeFeature> = { synthesis: "synthesis", alchemy: "alchemy", craft: "craft", sockets: "decoration", offering: "offering" };

const OUTCOME: Record<SynthOutcome, string> = {
  jackpot: "Great success! It jumped two grades.",
  upgrade: "Success! One grade higher.",
  stay: "The cube held. Same grade, new item.",
};

function levelChoices(max: number): number[] {
  const out = [1];
  for (let level = 5; level <= max; level += 5) out.push(level);
  return out;
}

function bagItems(state: ReturnType<typeof useGame>): Item[] {
  return state.inventory.map((id) => state.items[id]!).filter(Boolean);
}

function Synthesis() {
  const state = useGame();
  const [g, setG] = useState(0);
  const [picked, setPicked] = useState<ItemId[]>([]);
  const [level, setLevel] = useState<number | null>(null);
  const [result, setResult] = useState<{ item: Item; outcome: SynthOutcome } | null>(null);
  const candidates = bagItems(state).filter((it) => it.grade === g && !it.locked);
  const chosen = picked.map((id) => state.items[id]).filter((it): it is Item => !!it && candidates.includes(it));
  const synth = grade(g).synth;
  const maxLevel = chosen.length ? Math.max(...chosen.map((i) => i.level)) : 1;
  const avgLevel = chosen.length ? itemLevel(chosen.reduce((sum, it) => sum + it.level, 0) / chosen.length) : 1;
  const outLevel = Math.min(level ?? avgLevel, maxLevel);
  const fee = synthFee(g, outLevel);

  function toggle(id: ItemId) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < SYNTH_INPUTS ? [...p, id] : p));
  }

  return (
    <div className="cube-mode">
      <div className="grade-picker">
        {GRADES.slice(0, MAX_GRADE).map((def, i) => (
          <button
            key={def.name}
            type="button"
            className={i === g ? "active" : ""}
            style={{ color: def.color }}
            onClick={() => {
              setG(i);
              setPicked([]);
            }}
          >
            {def.name} <span className="muted">{bagItems(state).filter((it) => it.grade === i && !it.locked).length}</span>
          </button>
        ))}
      </div>
      <div className="cube-body">
        <div>
          <div className="cube-grid">
            {Array.from({ length: SYNTH_INPUTS }, (_, i) => {
              const it = chosen[i];
              return it ? <ItemTile key={it.id} item={it} onClick={() => toggle(it.id)} /> : <EmptyTile key={i} />;
            })}
          </div>
          {synth && (
            <ul className="odds">
              <li>Upgrade {percent(1 - synth.skip - synth.stay)}</li>
              <li>Skip a grade {percent(synth.skip)}</li>
              {synth.stay > 0 && <li>Stay {percent(synth.stay)}</li>}
              <li>Fee {compact(fee)} gold</li>
            </ul>
          )}
          <label className="field">
            Output level
            <select value={outLevel} onChange={(e) => setLevel(Number(e.target.value))}>
              {levelChoices(maxLevel).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <div className="row">
            <button type="button" onClick={() => setPicked([...candidates].sort((a, b) => a.level - b.level).slice(0, SYNTH_INPUTS).map((it) => it.id))} disabled={candidates.length < SYNTH_INPUTS}>
              Auto-fill
            </button>
            <button
              type="button"
              className="primary"
              disabled={chosen.length !== SYNTH_INPUTS || state.gold < fee}
              onClick={() => {
                const out = engine.act((s) => synthesize(s, chosen.map((it) => it.id), outLevel));
                if (out.ok) {
                  setResult(out.value);
                  setPicked([]);
                }
              }}
            >
              Synthesize
            </button>
          </div>
        </div>
        <div>
          <p className="muted">
            {candidates.length} unlocked {grade(g).name} items. Click to add or remove.
          </p>
          <div className="item-grid small">
            {candidates.map((it) => (
              <ItemTile key={it.id} item={it} selected={picked.includes(it.id)} onClick={() => toggle(it.id)} />
            ))}
          </div>
        </div>
        {result && state.items[result.item.id] && (
          <div className="cube-result">
            <div className={`outcome ${result.outcome}`}>{OUTCOME[result.outcome]}</div>
            <ItemDetails item={state.items[result.item.id]!} />
          </div>
        )}
      </div>
    </div>
  );
}

function Alchemy({ corrosion }: { corrosion: boolean }) {
  const state = useGame();
  const [upTo, setUpTo] = useState(0);
  const items = bagItems(state).filter((it) => it.grade <= upTo && !it.locked);
  const gold = items.reduce((sum, it) => sum + alchemyValue(it), 0);
  const dust = items.reduce((sum, it) => sum + grade(it.grade).dust, 0);
  const contamination = items.reduce((sum, it) => sum + (it.grade + 1) * 2, 0);
  return (
    <div className="cube-mode">
      <p className="muted">
        {corrosion
          ? `Corrode unlocked items into Plaguelands contamination (${Math.floor(state.plague.contamination)}/${PLAGUE_MAX_CONTAMINATION}).`
          : "Turn unlocked items into gold and Arcane Dust for crafting. Lock anything you want to keep."}
      </p>
      <div className="grade-picker">
        {GRADES.map((def, i) => (
          <button key={def.name} type="button" className={i === upTo ? "active" : ""} style={{ color: def.color }} onClick={() => setUpTo(i)}>
            up to {def.name}
          </button>
        ))}
      </div>
      <div className="item-grid small">
        {items.map((it) => (
          <ItemTile key={it.id} item={it} />
        ))}
      </div>
      <div className="row">
        {corrosion ? (
          <button type="button" className="primary" disabled={items.length === 0} onClick={() => engine.act((s) => corrode(s, items.map((it) => it.id)), (n) => `+${n} contamination`)}>
            Corrode {items.length} for {contamination} contamination
          </button>
        ) : (
          <button
            type="button"
            className="primary"
            disabled={items.length === 0}
            onClick={() => engine.act((s) => alchemize(s, items.map((it) => it.id)), (r) => `+${compact(r.gold)} gold, +${r.dust} dust`)}
          >
            Alchemize {items.length} for {compact(gold)} gold and {dust} dust
          </button>
        )}
      </div>
    </div>
  );
}

function Craft() {
  const state = useGame();
  const [base, setBase] = useState<BaseKey | "any">("any");
  const [tier, setTier] = useState(1);
  const top = maxCraftLevel(state);
  const [level, setLevel] = useState(top);
  const [made, setMade] = useState<ItemId | null>(null);
  const cost = craftCost(tier);
  const odds = craftOdds(tier);
  return (
    <div className="cube-mode">
      <div className="cube-body">
        <div className="craft-form">
          <label className="field">
            Item
            <select value={base} onChange={(e) => setBase(e.target.value as BaseKey | "any")}>
              <option value="any">Random</option>
              {BASE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {BASES[k].name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Level
            <select value={Math.min(level, top)} onChange={(e) => setLevel(Number(e.target.value))}>
              {levelChoices(top).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <div className="grade-picker">
            {Array.from({ length: CRAFT_TIERS }, (_, i) => i + 1).map((t) => (
              <button key={t} type="button" className={t === tier ? "active" : ""} disabled={!craftTierUnlocked(state, t)} onClick={() => setTier(t)}>
                Tier {t}
              </button>
            ))}
          </div>
          <ul className="odds">
            {odds.map((w, g) =>
              w > 0 ? (
                <li key={g} style={{ color: grade(g).color }}>
                  {grade(g).name} {w}%
                </li>
              ) : null,
            )}
            <li>
              Cost {compact(cost.gold)} gold and {cost.dust} dust (you have {state.materials.dust ?? 0})
            </li>
          </ul>
          <button
            type="button"
            className="primary"
            onClick={() => {
              const out = engine.act((s) => craft(s, base === "any" ? null : base, tier, Math.min(level, top)));
              if (out.ok) setMade(out.value.id);
            }}
          >
            Craft
          </button>
        </div>
        {made !== null && state.items[made] && <ItemDetails item={state.items[made]!} />}
      </div>
    </div>
  );
}

function Sockets() {
  const state = useGame();
  const [focus, setFocus] = useState<ItemId | null>(null);
  const item = focus === null ? undefined : state.items[focus];
  const withSockets = bagItems(state).filter((it) => it.sockets.decoration.length + it.sockets.engraving.length + it.sockets.inscription.length > 0);
  const fits: Record<SocketKind, string> = { decoration: "gem", engraving: "part", inscription: "scroll" };
  const options = (kind: SocketKind) => MATERIAL_KEYS.filter((k) => material(k).kind === fits[kind] && (state.materials[k] ?? 0) > 0);
  return (
    <div className="cube-mode">
      <p className="muted">
        Gems go in decoration sockets, monster parts in engravings, scrolls write a random inscription. Items must be in the bag. Removing destroys the material.
      </p>
      <div className="cube-body">
        <div className="item-grid small">
          {withSockets.map((it) => (
            <ItemTile key={it.id} item={it} selected={focus === it.id} onClick={() => setFocus(it.id)} />
          ))}
        </div>
        {item && (
          <div className="socket-editor">
            <ItemDetails item={item} />
            {(["decoration", "engraving", "inscription"] as SocketKind[]).map((kind) =>
              item.sockets[kind].map((filled, i) => (
                <div key={`${kind}${i}`} className="socket-row">
                  <span className="muted">
                    {kind} {i + 1}
                  </span>
                  {!featureUnlocked(state, kind) ? (
                    <span className="muted">Cube level {CUBE_FEATURES[kind]}</span>
                  ) : filled !== null ? (
                    <button type="button" disabled={!featureUnlocked(state, "removal")} onClick={() => engine.act((s) => unsocket(s, item.id, kind, i))}>
                      Remove for {compact(removalFee(item, kind))} gold
                    </button>
                  ) : options(kind).length === 0 ? (
                    <span className="muted">No {fits[kind]}s</span>
                  ) : (
                    <div className="chip-row">
                      {options(kind).map((k) => (
                        <MaterialChip key={k} id={k as MaterialKey} count={state.materials[k]} onClick={() => engine.act((s) => socket(s, item.id, kind, i, k))} />
                      ))}
                    </div>
                  )}
                </div>
              )),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Offering() {
  const state = useGame();
  const [focus, setFocus] = useState<ItemId | null>(null);
  const items = bagItems(state).filter((it) => it.grade >= 3);
  const item = focus === null ? undefined : state.items[focus];
  return (
    <div className="cube-mode">
      <p className="muted">Offer gold to reroll the random stats of a Legendary or better item.</p>
      <div className="cube-body">
        <div className="item-grid small">
          {items.map((it) => (
            <ItemTile key={it.id} item={it} selected={focus === it.id} onClick={() => setFocus(it.id)} />
          ))}
        </div>
        {item && (
          <ItemDetails item={item}>
            <button type="button" className="primary" onClick={() => engine.act((s) => offer(s, item.id), () => "Stats rerolled")}>
              Reroll for {compact(offeringFee(item))} gold
            </button>
          </ItemDetails>
        )}
      </div>
    </div>
  );
}

export function CubePanel() {
  const state = useGame();
  const [mode, setMode] = useState<Mode>("synthesis");
  if (!cubeUnlocked(state)) return <p className="muted">The Cube opens when any hero reaches level {CUBE_UNLOCK_HERO_LEVEL}.</p>;
  const open = (m: Mode) => (m === "corrosion" ? plagueUnlocked(state) : featureUnlocked(state, MODE_FEATURE[m]));
  const need = (m: Mode) => (m === "corrosion" ? "Plaguelands" : `Cube ${CUBE_FEATURES[MODE_FEATURE[m]]}`);
  const atMax = state.cube.level >= CUBE_MAX_LEVEL;
  return (
    <div className="cube">
      <div className="cube-level">
        <b>Cube level {state.cube.level}</b>
        {!atMax && (
          <div className="bar xp grow" title={`${Math.floor(state.cube.xp)} / ${cubeXpToNext(state.cube.level)}`}>
            <span style={{ width: `${(state.cube.xp / cubeXpToNext(state.cube.level)) * 100}%` }} />
          </div>
        )}
        <span className="muted">Using the Cube levels it up and unlocks new functions.</span>
      </div>
      <div className="subtabs">
        {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
          <button key={m} type="button" className={mode === m ? "active" : ""} disabled={!open(m)} title={open(m) ? undefined : `Needs ${need(m)}`} onClick={() => setMode(m)}>
            {MODE_LABEL[m]}
            {!open(m) && <span className="muted"> · {need(m)}</span>}
          </button>
        ))}
      </div>
      {mode === "synthesis" && <Synthesis />}
      {mode === "alchemy" && <Alchemy corrosion={false} />}
      {mode === "craft" && <Craft />}
      {mode === "sockets" && <Sockets />}
      {mode === "offering" && <Offering />}
      {mode === "corrosion" && <Alchemy corrosion />}
    </div>
  );
}
