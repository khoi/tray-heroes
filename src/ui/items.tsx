import type { CSSProperties, ReactNode } from "react";
import { CLASSES, CLASS_KEYS } from "../game/data/classes";
import { grade } from "../game/data/grades";
import { BASES, UNIQUES } from "../game/data/items";
import { material, type MaterialKey } from "../game/data/materials";
import { STATS, type StatKey } from "../game/data/stats";
import { alchemyValue, itemName } from "../game/loot";
import type { ClassKey, Item, Save } from "../game/schema";
import { heroStats, itemMain, modifiers, power } from "../game/stats";
import type { SpriteRef } from "../game/types";
import { compact, percent } from "./format";
import { spriteStyle } from "./sprites";

export function Icon({ sprite, scale = 2, className }: { sprite: SpriteRef; scale?: number; className?: string }) {
  return <span className={`icon ${className ?? ""}`} style={spriteStyle(sprite, scale)} aria-hidden />;
}

export function statText(stat: StatKey, value: number): string {
  const def = STATS[stat];
  return def.percent ? `+${percent(value)} ${def.label}` : `+${compact(value)} ${def.label}`;
}

export function ItemTile({ item, selected, onClick, badge }: { item: Item; selected?: boolean; onClick?: () => void; badge?: ReactNode }) {
  const filled = [...item.sockets.decoration, ...item.sockets.engraving, ...item.sockets.inscription].filter((s) => s !== null).length;
  return (
    <button
      type="button"
      className={`item-tile ${selected ? "selected" : ""} ${item.unique ? "unique" : ""}`}
      style={{ "--grade": grade(item.grade).color } as CSSProperties}
      onClick={onClick}
      title={itemName(item)}
      aria-label={`${itemName(item)}, level ${item.level}${item.locked ? ", locked" : ""}`}
    >
      <Icon sprite={BASES[item.base].sprite} />
      <span className="item-level">{item.level}</span>
      {item.locked && <span className="item-lock">L</span>}
      {filled > 0 && <span className="item-gems">{"◆".repeat(filled)}</span>}
      {badge}
    </button>
  );
}

export function EmptyTile({ label, onClick }: { label?: string; onClick?: () => void }) {
  return (
    <button type="button" className="item-tile empty" onClick={onClick} disabled={!onClick}>
      {label && <span className="empty-label">{label}</span>}
    </button>
  );
}

export function MaterialChip({ id, count, onClick, selected }: { id: MaterialKey; count?: number; onClick?: () => void; selected?: boolean }) {
  const info = material(id);
  return (
    <button type="button" className={`material-chip ${selected ? "selected" : ""}`} onClick={onClick} disabled={!onClick} title={info.name}>
      <Icon sprite={info.sprite} scale={1.5} />
      <span>{info.name}</span>
      {count !== undefined && <span className="muted">×{count}</span>}
    </button>
  );
}

function socketLines(item: Item): { kind: string; text: string | null }[] {
  const out: { kind: string; text: string | null }[] = [];
  for (const gem of item.sockets.decoration) {
    const info = gem ? material(gem) : null;
    out.push({ kind: "Gem", text: info && info.kind === "gem" ? `${info.name}: ${statText(info.stat, info.value)}` : null });
  }
  for (const part of item.sockets.engraving) {
    const info = part ? material(part) : null;
    out.push({
      kind: "Engraving",
      text: info && info.kind === "part" ? `${info.name}: ${Object.entries(info.stats).map(([k, v]) => statText(k as StatKey, v)).join(", ")}` : null,
    });
  }
  for (const affix of item.sockets.inscription) out.push({ kind: "Inscription", text: affix ? statText(affix.stat, affix.value) : null });
  return out;
}

export function ItemDetails({ item, children }: { item: Item; children?: ReactNode }) {
  const base = BASES[item.base];
  const g = grade(item.grade);
  const main = itemMain(item);
  const unique = item.unique ? UNIQUES[item.unique] : null;
  const sockets = socketLines(item);
  return (
    <div className="item-details" style={{ "--grade": g.color } as CSSProperties}>
      <div className="item-head">
        <ItemTile item={item} />
        <div>
          <div className="item-name">{itemName(item)}</div>
          <div className="muted">
            {g.name} {base.name} · item level {item.level} · {base.cls ? `${CLASSES[base.cls].name} only` : "any hero"}
          </div>
        </div>
      </div>
      <ul className="stat-list">
        {(Object.entries(main) as [StatKey, number][]).map(([k, v]) => (
          <li key={k}>{statText(k, v)}</li>
        ))}
        {(Object.entries(base.implicit) as [StatKey, number][]).map(([k, v]) => (
          <li key={`i-${k}`}>{statText(k, v * (1 + 0.1 * item.grade))}</li>
        ))}
        {item.affixes.map((a, i) => (
          <li key={`a-${i}`} className="affix">
            {statText(a.stat, a.value)}
          </li>
        ))}
        {unique && (
          <li className="unique-line">
            {unique.text} {(Object.entries(unique.stats) as [StatKey, number][]).map(([k, v]) => statText(k, v)).join(", ")}
          </li>
        )}
      </ul>
      {sockets.length > 0 && (
        <ul className="socket-list">
          {sockets.map((s, i) => (
            <li key={i} className={s.text ? "filled" : ""}>
              <span className="socket-dot" /> {s.text ?? `Empty ${s.kind.toLowerCase()} socket`}
            </li>
          ))}
        </ul>
      )}
      <div className="muted">Alchemy value {compact(alchemyValue(item))} gold</div>
      {children}
    </div>
  );
}

export function compareEquip(state: Save, cls: ClassKey, item: Item): number | null {
  const base = BASES[item.base];
  if (base.cls && base.cls !== cls) return null;
  const mods = modifiers(state);
  const before = power(heroStats(state, cls, mods), cls);
  const hero = state.heroes[cls];
  const trial: Save = { ...state, heroes: { ...state.heroes, [cls]: { ...hero, equipment: { ...hero.equipment, [base.slot]: item.id } } } };
  const after = power(heroStats(trial, cls, mods), cls);
  return before > 0 ? after / before - 1 : 0;
}

export function eligibleHeroes(state: Save, item: Item): ClassKey[] {
  const cls = BASES[item.base].cls;
  return CLASS_KEYS.filter((c) => state.heroes[c].unlocked && (!cls || cls === c));
}

export function Delta({ value }: { value: number }) {
  const sign = value > 0.001 ? "up" : value < -0.001 ? "down" : "same";
  return (
    <span className={`delta ${sign}`}>
      {sign === "up" ? "▲" : sign === "down" ? "▼" : "="} {percent(Math.abs(value))} power
    </span>
  );
}
