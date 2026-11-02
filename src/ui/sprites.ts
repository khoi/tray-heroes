import type { CSSProperties } from "react";
import type { CustomSprite, SpriteRef } from "../game/types";

export const TILE = 16;

export const SHEETS = {
  dungeon: { url: "/assets/dungeon.png", columns: 12, width: 192, height: 176 },
  town: { url: "/assets/town.png", columns: 12, width: 192, height: 176 },
} as const;

export type SheetKey = keyof typeof SHEETS;

export function frameOf(sheet: SheetKey, index: number): { x: number; y: number } {
  const { columns } = SHEETS[sheet];
  return { x: (index % columns) * TILE, y: Math.floor(index / columns) * TILE };
}

const PALETTE: Record<string, string> = {
  o: "#2e222f",
  l: "#c7d2e0",
  m: "#8b9bb4",
  d: "#5a6988",
  g: "#f9c22b",
  G: "#c27a1d",
  r: "#e83b3b",
  w: "#ffffff",
  L: "#a0653a",
  K: "#6b3e2b",
};

const PIXELS: Record<CustomSprite, string[]> = {
  helmet: [
    "................",
    ".....oooooo.....",
    "....ollllmmo....",
    "...olllllmmmo...",
    "..ollllllmmmdo..",
    "..ollllllmmmdo..",
    "..olllllmmmmdo..",
    "..oooooooooooo..",
    "..ollllmmmmmdo..",
    "..ollomlmomddo..",
    "..olllmmmmmmdo..",
    "..ollomlmomddo..",
    "..olllmmmmmddo..",
    "..oddddddddddo..",
    "...oooooooooo...",
    "................",
  ],
  armor: [
    "................",
    "..oooo....oooo..",
    ".ollllo..ommmdo.",
    ".olllllooommmdo.",
    ".ollllllmmmmmdo.",
    ".ollllllmmmmmdo.",
    ".oolllllmmmmdoo.",
    "..olllllmmmmdo..",
    "..olllllmmmmdo..",
    "..ollllmmmmmdo..",
    "..oggggGGGGGGo..",
    "..olllmmmmmmdo..",
    "...olmmmmmmdo...",
    "....oooooooo....",
    "................",
    "................",
  ],
  boots: [
    "................",
    "................",
    "................",
    "..oooo...oooo...",
    "..oLLo...oLLo...",
    "..oLLo...oLLo...",
    "..oLKo...oLKo...",
    "..oggo...oggo...",
    "..oLLo...oLLo...",
    "..oLLoo..oLLoo..",
    "..oLLLLo.oLLLLo.",
    "..oKKKKo.oKKKKo.",
    "..oooooo.oooooo.",
    "................",
    "................",
    "................",
  ],
  amulet: [
    "................",
    "..oo........oo..",
    "..og........go..",
    "...og......go...",
    "....og....go....",
    ".....og..go.....",
    "......oggo......",
    ".....oGGGGo.....",
    "....oGrrrrGo....",
    "....oGrwrrGo....",
    "....oGrrrrGo....",
    "....oGrrrrGo....",
    ".....oGGGGo.....",
    "......oooo......",
    "................",
    "................",
  ],
  coin: [
    "................",
    "................",
    "................",
    ".....oooooo.....",
    "....oggggggo....",
    "...oggwgggGGo...",
    "...ogwggGggGo...",
    "...ogwggGggGo...",
    "...oggggGggGo...",
    "...ogggggggGo...",
    "....oggggGGo....",
    ".....oooooo.....",
    "................",
    "................",
    "................",
    "................",
  ],
};

const canvases = new Map<CustomSprite, HTMLCanvasElement>();

export function customCanvas(name: CustomSprite): HTMLCanvasElement {
  const cached = canvases.get(name);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  PIXELS[name].forEach((row, y) => {
    if (row.length !== TILE) throw new Error(`${name} row ${y} is ${row.length} wide`);
    [...row].forEach((ch, x) => {
      const color = PALETTE[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  canvases.set(name, canvas);
  return canvas;
}

const urls = new Map<CustomSprite, string>();

export function customUrl(name: CustomSprite): string {
  const cached = urls.get(name);
  if (cached) return cached;
  const url = customCanvas(name).toDataURL();
  urls.set(name, url);
  return url;
}

export function spriteStyle(ref: SpriteRef, scale: number): CSSProperties {
  const size = TILE * scale;
  if (ref.sheet === "custom") {
    return { width: size, height: size, backgroundImage: `url(${customUrl(ref.name)})`, backgroundSize: `${size}px ${size}px` };
  }
  const sheet = SHEETS[ref.sheet];
  const { x, y } = frameOf(ref.sheet, ref.index);
  return {
    width: size,
    height: size,
    backgroundImage: `url(${sheet.url})`,
    backgroundSize: `${sheet.width * scale}px ${sheet.height * scale}px`,
    backgroundPosition: `-${x * scale}px -${y * scale}px`,
  };
}
