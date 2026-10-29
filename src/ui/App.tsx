import { useState } from "react";
import { runeStatus } from "../game/actions";
import { ACTS, DIFFICULTIES, stageInfo } from "../game/data/world";
import { RUNE_KEYS, type ClassKey } from "../game/schema";
import { engine, useGame } from "./engine";
import { compact, duration } from "./format";
import { Icon } from "./items";
import { BagPanel } from "./panels/Bag";
import { CubePanel } from "./panels/Cube";
import { MapPanel } from "./panels/Map";
import { PartyPanel } from "./panels/Party";
import { PetsPanel } from "./panels/Pets";
import { RunesPanel } from "./panels/Runes";
import { Strip, openNextChest } from "./Strip";

const TABS = ["party", "bag", "cube", "runes", "map", "pets"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { party: "Party", bag: "Bag", cube: "Cube", runes: "Runes", map: "Map", pets: "Pets" };

function OfflineReport() {
  useGame();
  const report = engine.offline;
  if (!report) return null;
  return (
    <div className="modal-backdrop" onClick={() => engine.dismissOffline()}>
      <div className="modal" role="dialog" aria-label="Welcome back" onClick={(e) => e.stopPropagation()}>
        <h2>Welcome back</h2>
        <p>You were away for {duration(report.elapsedMs)}.</p>
        {report.creditedMs > 0 ? (
          <p>
            Your heroes kept fighting for {duration(report.creditedMs)} and earned <b className="gold">{compact(report.gold)} gold</b> and{" "}
            <b>{compact(report.xp)} XP</b>
            {report.levels > 0 && `, gaining ${report.levels} hero level${report.levels > 1 ? "s" : ""}`}.
          </p>
        ) : (
          <p className="muted">Buy the Repose rune so your heroes keep earning while you are away.</p>
        )}
        <button type="button" className="primary" onClick={() => engine.dismissOffline()}>
          Continue
        </button>
      </div>
    </div>
  );
}

export function App() {
  const state = useGame();
  const [tab, setTab] = useState<Tab>("party");
  const [selected, setSelected] = useState<ClassKey>(state.party[0] ?? "knight");
  const info = stageInfo(state.stage);
  const runeReady = RUNE_KEYS.some((k) => {
    const s = runeStatus(state, k);
    return !s.locked && !s.maxed && s.cost <= state.gold;
  });

  return (
    <div className="app">
      <header className="topbar">
        <h1>Tray Heroes</h1>
        <div className="resources">
          <span className="resource gold" title="Gold" aria-label={`${compact(state.gold)} gold`}>
            <Icon sprite={{ sheet: "custom", name: "coin" }} /> {compact(state.gold)}
          </span>
          <button type="button" className="resource" onClick={openNextChest} disabled={state.chests.length === 0} title="Open the next chest" aria-label={`Open the next chest, ${state.chests.length} waiting`}>
            <Icon sprite={{ sheet: "dungeon", index: 89 }} /> {state.chests.length}
          </button>
          <span className="resource muted">
            {DIFFICULTIES[info.difficulty]} · {ACTS[info.act]!.name} {info.label}
          </span>
        </div>
      </header>
      <Strip />
      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {TAB_LABEL[t]}
            {t === "bag" && state.chests.length > 0 && <span className="badge">{state.chests.length}</span>}
            {t === "runes" && runeReady && <span className="dot" />}
          </button>
        ))}
      </nav>
      <main className="panel">
        {tab === "party" && <PartyPanel selected={selected} onSelect={setSelected} />}
        {tab === "bag" && <BagPanel selected={selected} />}
        {tab === "cube" && <CubePanel />}
        {tab === "runes" && <RunesPanel />}
        {tab === "map" && <MapPanel />}
        {tab === "pets" && <PetsPanel />}
      </main>
      <footer className="footer muted">
        Art: Kenney (Tiny Dungeon, Tiny Town) and Clint Bellanger (Tiny Creatures), CC0.
        <button
          type="button"
          className="link"
          onClick={() => {
            if (confirm("Start over? This deletes your save.")) engine.reset();
          }}
        >
          Reset save
        </button>
      </footer>
      <div className="notices" aria-live="polite">
        {engine.notices.map((n) => (
          <div key={n.id} className={`notice ${n.tone}`}>
            {n.text}
          </div>
        ))}
      </div>
      <OfflineReport />
    </div>
  );
}
