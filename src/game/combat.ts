import { CLASSES } from "./data/classes";
import { ACTS, MONSTERS, STAGE_COUNT, stageInfo } from "./data/world";
import { openChest } from "./loot";
import { pick, rand } from "./rng";
import { CLASS_KEYS, type ChestKind, type ClassKey, type MonsterKey, type Save } from "./schema";
import { heroStats, modifiers, type HeroStats, type Modifiers } from "./stats";
import {
  ARMOR_CAP,
  ARMOR_K,
  BOSS_MULT,
  CHEST_RULES,
  CLEARED_SECONDS,
  DEFEATED_SECONDS,
  GOLD_GROWTH,
  KILL_BASE,
  MAX_LEVEL,
  MONSTER_BASE,
  MONSTER_GROWTH,
  REVIVE_SECONDS,
  STEP_MS,
  WALK_REGEN_PER_S,
  WALK_SECONDS,
  XP_GROWTH,
  AUTO_OPEN_MS,
  levelPenalty,
  xpToNext,
} from "./tuning";
import type { Battle, BossRank, GameEvent, GameState, HeroUnit, MonsterUnit } from "./types";

export const heroUnitId = (cls: ClassKey) => CLASS_KEYS.indexOf(cls) + 1;

export function newBattle(state: Save, stage: number, nextId: number): Battle {
  const info = stageInfo(stage);
  const mods = modifiers(state);
  const waves = info.isActBoss ? 3 : Math.max(2, 4 + Math.floor(info.num / 2) - mods.fewerWaves);
  return {
    stage,
    wave: 0,
    waves,
    phase: { kind: "advancing", remaining: WALK_SECONDS },
    heroes: state.party.map((cls) => ({
      id: heroUnitId(cls),
      cls,
      hp: heroStats(state, cls, mods).maxHp,
      cooldown: rand(state) * 0.5,
      attacks: 0,
      reviveIn: 0,
    })),
    monsters: [],
    nextId,
  };
}

export function startStage(state: GameState, stage: number): void {
  state.stage = stage;
  state.battle = newBattle(state, stage, state.battle.nextId);
}

function spawn(state: Save, battle: Battle, kind: MonsterKey, rank: BossRank, level: number): MonsterUnit {
  const def = MONSTERS[kind];
  const mult = rank === "none" ? { hp: 1, dmg: 1 } : BOSS_MULT[rank];
  const scale = Math.pow(MONSTER_GROWTH, level - 1);
  const maxHp = MONSTER_BASE.hp * def.hp * mult.hp * scale;
  return {
    id: battle.nextId++,
    kind,
    rank,
    level,
    hp: maxHp,
    maxHp,
    dmg: MONSTER_BASE.dmg * def.dmg * mult.dmg * scale,
    cooldown: def.interval * (0.5 + rand(state) * 0.5),
  };
}

function spawnWave(state: Save, battle: Battle): void {
  const info = stageInfo(battle.stage);
  const act = ACTS[info.act]!;
  const last = battle.wave === battle.waves - 1;
  const monsters: MonsterUnit[] = [];
  if (info.isActBoss && last) {
    monsters.push(spawn(state, battle, act.actBoss, "act", info.level));
  } else {
    const count = Math.min(6, 2 + Math.floor((info.num + 1) / 4) + info.difficulty);
    if (last) monsters.push(spawn(state, battle, act.stageBoss, "stage", info.level));
    while (monsters.length < count) monsters.push(spawn(state, battle, pick(state, act.pool), "none", info.level));
  }
  battle.monsters = monsters;
}

function mitigate(dmg: number, armor: number): number {
  return dmg * (1 - Math.min(ARMOR_CAP, armor / (armor + ARMOR_K * dmg)));
}

export function grantXp(state: Save, cls: ClassKey, amount: number, events: GameEvent[]): void {
  const hero = state.heroes[cls];
  if (hero.level >= MAX_LEVEL) return;
  hero.xp += amount;
  while (hero.level < MAX_LEVEL && hero.xp >= xpToNext(hero.level)) {
    hero.xp -= xpToNext(hero.level);
    hero.level++;
    events.push({ type: "levelUp", cls, level: hero.level });
  }
  if (hero.level >= MAX_LEVEL) hero.xp = 0;
}

