import { alchemize, buyRune, equip, runeStatus, synthesize, SYNTH_INPUTS } from "../src/game/actions";
import { step } from "../src/game/combat";
import { BASES } from "../src/game/data/items";
import { MAX_GRADE } from "../src/game/data/grades";
import { STAGES_PER_ACT, STAGE_COUNT, stageInfo } from "../src/game/data/world";
import { writeFileSync } from "node:fs";
import { newGame } from "../src/game/game";
import { serialize } from "../src/game/save";
import { openChest } from "../src/game/loot";
import { RUNE_KEYS, type ClassKey, type ItemId } from "../src/game/schema";
import { dps, heroStats, inventoryCap, modifiers } from "../src/game/stats";
import { STEP_MS } from "../src/game/tuning";
import type { GameEvent, GameState } from "../src/game/types";

const [hoursArg, seedArg, flag, savePath] = process.argv.slice(2);
const HOURS = Number(hoursArg ?? 24);
const SEED = Number(seedArg ?? 7);
const BOT_EVERY_MS = 15_000;

function score(state: GameState, cls: ClassKey): number {
  const s = heroStats(state, cls, modifiers(state));
  return Math.sqrt(dps(s) * s.maxHp);
}

function gearUp(state: GameState): void {
  for (const cls of state.party) {
    for (const id of [...state.inventory]) {
      const item = state.items[id];
      if (!item) continue;
      const base = BASES[item.base];
      if ((base.cls && base.cls !== cls) || state.heroes[cls].level < item.level) continue;
      const before = score(state, cls);
      const previous = state.heroes[cls].equipment[base.slot];
      if (!equip(state, cls, id).ok) continue;
      if (score(state, cls) <= before && previous !== undefined) equip(state, cls, previous);
    }
  }
}

function mergeAndSell(state: GameState): void {
  for (let g = 0; g < MAX_GRADE; g++) {
    const pool = state.inventory.filter((id) => state.items[id]?.grade === g);
    while (pool.length >= SYNTH_INPUTS) {
      if (!synthesize(state, pool.splice(0, SYNTH_INPUTS)).ok) break;
    }
  }
  const cap = inventoryCap(modifiers(state));
  if (state.inventory.length > cap - 4) {
    const junk = [...state.inventory]
      .sort((a, b) => (state.items[a]!.grade - state.items[b]!.grade) || (state.items[a]!.level - state.items[b]!.level))
      .slice(0, 8) as ItemId[];
    alchemize(state, junk);
  }
}

function spend(state: GameState): void {
  for (;;) {
    const options = RUNE_KEYS.map((key) => ({ key, ...runeStatus(state, key) }))
      .filter((r) => !r.locked && !r.maxed && r.cost <= state.gold)
      .sort((a, b) => a.cost - b.cost);
    const choice = options[0];
    if (!choice || !buyRune(state, choice.key).ok) return;
  }
}

const state = newGame(SEED, 0);
const events: GameEvent[] = [];
const milestones = new Map<number, number>();
let nextBot = 0;
let defeats = 0;
const totalSteps = (HOURS * 3_600_000) / STEP_MS;

for (let i = 0; i < totalSteps; i++) {
  step(state, events);
  for (const e of events) if (e.type === "defeated") defeats++;
  events.length = 0;
  if (state.time >= nextBot) {
    nextBot = state.time + BOT_EVERY_MS;
    while (openChest(state, events).ok) {}
    events.length = 0;
    mergeAndSell(state);
    gearUp(state);
    spend(state);
  }
  if (!milestones.has(state.unlockedStage)) milestones.set(state.unlockedStage, state.time);
}

const fmt = (ms: number) => `${(ms / 3_600_000).toFixed(2)}h`;
console.log(`seed ${SEED}, ${HOURS}h simulated, ${defeats} defeats\n`);
console.log("stage  level  reached");
for (let s = STAGES_PER_ACT - 1; s < STAGE_COUNT; s += STAGES_PER_ACT) {
  const t = milestones.get(s + 1 < STAGE_COUNT ? s + 1 : s);
  const info = stageInfo(s);
  console.log(`${String(info.difficulty)}:${info.label.padEnd(5)} L${String(info.level).padEnd(4)} ${t === undefined ? "-" : fmt(t)}`);
}
console.log(`\nfinal stage ${stageInfo(state.unlockedStage).difficulty}:${stageInfo(state.unlockedStage).label} (L${stageInfo(state.unlockedStage).level}), gold ${Math.round(state.gold)}`);
for (const cls of state.party) {
  const s = heroStats(state, cls, modifiers(state));
  const gear = Object.values(state.heroes[cls].equipment).map((id) => `${state.items[id]!.grade}@${state.items[id]!.level}`);
  console.log(`${cls.padEnd(7)} L${state.heroes[cls].level} dps ${Math.round(dps(s))} hp ${Math.round(s.maxHp)} gear [${gear.join(" ")}]`);
}
console.log(`runes ${JSON.stringify(state.runes)}`);
console.log(`chests waiting ${state.chests.length}, inventory ${state.inventory.length}`);

if (flag === "--save" && savePath) {
  writeFileSync(savePath, serialize(state, Date.now()));
  console.log(`save written to ${savePath}`);
}
