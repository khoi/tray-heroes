import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import { DUNGEON, ROSTER, type ArtKey, type UnitManifest, type Weapon } from "../src/ui/battle/manifest";

const CELL = 100;
const ANIMS = { idle: ["Idle"], walk: ["Walk"], attacks: ["Attack01", "Attack02", "Attack03"], hurt: ["Hurt"], death: ["Death"] } as const;
const UNITS_OUT = "public/art/licensed";
const DUNGEON_OUT = "public/art/units";
const FX_OUT = "public/fx";
const SFX_OUT = "public/sfx";

const FX: Record<string, string> = {
  cut: "FX/Attack/Cut/SpriteSheet.png",
  slash: "FX/Attack/SlashCurved/SpriteSheet.png",
  slash2: "FX/Attack/SlashDoubleCurved/SpriteSheet.png",
  cross: "FX/Attack/CutX/SpriteSheet.png",
  claw: "FX/Attack/Claw/SpriteSheet.png",
  ring: "FX/Attack/CircularSlash/SpriteSheet.png",
  explosion: "FX/Elemental/Explosion/SpriteSheet.png",
  thunder: "FX/Elemental/Thunder/SpriteSheet.png",
  flame: "FX/Elemental/Flam/SpriteSheet.png",
  smoke: "FX/Smoke/Smoke/SpriteSheet.png",
  dust: "FX/Smoke/SmokeCircular/SpriteSheet.png",
  spark: "FX/Magic/Circle/SpriteSheetSpark.png",
  halo: "FX/Magic/Circle/SpriteSheetOrange.png",
  twinkle: "FX/Magic/Spark/SpriteSheet.png",
  arrow: "FX/Projectile/Arrow.png",
  fireball: "FX/Projectile/Fireball.png",
  orb: "FX/Projectile/EnergyBall.png",
  leaf: "FX/Particle/Leaf.png",
};

const SFX: Record<string, string> = {
  hit1: "Audio/Sounds/Hit & Impact/Hit1.wav",
  hit2: "Audio/Sounds/Hit & Impact/Hit2.wav",
  hit3: "Audio/Sounds/Hit & Impact/Hit3.wav",
  crit: "Audio/Sounds/Hit & Impact/Impact.wav",
  heavy: "Audio/Sounds/Hit & Impact/Impact3.wav",
  slash: "Audio/Sounds/Whoosh & Slash/Slash.wav",
  slash2: "Audio/Sounds/Whoosh & Slash/Slash3.wav",
  bow: "Audio/Sounds/Whoosh & Slash/Launch.wav",
  whoosh: "Audio/Sounds/Whoosh & Slash/Whoosh.wav",
  fireball: "Audio/Sounds/Elemental/Fireball.wav",
  explosion: "Audio/Sounds/Elemental/Explosion2.wav",
  magic: "Audio/Sounds/Magic & Skill/Magic1.wav",
  heal: "Audio/Sounds/Magic & Skill/Heal.wav",
  coin: "Audio/Sounds/Bonus/Coin.wav",
  chest: "Audio/Sounds/Bonus/Bonus.wav",
  open: "Audio/Sounds/Bonus/PowerUp1.wav",
  levelup: "Audio/Jingles/LevelUp1.wav",
  clear: "Audio/Jingles/Success1.wav",
  defeat: "Audio/Jingles/GameOver.wav",
  click: "Audio/Sounds/Menu/Accept.wav",
};

const MUSIC: Record<string, string> = {
  forest: "Audio/Musics/31 - Sunny.ogg",
  desert: "Audio/Musics/30 - Ruins.ogg",
  ember: "Audio/Musics/24 - Final Area.ogg",
};

function args(flag: string): string[] {
  const out: string[] = [];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === flag) {
      for (let j = i + 1; j < argv.length && !argv[j]!.startsWith("--"); j++) out.push(argv[j]!);
    }
  }
  return out;
}

function walk(dir: string, visit: (path: string) => void): void {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, visit);
    else visit(path);
  }
}

function findCharacters(roots: string[]): Map<string, string> {
  const found = new Map<string, string>();
  for (const root of roots) {
    walk(root, (path) => {
      const match = /\/([^/]+?)(?: with shadows)?\/([^/]+)_Idle\.png$/.exec(path);
      if (!match || match[1] !== match[2]) return;
      const name = match[2]!;
      const dir = path.slice(0, path.lastIndexOf("/"));
      if (!found.has(name) || dir.endsWith(" with shadows")) found.set(name, dir);
    });
  }
  return found;
}

const readPng = (path: string) => PNG.sync.read(readFileSync(path));

interface Strip {
  png: PNG;
  frames: number;
}

function opaque(png: PNG, x: number, y: number, threshold = 0): boolean {
  return png.data[(y * png.width + x) * 4 + 3]! > threshold;
}