function addChest(state: Save, kind: ChestKind, level: number, events: GameEvent[]): void {
  if (state.chests.filter((c) => c.kind === kind).length >= CHEST_RULES[kind].cap) return;
  state.chests.push({ kind, level });
  events.push({ type: "chest", kind });
}

function rollChest(state: Save, monster: MonsterUnit, mods: Modifiers, events: GameEvent[]): void {
  const kind: ChestKind = monster.rank === "act" ? "act" : monster.rank === "stage" ? "boss" : "common";
  if (state.time < state.chestReadyAt[kind]) return;
  const bonus = kind === "boss" ? mods.bossChest : kind === "common" ? mods.commonChest : 0;
  if (rand(state) >= CHEST_RULES[kind].chance * (1 + bonus)) return;
  const interval = kind === "common" ? Math.max(10_000, CHEST_RULES.common.intervalMs - mods.chestInterval) : CHEST_RULES[kind].intervalMs;
  state.chestReadyAt[kind] = state.time + interval;
  addChest(state, kind, monster.level, events);
}

function onKill(state: GameState, monster: MonsterUnit, mods: Modifiers, events: GameEvent[]): void {
  const mult = monster.rank === "none" ? { gold: 1, xp: 1 } : BOSS_MULT[monster.rank];
  const gold = KILL_BASE.gold * Math.pow(GOLD_GROWTH, monster.level - 1) * mult.gold * (1 + mods.gold);
  const xp = KILL_BASE.xp * Math.pow(XP_GROWTH, monster.level - 1) * mult.xp * (1 + mods.xp);
  state.gold += gold;
  state.rates.windowGold += gold;
  state.rates.windowXp += xp;
  for (const unit of state.battle.heroes) {
    if (unit.reviveIn > 0) continue;
    grantXp(state, unit.cls, xp * levelPenalty(state.heroes[unit.cls].level, monster.level), events);
  }
  state.kills[monster.kind] = (state.kills[monster.kind] ?? 0) + 1;
  events.push({ type: "kill", id: monster.id, gold });
  rollChest(state, monster, mods, events);
}

function heroAttack(state: GameState, unit: HeroUnit, stats: HeroStats, events: GameEvent[]): void {
  const battle = state.battle;
  const target = battle.monsters[0];
  if (!target) return;
  const def = CLASSES[unit.cls];
  unit.attacks++;
  const skill = unit.attacks % def.skill.every === 0;
  const crit = rand(state) < stats.critChance;
  const base = stats.atk * (crit ? 1 + stats.critDamage : 1) * (skill ? def.skill.mult : 1);
  battle.monsters.forEach((m, i) => {
    const share = i === 0 || (skill && def.skill.aoe) ? 1 : def.splash;
    if (share <= 0) return;
    const amount = base * share;
    m.hp -= amount;
    events.push({ type: "attack", from: unit.id, to: m.id, amount, crit, skill });
  });
}

function monsterAttack(state: GameState, monster: MonsterUnit, stats: Partial<Record<ClassKey, HeroStats>>, events: GameEvent[]): void {
  const target = state.battle.heroes.find((h) => h.reviveIn <= 0);
  if (!target) return;
  const amount = mitigate(monster.dmg, stats[target.cls]?.armor ?? 0);
  target.hp -= amount;
  events.push({ type: "hurt", from: monster.id, to: target.id, amount });
  if (target.hp <= 0) {
    target.hp = 0;
    target.reviveIn = REVIVE_SECONDS;
    events.push({ type: "heroDown", id: target.id });
  }
}

