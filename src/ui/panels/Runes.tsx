import { useState } from "react";
import { buyRune, runeStatus } from "../../game/actions";
import { RUNES, type ModKey } from "../../game/data/runes";
import { RUNE_KEYS, type RuneKey } from "../../game/schema";
import { engine, useGame } from "../engine";
import { compact, percent } from "../format";

const UNIT = 86;
const RADIUS = 31;

const DESCRIBE: Record<ModKey, (v: number) => string> = {
  atkPct: (v) => `+${percent(v)} attack`,
  hpPct: (v) => `+${percent(v)} life`,
  armorPct: (v) => `+${percent(v)} armor`,
  critChance: (v) => `+${percent(v)} crit chance`,
  critDamage: (v) => `+${percent(v)} crit damage`,
  gold: (v) => `+${percent(v)} gold`,
  xp: (v) => `+${percent(v)} experience`,
  commonChest: (v) => `+${percent(v)} chest drop chance`,
  bossChest: (v) => `+${percent(v)} boss chest chance`,
  chestInterval: (v) => `chests can drop ${v / 1000}s sooner`,
  inventory: (v) => `+${v} bag slots`,
  partySlot: (v) => `+${v} party slot`,
  autoOpen: () => "opens chests automatically",
  offlineHours: (v) => `+${v}h of offline rewards`,
  fewerWaves: (v) => `${v} fewer wave${v > 1 ? "s" : ""} per stage`,
};

export function RunesPanel() {
  const state = useGame();
  const [focus, setFocus] = useState<RuneKey>("might");
  const xs = RUNE_KEYS.map((k) => RUNES[k].x);
  const ys = RUNE_KEYS.map((k) => RUNES[k].y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = (Math.max(...xs) - minX) * UNIT + RADIUS * 2 + 16;
  const height = (Math.max(...ys) - minY) * UNIT + RADIUS * 2 + 16;
  const pos = (k: RuneKey) => ({ x: (RUNES[k].x - minX) * UNIT + RADIUS + 8, y: (RUNES[k].y - minY) * UNIT + RADIUS + 8 });
  const def = RUNES[focus];
  const status = runeStatus(state, focus);

  return (
    <div className="runes">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="rune-tree" role="list">
        {RUNE_KEYS.flatMap((k) =>
          RUNES[k].requires.map((r) => {
            const a = pos(r);
            const b = pos(k);
            return <line key={`${r}-${k}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={(state.runes[r] ?? 0) > 0 ? "edge on" : "edge"} />;
          }),
        )}
        {RUNE_KEYS.map((k) => {
          const s = runeStatus(state, k);
          const p = pos(k);
          const cls = s.maxed ? "maxed" : s.locked ? "locked" : s.cost <= state.gold ? "ready" : s.owned > 0 ? "owned" : "";
          return (
            <g
              key={k}
              role="listitem"
              className={`rune ${cls} ${focus === k ? "focus" : ""}`}
              transform={`translate(${p.x} ${p.y})`}
              onClick={() => setFocus(k)}
              onDoubleClick={() => engine.act((st) => buyRune(st, k))}
            >
              <circle r={RADIUS} />
              {RUNES[k].name.split(" ").map((word, i, words) => (
                <text key={word} y={(i - words.length / 2) * 10 + 2}>
                  {word}
                </text>
              ))}
              <text y={15} className="small">
                {s.owned}/{RUNES[k].max}
              </text>
            </g>
          );
        })}
      </svg>
      <aside className="rune-side">
        <h3>{def.name}</h3>
        <p>{DESCRIBE[def.effect](def.per)} per level</p>
        <p className="muted">
          Level {status.owned}/{def.max}
          {status.owned > 0 && ` · now ${DESCRIBE[def.effect](def.per * status.owned)}`}
        </p>
        {def.requires.length > 0 && <p className="muted">Requires {def.requires.map((r) => RUNES[r].name).join(", ")}</p>}
        <button
          type="button"
          className="primary"
          disabled={status.maxed || status.locked || state.gold < status.cost}
          onClick={() => engine.act((s) => buyRune(s, focus), () => `${def.name} → ${status.owned + 1}`)}
        >
          {status.maxed ? "Maxed" : status.locked ? "Locked" : `Buy for ${compact(status.cost)} gold`}
        </button>
        <p className="muted">Tip: double-click a rune to buy it.</p>
      </aside>
    </div>
  );
}