function frameBox(strip: Strip, f: number, threshold = 0) {
  let minX = CELL, minY = CELL, maxX = -1, maxY = -1, count = 0, bright = 0, sumX = 0;
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const px = f * CELL + x;
      if (!opaque(strip.png, px, y, threshold)) continue;
      const i = (y * strip.png.width + px) * 4;
      const d = strip.png.data;
      count++;
      sumX += x;
      if (d[i]! > 225 && d[i + 1]! > 225 && d[i + 2]! > 225) bright++;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY, count, bright, centerX: count ? sumX / count : CELL / 2 };
}

function importUnit(key: string, dir: string, name: string): UnitManifest | null {
  const load = (anim: string): Strip | null => {
    const path = join(dir, `${name}_${anim}.png`);
    if (!existsSync(path)) return null;
    const png = readPng(path);
    return { png, frames: Math.floor(png.width / CELL) };
  };
  const idle = load(ANIMS.idle[0]);
  const walkStrip = load(ANIMS.walk[0]);
  const hurt = load(ANIMS.hurt[0]);
  const death = load(ANIMS.death[0]);
  const attacks = ANIMS.attacks.map(load).filter((s): s is Strip => !!s);
  if (!idle || !walkStrip || !hurt || !death || attacks.length === 0) {
    console.warn(`skip ${key}: ${name} is missing animations`);
    return null;
  }
  const rows = [idle, walkStrip, ...attacks, hurt, death];
  const box = { minX: CELL, minY: CELL, maxX: 0, maxY: 0 };
  for (const strip of rows) {
    for (let f = 0; f < strip.frames; f++) {
      const b = frameBox(strip, f);
      if (b.count === 0) continue;
      box.minX = Math.min(box.minX, b.minX);
      box.minY = Math.min(box.minY, b.minY);
      box.maxX = Math.max(box.maxX, b.maxX);
      box.maxY = Math.max(box.maxY, b.maxY);
    }
  }
  const w = box.maxX - box.minX + 1;
  const h = box.maxY - box.minY + 1;
  const columns = Math.max(...rows.map((r) => r.frames));
  const atlas = new PNG({ width: w * columns, height: h * rows.length });
  rows.forEach((strip, row) => {
    for (let f = 0; f < strip.frames; f++) {
      PNG.bitblt(strip.png, atlas, f * CELL + box.minX, box.minY, w, h, f * w, row * h);
    }
  });
  const body = frameBox(idle, 0, 250);
  const ground = frameBox(idle, 0);
  const impactOf = (strip: Strip) => {
    let best = Math.floor(strip.frames * 0.55);
    let score = 0;
    for (let f = 1; f < strip.frames; f++) {
      const b = frameBox(strip, f);
      const s = b.bright * 4 + (b.maxX - b.minX);
      if (s > score) {
        score = s;
        best = f;
      }
    }
    return best;
  };
  writeFileSync(join(UNITS_OUT, `${key}.png`), PNG.sync.write(atlas));
  return {
    src: `/art/licensed/${key}.png`,
    w,
    h,
    anchorX: Math.round(body.centerX - box.minX),
    anchorY: ground.maxY - box.minY - 1,
    top: body.minY - box.minY,
    idle: { row: 0, frames: idle.frames },
    walk: { row: 1, frames: walkStrip.frames },
    attacks: attacks.map((strip, i) => ({ row: 2 + i, frames: strip.frames, impact: impactOf(strip) })),
    hurt: { row: 2 + attacks.length, frames: hurt.frames },
    death: { row: 3 + attacks.length, frames: death.frames },
    weapon: null,
  };
}

function importUnits(roots: string[]): void {
  rmSync(UNITS_OUT, { recursive: true, force: true });
  mkdirSync(UNITS_OUT, { recursive: true });
  const characters = findCharacters(roots);
  console.log(`found ${characters.size} characters: ${[...characters.keys()].sort().join(", ")}`);
  const units: Record<string, UnitManifest> = {};
  for (const [key, candidates] of Object.entries(ROSTER)) {
    const name = candidates.find((c) => characters.has(c));
    if (!name) continue;
    const unit = importUnit(key, characters.get(name)!, name);
    if (unit) {
      units[key] = unit;
      console.log(`${key.padEnd(9)} ← ${name} (${unit.w}×${unit.h})`);
    }
  }
  writeFileSync(join(UNITS_OUT, "manifest.json"), JSON.stringify({ units }, null, 1));
  console.log(`${Object.keys(units).length}/${Object.keys(ROSTER).length} units have animated art`);
}


interface Tile {
  x: number;
  y: number;
  w: number;
  h: number;
}

