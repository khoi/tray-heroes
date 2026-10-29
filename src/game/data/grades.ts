export interface GradeDef {
  name: string;
  color: string;
  power: number;
  affixes: number;
  alchemy: number;
  synth: { stay: number; skip: number; fee: number } | null;
  weights: { common: number; boss: number; act: number };
}

export const GRADES: readonly GradeDef[] = [
  { name: "Common", color: "#c9c4bd", power: 1, affixes: 0, alchemy: 10, synth: { stay: 0, skip: 0.048, fee: 0 }, weights: { common: 70, boss: 0, act: 0 } },
  { name: "Uncommon", color: "#6fd36a", power: 1.25, affixes: 1, alchemy: 30, synth: { stay: 0, skip: 0.038, fee: 50 }, weights: { common: 22, boss: 55, act: 0 } },
  { name: "Rare", color: "#4ea7ff", power: 1.55, affixes: 2, alchemy: 90, synth: { stay: 0, skip: 0.024, fee: 200 }, weights: { common: 6.5, boss: 32, act: 70 } },
  { name: "Epic", color: "#b97bff", power: 1.95, affixes: 3, alchemy: 270, synth: { stay: 0, skip: 0.0099, fee: 800 }, weights: { common: 1.3, boss: 10, act: 23 } },
  { name: "Legendary", color: "#ffa23a", power: 2.45, affixes: 3, alchemy: 810, synth: { stay: 0.2, skip: 0.0025, fee: 3200 }, weights: { common: 0.18, boss: 2.5, act: 6 } },
  { name: "Mythic", color: "#ff5a6e", power: 3.1, affixes: 4, alchemy: 2600, synth: { stay: 0.5, skip: 0, fee: 12800 }, weights: { common: 0.02, boss: 0.45, act: 0.9 } },
  { name: "Celestial", color: "#62f0e3", power: 4, affixes: 4, alchemy: 8300, synth: null, weights: { common: 0, boss: 0.05, act: 0.1 } },
];

export const MAX_GRADE = GRADES.length - 1;

export function grade(index: number): GradeDef {
  const g = GRADES[index];
  if (!g) throw new Error(`unknown grade ${index}`);
  return g;
}
