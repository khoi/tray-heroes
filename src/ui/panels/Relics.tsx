import { useState } from "react";
import { placeRelic } from "../../game/actions";
import { attune, attuneCost, relicsUnlocked } from "../../game/cube";
import { grade } from "../../game/data/grades";
import { MATCH_BONUS, RELIQUARIES, type RelicColor } from "../../game/data/relics";
import type { Relic, RelicId } from "../../game/schema";
import { engine, useGame } from "../engine";
import { compact } from "../format";
import { statText } from "../items";
import "./relics.css";

const COLOR: Record<RelicColor, string> = { red: "#ff6b6b", green: "#6fd36a", blue: "#62c3ff" };

function RelicCard({ relic, selected, onClick }: { relic: Relic; selected?: boolean; onClick?: () => void }) {
  return (
    <button type="button" className={`relic ${selected ? "selected" : ""}`} style={{ borderColor: COLOR[relic.color] }} onClick={onClick}>
      <span className="relic-gem" style={{ background: COLOR[relic.color] }} />
      <span style={{ color: grade(relic.grade).color }}>{grade(relic.grade).name} relic</span>
      <ul className="stat-list">
        {relic.stats.map((a, i) => (
          <li key={i}>{statText(a.stat, a.value)}</li>
        ))}
      </ul>
    </button>
  );
}

export function RelicsPanel() {
  const state = useGame();
  const [focus, setFocus] = useState<RelicId | null>(null);
  if (!relicsUnlocked(state)) return <p className="muted">Clear the Plaguelands once to unlock relics. They drop from Plaguelands boss and act chests.</p>;
  const relics = Object.values(state.relics);
  const placed = new Set(state.reliquary.flat().filter((id): id is RelicId => id !== null));
  const chosen = focus === null ? undefined : state.relics[focus];
  return (
    <div className="relics">
      <p className="muted">Relics give the whole party their stats. A relic in a slot of its own color counts ×{MATCH_BONUS}.</p>
      <div className="reliquaries">
        {RELIQUARIES.map((def, r) => {
          const open = state.plague.best >= def.unlockIntensity;
          return (
            <section key={def.name} className={`reliquary ${open ? "" : "closed"}`}>
              <h4>{def.name}</h4>
              {!open && <p className="muted">Clear Plaguelands intensity {def.unlockIntensity}</p>}
              <div className="relic-slots">
                {def.slots.map((color, s) => {
                  const id = state.reliquary[r]?.[s] ?? null;
                  const relic = id === null ? undefined : state.relics[id];
                  return (
                    <button
                      key={s}
                      type="button"
                      className="relic-slot"
                      style={{ borderColor: COLOR[color] }}
                      disabled={!open}
                      onClick={() => engine.act((st) => placeRelic(st, r, s, relic ? null : (focus ?? null)))}
                      title={relic ? "Remove relic" : "Place the selected relic"}
                    >
                      {relic ? relic.stats.map((a) => statText(a.stat, a.value * (relic.color === color ? MATCH_BONUS : 1))).join(" · ") : <span className="muted">Empty {color} slot</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <div className="relic-list">
        {relics.length === 0 && <p className="muted">No relics yet.</p>}
        {relics.map((relic) => (
          <div key={relic.id} className={placed.has(relic.id) ? "placed" : ""}>
            <RelicCard relic={relic} selected={focus === relic.id} onClick={() => setFocus(relic.id)} />
          </div>
        ))}
      </div>
      {chosen && (
        <div className="row">
          <button type="button" onClick={() => engine.act((s) => attune(s, chosen.id), (cost) => `Attuned for ${compact(cost)} gold`)}>
            Attune (reroll) for {compact(attuneCost(chosen.attunements))} gold
          </button>
          <span className="muted">Select a relic, then click an empty slot to place it.</span>
        </div>
      )}
    </div>
  );
}
