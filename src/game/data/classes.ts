import type { BaseKey } from "./items";
import type { DamageType, StatBlock, StatusKind } from "./stats";

export const CLASS_KEYS = ["knight", "ranger", "mage", "priest", "hunter", "slayer"] as const;
export type ClassKey = (typeof CLASS_KEYS)[number];

export interface ClassDef {
  name: string;
  role: string;
  main: BaseKey;
  sub: BaseKey;
  damage: DamageType;
  status: StatusKind | null;
  ranged: boolean;
  splash: number;
  armorCap: number;
  unlockCost: number;
  base: { life: number; attack: number; armor: number; attackSpeed: number } & StatBlock;
}

export const CLASSES: Record<ClassKey, ClassDef> = {
  knight: {
    name: "Knight",
    role: "Tank. Holds the front line with shields and stuns.",
    main: "sword",
    sub: "shield",
    damage: "physical",
    status: "stun",
    ranged: false,
    splash: 0,
    armorCap: 0.85,
    unlockCost: 0,
    base: { life: 130, attack: 8, armor: 14, attackSpeed: 0.9, critChance: 0.05, critDamage: 0.4, block: 0.1 },
  },
  ranger: {
    name: "Ranger",
    role: "Bow damage. Fast shots and frequent crits.",
    main: "bow",
    sub: "quiver",
    damage: "physical",
    status: "bleed",
    ranged: true,
    splash: 0,
    armorCap: 0.75,
    unlockCost: 150,
    base: { life: 75, attack: 9, armor: 5, attackSpeed: 1.3, critChance: 0.15, critDamage: 0.8, dodge: 0.08 },
  },
  mage: {
    name: "Sorcerer",
    role: "Elemental area damage that burns, freezes and shocks.",
    main: "staff",
    sub: "orb",
    damage: "fire",
    status: "ignite",
    ranged: true,
    splash: 0.35,
    armorCap: 0.75,
    unlockCost: 150,
    base: { life: 65, attack: 14, armor: 3, attackSpeed: 0.7, critChance: 0.06, critDamage: 0.6 },
  },
  priest: {
    name: "Priest",
    role: "Heals, blessings and resurrection.",
    main: "scepter",
    sub: "tome",
    damage: "lightning",
    status: "shock",
    ranged: true,
    splash: 0,
    armorCap: 0.85,
    unlockCost: 1_500,
    base: { life: 95, attack: 8, armor: 10, attackSpeed: 0.9, critChance: 0.04, critDamage: 0.5, healPower: 0 },
  },
  hunter: {
    name: "Hunter",
    role: "Crossbow and traps that hit whole waves.",
    main: "crossbow",
    sub: "bolts",
    damage: "physical",
    status: "bleed",
    ranged: true,
    splash: 0,
    armorCap: 0.75,
    unlockCost: 8_000,
    base: { life: 80, attack: 10, armor: 6, attackSpeed: 1, critChance: 0.1, critDamage: 0.7, dodge: 0.05 },
  },
  slayer: {
    name: "Slayer",
    role: "Melee burst that heals from every hit.",
    main: "axe",
    sub: "hatchet",
    damage: "physical",
    status: "bleed",
    ranged: false,
    splash: 0,
    armorCap: 0.85,
    unlockCost: 30_000,
    base: { life: 115, attack: 11, armor: 12, attackSpeed: 0.85, critChance: 0.08, critDamage: 1, leech: 0.03 },
  },
};
