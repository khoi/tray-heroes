import { useState } from "react";
import { setAutoAdvance, travel } from "../../game/actions";
import { ACTS, DIFFICULTIES, STAGES_PER_ACT, STAGES_PER_DIFFICULTY, stageInfo } from "../../game/data/world";
import { engine, useGame } from "../engine";

export function MapPanel() {
  const state = useGame();
  const [difficulty, setDifficulty] = useState(stageInfo(state.stage).difficulty);
  return (
    <div className="map">
      <div className="row">
        <div className="subtabs">
          {DIFFICULTIES.map((name, d) => (
            <button
              key={name}
              type="button"
              className={d === difficulty ? "active" : ""}
              disabled={d * STAGES_PER_DIFFICULTY > state.unlockedStage}
              onClick={() => setDifficulty(d)}
            >
              {name}
            </button>
          ))}
        </div>
        <label className="toggle">
          <input type="checkbox" checked={state.autoAdvance} onChange={(e) => engine.act((s) => setAutoAdvance(s, e.target.checked))} />
          Auto-advance
        </label>
      </div>
      <p className="muted">
        With auto-advance on, heroes push to the next stage after a clear and fall back one stage after a defeat. Turn it off to farm a single stage.
      </p>
      {ACTS.map((act, a) => (
        <div key={act.name} className="act-row">
          <h4>
            Act {a + 1}: {act.name}
          </h4>
          <div className="stage-buttons">
            {Array.from({ length: STAGES_PER_ACT }, (_, n) => {
              const index = difficulty * STAGES_PER_DIFFICULTY + a * STAGES_PER_ACT + n;
              const info = stageInfo(index);
              return (
                <button
                  key={index}
                  type="button"
                  className={`stage ${index === state.stage ? "current" : ""} ${info.isActBoss ? "boss" : ""}`}
                  disabled={index > state.unlockedStage}
                  onClick={() => engine.act((s) => travel(s, index))}
                  title={`Monster level ${info.level}`}
                >
                  {info.label}
                  <span className="muted">Lv {info.level}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
