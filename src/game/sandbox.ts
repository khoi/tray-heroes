import { setParty } from "./actions";
import { CLASSES, CLASS_KEYS } from "./data/classes";
import { GEM_KEYS, PARTS, type MaterialKey } from "./data/materials";
import { starterSkill } from "./data/skills";
import { newGame } from "./game";
import { createItem } from "./loot";
import type { Chest } from "./schema";
import type { GameState } from "./types";

export const SANDBOX_GOLD = 10_000_000_000;

export function sandboxGame(seed: number, now: number): GameState {
  const state = newGame(seed, now);
  state.gold = SANDBOX_GOLD;
  state.runes.command1 = 1;
  state.runes.command2 = 1;
  state.runes.awakening1 = 1;
  for (const cls of CLASS_KEYS) {
    const hero = state.heroes[cls];
    hero.unlocked = true;
    if (!hero.equipment.mainWeapon) hero.equipment.mainWeapon = createItem(state, 1, 0, CLASSES[cls].main).id;
    hero.skills[starterSkill(cls)] = 1;
    hero.slotted = [starterSkill(cls)];
  }
  setParty(state, ["knight", "ranger", "mage"]);
  const chest = (kind: Chest["kind"]): Chest => ({ kind, level: 1, cap: 6, difficulty: 0, plague: false });
  state.chests.push(...Array.from({ length: 10 }, () => chest("common")), ...Array.from({ length: 5 }, () => chest("boss")), ...Array.from({ length: 3 }, () => chest("act")));
  const stock: MaterialKey[] = [...GEM_KEYS, ...(Object.keys(PARTS) as MaterialKey[]), "scroll1", "scroll2", "scroll3", "soul0", "soul1"];
  for (const key of stock) state.materials[key] = 5;
  state.materials.dust = 500;
  state.cube = { level: 25, xp: 0 };
  state.deployReadyAt = 0;
  return state;
}
