import { MONSTERS } from "../../game/data/world";
import { PETS } from "../../game/data/pets";
import { useGame } from "../engine";
import { compact, percent } from "../format";
import { Icon } from "../items";

const BONUS: Record<(typeof PETS)[number]["bonus"], string> = {
  xp: "experience",
  gold: "gold",
  commonChest: "chest drop chance",
  bossChest: "boss chest chance",
  hpPct: "life",
  atkPct: "attack",
};

export function PetsPanel() {
  const state = useGame();
  return (
    <div className="pets">
      <p className="muted">Hunt a monster type enough times and it joins you. Pet bonuses apply to the whole party.</p>
      {PETS.map((pet) => {
        const kills = state.kills[pet.hunt] ?? 0;
        const done = kills >= pet.kills;
        return (
          <div key={pet.name} className={`pet ${done ? "done" : ""}`}>
            <Icon sprite={pet.sprite} scale={3} className={done ? "" : "silhouette"} />
            <div>
              <h4>
                {pet.name} <span className="muted">+{percent(pet.amount)} {BONUS[pet.bonus]}</span>
              </h4>
              <div className="muted">
                Defeat {compact(pet.kills)} {MONSTERS[pet.hunt].name}s: {compact(Math.min(kills, pet.kills))}/{compact(pet.kills)}
              </div>
              <div className="bar">
                <span style={{ width: `${Math.min(100, (kills / pet.kills) * 100)}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
