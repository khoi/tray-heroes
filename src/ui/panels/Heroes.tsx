import { recruit, setParty } from "../../game/actions";
import { unequip } from "../../game/actions";
import { CLASSES, CLASS_KEYS, type ClassKey } from "../../game/data/classes";
import { SLOTS, SLOT_LABEL } from "../../game/data/items";
import { areaInfo } from "../../game/data/world";
import { dps, heroStats, modifiers, partySize } from "../../game/stats";
import { xpToNext } from "../../game/tuning";
import { engine, useGame } from "../engine";
import { compact, percent } from "../format";
import { EmptyTile, ItemTile } from "../items";
import { Portrait } from "../Portrait";

export function HeroesPanel({ selected, onSelect }: { selected: ClassKey; onSelect: (cls: ClassKey) => void }) {
  const state = useGame();
  const mods = modifiers(state);
  const slots = partySize(mods);
  const hero = state.heroes[selected];
  const def = CLASSES[selected];
  const s = heroStats(state, selected, mods, {}, areaInfo(state.location).resPenalty);
  const position = state.party.indexOf(selected);
  const deployIn = Math.max(0, Math.ceil((state.deployReadyAt - state.time) / 1000));

  const rows: [string, string][] = [
    ["Damage per second", compact(dps(s, selected))],
    ["Attack", compact(s.attack)],
    ["Attacks per second", (1 / s.interval).toFixed(2)],
    ["Crit", `${percent(s.critChance)} ×${s.critMult.toFixed(2)}`],
    [`${def.damage[0]!.toUpperCase()}${def.damage.slice(1)} damage`, `×${s.dmg[def.damage].toFixed(2)}`],
    ["Life", compact(s.maxLife)],
    ["Armor", `${compact(s.armor)} (cap ${percent(s.armorCap)})`],
    ["Block / Dodge", `${percent(s.block)} / ${percent(s.dodge)}`],
    ["Damage reduction", percent(s.reduction)],
    ["Fire / Cold", `${percent(s.res.fire)} / ${percent(s.res.cold)}`],
    ["Lightning / Chaos", `${percent(s.res.lightning)} / ${percent(s.res.chaos)}`],
    ["Life leech / Regen", `${percent(s.leech)} / ${percent(s.regenPct)}`],
    ["Area / Cooldown", `${percent(s.area)} / ${percent(s.cooldown)}`],
    ["Healing / Status", `${percent(s.healPower)} / ${percent(s.statusChance)}`],
    ["Boss damage", percent(s.bossDmg)],
    ["Gold / Experience", `${percent(s.goldFind)} / ${percent(s.xpFind)}`],
  ];

  function move(to: number) {
    const next = state.party.filter((c) => c !== selected);
    next.splice(to, 0, selected);
    engine.act((st) => setParty(st, next));
  }

  return (
    <div className="heroes">
      <aside className="roster">
        <p className="muted">
          Party {state.party.length}/{slots}
          {deployIn > 0 && ` · next deploy in ${deployIn}s`}
        </p>
        {CLASS_KEYS.map((cls) => {
          const h = state.heroes[cls];
          const at = state.party.indexOf(cls);
          return (
            <button key={cls} type="button" className={`roster-row ${selected === cls ? "selected" : ""} ${h.unlocked ? "" : "locked"}`} onClick={() => onSelect(cls)}>
              <Portrait unit={cls} fallback={CLASSES[cls].sprite} scale={2} />
              <span className="roster-name">
                {CLASSES[cls].name}
                <span className="muted">{h.unlocked ? `Lv ${h.level}` : `${compact(CLASSES[cls].unlockCost)} gold`}</span>
              </span>
              {at >= 0 && <span className="tag">{at === 0 ? "Front" : `#${at + 1}`}</span>}
            </button>
          );
        })}
      </aside>
      <section className="hero-detail">
        <header className="hero-head">
          <Portrait unit={selected} fallback={def.sprite} scale={4} />
          <div className="grow">
            <h3>
              {def.name} <span className="muted">{hero.unlocked ? `Lv ${hero.level}` : "Not recruited"}</span>
            </h3>
            <p className="muted">{def.role}</p>
            {hero.unlocked && (
              <div className="bar xp" title={`${compact(hero.xp)} / ${compact(xpToNext(hero.level))} XP`}>
                <span style={{ width: `${Math.min(100, (hero.xp / xpToNext(hero.level)) * 100)}%` }} />
              </div>
            )}
            <div className="row">
              {!hero.unlocked && (
                <button type="button" className="primary" disabled={state.gold < def.unlockCost} onClick={() => engine.act((st) => recruit(st, selected), () => `${def.name} joined`)}>
                  Recruit for {compact(def.unlockCost)} gold
                </button>
              )}
              {hero.unlocked && position < 0 && (
                <button type="button" disabled={state.party.length >= slots} onClick={() => engine.act((st) => setParty(st, [...st.party, selected]))}>
                  {state.party.length >= slots ? "Party is full" : "Add to party"}
                </button>
              )}
              {position > 0 && (
                <button type="button" onClick={() => move(0)}>
                  Move to front
                </button>
              )}
              {position >= 0 && position < state.party.length - 1 && (
                <button type="button" onClick={() => move(position + 1)}>
                  Move back
                </button>
              )}
              {position >= 0 && state.party.length > 1 && (
                <button type="button" onClick={() => engine.act((st) => setParty(st, st.party.filter((c) => c !== selected)))}>
                  Bench
                </button>
              )}
            </div>
          </div>
        </header>
        {hero.unlocked && (
          <div className="hero-body">
            <div className="equipment">
              {SLOTS.map((slot) => {
                const id = hero.equipment[slot];
                const item = id === undefined ? undefined : state.items[id];
                return (
                  <div key={slot} className="equip-slot">
                    {item ? <ItemTile item={item} onClick={() => engine.act((st) => unequip(st, selected, slot))} /> : <EmptyTile label={SLOT_LABEL[slot]} />}
                  </div>
                );
              })}
            </div>
            <dl className="stats">
              {rows.map(([k, v]) => (
                <div key={k} className="stat-row">
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>
    </div>
  );
}
