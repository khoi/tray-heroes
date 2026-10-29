import { setParty } from "./actions";
import { newGame } from "./game";
import { CLASS_KEYS, type Chest } from "./schema";
import type { GameState } from "./types";

export const SANDBOX_GOLD = 10_000_000_000;

export function sandboxGame(seed: number, now: number): GameState {
  const state = newGame(seed, now);
  state.gold = SANDBOX_GOLD;
  state.runes.fellowship1 = 1;
  state.runes.fellowship2 = 1;
  setParty(state, CLASS_KEYS);
  const chests: Chest[] = [
    ...Array.from({ length: 10 }, (): Chest => ({ kind: "common", level: 1 })),
    ...Array.from({ length: 5 }, (): Chest => ({ kind: "boss", level: 1 })),
    ...Array.from({ length: 3 }, (): Chest => ({ kind: "act", level: 1 })),
  ];
  state.chests.push(...chests);
  return state;
}
