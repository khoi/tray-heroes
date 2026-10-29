import type { SpriteRef } from "../types";
import type { ClassKey } from "./classes";
import type { StatBlock, StatKey } from "./stats";

export const SLOTS = ["mainWeapon", "subWeapon", "helmet", "armor", "gloves", "boots", "amulet", "earring", "ring", "bracer"] as const;
export type Slot = (typeof SLOTS)[number];

export const SLOT_LABEL: Record<Slot, string> = {
  mainWeapon: "Weapon",
  subWeapon: "Off-hand",
  helmet: "Helm",
  armor: "Armor",
  gloves: "Gloves",
  boots: "Boots",
  amulet: "Amulet",
  earring: "Earring",
  ring: "Ring",
  bracer: "Bracer",
};

export interface BaseDef {
  name: string;
  slot: Slot;
  cls: ClassKey | null;
  main: Partial<Record<"life" | "attack" | "armor", number>>;
  implicit: StatBlock;
  sprite: SpriteRef;
}

const d = (index: number): SpriteRef => ({ sheet: "dungeon", index });
const t = (index: number): SpriteRef => ({ sheet: "town", index });
const c = (name: "helmet" | "armor" | "boots" | "amulet"): SpriteRef => ({ sheet: "custom", name });

export const BASES = {
  sword: { name: "Sword", slot: "mainWeapon", cls: "knight", main: { attack: 1 }, implicit: {}, sprite: d(104) },
  bow: { name: "Bow", slot: "mainWeapon", cls: "ranger", main: { attack: 1 }, implicit: {}, sprite: t(118) },
  staff: { name: "Staff", slot: "mainWeapon", cls: "mage", main: { attack: 1.15 }, implicit: {}, sprite: d(130) },
  scepter: { name: "Scepter", slot: "mainWeapon", cls: "priest", main: { attack: 0.9 }, implicit: { healPower: 0.1 }, sprite: d(129) },
  crossbow: { name: "Crossbow", slot: "mainWeapon", cls: "hunter", main: { attack: 1.05 }, implicit: {}, sprite: t(118) },
  axe: { name: "Axe", slot: "mainWeapon", cls: "slayer", main: { attack: 1.1 }, implicit: {}, sprite: d(118) },
  shield: { name: "Shield", slot: "subWeapon", cls: "knight", main: { armor: 0.8, life: 0.3 }, implicit: { block: 0.06 }, sprite: d(102) },
  quiver: { name: "Quiver", slot: "subWeapon", cls: "ranger", main: { attack: 0.35 }, implicit: { critDamage: 0.1 }, sprite: t(119) },
  orb: { name: "Orb", slot: "subWeapon", cls: "mage", main: { attack: 0.4 }, implicit: { fireDmg: 0.1 }, sprite: d(116) },
  tome: { name: "Tome", slot: "subWeapon", cls: "priest", main: { life: 0.5 }, implicit: { healPower: 0.1 }, sprite: d(66) },
  bolts: { name: "Bolts", slot: "subWeapon", cls: "hunter", main: { attack: 0.35 }, implicit: { attackSpeed: 0.04 }, sprite: d(131) },
  hatchet: { name: "Hatchet", slot: "subWeapon", cls: "slayer", main: { attack: 0.4 }, implicit: { statusChance: 0.05 }, sprite: d(119) },
  helmet: { name: "Helm", slot: "helmet", cls: null, main: { life: 0.6, armor: 0.5 }, implicit: {}, sprite: c("helmet") },
  armor: { name: "Cuirass", slot: "armor", cls: null, main: { life: 1, armor: 1 }, implicit: {}, sprite: c("armor") },
  gloves: { name: "Gauntlets", slot: "gloves", cls: null, main: { armor: 0.4, attack: 0.15 }, implicit: {}, sprite: d(117) },
  boots: { name: "Boots", slot: "boots", cls: null, main: { life: 0.4, armor: 0.4 }, implicit: { moveSpeed: 0.05 }, sprite: c("boots") },
  amulet: { name: "Amulet", slot: "amulet", cls: null, main: { life: 0.5, attack: 0.15 }, implicit: {}, sprite: c("amulet") },
  earring: { name: "Earring", slot: "earring", cls: null, main: { attack: 0.2 }, implicit: { critChance: 0.02 }, sprite: d(113) },
  ring: { name: "Ring", slot: "ring", cls: null, main: { attack: 0.35 }, implicit: {}, sprite: d(101) },
  bracer: { name: "Bracer", slot: "bracer", cls: null, main: { armor: 0.3, life: 0.3 }, implicit: {}, sprite: d(125) },
} as const satisfies Record<string, BaseDef>;

