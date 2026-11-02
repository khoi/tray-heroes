import type { ClassKey } from "../../game/data/classes";
import type { MonsterKey, Theme } from "../../game/data/world";

export type Knobs = Record<string, string | number | boolean>;

export interface Source {
  id: string;
  p?: Knobs;
}

export interface Grip {
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: number;
}

export type WeaponKey = "sword" | "shield" | "longbow" | "spear" | "axe" | "dagger";

export type AttackStyle = "melee" | "shoot" | "throw" | "cast";

export const LIMBS = ["Spine", "Neck", "RightArm", "RightForeArm", "LeftArm", "LeftForeArm"] as const;
export type Limb = (typeof LIMBS)[number];
export type Carry = Partial<Record<Limb, [number, number, number]>>;

export interface UnitModel extends Source {
  height: number;
  carry?: Carry;
  attack?: AttackStyle;
  right?: WeaponKey;
  left?: WeaponKey;
  fly?: number;
}

export type Band = "back" | "mid" | "front";

export interface SceneryModel extends Source {
  band: Band;
  weight: number;
  scale?: number;
  light?: number;
}

export interface Look {
  skyTop: number;
  skyBottom: number;
  fog: number;
  ground: [number, number, number];
  lane: number;
  sun: number;
  sunIntensity: number;
  ambient: number;
  ambientGround: number;
  ambientIntensity: number;
  hills: number;
  wall?: Source;
  scenery: SceneryModel[];
}

export const WEAPONS: Record<WeaponKey, Source & Grip> = {
  sword: { id: "arming-sword-401972", rot: [-110, 90, 0], pos: [0, 0.21, 0.82] },
  shield: { id: "heater-shield-c51b76", pos: [0.06, -0.42, 0.12] },
  longbow: { id: "kyudo-longbow-a7f88f", scale: 0.62, rot: [90, 90, 0], pos: [0, -0.08, -0.45] },
  spear: { id: "spear-e9824e", scale: 0.8, rot: [90, 0, 0], pos: [0, -0.08, -0.76] },
  axe: { id: "hand-axe-cee9e7", rot: [70, 90, 0], pos: [0, -0.1, -0.1] },
  dagger: { id: "jewelled-dagger-38f556", scale: 1.4, rot: [80, 90, 0], pos: [0, -0.08, -0.05] },
};

const BOW_CARRY: Carry = { LeftForeArm: [0.15, 0.1, 1] };
const SPEAR_CARRY: Carry = { RightForeArm: [-0.15, 0.1, 1] };

export const HERO_MODELS: Record<ClassKey, UnitModel> = {
  knight: { id: "armoured-knight-hero-07121f", height: 1.86, right: "sword", left: "shield" },
  ranger: { id: "egg-poacher-428c56", p: { eggs: false }, height: 1.78, attack: "shoot", left: "longbow", carry: BOW_CARRY },
  mage: { id: "kid-witch-01c770", p: { age: "teen", sack: false }, height: 1.7, attack: "cast" },
  priest: { id: "buddhist-monk-39f498", height: 1.76, attack: "cast" },
  hunter: { id: "dragon-rider-apprentice-dee2cd", p: { age: "adult" }, height: 1.78, attack: "throw", right: "spear", carry: SPEAR_CARRY },
  slayer: { id: "dragon-slayer-91ab39", height: 1.84 },
};

