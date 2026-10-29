import { useSyncExternalStore } from "react";
import { advance, newGame, type Clock, type OfflineReport } from "../game/game";
import { sandboxGame } from "../game/sandbox";
import { parseSave, serialize } from "../game/save";
import { fail, type GameEvent, type GameState, type Result } from "../game/types";

const SAVE_KEY = "tray-heroes/save";
const TAB_LOCK = "tray-heroes/active-tab";
const UI_INTERVAL_MS = 150;
const AUTOSAVE_MS = 10_000;
const EVENT_BUFFER = 300;

export type Notice = { id: number; text: string; tone: "info" | "good" | "bad" };

function load(now: number): GameState {
  const url = new URL(location.href);
  if (import.meta.env.DEV && url.searchParams.has("sandbox")) {
    url.searchParams.delete("sandbox");
    history.replaceState(null, "", url);
    return sandboxGame(Math.floor(Math.random() * 2 ** 31), now);
  }
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    const parsed = parseSave(raw);
    if (parsed.ok) return parsed.value;
    console.warn(`Discarding save: ${parsed.reason}`);
  }
  return newGame(Math.floor(Math.random() * 2 ** 31), now);
}

class Engine {
  state: GameState;
  offline: OfflineReport | null = null;
  notices: Notice[] = [];
  inControl = true;
  private clock: Clock;
  private events: GameEvent[] = [];
  private listeners = new Set<() => void>();
  private version = 0;
  private lastNotify = 0;
  private lastSave = 0;
  private noticeId = 0;
  private scanned = 0;

  constructor() {
    const now = Date.now();
    this.state = load(now);
    this.clock = { last: this.state.savedAt, acc: 0 };
    this.tick(now);
    navigator.locks
      ?.request(TAB_LOCK, { steal: true }, () => new Promise<never>(() => {}))
      .catch(() => {
        this.inControl = false;
        this.notify(Date.now());
      });
  }

  tick(now: number): void {
    if (!this.inControl) return;
    const report = advance(this.state, this.clock, now, this.events);
    if (report) this.offline = report;
    for (let i = this.scanned; i < this.events.length; i++) {
      const e = this.events[i]!;
      if (e.type === "notice") this.notice(e.text);
    }
    this.scanned = this.events.length;
    if (this.events.length > EVENT_BUFFER) {
      this.events.splice(0, this.events.length - EVENT_BUFFER);
      this.scanned = this.events.length;
    }
    if (now - this.lastSave >= AUTOSAVE_MS) this.save(now);
    if (now - this.lastNotify >= UI_INTERVAL_MS || report) this.notify(now);
  }

  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    this.scanned = 0;
    return out;
  }

  act<T>(run: (state: GameState) => Result<T>, success?: (value: T) => string): Result<T> {
    if (!this.inControl) return fail("The game is running in another tab");
    const result = run(this.state);
    if (!result.ok) this.notice(result.reason, "bad");
    else if (success) this.notice(success(result.value), "good");
    this.save(Date.now());
    this.notify(Date.now());
    return result;
  }

  notice(text: string, tone: Notice["tone"] = "info"): void {
    this.notices = [...this.notices.slice(-4), { id: ++this.noticeId, text, tone }];
    const id = this.noticeId;
    setTimeout(() => {
      this.notices = this.notices.filter((n) => n.id !== id);
      this.notify(Date.now());
    }, 3_500);
  }

  dismissOffline(): void {
    this.offline = null;
    this.notify(Date.now());
  }

  save(now: number): void {
    if (!this.inControl) return;
    this.lastSave = now;
    localStorage.setItem(SAVE_KEY, serialize(this.state, now));
  }

  reset(): void {
    localStorage.removeItem(SAVE_KEY);
    const now = Date.now();
    this.state = newGame(Math.floor(Math.random() * 2 ** 31), now);
    this.clock = { last: now, acc: 0 };
    this.events = [];
    this.offline = null;
    this.notify(now);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = (): number => this.version;

  private notify(now: number): void {
    this.lastNotify = now;
    this.version++;
    for (const listener of this.listeners) listener();
  }
}

export const engine = new Engine();

if (import.meta.env.DEV) Object.assign(window, { engine });

addEventListener("pagehide", () => engine.save(Date.now()));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") engine.save(Date.now());
});
setInterval(() => engine.tick(Date.now()), 1_000);

export function useGame(): GameState {
  useSyncExternalStore(engine.subscribe, engine.getVersion);
  return engine.state;
}
