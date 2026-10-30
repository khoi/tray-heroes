import type { ClassKey, MonsterKey } from "../../game/schema";

export interface Clip {
  row: number;
  frames: number;
}

export interface Weapon {
  src: string;
  w: number;
  h: number;
  kind: "blade" | "bow" | "staff";
}

export interface UnitManifest {
  src: string;
  w: number;
  h: number;
  anchorX: number;
  anchorY: number;
  top: number;
  idle: Clip;
  walk: Clip;
  attacks: (Clip & { impact: number })[];
  hurt: Clip | null;
  death: Clip | null;
  weapon: Weapon | null;
}

export type ArtKey = ClassKey | MonsterKey;

export const ROSTER: Record<ArtKey, string[]> = {
  knight: ["Knight", "Soldier"],
  ranger: ["Archer"],
  mage: ["Wizard"],
  priest: ["Priest"],
  hunter: ["Archer"],
  slayer: ["Armored Axeman", "Swordsman"],
  goblin: ["Orc"],
  mushroom: ["Slime"],
  snake: ["Armored Orc"],
  wolf: ["Werewolf"],
  bat: ["Bat"],
  orc: ["Elite Orc", "Orc"],
  troll: ["Orc Rider", "Werebear"],
  skeleton: ["Skeleton"],
  zombie: ["Armored Skeleton"],
  scorpion: ["Skeleton Archer"],
  cobra: ["Lancer"],
  mummy: ["Greatsword Skeleton"],
  reaper: ["Necromancer"],
  vampire: ["Knight Templar"],
  yeti: ["Werebear"],
  frost: ["Blood Monster_A"],
  flame: ["Demon_A"],
  imp: ["Demon_A"],
  skull: ["Blood Monster_A"],
  demon: ["Demon_A"],
  dragon: ["Blood Monster_A"],
};

export const DUNGEON: Partial<Record<ArtKey, { base: string; weapon?: string }>> = {
  knight: { base: "knight_m", weapon: "weapon_knight_sword" },
  ranger: { base: "elf_m", weapon: "weapon_bow" },
  mage: { base: "wizzard_m", weapon: "weapon_red_magic_staff" },
  priest: { base: "wizzard_f", weapon: "weapon_mace" },
  hunter: { base: "dwarf_m", weapon: "weapon_bow_2" },
  slayer: { base: "lizard_m", weapon: "weapon_double_axe" },
  goblin: { base: "goblin", weapon: "weapon_knife" },
  mushroom: { base: "swampy" },
  snake: { base: "tiny_slug" },
  wolf: { base: "orc_warrior", weapon: "weapon_baton_with_spikes" },
  orc: { base: "masked_orc", weapon: "weapon_waraxe" },
  troll: { base: "ogre", weapon: "weapon_big_hammer" },
  skeleton: { base: "skelet", weapon: "weapon_rusty_sword" },
  zombie: { base: "zombie" },
  scorpion: { base: "muddy" },
  cobra: { base: "slug" },
  mummy: { base: "tiny_zombie" },
  reaper: { base: "necromancer", weapon: "weapon_green_magic_staff" },
  vampire: { base: "big_zombie" },
  yeti: { base: "ice_zombie" },
  frost: { base: "angel" },
  flame: { base: "chort", weapon: "weapon_cleaver" },
  imp: { base: "imp" },
  skull: { base: "wogol" },
  demon: { base: "orc_shaman", weapon: "weapon_red_magic_staff" },
  dragon: { base: "big_demon" },
};

async function fetchUnits(url: string): Promise<Partial<Record<ArtKey, UnitManifest>>> {
  try {
    const res = await fetch(url);
    if (!res.ok) return {};
    return ((await res.json()) as { units: Partial<Record<ArtKey, UnitManifest>> }).units;
  } catch {
    return {};
  }
}

export async function loadManifest(): Promise<Partial<Record<ArtKey, UnitManifest>>> {
  const [base, licensed] = await Promise.all([fetchUnits("/art/units/manifest.json"), fetchUnits("/art/licensed/manifest.json")]);
  return { ...base, ...licensed };
}