export const MONSTER_MODELS: Record<MonsterKey, UnitModel> = {
  goblin: { id: "goblin-2461c8", height: 1.25, left: "dagger" },
  mushroom: { id: "leopard-slug-base", height: 0.8 },
  snake: { id: "beelzebufo-giant-frog-29beae", height: 1 },
  wolf: { id: "wolf-base", height: 1.25 },
  bat: { id: "crow-base", height: 0.95, fly: 1.1 },
  orc: { id: "orc-brute-08c6ca", height: 2.4, left: "axe" },
  troll: { id: "black-bear-adbdc7", height: 2.7 },
  skeleton: { id: "el-catr-n-be48ea", height: 1.85 },
  zombie: { id: "teen-zombie-b5bb27", height: 1.7 },
  scorpion: { id: "skeleton-mariachi-c1b4d5", height: 1.85, attack: "shoot", left: "longbow", carry: BOW_CARRY },
  cobra: { id: "dungeon-rat-cbb03c", height: 0.8 },
  mummy: { id: "shambling-ghoul-256f2f", height: 1.8 },
  reaper: { id: "hooded-cultist-8a488f", height: 2.05, attack: "cast" },
  vampire: { id: "tarantula-base", height: 1.9 },
  yeti: { id: "praying-mantis-base", height: 2 },
  frost: { id: "common-wasp-base", height: 1.2, fly: 0.9 },
  flame: { id: "velociraptor-base", height: 1.5 },
  imp: { id: "stag-beetle-base", height: 1.3 },
  skull: { id: "arthropleura-giant-millipede-7ade0b", height: 0.75 },
  demon: { id: "samurai-warrior-f2ebbe", height: 2.45 },
  dragon: { id: "tyrannosaurus-rex-adf79f", height: 3.6 },
};

export const PET_MODELS: Partial<Record<MonsterKey, UnitModel>> = {
  bat: { id: "crow-base", height: 0.42 },
  mushroom: { id: "leopard-slug-base", height: 0.32 },
  troll: { id: "black-bear-adbdc7", height: 0.62 },
  scorpion: { id: "owl-base", height: 0.42 },
  reaper: { id: "arched-black-cat-407cf6", height: 0.42 },
  mummy: { id: "dungeon-rat-cbb03c", height: 0.3 },
  yeti: { id: "mountain-hare-base", height: 0.45 },
  skull: { id: "seven-spot-ladybird-base", height: 0.3 },
  imp: { id: "red-fox-5c3bc0", height: 0.55 },
  dragon: { id: "compsognathus-base", height: 0.6 },
};

export const CHEST: Source = { id: "iron-banded-strongbox-698383" };

const s = (id: string, band: Band, weight = 1, extra: Partial<SceneryModel> = {}): SceneryModel => ({ id, band, weight, ...extra });

