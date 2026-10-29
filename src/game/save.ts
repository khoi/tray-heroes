import { newBattle } from "./combat";
import { migrateV1 } from "./migrate";
import { Save } from "./schema";
import { fail, ok, type GameState, type Result } from "./types";

export function serialize(state: GameState, now: number): string {
  const { battle: _battle, ...save } = state;
  return JSON.stringify({ ...save, savedAt: now } satisfies Save);
}

export function parseSave(raw: string): Result<GameState> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return fail("Save is not valid JSON");
  }
  const migrated = (json as { version?: unknown } | null)?.version === 1 ? migrateV1(json) : json;
  const parsed = Save.safeParse(migrated);
  if (!parsed.success) return fail(`Save does not match the schema: ${parsed.error.issues[0]?.message ?? "unknown"}`);
  const save = parsed.data;
  const placed = [...save.inventory, ...save.stash, ...Object.values(save.heroes).flatMap((h) => Object.values(h.equipment))];
  if (placed.some((id) => !save.items[id])) return fail("Save references a missing item");
  return ok({ ...save, battle: newBattle(save, save.location, 100) });
}