export type BaseKey = keyof typeof BASES;
export const BASE_KEYS = Object.keys(BASES) as BaseKey[];

export function base(key: BaseKey): BaseDef {
  return BASES[key];
}

export interface AffixDef {
  min: number;
  max: number;
  unit?: "life" | "attack" | "armor";
}

export const AFFIXES: Partial<Record<StatKey, AffixDef>> = {
  life: { min: 0.3, max: 0.6, unit: "life" },
  attack: { min: 0.15, max: 0.3, unit: "attack" },
  armor: { min: 0.3, max: 0.6, unit: "armor" },
  absorb: { min: 0.02, max: 0.05, unit: "life" },
  lifePct: { min: 0.04, max: 0.1 },
  regenPct: { min: 0.002, max: 0.006 },
  leech: { min: 0.005, max: 0.015 },
  attackPct: { min: 0.04, max: 0.1 },
  attackSpeed: { min: 0.03, max: 0.08 },
  critChance: { min: 0.02, max: 0.05 },
  critDamage: { min: 0.08, max: 0.2 },
  armorPct: { min: 0.05, max: 0.12 },
  block: { min: 0.02, max: 0.05 },
  dodge: { min: 0.02, max: 0.05 },
  reduction: { min: 0.02, max: 0.05 },
  fireRes: { min: 0.06, max: 0.15 },
  coldRes: { min: 0.06, max: 0.15 },
  lightningRes: { min: 0.06, max: 0.15 },
  chaosRes: { min: 0.05, max: 0.12 },
  allRes: { min: 0.04, max: 0.08 },
  physicalDmg: { min: 0.05, max: 0.12 },
  fireDmg: { min: 0.05, max: 0.12 },
  coldDmg: { min: 0.05, max: 0.12 },
  lightningDmg: { min: 0.05, max: 0.12 },
  chaosDmg: { min: 0.05, max: 0.12 },
  bossDmg: { min: 0.05, max: 0.12 },
  area: { min: 0.05, max: 0.12 },
  cooldown: { min: 0.03, max: 0.06 },
  healPower: { min: 0.05, max: 0.12 },
  statusChance: { min: 0.02, max: 0.06 },
  moveSpeed: { min: 0.04, max: 0.1 },
  goldFind: { min: 0.05, max: 0.12 },
  xpFind: { min: 0.04, max: 0.1 },
};

export const AFFIX_POOL: Record<Slot, StatKey[]> = {
  mainWeapon: ["attack", "attackPct", "attackSpeed", "critChance", "critDamage", "physicalDmg", "fireDmg", "coldDmg", "lightningDmg", "chaosDmg", "statusChance", "leech", "bossDmg"],
  subWeapon: ["attack", "attackPct", "critDamage", "block", "cooldown", "area", "healPower", "statusChance"],
  helmet: ["life", "armor", "lifePct", "regenPct", "allRes", "fireRes", "coldRes", "cooldown"],
  armor: ["life", "armor", "lifePct", "armorPct", "reduction", "regenPct", "fireRes", "chaosRes"],
  gloves: ["attack", "attackSpeed", "critChance", "armor", "leech", "area"],
  boots: ["life", "dodge", "moveSpeed", "coldRes", "lightningRes", "armor"],
  amulet: ["lifePct", "attackPct", "allRes", "critDamage", "xpFind", "goldFind"],
  earring: ["critChance", "critDamage", "chaosRes", "cooldown", "healPower", "xpFind"],
  ring: ["attack", "attackPct", "critChance", "fireRes", "lightningRes", "goldFind"],
  bracer: ["block", "dodge", "armor", "absorb", "reduction", "leech"],
};

