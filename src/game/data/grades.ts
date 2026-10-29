export interface GradeDef {
  name: string;
  color: string;
  power: number;
  affixes: number;
  sockets: [decoration: number, engraving: number, inscription: number];
  alchemy: number;
  dust: number;
  synth: { stay: number; skip: number; fee: number } | null;
  weights: { common: number; boss: number; act: number };
}

export const GRADES: readonly GradeDef[] = [
  { name: "Common", color: "#c9c4bd", power: 1, affixes: 0, sockets: [0, 0, 0], alchemy: 10, dust: 1, synth: { stay: 0, skip: 0.048, fee: 0 }, weights: { common: 70, boss: 0, act: 0 } },
  { name: "Uncommon", color: "#6fd36a", power: 1.25, affixes: 1, sockets: [1, 0, 0], alchemy: 30, dust: 2, synth: { stay: 0, skip: 0.038, fee: 50 }, weights: { common: 22, boss: 50, act: 0 } },
  { name: "Rare", color: "#4ea7ff", power: 1.55, affixes: 2, sockets: [1, 1, 0], alchemy: 90, dust: 4, synth: { stay: 0, skip: 0.024, fee: 200 }, weights: { common: 6.5, boss: 33, act: 60 } },
  { name: "Legendary", color: "#ffa23a", power: 1.95, affixes: 3, sockets: [2, 2, 0], alchemy: 270, dust: 8, synth: { stay: 0, skip: 0.0099, fee: 800 }, weights: { common: 1.3, boss: 12, act: 28 } },
  { name: "Immortal", color: "#ff5a6e", power: 2.45, affixes: 3, sockets: [2, 2, 1], alchemy: 810, dust: 16, synth: { stay: 0.2, skip: 0.0025, fee: 3_200 }, weights: { common: 0.18, boss: 3.5, act: 9 } },
  { name: "Arcana", color: "#c56bff", power: 3.1, affixes: 4, sockets: [3, 2, 1], alchemy: 2_592, dust: 32, synth: { stay: 0.5, skip: 0.0017, fee: 12_800 }, weights: { common: 0.02, boss: 0.9, act: 2.5 } },
  { name: "Beyond", color: "#5ff0e6", power: 3.9, affixes: 4, sockets: [3, 2, 2], alchemy: 8_294, dust: 64, synth: { stay: 0.77, skip: 0.0008, fee: 40_000 }, weights: { common: 0, boss: 0.2, act: 0.6 } },
  { name: "Celestial", color: "#fff27a", power: 4.9, affixes: 5, sockets: [3, 2, 2], alchemy: 29_029, dust: 128, synth: { stay: 0.83, skip: 0.0002, fee: 120_000 }, weights: { common: 0, boss: 0.04, act: 0.15 } },
  { name: "Divine", color: "#ffffff", power: 6.2, affixes: 5, sockets: [3, 2, 2], alchemy: 101_602, dust: 256, synth: { stay: 0.91, skip: 0, fee: 400_000 }, weights: { common: 0, boss: 0.008, act: 0.04 } },
  { name: "Cosmic", color: "#ff7ad9", power: 7.8, affixes: 6, sockets: [3, 2, 2], alchemy: 355_607, dust: 512, synth: null, weights: { common: 0, boss: 0.001, act: 0.01 } },
];

export const MAX_GRADE = GRADES.length - 1;
export const UNIQUE_MIN_GRADE = 5;

export function grade(index: number): GradeDef {
  const g = GRADES[index];
  if (!g) throw new Error(`unknown grade ${index}`);
  return g;
}

export function gradeCap(difficulty: number, act: number): number {
  if (difficulty >= 2 && act >= 1) return 9;
  if (difficulty >= 1 && act >= 2) return 8;
  if (difficulty >= 1) return 7;
  return 6;
}
