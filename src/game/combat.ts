import { CLASSES } from "./data/classes";
import { gradeCap } from "./data/grades";
import type { MaterialKey } from "./data/materials";
import { SKILLS, type ActiveDef, type SkillKey } from "./data/skills";
import { CHILL_SLOW, SHOCK_BONUS, STATUS, addStats, type DamageType, type StatBlock, type StatusKind } from "./data/stats";
import {
  MONSTERS,
  PLAGUE_DRAIN_PER_S,
  PLAGUE_MAX_CONTAMINATION,
  PLAGUE_MAX_INTENSITY,
  PLAGUE_REFILL_PER_S,
  STAGE_COUNT,
  areaInfo,
  type AreaInfo,
  type Location,
} from "./data/world";
import { dropPart, openChest, takeMaterial } from "./loot";
import { pick, rand } from "./rng";
import { CLASS_KEYS, type ChestKind, type ClassKey, type MonsterKey, type Save } from "./schema";
import { heroStats, modifiers, type HeroStats, type Modifiers } from "./stats";
import {
  ARMOR_K,
  AUTO_OPEN_MS,
  BLOCK_FACTOR,
  BOSS_MULT,
  CHAIN_LIGHTNING_CHANCE,
  CHEST_RULES,
  CLEARED_SECONDS,
  DEFEATED_SECONDS,
  GOLD_GROWTH,
  KILL_BASE,
  LIFE_CAP_HIT,
  MAX_LEVEL,
  MONSTER_BASE,
  MONSTER_GROWTH,
  MONSTER_STATUS_CHANCE,
  PART_DROP_CHANCE,
  REVIVE_SECONDS,
  STEP_MS,
  WALK_REGEN_PER_S,
  WALK_SECONDS,
  XP_GROWTH,
  levelPenalty,
  xpToNext,
} from "./tuning";
import type { Battle, BossRank, GameEvent, GameState, HeroUnit, MonsterUnit, Status } from "./types";

export const heroUnitId = (cls: ClassKey) => CLASS_KEYS.indexOf(cls) + 1;

interface Ctx {
  state: GameState;
  battle: Battle;
  area: AreaInfo;
  mods: Modifiers;
  stats: Map<number, HeroStats>;
  events: GameEvent[];
  dt: number;
}

function newHeroUnit(state: Save, cls: ClassKey, mods: Modifiers, penalty: number): HeroUnit {
  const stats = heroStats(state, cls, mods, {}, penalty);
  const skillReady: HeroUnit["skillReady"] = {};
  for (const key of state.heroes[cls].slotted) {
    const def = SKILLS[key];
    if (def.kind === "active" && "cooldown" in def.trigger) skillReady[key] = 2;
  }
  return { id: heroUnitId(cls), cls, hp: stats.maxLife, cooldown: rand(state) * 0.5, attacks: 0, reviveIn: 0, skillReady, statuses: [], taunt: 0, phoenix: stats.flags.has("phoenix") };
}

export function newBattle(state: Save, location: Location, nextId: number): Battle {
  const area = areaInfo(location);
  const mods = modifiers(state);
  return {
    location,
    wave: 0,
    waves: area.isActBoss ? area.waves : Math.max(2, area.waves - mods.fewerWaves),
    phase: { kind: "advancing", remaining: WALK_SECONDS },
    heroes: state.party.map((cls) => newHeroUnit(state, cls, mods, area.resPenalty)),
    monsters: [],
    buffs: [],
    traps: [],
    nextId,
  };
}