export const UNIQUE_FLAGS = ["lifeCap", "frostbite", "chainLightning", "phoenix"] as const;
export type UniqueFlag = (typeof UNIQUE_FLAGS)[number];

export interface UniqueDef {
  name: string;
  base: BaseKey;
  text: string;
  stats: StatBlock;
  flag?: UniqueFlag;
}

export const UNIQUES = {
  eternalArmor: { name: "Eternal Armor", base: "armor", text: "No single hit can take more than half your life.", stats: { lifePct: 0.1 }, flag: "lifeCap" },
  frostbrand: { name: "Frostbrand", base: "sword", text: "Every hit chills.", stats: { coldDmg: 0.25 }, flag: "frostbite" },
  stormcaller: { name: "Stormcaller", base: "staff", text: "Hits can arc lightning to every enemy.", stats: { lightningDmg: 0.3 }, flag: "chainLightning" },
  phoenixFeather: { name: "Phoenix Feather", base: "amulet", text: "Rise once per stage at half life.", stats: { fireRes: 0.2 }, flag: "phoenix" },
  vampiricFang: { name: "Vampiric Fang", base: "axe", text: "Drink the life of every enemy struck.", stats: { leech: 0.05, attackPct: 0.1 } },
  eagleEye: { name: "Eagle Eye", base: "bow", text: "Deadly, precise shots.", stats: { critChance: 0.05, critDamage: 0.5 } },
  aegis: { name: "Aegis", base: "shield", text: "A wall of steel.", stats: { block: 0.15, armorPct: 0.2 } },
  midas: { name: "Midas Touch", base: "ring", text: "Gold flows to the wearer.", stats: { goldFind: 0.25 } },
  sagesTome: { name: "Sage's Tome", base: "tome", text: "Healing words carry further.", stats: { healPower: 0.3, cooldown: 0.08 } },
  windwalkers: { name: "Windwalkers", base: "boots", text: "Light as the wind.", stats: { moveSpeed: 0.4, dodge: 0.08 } },
  berserker: { name: "Berserker Band", base: "bracer", text: "Rage quickens the arm.", stats: { attackSpeed: 0.2 } },
  emberOrb: { name: "Ember Orb", base: "orb", text: "Flames cling to every target.", stats: { fireDmg: 0.3, statusChance: 0.15 } },
  huntersMark: { name: "Hunter's Mark", base: "bolts", text: "The bigger the prey, the harder it falls.", stats: { bossDmg: 0.25 } },
  scholar: { name: "Scholar's Earring", base: "earring", text: "Every fight teaches more.", stats: { xpFind: 0.2 } },
  titanGrips: { name: "Titan Grips", base: "gloves", text: "Crushing strength.", stats: { attackPct: 0.15, armorPct: 0.1 } },
  crownOfAges: { name: "Crown of Ages", base: "helmet", text: "The wisdom of kings.", stats: { allRes: 0.1, lifePct: 0.1 } },
  holyScepter: { name: "Dawnbringer", base: "scepter", text: "Light that burns the wicked.", stats: { lightningDmg: 0.3, healPower: 0.15 } },
  siegeCrossbow: { name: "Siegebreaker", base: "crossbow", text: "Bolts that shatter walls.", stats: { attackPct: 0.2, area: 0.15 } },
  bloodQuiver: { name: "Bloodletter", base: "quiver", text: "Arrows that keep cutting.", stats: { statusChance: 0.15, physicalDmg: 0.2 } },
  reaverHatchet: { name: "Reaver", base: "hatchet", text: "Throw, rend, repeat.", stats: { attackSpeed: 0.1, leech: 0.03 } },
} as const satisfies Record<string, UniqueDef>;

export type UniqueKey = keyof typeof UNIQUES;
export const UNIQUE_KEYS = Object.keys(UNIQUES) as UniqueKey[];
