import { useState } from "react";
import { alchemize, synthesize, SYNTH_INPUTS, type SynthOutcome } from "../../game/actions";
import { GRADES, MAX_GRADE, grade } from "../../game/data/grades";
import { alchemyValue, itemLevel, synthFee } from "../../game/loot";
import type { Item, ItemId } from "../../game/schema";
import { engine, useGame } from "../engine";
import { compact, percent } from "../format";
import { EmptyTile, ItemDetails, ItemTile } from "../items";

const OUTCOME: Record<SynthOutcome, string> = {
  jackpot: "Great success! It jumped two grades.",
  upgrade: "Success! One grade higher.",
  stay: "The cube held. Same grade, new item.",
};

function Synthesis() {
  const state = useGame();
  const [g, setG] = useState(0);
  const [picked, setPicked] = useState<ItemId[]>([]);
  const [result, setResult] = useState<{ item: Item; outcome: SynthOutcome } | null>(null);
  const candidates = state.inventory.map((id) => state.items[id]!).filter((it) => it.grade === g && !it.locked);
  const chosen = picked.map((id) => state.items[id]).filter((it): it is Item => !!it && candidates.includes(it));
  const synth = grade(g).synth;
  const level = chosen.length ? itemLevel(chosen.reduce((sum, it) => sum + it.level, 0) / chosen.length) : 1;
  const fee = synthFee(g, level);

  function choose(grade: number) {
    setG(grade);
    setPicked([]);
  }

  function autoFill() {
    setPicked([...candidates].sort((a, b) => a.level - b.level).slice(0, SYNTH_INPUTS).map((it) => it.id));
  }

  function toggle(id: ItemId) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < SYNTH_INPUTS ? [...p, id] : p));
  }

  function run() {
    const out = engine.act((s) => synthesize(s, chosen.map((it) => it.id)));
    if (out.ok) {
      setResult(out.value);
      setPicked([]);
    }
  }

  return (
    <div className="cube-mode">
      <div className="grade-picker">
        {GRADES.slice(0, MAX_GRADE).map((def, i) => {
          const count = state.inventory.filter((id) => state.items[id]!.grade === i && !state.items[id]!.locked).length;
          return (
            <button key={def.name} type="button" className={i === g ? "active" : ""} style={{ color: def.color }} onClick={() => choose(i)}>
              {def.name} <span className="muted">{count}</span>
            </button>
          );
        })}
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
          <div className="row">
            <button type="button" onClick={autoFill} disabled={candidates.length < SYNTH_INPUTS}>
              Auto-fill
            </button>
            <button type="button" className="primary" onClick={run} disabled={chosen.length !== SYNTH_INPUTS || state.gold < fee}>
              Synthesize
            </button>
          </div>
        </div>
        <div>
          <p className="muted">
            {candidates.length} unlocked {grade(g).name} items in the bag. Click to add or remove.
          </p>
          <div className="item-grid small">
            {candidates.map((it) => (
              <ItemTile key={it.id} item={it} selected={picked.includes(it.id)} onClick={() => toggle(it.id)} />
            ))}
          </div>
        </div>
        {result && (
          <div className="cube-result">
            <div className={`outcome ${result.outcome}`}>{OUTCOME[result.outcome]}</div>
            {state.items[result.item.id] && <ItemDetails item={state.items[result.item.id]!} />}
          </div>
        )}
      </div>
    </div>
  );
}

function Alchemy() {
  const state = useGame();
  const [upTo, setUpTo] = useState(0);
  const items = state.inventory.map((id) => state.items[id]!).filter((it) => it.grade <= upTo && !it.locked);
  const total = items.reduce((sum, it) => sum + alchemyValue(it), 0);
  return (
    <div className="cube-mode">
      <p className="muted">Turn unlocked items into gold. Lock anything you want to keep.</p>
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
        <button
          type="button"
          className="primary"
          disabled={items.length === 0}
          onClick={() => engine.act((s) => alchemize(s, items.map((it) => it.id)), (gold) => `+${compact(gold)} gold`)}
        >
          Alchemize {items.length} for {compact(total)} gold
        </button>
      </div>
    </div>
  );
}

export function CubePanel() {
  const [mode, setMode] = useState<"synth" | "alchemy">("synth");
  return (
    <div className="cube">
      <div className="subtabs">
        <button type="button" className={mode === "synth" ? "active" : ""} onClick={() => setMode("synth")}>
          Synthesis 9 → 1
        </button>
        <button type="button" className={mode === "alchemy" ? "active" : ""} onClick={() => setMode("alchemy")}>
          Alchemy
        </button>
      </div>
      {mode === "synth" ? <Synthesis /> : <Alchemy />}
    </div>
  );
}
