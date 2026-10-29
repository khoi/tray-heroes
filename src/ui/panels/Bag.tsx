import { useState } from "react";
import { alchemize, equip, sortInventory, toggleLock } from "../../game/actions";
import { CLASSES } from "../../game/data/classes";
import { BASES } from "../../game/data/items";
import { CHEST_KINDS, CLASS_KEYS, type ChestKind, type ClassKey, type ItemId } from "../../game/schema";
import { inventoryCap, modifiers } from "../../game/stats";
import { itemName, openChest } from "../../game/loot";
import { engine, useGame } from "../engine";
import { Delta, EmptyTile, Icon, ItemDetails, ItemTile, compareEquip } from "../items";
import { compact } from "../format";

const CHEST_SPRITE = { common: 89, boss: 90, act: 91 } as const;
const CHEST_LABEL: Record<ChestKind, string> = { common: "Chest", boss: "Boss chest", act: "Act chest" };

export function BagPanel({ selected }: { selected: ClassKey }) {
  const state = useGame();
  const [focus, setFocus] = useState<ItemId | null>(null);
  const cap = inventoryCap(modifiers(state));
  const item = focus === null ? undefined : state.items[focus];
  const inBag = item && state.inventory.includes(item.id);

  function sortBag() {
    engine.act(sortInventory);
  }

  function open(kind: ChestKind) {
    engine.act((s) => openChest(s, [], kind), (items) => `Opened ${items.map(itemName).join(", ")}`);
  }

  return (
    <div className="bag">
      <div className="bag-main">
        <div className="chests">
          {CHEST_KINDS.map((kind) => {
            const count = state.chests.filter((c) => c.kind === kind).length;
            return (
              <button key={kind} type="button" className="chest-button" disabled={count === 0} onClick={() => open(kind)}>
                <Icon sprite={{ sheet: "dungeon", index: CHEST_SPRITE[kind] }} />
                <span>
                  {CHEST_LABEL[kind]} ×{count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="bag-toolbar">
          <span className="muted">
            Bag {state.inventory.length}/{cap}
          </span>
          <button type="button" onClick={sortBag}>
            Sort
          </button>
        </div>
        <div className="item-grid">
          {Array.from({ length: cap }, (_, i) => {
            const id = state.inventory[i];
            const it = id === undefined ? undefined : state.items[id];
            return it ? <ItemTile key={it.id} item={it} selected={focus === it.id} onClick={() => setFocus(it.id)} /> : <EmptyTile key={`e${i}`} />;
          })}
        </div>
      </div>
      <aside className="bag-side">
        {item && inBag ? (
          <ItemDetails item={item}>
            <div className="compare">
              {CLASS_KEYS.filter((cls) => !BASES[item.base].cls || BASES[item.base].cls === cls).map((cls) => {
                const delta = compareEquip(state, cls, item);
                if (!delta) return null;
                return (
                  <div key={cls} className={`compare-row ${cls === selected ? "selected" : ""}`}>
                    <Icon sprite={CLASSES[cls].sprite} scale={1.5} />
                    <Delta value={delta.dps} label="DPS" />
                    <Delta value={delta.hp} label="Life" />
                    <button
                      type="button"
                      disabled={state.heroes[cls].level < item.level}
                      onClick={() => {
                        if (engine.act((s) => equip(s, cls, item.id), () => `${CLASSES[cls].name} equipped ${itemName(item)}`).ok) setFocus(null);
                      }}
                    >
                      {state.heroes[cls].level < item.level ? `Needs Lv ${item.level}` : "Equip"}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="row">
              <button type="button" onClick={() => engine.act((s) => toggleLock(s, item.id))}>
                {item.locked ? "Unlock" : "Lock"}
              </button>
              <button
                type="button"
                disabled={item.locked}
                onClick={() => {
                  if (engine.act((s) => alchemize(s, [item.id]), (g) => `+${compact(g)} gold`).ok) setFocus(null);
                }}
              >
                Alchemize
              </button>
            </div>
          </ItemDetails>
        ) : (
          <p className="muted">Select an item to see its stats and compare it with what your heroes wear.</p>
        )}
      </aside>
    </div>
  );
}
