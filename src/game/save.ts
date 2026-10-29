import { newBattle } from "./combat";
import { BASES } from "./data/items";
import { SKILLS, type SkillKey } from "./data/skills";
import { migrateV1 } from "./migrate";
import { CLASS_KEYS, Save } from "./schema";
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
  const broken = invariantError(parsed.data);
  if (broken) return fail(broken);
  return ok({ ...parsed.data, battle: newBattle(parsed.data, parsed.data.location, 100) });
}

function invariantError(save: Save): string | null {
  const placed = [...save.inventory, ...save.stash, ...Object.values(save.heroes).flatMap((h) => Object.values(h.equipment))];
  if (placed.some((id) => !save.items[id])) return "Save references a missing item";
  if (new Set(placed).size !== placed.length) return "An item is in two places at once";
  for (const cls of CLASS_KEYS) {
    const hero = save.heroes[cls];
    for (const [slot, id] of Object.entries(hero.equipment)) {
      const base = BASES[save.items[id]!.base];
      if (base.slot !== slot || (base.cls && base.cls !== cls)) return `${cls} wears an item in the wrong slot`;
    }
    const learned = Object.keys(hero.skills) as SkillKey[];
    if (learned.some((k) => SKILLS[k].cls !== cls)) return `${cls} knows another class's skill`;
    if (hero.slotted.some((k) => !hero.skills[k] || SKILLS[k].kind !== "active") || new Set(hero.slotted).size !== hero.slotted.length) return `${cls} has an invalid skill slot`;
  }
  if (save.party.some((cls) => !save.heroes[cls].unlocked) || new Set(save.party).size !== save.party.length) return "Party has an invalid hero";
  const relics = save.reliquary.flat().filter((id) => id !== null);
  if (relics.some((id) => !save.relics[id]) || new Set(relics).size !== relics.length) return "Reliquary references an invalid relic";
  return null;
}
