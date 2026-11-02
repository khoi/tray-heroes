import type { Theme } from "../../game/data/world";
import { publicUrl } from "../paths";

export const SOUNDS = [
  "hit1",
  "hit2",
  "hit3",
  "crit",
  "heavy",
  "slash",
  "slash2",
  "bow",
  "whoosh",
  "fireball",
  "explosion",
  "magic",
  "heal",
  "coin",
  "chest",
  "open",
  "levelup",
  "clear",
  "defeat",
  "click",
] as const;

export type Sound = (typeof SOUNDS)[number];

const PREFS_KEY = "tray-heroes/audio";
const MIN_GAP_MS = 45;

interface Prefs {
  sfx: boolean;
  music: boolean;
}

function readPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<Prefs>;
    return { sfx: raw.sfx ?? true, music: raw.music ?? false };
  } catch {
    return { sfx: true, music: false };
  }
}

class Audio {
  prefs = readPrefs();
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<Sound, AudioBuffer>();
  private lastPlayed = new Map<Sound, number>();
  private music: HTMLAudioElement | null = null;
  private theme: Theme | null = null;
  private listeners = new Set<() => void>();

  constructor() {
    const unlock = () => {
      void this.start();
      removeEventListener("pointerdown", unlock);
      removeEventListener("keydown", unlock);
    };
    addEventListener("pointerdown", unlock);
    addEventListener("keydown", unlock);
  }

  private async start(): Promise<void> {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.45;
    this.master.connect(this.ctx.destination);
    await Promise.all(
      SOUNDS.map(async (name) => {
        const res = await fetch(publicUrl(`sfx/${name}.m4a`));
        this.buffers.set(name, await this.ctx!.decodeAudioData(await res.arrayBuffer()));
      }),
    );
    this.syncMusic();
  }

  play(name: Sound, volume = 1, rate = 1): void {
    if (!this.prefs.sfx || !this.ctx || !this.master || this.ctx.state !== "running") return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    const now = performance.now();
    if (now - (this.lastPlayed.get(name) ?? 0) < MIN_GAP_MS) return;
    this.lastPlayed.set(name, now);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate * (0.94 + Math.random() * 0.12);
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(this.master);
    source.start();
  }

  setTheme(theme: Theme): void {
    if (theme === this.theme) return;
    this.theme = theme;
    this.syncMusic();
  }

  toggle(kind: keyof Prefs): void {
    this.prefs = { ...this.prefs, [kind]: !this.prefs[kind] };
    localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
    if (kind === "music") void this.start().then(() => this.syncMusic());
    this.syncMusic();
    for (const listener of this.listeners) listener();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getPrefs = (): Prefs => this.prefs;

  private syncMusic(): void {
    const track = this.theme === "plague" ? "lair" : this.theme;
    const wanted = this.prefs.music && this.ctx && track ? publicUrl(`sfx/music-${track}.m4a`) : null;
    if (this.music && (!wanted || !this.music.src.endsWith(wanted))) {
      this.music.pause();
      this.music = null;
    }
    if (wanted && !this.music) {
      this.music = new window.Audio(wanted);
      this.music.loop = true;
      this.music.volume = 0.25;
      void this.music.play().catch(() => undefined);
    }
  }
}

export const audio = new Audio();
