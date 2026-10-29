import { setParty, unequip } from "../../game/actions";
import { CLASSES } from "../../game/data/classes";
import { CLASS_KEYS, SLOTS, type ClassKey, type Slot } from "../../game/schema";
import { dps, heroStats, modifiers, partySize } from "../../game/stats";
import { xpToNext } from "../../game/tuning";
import { engine, useGame } from "../engine";
import { compact, percent } from "../format";
import { EmptyTile, ItemTile } from "../items";
import { Portrait } from "../Portrait";

const SLOT_LABEL: Record<Slot, string> = { weapon: "Weapon", helmet: "Helm", armor: "Chest", boots: "Boots", ring: "Ring", amulet: "Amulet" };

export function PartyPanel({ selected, onSelect }: { selected: ClassKey; onSelect: (cls: ClassKey) => void }) {
  const state = useGame();
  const mods = modifiers(state);
  const slots = partySize(mods);

  function toggle(cls: ClassKey) {
    const party = state.party.includes(cls) ? state.party.filter((c) => c !== cls) : [...state.party, cls];
    engine.act((s) => setParty(s, party));
  }

  function moveFront(cls: ClassKey) {
    engine.act((s) => setParty(s, [cls, ...s.party.filter((c) => c !== cls)]));
  }

  return (
    <div className="party">
      <p className="muted">
        Party slots {state.party.length}/{slots}. The hero in front takes the hits. Unlock more slots with the Fellowship runes.
      </p>
      <div className="hero-grid">
        {CLASS_KEYS.map((cls) => {
          const def = CLASSES[cls];
          const hero = state.heroes[cls];
          const stats = heroStats(state, cls, mods);
          const position = state.party.indexOf(cls);
          const need = xpToNext(hero.level);
          return (
            <article
              key={cls}
              className={`hero-card ${selected === cls ? "selected" : ""} ${position < 0 ? "benched" : ""}`}
              onClick={() => onSelect(cls)}
            >
              <header>
                <Portrait unit={cls} fallback={def.sprite} />
                <div>
                  <h3>
                    {def.name} <span className="muted">Lv {hero.level}</span>
                  </h3>
                  <div className="muted">{def.role}</div>
                  <div className="bar xp" title={`${compact(hero.xp)} / ${compact(need)} XP`}>
                    <span style={{ width: `${Math.min(100, (hero.xp / need) * 100)}%` }} />
                  </div>
                </div>
              </header>
              <dl className="stats">
                <dt>DPS</dt>
                <dd>{compact(dps(stats))}</dd>
                <dt>Life</dt>
                <dd>{compact(stats.maxHp)}</dd>
                <dt>Armor</dt>
                <dd>{compact(stats.armor)}</dd>
                <dt>Crit</dt>
                <dd>
                  {percent(stats.critChance)} ×{(1 + stats.critDamage).toFixed(2)}
                </dd>
                <dt>Skill</dt>
                <dd>
                  {def.skill.name} every {def.skill.every} hits
                </dd>
              </dl>
              <div className="equipment">
                {SLOTS.map((slot) => {
                  const id = hero.equipment[slot];
                  const item = id === undefined ? undefined : state.items[id];
                  return item ? (
                    <ItemTile key={slot} item={item} onClick={() => engine.act((s) => unequip(s, cls, slot))} />
                  ) : (
                    <EmptyTile key={slot} label={SLOT_LABEL[slot]} />
                  );
                })}
              </div>
              <footer onClick={(e) => e.stopPropagation()}>
                {position >= 0 ? (
                  <>
                    <span className="tag">{position === 0 ? "Front" : `Slot ${position + 1}`}</span>
                    {position > 0 && (
                      <button type="button" onClick={() => moveFront(cls)}>
                        Move to front
                      </button>
                    )}
                    {state.party.length > 1 && (
                      <button type="button" onClick={() => toggle(cls)}>
                        Bench
                      </button>
                    )}
                  </>
                ) : (
                  <button type="button" onClick={() => toggle(cls)} disabled={state.party.length >= slots}>
                    {state.party.length >= slots ? "No free slot" : "Add to party"}
                  </button>
                )}
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}
