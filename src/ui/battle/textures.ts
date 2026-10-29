import { Assets, Rectangle, Texture, TextureStyle } from "pixi.js";
import type { SpriteRef } from "../../game/types";
import { SHEETS, TILE, customCanvas, frameOf, type SheetKey } from "../sprites";
import { loadManifest, type ArtKey, type Clip, type UnitManifest } from "./manifest";

TextureStyle.defaultOptions.scaleMode = "nearest";

export const FX = {
  cut: { frames: 4, w: 32, h: 32 },
  slash: { frames: 4, w: 32, h: 32 },
  slash2: { frames: 4, w: 32, h: 32 },
  cross: { frames: 4, w: 32, h: 32 },
  claw: { frames: 4, w: 32, h: 32 },
  ring: { frames: 4, w: 32, h: 32 },
  explosion: { frames: 9, w: 40, h: 40 },
  thunder: { frames: 8, w: 20, h: 28 },
  flame: { frames: 8, w: 25, h: 30 },
  smoke: { frames: 6, w: 32, h: 32 },
  dust: { frames: 10, w: 24, h: 14 },
  spark: { frames: 6, w: 32, h: 32 },
  halo: { frames: 4, w: 32, h: 32 },
  twinkle: { frames: 9, w: 30, h: 35 },
  arrow: { frames: 1, w: 13, h: 5 },
  fireball: { frames: 4, w: 16, h: 16 },
  orb: { frames: 4, w: 16, h: 16 },
  leaf: { frames: 6, w: 12, h: 7 },
} as const;

export type FxKey = keyof typeof FX;

export interface UnitArt {
  manifest: UnitManifest;
  weapon: Texture | null;
  clip(clip: Clip): Texture[];
}

export class TextureBank {
  readonly images = {} as Record<SheetKey, HTMLImageElement>;
  private sheets = {} as Record<SheetKey, Texture>;
  private cache = new Map<string, Texture>();
  private fx = new Map<FxKey, Texture[]>();
  readonly units: Partial<Record<ArtKey, UnitArt>> = {};

  async load(): Promise<void> {
    for (const key of Object.keys(SHEETS) as SheetKey[]) {
      this.images[key] = await loadImage(SHEETS[key].url);
      this.sheets[key] = await Assets.load<Texture>(SHEETS[key].url);
    }
    await Promise.all(
      (Object.keys(FX) as FxKey[]).map(async (key) => {
        const base = await Assets.load<Texture>(`/fx/${key}.png`);
        const { frames, w, h } = FX[key];
        this.fx.set(
          key,
          Array.from({ length: frames }, (_, i) => new Texture({ source: base.source, frame: new Rectangle(i * w, 0, w, h) })),
        );
      }),
    );
    const manifest = await loadManifest();
    await Promise.all(
      (Object.entries(manifest) as [ArtKey, UnitManifest][]).map(async ([key, m]) => {
        const base = await Assets.load<Texture>(m.src);
        const weapon = m.weapon ? await Assets.load<Texture>(m.weapon.src) : null;
        const clips = new Map<number, Texture[]>();
        this.units[key] = {
          manifest: m,
          weapon,
          clip: (clip) => {
            const hit = clips.get(clip.row);
            if (hit) return hit;
            const frames = Array.from(
              { length: clip.frames },
              (_, i) => new Texture({ source: base.source, frame: new Rectangle(i * m.w, clip.row * m.h, m.w, m.h) }),
            );
            clips.set(clip.row, frames);
            return frames;
          },
        };
      }),
    );
  }

  sprite(ref: SpriteRef): Texture {
    const key = ref.sheet === "custom" ? `custom:${ref.name}` : `${ref.sheet}:${ref.index}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const texture =
      ref.sheet === "custom"
        ? Texture.from(customCanvas(ref.name))
        : new Texture({ source: this.sheets[ref.sheet].source, frame: new Rectangle(frameOf(ref.sheet, ref.index).x, frameOf(ref.sheet, ref.index).y, TILE, TILE) });
    this.cache.set(key, texture);
    return texture;
  }

  effect(key: FxKey): Texture[] {
    return this.fx.get(key) ?? [Texture.EMPTY];
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${url}`));
    img.src = url;
  });
}
