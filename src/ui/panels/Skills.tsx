import { useState } from "react";
import { learnSkill, resetSkills, skillPoints, skillTierOpen, slotSkill } from "../../game/actions";
import { CLASSES, CLASS_KEYS, type ClassKey } from "../../game/data/classes";
import { SKILLS, TIER_POINTS, classSkills, maxLevel, type Effect, type SkillKey } from "../../game/data/skills";
import type { StatKey } from "../../game/data/stats";
import { modifiers, skillSlots } from "../../game/stats";
import { engine, useGame } from "../engine";
import { percent } from "../format";
import { statText } from "../items";

function effectText(effect: Effect, level: number): string {
  const at = (base: number, per: number) => base + per * (Math.max(1, level) - 1);
  switch (effect.kind) {
    case "hit":
      return `${percent(at(effect.mult, effect.per))} damage to ${effect.target === "front" ? "the front enemy" : effect.target === "all" ? "all enemies" : "3 random enemies"}${effect.type ? ` as ${effect.type}` : ""}${effect.status ? `, ${percent(effect.chance ?? 0)} to ${effect.status}` : ""}${effect.crit ? ", always crits" : ""}`;
    case "trap":
      return `Trap after ${effect.delay}s: ${percent(at(effect.mult, effect.per))} damage to ${effect.target === "all" ? "all enemies" : "the front enemy"}${effect.status ? `, ${effect.status}` : ""}`;
    case "heal":
      return `Heal ${effect.target === "party" ? "the party" : "the weakest ally"} for ${percent(at(effect.pct, effect.per))} of max life`;
    case "buff":
      return `${effect.target === "party" ? "Party" : "Self"}: ${statText(effect.stat, at(effect.amount, effect.per))} for ${effect.seconds}s`;
    case "taunt":
      return `Taunt enemies for ${effect.seconds}s`;
    case "revive":
      return `Revive a fallen ally at ${percent(at(effect.pct, effect.per))} life`;
  }
}

export function SkillsPanel({ selected, onSelect }: { selected: ClassKey; onSelect: (cls: ClassKey) => void }) {
  const state = useGame();
  const [focus, setFocus] = useState<SkillKey | null>(null);
  const hero = state.heroes[selected];
  const points = skillPoints(state, selected);
  const slots = skillSlots(modifiers(state));
  const keys = classSkills(selected);
  const tiers = Array.from({ length: 8 }, (_, t) => keys.filter((k) => SKILLS[k].tier === t));
  const shown = focus && SKILLS[focus].cls === selected ? focus : keys[0]!;
  const def = SKILLS[shown];
  const level = hero.skills[shown] ?? 0;

  return (
    <div className="skills">
      <div className="subtabs row tight">
        {CLASS_KEYS.filter((c) => state.heroes[c].unlocked).map((cls) => (
          <button key={cls} type="button" className={cls === selected ? "active" : ""} onClick={() => onSelect(cls)}>
            {CLASSES[cls].name}
          </button>
        ))}
      </div>
      {!hero.unlocked ? (
        <p className="muted">Recruit the {CLASSES[selected].name} in the Heroes tab first.</p>
      ) : (
        <div className="skills-body">
          <div className="skill-tree">
            <div className="skill-summary">
              <span>
                <b>{points.free}</b> points free · {points.spent} spent
              </span>
              <span className="muted">Each tier opens after {TIER_POINTS} more points.</span>
              <button type="button" onClick={() => engine.act((s) => resetSkills(s, selected), () => "Skills reset")}>
                Reset
              </button>
            </div>
            {tiers.map((row, t) => {
              const open = skillTierOpen(state, selected, t);
              return (
                <div key={t} className={`tier ${open ? "" : "closed"}`}>
                  <span className="tier-label">{t * TIER_POINTS}</span>
                  {row.map((key) => {
                    const skill = SKILLS[key];
                    const lv = hero.skills[key] ?? 0;
                    const slotted = hero.slotted.indexOf(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`skill ${skill.kind} ${lv > 0 ? "learned" : ""} ${shown === key ? "focus" : ""}`}
                        onClick={() => setFocus(key)}
                        onDoubleClick={() => engine.act((s) => learnSkill(s, selected, key))}
                      >
                        <span className="skill-name">{skill.name}</span>
                        <span className="skill-level">
                          {lv}/{maxLevel(key)}
                        </span>
                        {slotted >= 0 && <span className="slot-badge">{slotted + 1}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <aside className="skill-side">
            <h3>{def.name}</h3>
            <p className="muted">
              {def.kind === "active" ? ("cooldown" in def.trigger ? `Active · every ${def.trigger.cooldown}s` : `Active · every ${def.trigger.every} attacks`) : "Passive"} · Tier {def.tier}
            </p>
            {def.kind === "active" ? (
              <>
                <p>{def.text}</p>
                <ul className="stat-list">
                  {def.effects.map((e, i) => (
                    <li key={i}>{effectText(e, level)}</li>
                  ))}
                </ul>
              </>
            ) : (
              <ul className="stat-list">
                {(Object.entries(def.stats) as [StatKey, number][]).map(([k, v]) => (
                  <li key={k}>
                    {statText(k, v * Math.max(1, level))} {level > 0 ? "now" : "at level 1"}
                  </li>
                ))}
              </ul>
            )}
            <p className="muted">
              Level {level}/{maxLevel(shown)}
            </p>
            <div className="row">
              <button type="button" className="primary" onClick={() => engine.act((s) => learnSkill(s, selected, shown))} disabled={points.free <= 0 || level >= maxLevel(shown)}>
                Learn
              </button>
              {def.kind === "active" &&
                level > 0 &&
                Array.from({ length: slots }, (_, i) => (
                  <button key={i} type="button" className={hero.slotted[i] === shown ? "active" : ""} onClick={() => engine.act((s) => slotSkill(s, selected, shown, i))}>
                    Slot {i + 1}
                  </button>
                ))}
            </div>
            <p className="muted">
              Active slots: {hero.slotted.map((k) => SKILLS[k].name).join(", ") || "none"} ({slots} available). Double-click a skill to learn it.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
