import type { CSSProperties, ReactNode } from "react";
import { CLASSES } from "../game/data/classes";
import { grade } from "../game/data/grades";
import { AFFIXES, BASES } from "../game/data/items";
import { alchemyValue, itemName } from "../game/loot";
import type { ClassKey, Item, Save } from "../game/schema";
import { dps, heroStats, itemMain, modifiers } from "../game/stats";
import type { SpriteRef } from "../game/types";
import { compact, percent } from "./format";
import { spriteStyle } from "./sprites";

export function Icon({ sprite, scale = 2, className }: { sprite: SpriteRef; scale?: number; className?: string }) {
  return <span className={`icon ${className ?? ""}`} style={spriteStyle(sprite, scale)} aria-hidden />;
}

export function itemSprite(item: Item): SpriteRef {
  const sprites = BASES[item.base].sprites;
  return sprites[Math.min(item.grade, sprites.length - 1)]!;
}

export function ItemTile({
  item,
  selected,
  onClick,
  badge,
}: {
  item: Item;
  selected?: boolean;
  onClick?: () => void;
  badge?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`item-tile ${selected ? "selected" : ""}`}
      style={{ "--grade": grade(item.grade).color } as CSSProperties}
      onClick={onClick}
      title={itemName(item)}
      aria-label={`${itemName(item)}, level ${item.level}${item.locked ? ", locked" : ""}`}
    >
      <Icon sprite={itemSprite(item)} />
      <span className="item-level">{item.level}</span>
      {item.locked && <span className="item-lock">L</span>}
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

function statLines(item: Item): string[] {
  const lines: string[] = [];
  const main = itemMain(item);
  if (main.atk) lines.push(`+${compact(main.atk)} Attack`);
  if (main.hp) lines.push(`+${compact(main.hp)} Life`);
  if (main.armor) lines.push(`+${compact(main.armor)} Armor`);
  return lines;
}

function affixLines(item: Item): string[] {
  return item.affixes.map((a) => {
    const def = AFFIXES[a.stat];
    return def.percent ? `+${percent(a.value)} ${def.label}` : `+${compact(a.value)} ${def.label}`;
  });
}

export function ItemDetails({ item, children }: { item: Item; children?: ReactNode }) {
  const base = BASES[item.base];
  const g = grade(item.grade);
  return (
    <div className="item-details" style={{ "--grade": g.color } as CSSProperties}>
      <div className="item-head">
        <ItemTile item={item} />
        <div>
          <div className="item-name">{itemName(item)}</div>
          <div className="muted">
            Item level {item.level} · {base.cls ? `${CLASSES[base.cls].name} only` : `Any hero`}
          </div>
        </div>
      </div>
      <ul className="stat-list">
        {statLines(item).map((l) => (
          <li key={l}>{l}</li>
        ))}
        {affixLines(item).map((l, i) => (
          <li key={`${l}${i}`} className="affix">
            {l}
          </li>
        ))}
      </ul>
      <div className="muted">Alchemy value {compact(alchemyValue(item))} gold</div>
      {children}
    </div>
  );
}

export function compareEquip(state: Save, cls: ClassKey, item: Item): { dps: number; hp: number } | null {
  const base = BASES[item.base];
  if (base.cls && base.cls !== cls) return null;
  const mods = modifiers(state);
  const before = heroStats(state, cls, mods);
  const hero = state.heroes[cls];
  const trial: Save = { ...state, heroes: { ...state.heroes, [cls]: { ...hero, equipment: { ...hero.equipment, [base.slot]: item.id } } } };
  const after = heroStats(trial, cls, mods);
  return { dps: dps(after) - dps(before), hp: after.maxHp - before.maxHp };
}

export function Delta({ value, label }: { value: number; label: string }) {
  const sign = value > 0.05 ? "up" : value < -0.05 ? "down" : "same";
  return (
    <span className={`delta ${sign}`}>
      {sign === "up" ? "▲" : sign === "down" ? "▼" : "="} {Math.abs(value) < 10 ? Math.abs(value).toFixed(1) : compact(Math.abs(value))} {label}
    </span>
  );
}
