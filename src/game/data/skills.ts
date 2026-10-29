import type { ClassKey } from "./classes";
import type { DamageType, StatBlock, StatKey, StatusKind } from "./stats";

export const TIER_POINTS = 10;
export const ACTIVE_MAX = 5;
export const PASSIVE_MAX = 10;

export type Trigger = { every: number } | { cooldown: number };

export type Effect =
  | { kind: "hit"; mult: number; per: number; target: "front" | "all" | "random3"; type?: DamageType; status?: StatusKind; chance?: number; crit?: boolean }
  | { kind: "trap"; mult: number; per: number; target: "front" | "all"; delay: number; type?: DamageType; status?: StatusKind; chance?: number }
  | { kind: "heal"; pct: number; per: number; target: "lowest" | "party" }
  | { kind: "buff"; stat: StatKey; amount: number; per: number; seconds: number; target: "self" | "party" }
  | { kind: "taunt"; seconds: number }
  | { kind: "revive"; pct: number; per: number };

export interface ActiveDef {
  kind: "active";
  name: string;
  cls: ClassKey;
  tier: number;
  trigger: Trigger;
  effects: Effect[];
  text: string;
}

export interface PassiveDef {
  kind: "passive";
  name: string;
  cls: ClassKey;
  tier: number;
  stats: StatBlock;
}

export type SkillDef = ActiveDef | PassiveDef;

const active = (cls: ClassKey, tier: number, name: string, trigger: Trigger, text: string, ...effects: Effect[]): ActiveDef => ({
  kind: "active",
  name,
  cls,
  tier,
  trigger,
  effects,
  text,
});

const passive = (cls: ClassKey, tier: number, name: string, stat: StatKey, per: number): PassiveDef => ({
  kind: "passive",
  name,
  cls,
  tier,
  stats: { [stat]: per },
});

const hit = (mult: number, per: number, target: "front" | "all" | "random3", extra: Partial<Extract<Effect, { kind: "hit" }>> = {}): Effect => ({ kind: "hit", mult, per, target, ...extra });
const buff = (stat: StatKey, amount: number, per: number, seconds: number, target: "self" | "party"): Effect => ({ kind: "buff", stat, amount, per, seconds, target });

