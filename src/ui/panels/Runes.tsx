import { useState, type CSSProperties } from "react";
import { buyRune, resetRunes, runeStatus } from "../../game/actions";
import { BRANCHES, RUNES, RUNE_KEYS, runePosition, type Branch, type ModKey, type RuneKey } from "../../game/data/runes";
import { STATS, type StatKey } from "../../game/data/stats";
import { engine, useGame } from "../engine";
import { compact, percent } from "../format";

const UNIT = 62;
const RADIUS = 22;

const UTILITY_TEXT: Partial<Record<ModKey, (v: number) => string>> = {
  commonChest: (v) => `+${percent(v)} chest drop chance`,
  bossChest: (v) => `+${percent(v)} boss chest chance`,
  chestInterval: (v) => `chests can drop ${v / 1000}s sooner`,
  inventory: (v) => `+${v} bag slots`,
  stash: (v) => `+${v} stash page`,
  partySlot: (v) => `+${v} party slot`,
  skillSlot: (v) => `+${v} active skill slot`,
  autoOpenCommon: () => "opens chests automatically",
  autoOpenBoss: () => "opens boss chests automatically",
  autoOpenAct: () => "opens act chests automatically",
  autoOpenSpeed: (v) => `auto-open ${v}s faster`,
  offlineHours: (v) => `+${v}h of offline rewards`,
  fewerWaves: (v) => `${v} fewer wave${v > 1 ? "s" : ""} per stage`,
  alchemyGold: (v) => `+${percent(v)} alchemy gold`,
  materialDrop: (v) => `+${percent(v)} material drops`,
  soulDrop: (v) => `+${percent(v)} Soulstone drops`,
  cubeXp: (v) => `+${percent(v)} Cube experience`,
};

export function describe(effect: ModKey, value: number): string {
  const utility = UTILITY_TEXT[effect];
  if (utility) return utility(value);
  const stat = STATS[effect as StatKey];
  return `+${stat.percent ? percent(value) : compact(value)} ${stat.label.toLowerCase()}`;
}

const BRANCH_COLOR: Record<Branch, string> = { heroes: "#ffd23f", wisdom: "#62c3ff", gold: "#ffa23a", storage: "#b8a27a", treasure: "#c56bff", combat: "#ff6b7a" };

export function RunesPanel() {
  const state = useGame();
  const [focus, setFocus] = useState<RuneKey>("might");
  const pos = Object.fromEntries(RUNE_KEYS.map((k) => [k, runePosition(k)])) as Record<RuneKey, { x: number; y: number }>;
  const xs = RUNE_KEYS.map((k) => pos[k].x);
  const ys = RUNE_KEYS.map((k) => pos[k].y);
  const minX = Math.min(...xs, 0);
  const minY = Math.min(...ys, 0);
  const width = (Math.max(...xs, 0) - minX) * UNIT + RADIUS * 2 + 16;
  const height = (Math.max(...ys, 0) - minY) * UNIT + RADIUS * 2 + 16;
  const at = (p: { x: number; y: number }) => ({ x: (p.x - minX) * UNIT + RADIUS + 8, y: (p.y - minY) * UNIT + RADIUS + 8 });
  const center = at({ x: 0, y: 0 });
  const def = RUNES[focus];
  const status = runeStatus(state, focus);
  return (
    <div className="runes">
      <div className="rune-scroll">
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="rune-tree" role="list">
          {RUNE_KEYS.map((k) => {
            const p = at(pos[k]);
            const reqs = RUNES[k].requires;
            return reqs.length === 0 ? (
              <line key={`c-${k}`} x1={center.x} y1={center.y} x2={p.x} y2={p.y} className={(state.runes[k] ?? 0) > 0 ? "edge on" : "edge"} />
            ) : (
              reqs.map((r) => {
                const a = at(pos[r]);
                return <line key={`${r}-${k}`} x1={a.x} y1={a.y} x2={p.x} y2={p.y} className={(state.runes[r] ?? 0) > 0 ? "edge on" : "edge"} />;
              })
            );
          })}
          <circle cx={center.x} cy={center.y} r={10} className="rune-core" />
          {(Object.keys(BRANCHES) as Branch[]).map((b) => {
            const angle = (BRANCHES[b].angle * Math.PI) / 180;
            const p = at({ x: Math.cos(angle) * 0.55, y: -Math.sin(angle) * 0.55 });
            return (
              <text key={b} x={p.x} y={p.y} className="branch-label" fill={BRANCH_COLOR[b]}>
                {BRANCHES[b].name}
              </text>
            );
          })}
          {RUNE_KEYS.map((k) => {
            const s = runeStatus(state, k);
            const p = at(pos[k]);
            const cls = s.maxed ? "maxed" : s.locked ? "locked" : s.cost <= state.gold ? "ready" : s.owned > 0 ? "owned" : "";
            return (
              <g
                key={k}
                role="listitem"
                className={`rune ${cls} ${focus === k ? "focus" : ""}`}
                transform={`translate(${p.x} ${p.y})`}
                onClick={() => setFocus(k)}
                onDoubleClick={() => engine.act((st) => buyRune(st, k))}
                style={{ "--branch": BRANCH_COLOR[RUNES[k].branch] } as CSSProperties}
              >
                <circle r={RADIUS} />
                {RUNES[k].name.split(" ").map((word, i, words) => (
                  <text key={word + i} y={(i - words.length / 2) * 9 + 2}>
                    {word}
                  </text>
                ))}
                <text y={14} className="small">
                  {s.owned}/{RUNES[k].max}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <aside className="rune-side">
        <h3>{def.name}</h3>
        <p className="muted">{BRANCHES[def.branch].name} branch</p>
        <p>{describe(def.effect, def.per)} per level</p>
        <p className="muted">
          Level {status.owned}/{def.max}
          {status.owned > 0 && ` · now ${describe(def.effect, def.per * status.owned)}`}
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
        <button type="button" onClick={() => confirm("Reset every rune and refund all the gold spent?") && engine.act(resetRunes, (g) => `Refunded ${compact(g)} gold`)}>
          Reset tree
        </button>
        <p className="muted">Double-click a rune to buy it. Resetting refunds everything.</p>
      </aside>
    </div>
  );
}
