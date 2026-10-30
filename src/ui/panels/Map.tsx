import { useState } from "react";
import { enterPlague, leavePlague, setAutoAdvance, travel } from "../../game/actions";
import { plagueUnlocked } from "../../game/cube";
import { material, type MaterialKey } from "../../game/data/materials";
import {
  ACTS,
  DIFFICULTIES,
  PLAGUE_MAX_CONTAMINATION,
  PLAGUE_MAX_INTENSITY,
  PLAGUE_MIN_CONTAMINATION,
  PLAGUE_SOUL_INTENSITY,
  RES_PENALTY,
  STAGES_PER_ACT,
  STAGES_PER_DIFFICULTY,
  areaInfo,
  stageInfo,
} from "../../game/data/world";
import { engine, useGame } from "../engine";
import { percent } from "../format";
import { Icon } from "../items";
import "./map.css";

function Plaguelands() {
  const state = useGame();
  const [intensity, setIntensity] = useState(Math.max(1, Math.min(state.plague.best + 1, PLAGUE_MAX_INTENSITY)));
  const inside = state.location.kind === "plague";
  const souls = state.materials.soulPlague ?? 0;
  if (!plagueUnlocked(state)) return <p className="muted">Clear Nightmare 1-10 to open the Plaguelands.</p>;
  const info = areaInfo({ kind: "plague", intensity, boss: false });
  return (
    <div className="plague">
      <div className="row">
        <b>Contamination</b>
        <div className="bar plague-bar grow" title={`${Math.floor(state.plague.contamination)} / ${PLAGUE_MAX_CONTAMINATION}`}>
          <span style={{ width: `${(state.plague.contamination / PLAGUE_MAX_CONTAMINATION) * 100}%` }} />
        </div>
        <span className="muted">{Math.floor(state.plague.contamination)}</span>
      </div>
      <p className="muted">
        Entering needs {PLAGUE_MIN_CONTAMINATION}. It drains while you fight here and refills slowly elsewhere, even offline. Corrode items in the Cube for more. Best cleared: intensity {state.plague.best}.
      </p>
      <div className="row">
        <label className="field">
          Intensity
          <select value={intensity} onChange={(e) => setIntensity(Number(e.target.value))}>
            {Array.from({ length: Math.min(PLAGUE_MAX_INTENSITY, state.plague.best + 1) }, (_, i) => i + 1).map((t) => (
              <option key={t} value={t}>
                {t} (monster level {areaInfo({ kind: "plague", intensity: t, boss: false }).level})
              </option>
            ))}
          </select>
        </label>
        <span className="muted">Resistance penalty {percent(info.resPenalty)}</span>
        {inside ? (
          <button type="button" onClick={() => engine.act(leavePlague)}>
            Leave the Plaguelands
          </button>
        ) : (
          <button type="button" className="primary" disabled={state.plague.contamination < PLAGUE_MIN_CONTAMINATION} onClick={() => engine.act((s) => enterPlague(s, intensity, false))}>
            Enter
          </button>
        )}
        <button
          type="button"
          disabled={intensity < PLAGUE_SOUL_INTENSITY || souls === 0 || state.plague.contamination < PLAGUE_MIN_CONTAMINATION}
          title={`Contaminated bosses appear from intensity ${PLAGUE_SOUL_INTENSITY} and cost a Contaminated Soulstone`}
          onClick={() => engine.act((s) => enterPlague(s, intensity, true))}
        >
          Contaminated boss ({souls} stone{souls === 1 ? "" : "s"})
        </button>
      </div>
    </div>
  );
}

export function MapPanel() {
  const state = useGame();
  const current = state.location.kind === "stage" ? state.location.index : -1;
  const [difficulty, setDifficulty] = useState(stageInfo(Math.max(0, current === -1 ? state.lastStage : current)).difficulty);
  const soul = `soul${difficulty}` as MaterialKey;
  return (
    <div className="map">
      <div className="row spread">
        <div className="subtabs">
          {DIFFICULTIES.map((name, d) => (
            <button key={name} type="button" className={d === difficulty ? "active" : ""} disabled={d * STAGES_PER_DIFFICULTY > state.unlockedStage} onClick={() => setDifficulty(d)}>
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
        {DIFFICULTIES[difficulty]} lowers every resistance by {percent(RES_PENALTY[difficulty] ?? 0)}. Act bosses need a{" "}
        <span className="inline-icon">
          <Icon sprite={material(soul).sprite} scale={1} />
        </span>
        {material(soul).name} (you have {state.materials[soul] ?? 0}) to drop their chest.
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
                  className={`stage ${index === current ? "current" : ""} ${info.isActBoss ? "boss" : ""}`}
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
      <h4 className="plague-title">Plaguelands</h4>
      <Plaguelands />
    </div>
  );
}
