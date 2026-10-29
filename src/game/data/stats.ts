export const DAMAGE_TYPES = ["physical", "fire", "cold", "lightning", "chaos"] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export const STATUS_KINDS = ["stun", "freeze", "chill", "ignite", "shock", "bleed", "poison"] as const;
export type StatusKind = (typeof STATUS_KINDS)[number];

export interface StatDef {
  label: string;
  percent: boolean;
}

export const STATS = {
  life: { label: "Life", percent: false },
  lifePct: { label: "Life", percent: true },
  regenPct: { label: "Life regen per second", percent: true },
  leech: { label: "Life leech", percent: true },
  attack: { label: "Attack", percent: false },
  attackPct: { label: "Attack", percent: true },
  attackSpeed: { label: "Attack speed", percent: true },
  critChance: { label: "Crit chance", percent: true },
  critDamage: { label: "Crit damage", percent: true },
  armor: { label: "Armor", percent: false },
  armorPct: { label: "Armor", percent: true },
  block: { label: "Block chance", percent: true },
  dodge: { label: "Dodge chance", percent: true },
  reduction: { label: "Damage reduction", percent: true },
  absorb: { label: "Damage absorbed per hit", percent: false },
  fireRes: { label: "Fire resistance", percent: true },
  coldRes: { label: "Cold resistance", percent: true },
  lightningRes: { label: "Lightning resistance", percent: true },
  chaosRes: { label: "Chaos resistance", percent: true },
  allRes: { label: "All resistances", percent: true },
  maxRes: { label: "Max resistances", percent: true },
  physicalDmg: { label: "Physical damage", percent: true },
  fireDmg: { label: "Fire damage", percent: true },
  coldDmg: { label: "Cold damage", percent: true },
  lightningDmg: { label: "Lightning damage", percent: true },
  chaosDmg: { label: "Chaos damage", percent: true },
  bossDmg: { label: "Damage to bosses", percent: true },
  area: { label: "Area damage", percent: true },
  cooldown: { label: "Cooldown reduction", percent: true },
  healPower: { label: "Healing", percent: true },
  statusChance: { label: "Status chance", percent: true },
  moveSpeed: { label: "Movement speed", percent: true },
  goldFind: { label: "Gold found", percent: true },
  xpFind: { label: "Experience", percent: true },
} as const satisfies Record<string, StatDef>;

export type StatKey = keyof typeof STATS;
export const STAT_KEYS = Object.keys(STATS) as StatKey[];
export type StatBlock = Partial<Record<StatKey, number>>;

export const RES_KEY: Record<Exclude<DamageType, "physical">, StatKey> = {
  fire: "fireRes",
  cold: "coldRes",
  lightning: "lightningRes",
  chaos: "chaosRes",
};

export const DMG_KEY: Record<DamageType, StatKey> = {
  physical: "physicalDmg",
  fire: "fireDmg",
  cold: "coldDmg",
  lightning: "lightningDmg",
  chaos: "chaosDmg",
};

export const STATUS = {
  stun: { seconds: 1.5, dot: 0, label: "Stunned" },
  freeze: { seconds: 1.5, dot: 0, label: "Frozen" },
  chill: { seconds: 4, dot: 0, label: "Chilled" },
  ignite: { seconds: 4, dot: 0.25, label: "Burning" },
  shock: { seconds: 6, dot: 0, label: "Shocked" },
  bleed: { seconds: 7, dot: 0.12, label: "Bleeding" },
  poison: { seconds: 6, dot: 0.2, label: "Poisoned" },
} as const satisfies Record<StatusKind, { seconds: number; dot: number; label: string }>;

export const SHOCK_BONUS = 0.2;
export const CHILL_SLOW = 0.3;

export function addStats(into: StatBlock, from: StatBlock, scale = 1): StatBlock {
  for (const [k, v] of Object.entries(from) as [StatKey, number][]) into[k] = (into[k] ?? 0) + v * scale;
  return into;
}
