import { useState } from "react";
import { equip, sortInventory, stashItem, toggleLock, unstashItem } from "../../game/actions";
import { alchemize } from "../../game/cube";
import { CLASSES } from "../../game/data/classes";
import { MATERIAL_KEYS, material } from "../../game/data/materials";
import { itemName, openChest } from "../../game/loot";
import type { ChestKind, ItemId } from "../../game/schema";
import { inventoryCap, modifiers, stashCap } from "../../game/stats";
import { engine, useGame } from "../engine";
import { compact } from "../format";
import { Delta, EmptyTile, Icon, ItemDetails, ItemTile, MaterialChip, compareEquip, eligibleHeroes } from "../items";
import { Portrait } from "../Portrait";

const CHEST_SPRITE: Record<ChestKind, number> = { common: 89, boss: 90, act: 91 };
const CHEST_LABEL: Record<ChestKind, string> = { common: "Chest", boss: "Boss chest", act: "Act chest" };
const KIND_LABEL = { gem: "Gems", part: "Monster parts", scroll: "Scrolls", soul: "Soulstones", dust: "Dust" } as const;

export function BagPanel() {
  const state = useGame();
  const [view, setView] = useState<"bag" | "stash" | "materials">("bag");
  const [focus, setFocus] = useState<ItemId | null>(null);
  const mods = modifiers(state);
  const list = view === "stash" ? state.stash : state.inventory;
  const cap = view === "stash" ? stashCap(mods) : inventoryCap(mods);
  const item = focus === null ? undefined : state.items[focus];
  const inBag = !!item && state.inventory.includes(item.id);
  const inStash = !!item && state.stash.includes(item.id);

  const owned = MATERIAL_KEYS.filter((k) => (state.materials[k] ?? 0) > 0);
  const groups = (Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).map((kind) => ({ kind, keys: owned.filter((k) => material(k).kind === kind) }));

  return (
    <div className="bag">
      <div className="bag-main">
        <div className="chests">
          {(["common", "boss", "act"] as ChestKind[]).map((kind) => {
            const count = state.chests.filter((c) => c.kind === kind).length;
            return (
              <button
                key={kind}
                type="button"
                className="chest-button"
                disabled={count === 0}
                onClick={() => engine.act((s) => openChest(s, [], kind), (items) => `Opened ${items.map(itemName).join(", ")}`)}
              >
                <Icon sprite={{ sheet: "dungeon", index: CHEST_SPRITE[kind] }} />
                <span>
                  {CHEST_LABEL[kind]} ×{count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="bag-toolbar">
          <div className="subtabs">
            <button type="button" className={view === "bag" ? "active" : ""} onClick={() => setView("bag")}>
              Bag {state.inventory.length}/{inventoryCap(mods)}
            </button>
            <button type="button" className={view === "stash" ? "active" : ""} onClick={() => setView("stash")}>
              Stash {state.stash.length}/{stashCap(mods)}
            </button>
            <button type="button" className={view === "materials" ? "active" : ""} onClick={() => setView("materials")}>
              Materials
            </button>
          </div>
          {view === "bag" && (
            <button type="button" onClick={() => engine.act(sortInventory)}>
              Sort
            </button>
          )}
        </div>
        {view === "materials" ? (
          <div className="materials">
            {groups.map(({ kind, keys }) => (
              <section key={kind}>
                <h4>{KIND_LABEL[kind]}</h4>
                {keys.length === 0 ? (
                  <p className="muted">None yet.</p>
                ) : (
                  <div className="chip-row">
                    {keys.map((k) => (
                      <MaterialChip key={k} id={k} count={state.materials[k]} />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        ) : (
          <div className="item-grid">
            {Array.from({ length: cap }, (_, i) => {
              const id = list[i];
              const it = id === undefined ? undefined : state.items[id];
              return it ? <ItemTile key={it.id} item={it} selected={focus === it.id} onClick={() => setFocus(it.id)} /> : <EmptyTile key={`e${i}`} />;
            })}
          </div>
        )}
      </div>
      <aside className="bag-side">
        {item && (inBag || inStash) ? (
          <ItemDetails item={item}>
            {inBag && (
              <div className="compare">
                {eligibleHeroes(state, item).map((cls) => {
                  const delta = compareEquip(state, cls, item);
                  if (delta === null) return null;
                  const tooLow = state.heroes[cls].level < item.level;
                  return (
                    <div key={cls} className="compare-row">
                      <Portrait unit={cls} fallback={CLASSES[cls].sprite} scale={1} />
                      <Delta value={delta} />
                      <button
                        type="button"
                        disabled={tooLow}
                        onClick={() => {
                          if (engine.act((s) => equip(s, cls, item.id), () => `${CLASSES[cls].name} equipped ${itemName(item)}`).ok) setFocus(null);
                        }}
                      >
                        {tooLow ? `Lv ${item.level}` : "Equip"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="row">
              <button type="button" onClick={() => engine.act((s) => toggleLock(s, item.id))}>
                {item.locked ? "Unlock" : "Lock"}
              </button>
              {inBag ? (
                <button type="button" onClick={() => engine.act((s) => stashItem(s, item.id))}>
                  To stash
                </button>
              ) : (
                <button type="button" onClick={() => engine.act((s) => unstashItem(s, item.id))}>
                  To bag
                </button>
              )}
              {inBag && (
                <button
                  type="button"
                  disabled={item.locked}
                  onClick={() => {
                    if (engine.act((s) => alchemize(s, [item.id]), (r) => `+${compact(r.gold)} gold, +${r.dust} dust`).ok) setFocus(null);
                  }}
                >
                  Alchemize
                </button>
              )}
            </div>
          </ItemDetails>
        ) : (
          <p className="muted">Select an item to see its stats, sockets and how much power it would add to each hero.</p>
        )}
      </aside>
    </div>
  );
}
