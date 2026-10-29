import { Container, Sprite, Texture, TilingSprite } from "pixi.js";
import type { Theme } from "../../game/data/world";
import type { SpriteRef } from "../../game/types";
import { TILE, frameOf } from "../sprites";
import type { TextureBank } from "./textures";

export const WORLD_H = 56;
export const GROUND_Y = 44;
const LOOP = 512;

interface Ridge {
  base: number;
  waves: [amp: number, cycles: number, phase: number][];
  fill: string;
  rim: string;
  flatten?: number;
  jagged?: boolean;
}

interface ThemeDef {
  sky: string[];
  body: { x: number; y: number; r: number; color: string; glow: string };
  clouds: string | null;
  ridges: { ridge: Ridge; speed: number }[];
  trees?: { color: string; every: number };
  ground: SpriteRef[];
  dirt: string;
  decor: SpriteRef[];
  horizonGlow?: string;
}

const d = (index: number): SpriteRef => ({ sheet: "dungeon", index });
const t = (index: number): SpriteRef => ({ sheet: "town", index });

const THEMES: Record<Theme, ThemeDef> = {
  forest: {
    sky: ["#4fa3ef", "#67b5f5", "#86c8f9", "#a9dafb", "#cdeafc", "#eaf7fd"],
    body: { x: 0.74, y: 11, r: 5, color: "#fff6c4", glow: "#fffbe0" },
    clouds: "#ffffff",
    ridges: [
      { ridge: { base: 27, waves: [[5, 2, 0.3], [3, 5, 1.7], [1.5, 13, 0.4]], fill: "#8fb9dc", rim: "#b3d3ee", jagged: true }, speed: 0.12 },
      { ridge: { base: 35, waves: [[3, 3, 2.1], [1.6, 7, 0.2]], fill: "#5f9e7a", rim: "#7cbb8e" }, speed: 0.3 },
    ],
    trees: { color: "#3f7c5c", every: 7 },
    ground: [t(0), t(1), t(0), t(2), t(0)],
    dirt: "#5a3d2b",
    decor: [t(4), t(16), t(5), t(28), t(3), t(15), t(5)],
  },
  desert: {
    sky: ["#e98a5a", "#f09d69", "#f5b27c", "#f8c794", "#fbdcb2", "#fdeed3"],
    body: { x: 0.3, y: 14, r: 8, color: "#fff4d2", glow: "#ffe7b3" },
    clouds: "#fff3e3",
    ridges: [
      { ridge: { base: 31, waves: [[6, 2, 1.1], [3, 5, 0.6], [1, 11, 2.2]], fill: "#d4906a", rim: "#e8ad83", flatten: 26 }, speed: 0.12 },
      { ridge: { base: 38, waves: [[2.6, 3, 0.4], [1.2, 6, 1.9]], fill: "#b86f42", rim: "#d48b56" }, speed: 0.32 },
    ],
    ground: [d(48), d(49), d(48), d(53), d(48)],
    dirt: "#9a5b34",
    decor: [d(65), d(64), d(42), d(65), d(54)],
  },
  ember: {
    sky: ["#120a1c", "#1d0f26", "#2d132d", "#461a33", "#6b2335", "#93303a"],
    body: { x: 0.68, y: 12, r: 6, color: "#ff8d63", glow: "#ff5a3a" },
    clouds: null,
    ridges: [
      { ridge: { base: 26, waves: [[8, 3, 0.9], [4, 7, 2.4], [2, 17, 0.1]], fill: "#3a1a30", rim: "#5c2638", jagged: true }, speed: 0.12 },
      { ridge: { base: 36, waves: [[3, 4, 1.3], [2.4, 9, 0.7]], fill: "#24101f", rim: "#40182c", jagged: true }, speed: 0.32 },
    ],
    ground: [d(36), d(37), d(38), d(37), d(36)],
    dirt: "#1c0f18",
    decor: [d(29), d(19), d(41), d(29), d(20)],
    horizonGlow: "#ff5a2a",
  },
};

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
}

function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  return (Math.imul(h, 0xc2b2ae35) >>> 0) / 4294967296;
}