function fight(state: GameState, stats: Partial<Record<ClassKey, HeroStats>>, mods: Modifiers, dt: number, events: GameEvent[]): void {
  const battle = state.battle;
  for (const unit of battle.heroes) {
    const s = stats[unit.cls];
    if (!s || unit.reviveIn > 0) continue;
    unit.hp = Math.min(s.maxHp, unit.hp + s.regen * dt);
    unit.cooldown -= dt;
    while (unit.cooldown <= 0 && battle.monsters.length > 0) {
      unit.cooldown += s.interval;
      heroAttack(state, unit, s, events);
      const dead = battle.monsters.filter((m) => m.hp <= 0);
      battle.monsters = battle.monsters.filter((m) => m.hp > 0);
      for (const m of dead) onKill(state, m, mods, events);
    }
    if (battle.monsters.length === 0) unit.cooldown = Math.max(unit.cooldown, 0);
  }
  for (const monster of battle.monsters) {
    monster.cooldown -= dt;
    if (monster.cooldown > 0) continue;
    monster.cooldown += MONSTERS[monster.kind].interval;
    monsterAttack(state, monster, stats, events);
  }
  if (battle.monsters.length === 0) {
    battle.wave++;
    if (battle.wave >= battle.waves) {
      state.unlockedStage = Math.max(state.unlockedStage, Math.min(battle.stage + 1, STAGE_COUNT - 1));
      battle.phase = { kind: "cleared", remaining: CLEARED_SECONDS };
      events.push({ type: "stageCleared", stage: battle.stage });
    } else {
      battle.phase = { kind: "advancing", remaining: WALK_SECONDS };
    }
  } else if (battle.heroes.every((h) => h.reviveIn > 0)) {
    battle.phase = { kind: "defeated", remaining: DEFEATED_SECONDS };
    events.push({ type: "defeated", stage: battle.stage });
  }
}

function tickRates(state: Save): void {
  const r = state.rates;
  const span = state.time - r.windowStart;
  if (span < 60_000) return;
  const gold = (r.windowGold * 1000) / span;
  const xp = (r.windowXp * 1000) / span;
  r.gold = r.gold === 0 ? gold : r.gold * 0.6 + gold * 0.4;
  r.xp = r.xp === 0 ? xp : r.xp * 0.6 + xp * 0.4;
  r.windowGold = 0;
  r.windowXp = 0;
  r.windowStart = state.time;
}

export function step(state: GameState, events: GameEvent[]): void {
  state.time += STEP_MS;
  const dt = STEP_MS / 1000;
  const battle = state.battle;
  const mods = modifiers(state);
  const stats: Partial<Record<ClassKey, HeroStats>> = {};
  for (const unit of battle.heroes) stats[unit.cls] = heroStats(state, unit.cls, mods);

  for (const unit of battle.heroes) {
    if (unit.reviveIn <= 0) continue;
    unit.reviveIn -= dt;
    if (unit.reviveIn <= 0) {
      unit.reviveIn = 0;
      unit.hp = (stats[unit.cls]?.maxHp ?? 1) * 0.5;
    }
  }

  const phase = battle.phase;
  switch (phase.kind) {
    case "advancing":
      for (const unit of battle.heroes) {
        const s = stats[unit.cls];
        if (s && unit.reviveIn <= 0) unit.hp = Math.min(s.maxHp, unit.hp + s.maxHp * WALK_REGEN_PER_S * dt);
      }
      phase.remaining -= dt;
      if (phase.remaining <= 0) {
        spawnWave(state, battle);
        battle.phase = { kind: "fighting" };
        events.push({ type: "waveStart", wave: battle.wave });
      }
      break;
    case "fighting":
      fight(state, stats, mods, dt, events);
      break;
    case "cleared":
      phase.remaining -= dt;
      if (phase.remaining <= 0) {
        const next = state.autoAdvance && battle.stage + 1 <= state.unlockedStage ? battle.stage + 1 : battle.stage;
        startStage(state, next);
      }
      break;
    case "defeated":
      phase.remaining -= dt;
      if (phase.remaining <= 0) startStage(state, state.autoAdvance ? Math.max(0, battle.stage - 1) : battle.stage);
      break;
  }

  if (mods.autoOpen > 0 && state.time >= state.autoOpenAt && state.chests.length > 0) {
    state.autoOpenAt = state.time + AUTO_OPEN_MS;
    openChest(state, events);
  }
  tickRates(state);
}