function importDungeon(root: string): void {
  const dir = readdirSync(root).map((n) => join(root, n)).find((p) => existsSync(join(p, "tile_list_v1.7"))) ?? root;
  const tiles = new Map<string, Tile>();
  for (const line of readFileSync(join(dir, "tile_list_v1.7"), "utf8").split("\n")) {
    const [name, x, y, w, h] = line.trim().split(/\s+/);
    if (name && h) tiles.set(name, { x: +x!, y: +y!, w: +w!, h: +h! });
  }
  const sheet = readPng(join(dir, "0x72_DungeonTilesetII_v1.7.png"));
  const frames = (prefix: string) =>
    [...tiles.entries()]
      .map(([name, tile]) => ({ n: new RegExp(`^${prefix}_f(\\d+)$`).exec(name)?.[1], tile }))
      .filter((e): e is { n: string; tile: Tile } => e.n !== undefined)
      .sort((a, b) => Number(a.n) - Number(b.n))
      .map((e) => e.tile);
  rmSync(DUNGEON_OUT, { recursive: true, force: true });
  mkdirSync(DUNGEON_OUT, { recursive: true });
  const units: Partial<Record<ArtKey, UnitManifest>> = {};
  for (const [key, spec] of Object.entries(DUNGEON) as [ArtKey, { base: string; weapon?: string }][]) {
    const idle = frames(`${spec.base}_idle_anim`).length ? frames(`${spec.base}_idle_anim`) : frames(`${spec.base}_anim`);
    const run = frames(`${spec.base}_run_anim`).length ? frames(`${spec.base}_run_anim`) : idle;
    const hit = frames(`${spec.base}_hit_anim`);
    if (idle.length === 0) {
      console.warn(`skip ${key}: no ${spec.base} frames`);
      continue;
    }
    const rows = [idle, run, ...(hit.length ? [hit] : [])];
    const { w, h } = idle[0]!;
    const atlas = new PNG({ width: w * Math.max(...rows.map((r) => r.length)), height: h * rows.length });
    rows.forEach((row, r) => row.forEach((t, f) => PNG.bitblt(sheet, atlas, t.x, t.y, w, h, f * w, r * h)));
    writeFileSync(join(DUNGEON_OUT, `${key}.png`), PNG.sync.write(atlas));
    let top = h;
    let bottom = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (atlas.data[(y * atlas.width + x) * 4 + 3]! === 0) continue;
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    let weapon: Weapon | null = null;
    const wt = spec.weapon ? tiles.get(spec.weapon) : undefined;
    if (spec.weapon && wt) {
      const png = new PNG({ width: wt.w, height: wt.h });
      PNG.bitblt(sheet, png, wt.x, wt.y, wt.w, wt.h, 0, 0);
      writeFileSync(join(DUNGEON_OUT, `${spec.weapon}.png`), PNG.sync.write(png));
      weapon = { src: `/art/units/${spec.weapon}.png`, w: wt.w, h: wt.h, kind: spec.weapon.includes("bow") ? "bow" : spec.weapon.includes("staff") ? "staff" : "blade" };
    }
    units[key] = {
      src: `/art/units/${key}.png`,
      w,
      h,
      anchorX: Math.floor(w / 2),
      anchorY: bottom,
      top,
      idle: { row: 0, frames: idle.length },
      walk: { row: 1, frames: run.length },
      attacks: [],
      hurt: hit.length ? { row: 2, frames: hit.length } : null,
      death: null,
      weapon,
    };
    console.log(`${key.padEnd(9)} ← ${spec.base} (${w}×${h}${weapon ? `, ${spec.weapon}` : ""})`);
  }
  writeFileSync(join(DUNGEON_OUT, "manifest.json"), JSON.stringify({ units }, null, 1));
}

function importNinja(root: string): void {
  mkdirSync(FX_OUT, { recursive: true });
  mkdirSync(SFX_OUT, { recursive: true });
  for (const [name, path] of Object.entries(FX)) copyFileSync(join(root, path), join(FX_OUT, `${name}.png`));
  const encode = (from: string, to: string, kbps: number) =>
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", from, "-ac", "1", "-c:a", "aac", "-b:a", `${kbps}k`, to]);
  for (const [name, path] of Object.entries(SFX)) encode(join(root, path), join(SFX_OUT, `${name}.m4a`), 96);
  for (const [name, path] of Object.entries(MUSIC)) encode(join(root, path), join(SFX_OUT, `music-${name}.m4a`), 80);
  console.log(`copied ${Object.keys(FX).length} effects, ${Object.keys(SFX).length} sounds, ${Object.keys(MUSIC).length} tracks`);
}

const zerie = args("--zerie");
const ninja = args("--ninja")[0];
const dungeonDir = args("--dungeon")[0];
if (zerie.length === 0 && !ninja && !dungeonDir) {
  console.log("usage: npm run import-art -- [--zerie <dir>...] [--dungeon <0x72 DungeonTileset II dir>] [--ninja <Ninja Adventure dir>]");
  process.exit(1);
}
if (dungeonDir) importDungeon(dungeonDir);
if (zerie.length > 0) importUnits(zerie);
if (ninja) importNinja(ninja);