function hex(color: string): [number, number, number] {
  const n = parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function skyCanvas(def: ThemeDef): HTMLCanvasElement {
  const [c, ctx] = canvas(4, WORLD_H);
  const img = ctx.createImageData(4, WORLD_H);
  const bands = def.sky.map(hex);
  for (let y = 0; y < WORLD_H; y++) {
    const pos = (y / (GROUND_Y + 2)) * (bands.length - 1);
    const i = Math.min(bands.length - 1, Math.floor(pos));
    const frac = pos - i;
    for (let x = 0; x < 4; x++) {
      const pick = frac * 16 > BAYER[y % 4]![x]! ? Math.min(bands.length - 1, i + 1) : i;
      const [r, g, b] = bands[pick]!;
      const o = (y * 4 + x) * 4;
      img.data.set([r, g, b, 255], o);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function bodyCanvas(def: ThemeDef): HTMLCanvasElement {
  const { r, color, glow } = def.body;
  const size = r * 4 + 2;
  const [c, ctx] = canvas(size, size);
  const mid = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.hypot(x + 0.5 - mid, y + 0.5 - mid);
      if (dist <= r) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      } else if (dist <= r * 1.9 && BAYER[y % 4]![x % 4]! < 16 * (1 - (dist - r) / (r * 0.9)) * 0.5) {
        ctx.fillStyle = glow;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x, y, 1, 1);
        ctx.globalAlpha = 1;
      }
    }
  }
  return c;
}

function cloudCanvas(color: string): HTMLCanvasElement {
  const [c, ctx] = canvas(LOOP, 24);
  const shade = "rgba(120, 150, 190, 0.35)";
  for (let i = 0; i < 6; i++) {
    const cx = Math.floor(hash(i * 7 + 1) * LOOP);
    const cy = 5 + Math.floor(hash(i * 7 + 2) * 12);
    const puffs = 3 + Math.floor(hash(i * 7 + 3) * 4);
    for (let p = 0; p < puffs; p++) {
      const px = cx + p * 6 - puffs * 3;
      const pr = 3 + Math.floor(hash(i * 13 + p) * 3);
      for (let y = -pr; y <= pr; y++) {
        for (let x = -pr - 2; x <= pr + 2; x++) {
          if ((x * x) / ((pr + 2) * (pr + 2)) + (y * y) / (pr * pr) > 1) continue;
          ctx.fillStyle = y > pr * 0.35 ? shade : color;
          ctx.fillRect((((px + x) % LOOP) + LOOP) % LOOP, cy + y, 1, 1);
        }
      }
    }
  }
  return c;
}

function ridgeHeight(ridge: Ridge, x: number): number {
  let y = ridge.base;
  for (const [amp, cycles, phase] of ridge.waves) {
    const a = (x / LOOP) * cycles * Math.PI * 2 + phase;
    y -= amp * (ridge.jagged ? 1 - 2 * Math.abs(((a / Math.PI) % 2 + 2) % 2 - 1) : Math.sin(a));
  }
  return ridge.flatten !== undefined ? Math.max(ridge.flatten, y) : y;
}

function ridgeCanvas(ridge: Ridge, trees?: { color: string; every: number }): HTMLCanvasElement {
  const [c, ctx] = canvas(LOOP, WORLD_H);
  for (let x = 0; x < LOOP; x++) {
    const top = Math.round(ridgeHeight(ridge, x));
    ctx.fillStyle = ridge.fill;
    ctx.fillRect(x, top, 1, WORLD_H - top);
    const slope = ridgeHeight(ridge, x + 1) - ridgeHeight(ridge, x - 1);
    if (slope <= 0.2) {
      ctx.fillStyle = ridge.rim;
      ctx.fillRect(x, top, 1, 1);
    }
  }
  if (trees) {
    for (let x = 2; x < LOOP; x += trees.every + Math.floor(hash(x) * 4)) {
      const base = Math.round(ridgeHeight(ridge, x)) + 1;
      const h = 5 + Math.floor(hash(x + 99) * 5);
      ctx.fillStyle = trees.color;
      for (let row = 0; row < h; row++) {
        const half = Math.floor((row / h) * 3) + (row % 2);
        ctx.fillRect(x - half, base - h + row, half * 2 + 1, 1);
      }
      ctx.fillRect(x, base, 1, 2);
    }
  }
  return c;
}

