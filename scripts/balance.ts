import { writeFileSync } from "node:fs";
import { buyRune, equip, learnSkill, recruit, runeStatus, setParty, skillPoints, unequip } from "../src/game/actions";
import { step } from "../src/game/combat";
import { SYNTH_INPUTS, alchemize, featureUnlocked, socket, synthesize } from "../src/game/cube";
import { CLASSES, CLASS_KEYS } from "../src/game/data/classes";
import { MAX_GRADE } from "../src/game/data/grades";
import { BASES } from "../src/game/data/items";
import { GEM_KEYS, PARTS, type MaterialKey } from "../src/game/data/materials";
import { RUNE_KEYS } from "../src/game/data/runes";
import { SKILLS, classSkills } from "../src/game/data/skills";
import { STAGES_PER_ACT, STAGE_COUNT, stageInfo } from "../src/game/data/world";
import { newGame } from "../src/game/game";
import { openChest } from "../src/game/loot";
import { serialize } from "../src/game/save";
import type { ClassKey, ItemId } from "../src/game/schema";
import { heroStats, inventoryCap, modifiers, partySize, power } from "../src/game/stats";
import { STEP_MS } from "../src/game/tuning";
import type { GameEvent, GameState } from "../src/game/types";

const [hoursArg, seedArg, flag, savePath] = process.argv.slice(2);
const HOURS = Number(hoursArg ?? 24);
const SEED = Number(seedArg ?? 7);
const BOT_EVERY_MS = 15_000;

const score = (state: GameState, cls: ClassKey) => power(heroStats(state, cls, modifiers(state)), cls);

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

function fillSockets(state: GameState): void {
  const parts = Object.keys(PARTS) as MaterialKey[];
  for (const cls of state.party) {
    for (const [slot, id] of Object.entries(state.heroes[cls].equipment)) {
      const item = state.items[id];
      if (!item) continue;
      const gems = [...GEM_KEYS].reverse().filter((k) => (state.materials[k] ?? 0) > 0);
      const plan: [kind: "decoration" | "engraving" | "inscription", keys: MaterialKey[]][] = [
        ["decoration", gems],
        ["engraving", parts.filter((k) => (state.materials[k] ?? 0) > 0)],
        ["inscription", (["scroll3", "scroll2", "scroll1"] as MaterialKey[]).filter((k) => (state.materials[k] ?? 0) > 0)],
      ];
      const work = plan.filter(([kind, keys]) => featureUnlocked(state, kind) && keys.length > 0 && item.sockets[kind].includes(null));
      if (work.length === 0 || !unequip(state, cls, slot as never).ok) continue;
      for (const [kind] of work) {
        item.sockets[kind].forEach((v, i) => {
          if (v !== null) return;
          const key = plan.find(([k]) => k === kind)![1].find((k) => (state.materials[k] ?? 0) > 0);
          if (key) socket(state, item.id, kind, i, key);
        });
      }
      equip(state, cls, item.id);
    }
  }
}

function mergeAndSell(state: GameState): void {
  for (let g = 0; g < MAX_GRADE; g++) {
    const pool = state.inventory.filter((id) => state.items[id]?.grade === g && !state.items[id]?.locked);
    while (pool.length >= SYNTH_INPUTS) if (!synthesize(state, pool.splice(0, SYNTH_INPUTS)).ok) break;
  }
  const cap = inventoryCap(modifiers(state));
  if (state.inventory.length > cap - 6) {
    const junk = [...state.inventory].sort((a, b) => state.items[a]!.grade - state.items[b]!.grade || state.items[a]!.level - state.items[b]!.level).slice(0, 10) as ItemId[];
    alchemize(state, junk);
  }
}

function spendSkills(state: GameState): void {
  for (const cls of CLASS_KEYS) {
    if (!state.heroes[cls].unlocked) continue;
    const keys = classSkills(cls);
    const order = [...keys.filter((k) => SKILLS[k].kind === "active"), ...keys.filter((k) => SKILLS[k].kind === "passive")].sort((a, b) => SKILLS[a].tier - SKILLS[b].tier);
    let guard = 200;
    while (skillPoints(state, cls).free > 0 && guard-- > 0) {
      const key = order.find((k) => learnSkill(state, cls, k).ok);
      if (!key) break;
    }
  }
}

function spendGold(state: GameState): void {
  for (const cls of CLASS_KEYS) {
    if (!state.heroes[cls].unlocked && state.gold >= CLASSES[cls].unlockCost * 2) recruit(state, cls);
  }
  const size = partySize(modifiers(state));
  if (state.party.length < size) {
    const extra = CLASS_KEYS.filter((c) => state.heroes[c].unlocked && !state.party.includes(c)).sort((a, b) => state.heroes[b].level - state.heroes[a].level);
    if (extra.length) setParty(state, [...state.party, ...extra].slice(0, size));
  }
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
    fillSockets(state);
    spendSkills(state);
    spendGold(state);
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
const at = stageInfo(state.unlockedStage);
console.log(`\nfinal stage ${at.difficulty}:${at.label} (L${at.level}), gold ${Math.round(state.gold)}, cube ${state.cube.level}`);
for (const cls of state.party) {
  const s = heroStats(state, cls, modifiers(state));
  const gear = Object.values(state.heroes[cls].equipment).map((id) => `${state.items[id]!.grade}@${state.items[id]!.level}`);
  console.log(`${cls.padEnd(7)} L${state.heroes[cls].level} life ${Math.round(s.maxLife)} atk ${Math.round(s.attack)} gear [${gear.join(" ")}]`);
}
console.log(`recruited ${CLASS_KEYS.filter((c) => state.heroes[c].unlocked).join(", ")}; runes owned ${Object.keys(state.runes).length}/${RUNE_KEYS.length}`);

if (flag === "--save" && savePath) {
  writeFileSync(savePath, serialize(state, Date.now()));
  console.log(`save written to ${savePath}`);
}