export const LOOKS: Record<Theme, Look> = {
  forest: {
    skyTop: 0x6fb7e8,
    skyBottom: 0xd8eef2,
    fog: 0xcfe6e6,
    ground: [0x7fae4c, 0x6d9c40, 0x8cbb57],
    lane: 0xc9b07a,
    sun: 0xfff1d6,
    sunIntensity: 2.6,
    ambient: 0xcfe8ff,
    ambientGround: 0x6b7b3a,
    ambientIntensity: 1.25,
    hills: 0x8fbf8a,
    scenery: [
      s("tall-pine-tree-ab4108", "back", 3),
      s("broadleaf-oak-997c22", "back", 2),
      s("birch-tree-181b33", "back", 2),
      s("maple-tree-65fa12", "back", 1),
      s("young-pine-0d7695", "back", 2),
      s("large-boulder-a29b99", "back", 1),
      s("round-bush-cd2ac0", "mid", 3),
      s("medium-rock-e08405", "mid", 2),
      s("fallen-log-1685fb", "mid", 1),
      s("tree-stump-ec3f48", "mid", 1),
      s("fern-plant-1559b8", "front", 3),
      s("grass-tuft-a40a08", "front", 4),
      s("toadstool-257a4a", "front", 1),
      s("wildflower-68d3a1", "front", 3),
    ],
  },
  crypt: {
    skyTop: 0x141220,
    skyBottom: 0x2b2238,
    fog: 0x1d1828,
    ground: [0x4a4552, 0x403b48, 0x56505e],
    lane: 0x5e5866,
    sun: 0xa9b8ff,
    sunIntensity: 0.9,
    ambient: 0x6c6290,
    ambientGround: 0x2a2030,
    ambientIntensity: 1.1,
    hills: 0x2a2436,
    wall: { id: "dungeon-wall-module-a537b3" },
    scenery: [
      s("standing-brazier-c9e4ee", "mid", 2, { light: 0xff9a3c }),
      s("stone-sarcophagus-cc96a4", "back", 2),
      s("standing-knight-statue-8bdcc9", "back", 1),
      s("carved-grave-stele-a1359c", "mid", 2),
      s("funerary-urn-688493", "mid", 2),
      s("clay-storage-pot-626452", "mid", 2),
      s("glowing-rune-stone-5a5558", "mid", 1, { light: 0x7fd8ff }),
      s("bone-scatter-90313d", "front", 3),
      s("candle-spike-cluster-d7c566", "front", 2, { light: 0xffc06a }),
      s("mushroom-cluster-18dc1d", "front", 2),
    ],
  },
  lair: {
    skyTop: 0x2a0f14,
    skyBottom: 0x8a3a1c,
    fog: 0x5a2618,
    ground: [0x5b4038, 0x4e362f, 0x684a3f],
    lane: 0x6e5246,
    sun: 0xffb27a,
    sunIntensity: 1.9,
    ambient: 0xff9a6a,
    ambientGround: 0x3a1a14,
    ambientIntensity: 0.9,
    hills: 0x4a2018,
    scenery: [
      s("giant-dragon-rib-0e42d9", "back", 1, { scale: 0.6 }),
      s("ancient-dragon-skull-7be378", "back", 1),
      s("crystal-veined-slab-375a56", "back", 2),
      s("claw-scored-boulder-c756f3", "back", 2),
      s("brood-nest-1d3e6b", "back", 1),
      s("crystal-shard-9e0a83", "mid", 3, { light: 0xff5ad0, scale: 4 }),
      s("geode-boulder-e8091d", "mid", 2),
      s("dragonfire-brazier-6bc2ce", "mid", 1, { light: 0xff7a2a }),
      s("bone-warning-totem-56cf4a", "mid", 1),
      s("ember-dragon-egg-0700c7", "front", 1),
      s("dragonsbane-thistle-9aaa05", "front", 3),
    ],
  },
  plague: {
    skyTop: 0x16201a,
    skyBottom: 0x3f5a35,
    fog: 0x34482c,
    ground: [0x4b5a36, 0x404e2e, 0x56663e],
    lane: 0x5c5a3e,
    sun: 0xd6ffb0,
    sunIntensity: 1.2,
    ambient: 0xa6d47a,
    ambientGround: 0x2a3020,
    ambientIntensity: 1,
    hills: 0x2e3e28,
    scenery: [
      s("twisted-dead-oak-49457b", "back", 3),
      s("weeping-stone-angel-644ce3", "back", 1),
      s("coffin-prop-d62082", "back", 1),
      s("carved-headstone-09d9f8", "mid", 3),
      s("grave-mound-169ec3", "mid", 2),
      s("cemetery-lantern-post-fed352", "mid", 1, { light: 0xc6ff7a }),
      s("bubbling-tripod-cauldron-124e15", "mid", 1, { light: 0x9dff5a }),
      s("bare-thorn-bush-91a238", "front", 3),
    ],
  },
};

function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

export function modelFile(source: Source): string {
  return `/models/${source.p ? `${source.id}-${hash(JSON.stringify(source.p))}` : source.id}.glb`;
}

export function allSources(): Source[] {
  const all: Source[] = [
    ...Object.values(WEAPONS),
    ...Object.values(HERO_MODELS),
    ...Object.values(MONSTER_MODELS),
    ...Object.values(PET_MODELS),
    CHEST,
    ...Object.values(LOOKS).flatMap((look) => [...look.scenery, ...(look.wall ? [look.wall] : [])]),
  ];
  return [...new Map(all.map((src) => [modelFile(src), { id: src.id, ...(src.p ? { p: src.p } : {}) }])).values()];
}