function stripCanvas(images: TextureBank["images"], tiles: number, pick: (i: number) => SpriteRef | null, height: number, offsetY: number): HTMLCanvasElement {
  const [c, ctx] = canvas(tiles * TILE, height);
  for (let i = 0; i < tiles; i++) {
    const ref = pick(i);
    if (!ref || ref.sheet === "custom") continue;
    const { x, y } = frameOf(ref.sheet, ref.index);
    ctx.drawImage(images[ref.sheet], x, y, TILE, TILE, i * TILE, offsetY, TILE, TILE);
  }
  return c;
}

export class Backdrop {
  readonly root = new Container();
  private sky = new Sprite();
  private body = new Sprite();
  private clouds = new TilingSprite();
  private ridges: { sprite: TilingSprite; speed: number }[] = [];
  private glow = new Sprite();
  private decor = new TilingSprite();
  private ground = new TilingSprite();
  private dirt = new Sprite(Texture.WHITE);
  private width = 320;
  private wind = 0;
  theme: Theme | null = null;

  constructor(private readonly bank: TextureBank) {
    this.root.addChild(this.sky, this.body, this.clouds, this.glow, this.decor, this.dirt, this.ground);
  }

  setTheme(theme: Theme): void {
    if (theme === this.theme) return;
    this.theme = theme;
    const def = THEMES[theme];
    this.sky.texture = Texture.from(skyCanvas(def));
    this.body.texture = Texture.from(bodyCanvas(def));
    this.body.anchor.set(0.5);
    this.clouds.texture = def.clouds ? Texture.from(cloudCanvas(def.clouds)) : Texture.EMPTY;
    for (const r of this.ridges) r.sprite.destroy();
    this.ridges = def.ridges.map(({ ridge, speed }, i) => {
      const sprite = new TilingSprite({ texture: Texture.from(ridgeCanvas(ridge, i === 1 ? def.trees : undefined)), width: this.width, height: WORLD_H });
      this.root.addChildAt(sprite, 3 + i);
      return { sprite, speed };
    });
    if (def.horizonGlow) {
      const [c, ctx] = canvas(1, 24);
      const g = ctx.createLinearGradient(0, 0, 0, 24);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, def.horizonGlow);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1, 24);
      this.glow.texture = Texture.from(c);
      this.glow.alpha = 0.35;
      this.glow.blendMode = "add";
    } else {
      this.glow.texture = Texture.EMPTY;
    }
    this.decor.texture = Texture.from(
      stripCanvas(this.bank.images, 40, (i) => (hash(i + 31) < 0.28 ? def.decor[Math.floor(hash(i + 5) * def.decor.length)]! : null), TILE, 0),
    );
    this.ground.texture = Texture.from(stripCanvas(this.bank.images, 16, (i) => def.ground[Math.floor(hash(i * 3) * def.ground.length)]!, TILE, 0));
    this.dirt.tint = def.dirt;
    this.layout(this.width);
  }

  layout(width: number): void {
    this.width = width;
    this.sky.width = width;
    this.sky.height = WORLD_H;
    this.body.position.set(Math.round(width * THEMES[this.theme ?? "forest"].body.x), THEMES[this.theme ?? "forest"].body.y);
    this.clouds.width = width;
    this.clouds.height = 24;
    for (const r of this.ridges) {
      r.sprite.width = width;
      r.sprite.height = WORLD_H;
    }
    this.glow.width = width;
    this.glow.height = 24;
    this.glow.y = GROUND_Y - 24;
    this.decor.width = width;
    this.decor.height = TILE;
    this.decor.y = GROUND_Y - TILE + 2;
    this.ground.width = width;
    this.ground.height = TILE;
    this.ground.y = GROUND_Y;
    this.dirt.width = width;
    this.dirt.height = WORLD_H - GROUND_Y;
    this.dirt.y = GROUND_Y + 8;
  }

  update(scroll: number, dt: number): void {
    this.wind += dt * 3;
    this.clouds.tilePosition.x = -(scroll * 0.05 + this.wind);
    for (const r of this.ridges) r.sprite.tilePosition.x = -scroll * r.speed;
    this.decor.tilePosition.x = -scroll * 0.7;
    this.ground.tilePosition.x = -scroll;
  }
}