export const SKILLS = {
  shieldBash: active("knight", 0, "Shield Bash", { every: 5 }, "Bash the front enemy and stun it.", hit(2.5, 0.3, "front", { status: "stun", chance: 1 })),
  warCry: active("knight", 1, "War Cry", { cooldown: 12 }, "The party deals more damage for a while.", buff("attackPct", 0.15, 0.05, 6, "party")),
  shieldWall: active("knight", 2, "Shield Wall", { cooldown: 15 }, "Brace behind the shield and take less damage.", buff("reduction", 0.3, 0.05, 5, "self")),
  whirlwind: active("knight", 3, "Whirlwind", { every: 6 }, "Spin through every enemy, leaving them bleeding.", hit(1.2, 0.15, "all", { status: "bleed", chance: 0.5 })),
  provoke: active("knight", 4, "Provoke", { cooldown: 10 }, "Force enemies to attack the knight and harden armor.", { kind: "taunt", seconds: 4 }, buff("armorPct", 0.5, 0.1, 4, "self")),
  judgment: active("knight", 6, "Judgment", { cooldown: 20 }, "Call down holy lightning on the front enemy.", hit(6, 0.8, "front", { type: "lightning", status: "shock", chance: 1 })),
  toughness: passive("knight", 0, "Toughness", "lifePct", 0.04),
  ironSkin: passive("knight", 0, "Iron Skin", "armorPct", 0.05),
  swordsmanship: passive("knight", 1, "Swordsmanship", "attackPct", 0.03),
  bulwark: passive("knight", 1, "Bulwark", "block", 0.015),
  secondWind: passive("knight", 2, "Second Wind", "regenPct", 0.002),
  resolve: passive("knight", 2, "Resolve", "allRes", 0.02),
  fortress: passive("knight", 3, "Fortress", "reduction", 0.015),
  riposte: passive("knight", 3, "Riposte", "critDamage", 0.05),
  vanguard: passive("knight", 4, "Vanguard", "armorPct", 0.04),
  heavyBlows: passive("knight", 4, "Heavy Blows", "statusChance", 0.02),
  unbreakable: passive("knight", 5, "Unbreakable", "maxRes", 0.01),
  battleHardened: passive("knight", 5, "Battle Hardened", "lifePct", 0.03),
  crusader: passive("knight", 6, "Crusader", "lightningDmg", 0.05),
  champion: passive("knight", 6, "Champion", "attackPct", 0.04),
  bastion: passive("knight", 7, "Bastion", "block", 0.02),
  lastStand: passive("knight", 7, "Last Stand", "reduction", 0.02),

  volley: active("ranger", 0, "Volley", { every: 4 }, "Loose arrows at every enemy.", hit(1.3, 0.15, "all")),
  aimedShot: active("ranger", 1, "Aimed Shot", { cooldown: 8 }, "A guaranteed critical shot at the front enemy.", hit(3.5, 0.5, "front", { crit: true })),
  huntersFocus: active("ranger", 2, "Hunter's Focus", { cooldown: 14 }, "Sharpen focus for more critical hits.", buff("critChance", 0.2, 0.03, 5, "self")),
  poisonArrow: active("ranger", 3, "Poison Arrow", { every: 5 }, "A chaos arrow that poisons.", hit(1.5, 0.2, "front", { type: "chaos", status: "poison", chance: 1 })),
  rainOfArrows: active("ranger", 4, "Rain of Arrows", { cooldown: 16 }, "Arrows fall on every enemy.", hit(2.5, 0.3, "all")),
  phoenixArrow: active("ranger", 6, "Phoenix Arrow", { cooldown: 22 }, "A burning arrow that sets the target ablaze.", hit(7, 0.9, "front", { type: "fire", status: "ignite", chance: 1 })),
  keenEye: passive("ranger", 0, "Keen Eye", "critChance", 0.01),
  deadlyAim: passive("ranger", 0, "Deadly Aim", "critDamage", 0.06),
  quickDraw: passive("ranger", 1, "Quick Draw", "attackSpeed", 0.02),
  agility: passive("ranger", 1, "Agility", "dodge", 0.015),
  marksman: passive("ranger", 2, "Marksman", "attackPct", 0.03),
  windStep: passive("ranger", 2, "Wind Step", "moveSpeed", 0.03),
  piercing: passive("ranger", 3, "Piercing", "area", 0.04),
  hunterInstinct: passive("ranger", 3, "Hunter Instinct", "bossDmg", 0.04),
  evasion: passive("ranger", 4, "Evasion", "dodge", 0.015),
  vitality: passive("ranger", 4, "Vitality", "lifePct", 0.03),
  sniper: passive("ranger", 5, "Sniper", "critDamage", 0.08),
  venom: passive("ranger", 5, "Venom", "chaosDmg", 0.05),
  eagleEye: passive("ranger", 6, "Eagle Eye", "critChance", 0.015),
  fleet: passive("ranger", 6, "Fleet", "attackSpeed", 0.025),
  rangersGrace: passive("ranger", 7, "Ranger's Grace", "allRes", 0.02),
  lethality: passive("ranger", 7, "Lethality", "attackPct", 0.04),

  meteor: active("mage", 0, "Meteor", { every: 6 }, "A meteor crashes into every enemy and sets them burning.", hit(3, 0.4, "all", { type: "fire", status: "ignite", chance: 0.6 })),
  frostNova: active("mage", 1, "Frost Nova", { cooldown: 10 }, "Freezing burst that chills the whole wave.", hit(1.5, 0.2, "all", { type: "cold", status: "chill", chance: 1 })),
  chainLightning: active("mage", 2, "Chain Lightning", { every: 4 }, "Lightning jumps between three enemies.", hit(2, 0.25, "random3", { type: "lightning", status: "shock", chance: 0.5 })),
  arcaneSurge: active("mage", 3, "Arcane Surge", { cooldown: 16 }, "Overcharge spells for a burst of damage.", buff("attackPct", 0.4, 0.08, 6, "self")),
  blizzard: active("mage", 4, "Blizzard", { cooldown: 18 }, "Ice storm that can freeze every enemy.", hit(3.5, 0.45, "all", { type: "cold", status: "freeze", chance: 0.4 })),
  inferno: active("mage", 6, "Inferno", { cooldown: 24 }, "A sea of fire across the battlefield.", hit(7, 0.9, "all", { type: "fire", status: "ignite", chance: 1 })),
  pyromancy: passive("mage", 0, "Pyromancy", "fireDmg", 0.05),
  cryomancy: passive("mage", 0, "Cryomancy", "coldDmg", 0.05),
  electromancy: passive("mage", 1, "Electromancy", "lightningDmg", 0.05),
  arcaneMind: passive("mage", 1, "Arcane Mind", "cooldown", 0.02),
  spellEcho: passive("mage", 2, "Spell Echo", "area", 0.05),
  manaShield: passive("mage", 2, "Mana Shield", "reduction", 0.015),
  combustion: passive("mage", 3, "Combustion", "statusChance", 0.02),
  focus: passive("mage", 3, "Focus", "critChance", 0.01),
  elementalMastery: passive("mage", 4, "Elemental Mastery", "attackPct", 0.03),
  warding: passive("mage", 4, "Warding", "allRes", 0.02),
  overload: passive("mage", 5, "Overload", "critDamage", 0.06),
  frostbite: passive("mage", 5, "Frostbite", "coldDmg", 0.06),
  conflagration: passive("mage", 6, "Conflagration", "fireDmg", 0.06),
  stormLord: passive("mage", 6, "Storm Lord", "lightningDmg", 0.06),
  archmage: passive("mage", 7, "Archmage", "attackPct", 0.04),
  manaFlow: passive("mage", 7, "Mana Flow", "cooldown", 0.025),

  heal: active("priest", 0, "Heal", { cooldown: 6 }, "Restore life to the most wounded ally.", { kind: "heal", pct: 0.25, per: 0.05, target: "lowest" }),
  blessingOfMight: active("priest", 1, "Blessing of Might", { cooldown: 15 }, "Bless the party with more damage.", buff("attackPct", 0.2, 0.05, 8, "party")),
  wrathOfHeaven: active("priest", 2, "Wrath of Heaven", { every: 5 }, "Holy lightning strikes the front enemy.", hit(3, 0.4, "front", { type: "lightning", status: "shock", chance: 1 })),
  sanctuary: active("priest", 3, "Sanctuary", { cooldown: 18 }, "Heal the whole party and soften incoming blows.", { kind: "heal", pct: 0.15, per: 0.03, target: "party" }, buff("reduction", 0.15, 0.03, 5, "party")),
  blessingOfWarding: active("priest", 4, "Blessing of Warding", { cooldown: 20 }, "Raise the party's resistances.", buff("allRes", 0.2, 0.05, 8, "party")),
  resurrection: active("priest", 6, "Resurrection", { cooldown: 45 }, "Bring a fallen ally back into the fight.", { kind: "revive", pct: 0.5, per: 0.1 }),
  devotion: passive("priest", 0, "Devotion", "healPower", 0.06),
  faith: passive("priest", 0, "Faith", "lifePct", 0.03),
  holyFire: passive("priest", 1, "Holy Fire", "lightningDmg", 0.05),
  grace: passive("priest", 1, "Grace", "regenPct", 0.002),
  divineShield: passive("priest", 2, "Divine Shield", "reduction", 0.015),
  benediction: passive("priest", 2, "Benediction", "healPower", 0.06),
  zeal: passive("priest", 3, "Zeal", "attackSpeed", 0.02),
  purity: passive("priest", 3, "Purity", "allRes", 0.02),
  radiance: passive("priest", 4, "Radiance", "area", 0.04),
  piety: passive("priest", 4, "Piety", "armorPct", 0.04),
  martyr: passive("priest", 5, "Martyr", "lifePct", 0.04),
  smite: passive("priest", 5, "Smite", "attackPct", 0.03),
  sanctity: passive("priest", 6, "Sanctity", "maxRes", 0.01),
  miracle: passive("priest", 6, "Miracle", "healPower", 0.08),
  halo: passive("priest", 7, "Halo", "block", 0.015),
  prayer: passive("priest", 7, "Prayer", "cooldown", 0.025),

  bearTrap: active("hunter", 0, "Bear Trap", { every: 4 }, "A trap snaps on the front enemy and stuns it.", { kind: "trap", mult: 2.5, per: 0.3, target: "front", delay: 1, status: "stun", chance: 1 }),
  explosiveTrap: active("hunter", 1, "Explosive Trap", { cooldown: 10 }, "A fire trap that blows up the whole wave.", { kind: "trap", mult: 2, per: 0.25, target: "all", delay: 1.2, type: "fire", status: "ignite", chance: 0.5 }),
  multishot: active("hunter", 2, "Multishot", { every: 5 }, "Bolts at three enemies.", hit(1.6, 0.2, "random3")),
  markPrey: active("hunter", 3, "Mark Prey", { cooldown: 14 }, "Study the quarry: more damage to bosses.", buff("bossDmg", 0.4, 0.1, 6, "self")),
  spikeField: active("hunter", 4, "Spike Field", { cooldown: 16 }, "Spikes erupt under every enemy, causing bleeding.", { kind: "trap", mult: 3, per: 0.4, target: "all", delay: 1, status: "bleed", chance: 1 }),
  ballista: active("hunter", 6, "Ballista", { cooldown: 25 }, "A siege bolt for the front enemy.", hit(8, 1, "front")),
  trapper: passive("hunter", 0, "Trapper", "area", 0.04),
  sharpshooter: passive("hunter", 0, "Sharpshooter", "critChance", 0.01),
  steadyHands: passive("hunter", 1, "Steady Hands", "attackSpeed", 0.02),
  camouflage: passive("hunter", 1, "Camouflage", "dodge", 0.015),
  barbedBolts: passive("hunter", 2, "Barbed Bolts", "statusChance", 0.02),
  tracker: passive("hunter", 2, "Tracker", "bossDmg", 0.04),
  demolition: passive("hunter", 3, "Demolition", "fireDmg", 0.05),
  survivalist: passive("hunter", 3, "Survivalist", "lifePct", 0.03),
  precisionBolts: passive("hunter", 4, "Precision Bolts", "critDamage", 0.06),
  swiftReload: passive("hunter", 4, "Swift Reload", "cooldown", 0.02),
  bigGame: passive("hunter", 5, "Big Game", "bossDmg", 0.05),
  leathers: passive("hunter", 5, "Leathers", "armorPct", 0.04),
  ambush: passive("hunter", 6, "Ambush", "attackPct", 0.04),
  snare: passive("hunter", 6, "Snare", "statusChance", 0.025),
  apexPredator: passive("hunter", 7, "Apex Predator", "critDamage", 0.08),
  wilderness: passive("hunter", 7, "Wilderness", "allRes", 0.02),

  rend: active("slayer", 0, "Rend", { every: 3 }, "Tear into the front enemy and make it bleed.", hit(1.8, 0.25, "front", { status: "bleed", chance: 1 })),
  bloodlust: active("slayer", 1, "Bloodlust", { cooldown: 12 }, "Frenzied attack speed.", buff("attackSpeed", 0.3, 0.05, 6, "self")),
  cleave: active("slayer", 2, "Cleave", { every: 5 }, "A wide swing through every enemy.", hit(1.6, 0.2, "all")),
  execute: active("slayer", 3, "Execute", { cooldown: 10 }, "A brutal finishing blow.", hit(5, 0.7, "front")),
  bloodFrenzy: active("slayer", 4, "Blood Frenzy", { cooldown: 16 }, "Drink deep: more leech and damage.", buff("leech", 0.1, 0.02, 6, "self"), buff("attackPct", 0.3, 0.05, 6, "self")),
  decimate: active("slayer", 6, "Decimate", { cooldown: 22 }, "Annihilate the whole wave.", hit(6, 0.8, "all")),
  brutality: passive("slayer", 0, "Brutality", "attackPct", 0.03),
  thickHide: passive("slayer", 0, "Thick Hide", "lifePct", 0.03),
  lifedrinker: passive("slayer", 1, "Lifedrinker", "leech", 0.005),
  savageStrikes: passive("slayer", 1, "Savage Strikes", "critDamage", 0.06),
  savagery: passive("slayer", 2, "Savagery", "attackSpeed", 0.02),
  hemorrhage: passive("slayer", 2, "Hemorrhage", "statusChance", 0.02),
  berserker: passive("slayer", 3, "Berserker", "critChance", 0.01),
  scars: passive("slayer", 3, "Scars", "armorPct", 0.04),
  relentless: passive("slayer", 4, "Relentless", "reduction", 0.015),
  carnage: passive("slayer", 4, "Carnage", "area", 0.04),
  bloodthirst: passive("slayer", 5, "Bloodthirst", "leech", 0.006),
  warlord: passive("slayer", 5, "Warlord", "attackPct", 0.04),
  undying: passive("slayer", 6, "Undying", "lifePct", 0.04),
  slaughter: passive("slayer", 6, "Slaughter", "bossDmg", 0.05),
  rampage: passive("slayer", 7, "Rampage", "attackSpeed", 0.025),
  ironWill: passive("slayer", 7, "Iron Will", "allRes", 0.02),
} satisfies Record<string, SkillDef>;

export type SkillKey = keyof typeof SKILLS;
export const SKILL_KEYS = Object.keys(SKILLS) as SkillKey[];

export function skill(key: SkillKey): SkillDef {
  return SKILLS[key];
}

export function classSkills(cls: ClassKey): SkillKey[] {
  return SKILL_KEYS.filter((k) => SKILLS[k].cls === cls);
}

export function starterSkill(cls: ClassKey): SkillKey {
  const key = classSkills(cls).find((k) => SKILLS[k].kind === "active" && SKILLS[k].tier === 0);
  if (!key) throw new Error(`${cls} has no starter skill`);
  return key;
}

export function maxLevel(key: SkillKey): number {
  return SKILLS[key].kind === "active" ? ACTIVE_MAX : PASSIVE_MAX;
}