export function startBattle(state: GameState, location: Location): void {
  state.location = location;
  if (location.kind === "stage") state.lastStage = location.index;
  state.battle = newBattle(state, location, state.battle.nextId);
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

const has = (unit: { statuses: Status[] }, kind: StatusKind) => unit.statuses.some((s) => s.kind === kind);
const disabled = (unit: { statuses: Status[] }) => has(unit, "stun") || has(unit, "freeze");

function inflict(ctx: Ctx, unit: { id: number; statuses: Status[] }, kind: StatusKind, hit: number): void {
  const dps = STATUS[kind].dot * hit;
  const existing = unit.statuses.find((s) => s.kind === kind);
  if (existing) {
    existing.remaining = Math.max(existing.remaining, STATUS[kind].seconds);
    existing.dps = Math.max(existing.dps, dps);
    return;
  }
  unit.statuses.push({ kind, remaining: STATUS[kind].seconds, dps, acc: 0, tick: 0 });
  ctx.events.push({ type: "status", to: unit.id, status: kind });
}

function tickStatuses(ctx: Ctx, unit: { id: number; statuses: Status[]; hp: number }): void {
  for (const s of unit.statuses) {
    s.remaining -= ctx.dt;
    if (s.dps <= 0) continue;
    const dmg = s.dps * ctx.dt;
    unit.hp -= dmg;
    s.acc += dmg;
    s.tick += ctx.dt;
    if (s.tick >= 1) {
      ctx.events.push({ type: "dot", to: unit.id, amount: s.acc, status: s.kind });
      s.acc = 0;
      s.tick = 0;
    }
  }
  unit.statuses = unit.statuses.filter((s) => s.remaining > 0);
}

function buffStats(battle: Battle, unitId: number): StatBlock {
  const out: StatBlock = {};
  for (const b of battle.buffs) if (b.target === "party" || b.target === unitId) addStats(out, b.stats);
  return out;
}

function spawn(state: Save, battle: Battle, area: AreaInfo, kind: MonsterKey, rank: BossRank): MonsterUnit {
  const def = MONSTERS[kind];
  const mult = rank === "none" ? { hp: 1, dmg: 1 } : BOSS_MULT[rank];
  const scale = Math.pow(MONSTER_GROWTH, area.level - 1) * area.power;
  const maxHp = MONSTER_BASE.hp * def.hp * mult.hp * scale;
  return {
    id: battle.nextId++,
    kind,
    rank,
    level: area.level,
    hp: maxHp,
    maxHp,
    dmg: MONSTER_BASE.dmg * def.dmg * mult.dmg * scale,
    cooldown: def.interval * (0.5 + rand(state) * 0.5),
    attacks: 0,
    statuses: [],
  };
}

function spawnWave(state: Save, battle: Battle, area: AreaInfo): void {
  const last = battle.wave === battle.waves - 1;
  const monsters: MonsterUnit[] = [];
  if (area.isActBoss && last) {
    monsters.push(spawn(state, battle, area, area.actBoss, "act"));
  } else {
    const num = area.location.kind === "stage" ? area.location.index % 10 : 6;
    const count = Math.min(6, 2 + Math.floor((num + 1) / 4) + area.difficulty);
    if (last) monsters.push(spawn(state, battle, area, area.stageBoss, "stage"));
    while (monsters.length < count) monsters.push(spawn(state, battle, area, pick(state, area.pool), "none"));
  }
  battle.monsters = monsters;
}

function damageMonster(
  ctx: Ctx,
  attacker: HeroUnit,
  m: MonsterUnit,
  raw: number,
  type: DamageType,
  opts: { skill: SkillKey | null; splash: boolean; forceCrit?: boolean; status?: StatusKind | null; chance?: number },
): void {
  const s = ctx.stats.get(attacker.id);
  if (!s || m.hp <= 0) return;
  const crit = opts.forceCrit === true || rand(ctx.state) < s.critChance;
  const amount = raw * s.dmg[type] * (crit ? s.critMult : 1) * (m.rank !== "none" ? 1 + s.bossDmg : 1) * (has(m, "shock") ? 1 + SHOCK_BONUS : 1);
  m.hp -= amount;
  if (s.leech > 0 && attacker.reviveIn <= 0) attacker.hp = Math.min(s.maxLife, attacker.hp + amount * s.leech);
  ctx.events.push({ type: "attack", from: attacker.id, to: m.id, amount, outcome: crit ? "crit" : "hit", damage: type, skill: opts.skill, splash: opts.splash });
  const status = opts.status ?? null;
  if (status && rand(ctx.state) < (opts.chance ?? 0) + s.statusChance) inflict(ctx, m, status, amount);
  if (s.flags.has("frostbite")) inflict(ctx, m, "chill", amount);
}

function reap(ctx: Ctx): void {
  const dead = ctx.battle.monsters.filter((m) => m.hp <= 0);
  if (dead.length === 0) return;
  ctx.battle.monsters = ctx.battle.monsters.filter((m) => m.hp > 0);
  for (const m of dead) onKill(ctx, m);
}

function basicAttack(ctx: Ctx, unit: HeroUnit): void {
  const target = ctx.battle.monsters[0];
  const s = ctx.stats.get(unit.id);
  if (!target || !s) return;
  const def = CLASSES[unit.cls];
  damageMonster(ctx, unit, target, s.attack, def.damage, { skill: null, splash: false, status: def.status, chance: 0 });
  if (def.splash > 0) {
    for (const m of ctx.battle.monsters.slice(1)) damageMonster(ctx, unit, m, s.attack * def.splash * (1 + s.area), def.damage, { skill: null, splash: true });
  }
  if (s.flags.has("chainLightning") && rand(ctx.state) < CHAIN_LIGHTNING_CHANCE) {
    for (const m of ctx.battle.monsters) damageMonster(ctx, unit, m, s.attack * 0.5, "lightning", { skill: null, splash: true, status: "shock", chance: 0.3 });
  }
}

function skillUsable(ctx: Ctx, def: ActiveDef): boolean {
  if (def.effects.some((e) => e.kind === "revive")) return ctx.battle.heroes.some((h) => h.reviveIn > 0);
  if (def.effects.every((e) => e.kind === "heal")) {
    return ctx.battle.heroes.some((h) => h.reviveIn <= 0 && h.hp < (ctx.stats.get(h.id)?.maxLife ?? 0) * 0.8);
  }
  return true;
}

function chooseSkill(ctx: Ctx, unit: HeroUnit): SkillKey | null {
  const hero = ctx.state.heroes[unit.cls];
  for (const key of hero.slotted) {
    const def = SKILLS[key];
    if (def.kind !== "active" || !hero.skills[key]) continue;
    if ("cooldown" in def.trigger) {
      if ((unit.skillReady[key] ?? 0) <= 0 && skillUsable(ctx, def)) return key;
    } else if (unit.attacks % def.trigger.every === 0) {
      return key;
    }
  }
  return null;
}

function targets(ctx: Ctx, kind: "front" | "all" | "random3"): MonsterUnit[] {
  const alive = ctx.battle.monsters.filter((m) => m.hp > 0);
  if (kind === "front") return alive.slice(0, 1);
  if (kind === "all") return alive;
  const out: MonsterUnit[] = [];
  for (let i = 0; i < 3 && alive.length > 0; i++) out.push(alive[Math.floor(rand(ctx.state) * alive.length)]!);
  return out;
}

function castSkill(ctx: Ctx, unit: HeroUnit, key: SkillKey): void {
  const def = SKILLS[key] as ActiveDef;
  const level = ctx.state.heroes[unit.cls].skills[key] ?? 1;
  const s = ctx.stats.get(unit.id)!;
  const classType = CLASSES[unit.cls].damage;
  for (const effect of def.effects) {
    switch (effect.kind) {
      case "hit": {
        const area = effect.target === "front" ? 1 : 1 + s.area * 0.5;
        const raw = s.attack * (effect.mult + effect.per * (level - 1)) * area;
        targets(ctx, effect.target).forEach((m, i) =>
          damageMonster(ctx, unit, m, raw, effect.type ?? classType, { skill: key, splash: i > 0, forceCrit: effect.crit, status: effect.status, chance: effect.chance }),
        );
        break;
      }
      case "trap": {
        const area = effect.target === "front" ? 1 : 1 + s.area * 0.5;
        ctx.battle.traps.push({
          from: unit.id,
          remaining: effect.delay,
          amount: s.attack * (effect.mult + effect.per * (level - 1)) * area,
          type: effect.type ?? classType,
          target: effect.target,
          status: effect.status ?? null,
          chance: effect.chance ?? 0,
        });
        ctx.events.push({ type: "trap", from: unit.id, skill: key });
        break;
      }
      case "heal": {
        const alive = ctx.battle.heroes.filter((h) => h.reviveIn <= 0);
        const ratio = (h: HeroUnit) => h.hp / (ctx.stats.get(h.id)?.maxLife ?? 1);
        const chosen = effect.target === "party" ? alive : alive.sort((a, b) => ratio(a) - ratio(b)).slice(0, 1);
        for (const h of chosen) {
          const max = ctx.stats.get(h.id)?.maxLife ?? 0;
          const amount = (effect.pct + effect.per * (level - 1)) * max * (1 + s.healPower);
          h.hp = Math.min(max, h.hp + amount);
          ctx.events.push({ type: "heal", from: unit.id, to: h.id, amount });
        }
        break;
      }
      case "buff":
        ctx.battle.buffs.push({ target: effect.target === "self" ? unit.id : "party", stats: { [effect.stat]: effect.amount + effect.per * (level - 1) }, remaining: effect.seconds });
        ctx.events.push({ type: "buff", from: unit.id, skill: key });
        break;
      case "taunt":
        unit.taunt = effect.seconds;
        break;
      case "revive": {
        const fallen = ctx.battle.heroes.find((h) => h.reviveIn > 0);
        if (!fallen) break;
        fallen.reviveIn = 0;
        fallen.statuses = [];
        fallen.hp = (ctx.stats.get(fallen.id)?.maxLife ?? 1) * (effect.pct + effect.per * (level - 1));
        ctx.events.push({ type: "revive", from: unit.id, to: fallen.id });
        break;
      }
    }
  }
  if ("cooldown" in def.trigger) unit.skillReady[key] = def.trigger.cooldown * (1 - s.cooldown);
}

function downHero(ctx: Ctx, unit: HeroUnit): void {
  if (unit.phoenix) {
    unit.phoenix = false;
    unit.hp = (ctx.stats.get(unit.id)?.maxLife ?? 1) * 0.5;
    unit.statuses = [];
    ctx.events.push({ type: "revive", from: unit.id, to: unit.id });
    return;
  }
  unit.hp = 0;
  unit.reviveIn = REVIVE_SECONDS;
  unit.statuses = [];
  unit.taunt = 0;
  ctx.events.push({ type: "heroDown", id: unit.id });
}

function hitHero(ctx: Ctx, m: MonsterUnit, unit: HeroUnit, raw: number, heavy: boolean): void {
  const s = ctx.stats.get(unit.id);
  if (!s) return;
  const def = MONSTERS[m.kind];
  if (rand(ctx.state) < s.dodge) {
    ctx.events.push({ type: "hurt", from: m.id, to: unit.id, amount: 0, outcome: "dodged", damage: def.type, heavy });
    return;
  }
  const blocked = rand(ctx.state) < s.block;
  let amount = raw * (blocked ? BLOCK_FACTOR : 1);
  if (def.type === "physical") amount *= 1 - Math.min(s.armorCap, s.armor / (s.armor + ARMOR_K * amount));
  else amount *= 1 - s.res[def.type];
  amount = Math.max(1, amount * (1 - s.reduction) * (has(unit, "shock") ? 1 + SHOCK_BONUS : 1) - s.absorb);
  if (s.flags.has("lifeCap")) amount = Math.min(amount, s.maxLife * LIFE_CAP_HIT);
  unit.hp -= amount;
  ctx.events.push({ type: "hurt", from: m.id, to: unit.id, amount, outcome: blocked ? "blocked" : "hit", damage: def.type, heavy });
  if (def.status && (heavy || rand(ctx.state) < MONSTER_STATUS_CHANCE)) inflict(ctx, unit, def.status, amount);
  if (unit.hp <= 0) downHero(ctx, unit);
}

function monsterTurn(ctx: Ctx, m: MonsterUnit): void {
  const def = MONSTERS[m.kind];
  if (disabled(m)) return;
  m.cooldown -= ctx.dt * (has(m, "chill") ? 1 - CHILL_SLOW : 1);
  if (m.cooldown > 0) return;
  m.cooldown += def.interval;
  m.attacks++;
  const alive = ctx.battle.heroes.filter((h) => h.reviveIn <= 0);
  if (alive.length === 0) return;
  const aoe = m.rank === "act" && m.attacks % 4 === 0;
  const heavy = m.rank === "stage" && m.attacks % 5 === 0;
  const taunter = alive.find((h) => h.taunt > 0);
  const chosen = aoe ? alive : [taunter ?? alive[0]!];
  for (const h of chosen) hitHero(ctx, m, h, m.dmg * (aoe ? 0.8 : heavy ? 2 : 1), aoe || heavy);
}

function soulKey(area: AreaInfo): MaterialKey {
  return area.plague ? "soulPlague" : (`soul${area.difficulty}` as MaterialKey);
}

function addChest(ctx: Ctx, kind: ChestKind, level: number): void {
  const { state, area } = ctx;
  if (state.chests.filter((c) => c.kind === kind).length >= CHEST_RULES[kind].cap) return;
  state.chests.push({ kind, level, cap: area.plague ? 9 : gradeCap(area.difficulty, area.act), difficulty: area.plague ? 4 : area.difficulty, plague: area.plague });
  ctx.events.push({ type: "chest", kind });
}

function rollChest(ctx: Ctx, m: MonsterUnit): void {
  const { state, area, mods } = ctx;
  if (m.rank === "act") {
    if (area.plague) return addChest(ctx, "act", m.level);
    if (takeMaterial(state, soulKey(area))) return addChest(ctx, "act", m.level);
    ctx.events.push({ type: "notice", text: "Act boss defeated. Bring a Soulstone to claim its chest." });
    return;
  }
  const kind: ChestKind = m.rank === "stage" ? "boss" : "common";
  if (state.time < state.chestReadyAt[kind]) return;
  const bonus = kind === "boss" ? mods.bossChest : mods.commonChest;
  if (rand(state) >= CHEST_RULES[kind].chance * (1 + bonus)) return;
  state.chestReadyAt[kind] = state.time + (kind === "common" ? Math.max(10_000, CHEST_RULES.common.intervalMs - mods.chestInterval) : CHEST_RULES.boss.intervalMs);
  addChest(ctx, kind, m.level);
}

function onKill(ctx: Ctx, m: MonsterUnit): void {
  const { state, mods } = ctx;
  const mult = m.rank === "none" ? { gold: 1, xp: 1 } : BOSS_MULT[m.rank];
  const deployed = ctx.battle.heroes.map((h) => ctx.stats.get(h.id)).filter((s): s is HeroStats => !!s);
  const goldFind = Math.max(mods.goldFind, ...deployed.map((s) => s.goldFind));
  const gold = KILL_BASE.gold * Math.pow(GOLD_GROWTH, m.level - 1) * mult.gold * (1 + goldFind);
  const xp = KILL_BASE.xp * Math.pow(XP_GROWTH, m.level - 1) * mult.xp;
  state.gold += gold;
  state.rates.windowGold += gold;
  const alive = ctx.battle.heroes.filter((h) => h.reviveIn <= 0);
  for (const unit of alive) {
    const granted = xp * (1 + (ctx.stats.get(unit.id)?.xpFind ?? 0)) * levelPenalty(state.heroes[unit.cls].level, m.level);
    state.rates.windowXp += granted / alive.length;
    grantXp(state, unit.cls, granted, ctx.events);
  }
  state.kills[m.kind] = (state.kills[m.kind] ?? 0) + 1;
  ctx.events.push({ type: "kill", id: m.id, gold });
  if (rand(state) < PART_DROP_CHANCE * (1 + mods.materialDrop) * (m.rank === "none" ? 1 : 5)) dropPart(state, MONSTERS[m.kind].part, ctx.events);
  rollChest(ctx, m);
}

function nextLocation(state: GameState, location: Location, won: boolean): Location {
  if (location.kind === "stage") {
    if (won) return state.autoAdvance && location.index + 1 <= state.unlockedStage ? { kind: "stage", index: location.index + 1 } : location;
    return state.autoAdvance ? { kind: "stage", index: Math.max(0, location.index - 1) } : location;
  }
  if (location.boss) return { kind: "plague", intensity: location.intensity, boss: false };
  if (won) {
    const next = location.intensity + 1;
    return state.autoAdvance && next <= Math.min(PLAGUE_MAX_INTENSITY, state.plague.best + 1) ? { kind: "plague", intensity: next, boss: false } : location;
  }
  return state.autoAdvance ? { kind: "plague", intensity: Math.max(1, location.intensity - 1), boss: false } : location;
}

function fight(ctx: Ctx): void {
  const { battle, state } = ctx;
  for (const unit of battle.heroes) {
    const s = ctx.stats.get(unit.id);
    if (!s || unit.reviveIn > 0) continue;
    unit.hp = Math.min(s.maxLife, unit.hp + s.maxLife * s.regenPct * ctx.dt);
    unit.taunt = Math.max(0, unit.taunt - ctx.dt);
    for (const key of Object.keys(unit.skillReady) as SkillKey[]) unit.skillReady[key] = (unit.skillReady[key] ?? 0) - ctx.dt;
    if (disabled(unit)) continue;
    unit.cooldown -= ctx.dt * (has(unit, "chill") ? 1 - CHILL_SLOW : 1);
    while (unit.cooldown <= 0 && battle.monsters.length > 0) {
      unit.cooldown += s.interval;
      unit.attacks++;
      const key = chooseSkill(ctx, unit);
      if (key) castSkill(ctx, unit, key);
      else basicAttack(ctx, unit);
      reap(ctx);
    }
    if (battle.monsters.length === 0) unit.cooldown = Math.max(unit.cooldown, 0);
  }
  for (const trap of battle.traps) {
    trap.remaining -= ctx.dt;
    if (trap.remaining > 0) continue;
    const owner = battle.heroes.find((h) => h.id === trap.from);
    if (!owner) continue;
    targets(ctx, trap.target).forEach((m, i) => damageMonster(ctx, owner, m, trap.amount, trap.type, { skill: null, splash: i > 0, status: trap.status, chance: trap.chance }));
  }
  battle.traps = battle.traps.filter((t) => t.remaining > 0);
  reap(ctx);
  for (const m of battle.monsters) monsterTurn(ctx, m);

  if (battle.monsters.length === 0) {
    battle.wave++;
    if (battle.wave < battle.waves) {
      battle.phase = { kind: "advancing", remaining: walkSeconds(ctx) };
      return;
    }
    const loc = battle.location;
    if (loc.kind === "stage") state.unlockedStage = Math.max(state.unlockedStage, Math.min(loc.index + 1, STAGE_COUNT - 1));
    else if (!loc.boss) state.plague.best = Math.max(state.plague.best, loc.intensity);
    battle.phase = { kind: "cleared", remaining: CLEARED_SECONDS };
    ctx.events.push({ type: "stageCleared", location: loc });
  } else if (battle.heroes.every((h) => h.reviveIn > 0)) {
    battle.phase = { kind: "defeated", remaining: DEFEATED_SECONDS };
    ctx.events.push({ type: "defeated", location: battle.location });
  }
}

function walkSeconds(ctx: Ctx): number {
  const speeds = [...ctx.stats.values()].map((s) => s.moveSpeed);
  const speed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
  return WALK_SECONDS / (1 + Math.min(1, speed));
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

function autoOpen(state: GameState, mods: Modifiers, events: GameEvent[]): void {
  if (state.time < state.autoOpenAt) return;
  const enabled: Record<ChestKind, boolean> = { common: mods.autoOpenCommon > 0, boss: mods.autoOpenBoss > 0, act: mods.autoOpenAct > 0 };
  const chest = state.chests.find((c) => enabled[c.kind]);
  if (!chest) return;
  state.autoOpenAt = state.time + Math.max(3_000, AUTO_OPEN_MS - mods.autoOpenSpeed * 1_000);
  openChest(state, events, chest.kind);
}

function tickPlague(state: GameState, dt: number, events: GameEvent[]): void {
  const plague = state.plague;
  if (state.location.kind !== "plague") {
    plague.contamination = Math.min(PLAGUE_MAX_CONTAMINATION, plague.contamination + PLAGUE_REFILL_PER_S * dt);
    return;
  }
  plague.contamination -= PLAGUE_DRAIN_PER_S * dt;
  if (plague.contamination > 0) return;
  plague.contamination = 0;
  events.push({ type: "notice", text: "Contamination ran out. Back to the regular stages." });
  startBattle(state, { kind: "stage", index: state.lastStage });
}

export function step(state: GameState, events: GameEvent[]): void {
  state.time += STEP_MS;
  const dt = STEP_MS / 1000;
  const battle = state.battle;
  const area = areaInfo(battle.location);
  const mods = modifiers(state);
  const stats = new Map<number, HeroStats>();
  for (const unit of battle.heroes) stats.set(unit.id, heroStats(state, unit.cls, mods, buffStats(battle, unit.id), area.resPenalty));
  const ctx: Ctx = { state, battle, area, mods, stats, events, dt };

  for (const unit of battle.heroes) {
    if (unit.reviveIn > 0) {
      unit.reviveIn -= dt;
      if (unit.reviveIn <= 0) {
        unit.reviveIn = 0;
        unit.hp = (stats.get(unit.id)?.maxLife ?? 1) * 0.5;
      }
      continue;
    }
    tickStatuses(ctx, unit);
    if (unit.hp <= 0) downHero(ctx, unit);
  }
  for (const m of battle.monsters) tickStatuses(ctx, m);
  reap(ctx);
  for (const b of battle.buffs) b.remaining -= dt;
  battle.buffs = battle.buffs.filter((b) => b.remaining > 0);

  const phase = battle.phase;
  switch (phase.kind) {
    case "advancing":
      for (const unit of battle.heroes) {
        const s = stats.get(unit.id);
        if (s && unit.reviveIn <= 0) unit.hp = Math.min(s.maxLife, unit.hp + s.maxLife * WALK_REGEN_PER_S * dt);
      }
      phase.remaining -= dt;
      if (phase.remaining <= 0) {
        spawnWave(state, battle, area);
        battle.phase = { kind: "fighting" };
        events.push({ type: "waveStart", wave: battle.wave });
      }
      break;
    case "fighting":
      fight(ctx);
      break;
    case "cleared":
      phase.remaining -= dt;
      if (phase.remaining <= 0) startBattle(state, nextLocation(state, battle.location, true));
      break;
    case "defeated":
      phase.remaining -= dt;
      if (phase.remaining <= 0) startBattle(state, nextLocation(state, battle.location, false));
      break;
  }

  autoOpen(state, mods, events);
  tickPlague(state, dt, events);
  tickRates(state);
}
