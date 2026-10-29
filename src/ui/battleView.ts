import { Application, Assets, Container, Graphics, Rectangle, Sprite, Text, Texture, TextureStyle, TilingSprite } from "pixi.js";
import { CLASSES } from "../game/data/classes";
import { PETS } from "../game/data/pets";
import { ACTS, DIFFICULTIES, MONSTERS, stageInfo, type Theme } from "../game/data/world";
import { heroStats, modifiers } from "../game/stats";
import type { GameEvent, GameState, SpriteRef } from "../game/types";
import { compact } from "./format";
import { SHEETS, TILE, customCanvas, frameOf, type SheetKey } from "./sprites";

TextureStyle.defaultOptions.scaleMode = "nearest";

export const STRIP_HEIGHT = 96;
const GROUND_H = TILE * 2;
const FEET_Y = STRIP_HEIGHT - GROUND_H + 7;
const WALK_SPEED = 70;
const FONT = "Pixelify Sans";
const OUTLINE = 0x2e222f;

const ref = (sheet: SheetKey, index: number): SpriteRef => ({ sheet, index });

const THEMES: Record<Theme, { sky: [string, string]; ground: SpriteRef[]; decor: SpriteRef[] }> = {
  forest: {
    sky: ["#7cc6ff", "#dff3ff"],
    ground: [ref("town", 0), ref("town", 1), ref("town", 0), ref("town", 2)],
    decor: [ref("town", 4), ref("town", 16), ref("town", 5), ref("town", 28), ref("town", 29), ref("town", 3)],
  },
  desert: {
    sky: ["#f6b26b", "#ffe9c4"],
    ground: [ref("dungeon", 48), ref("dungeon", 49), ref("dungeon", 48), ref("dungeon", 53)],
    decor: [ref("dungeon", 65), ref("dungeon", 64), ref("dungeon", 42), ref("dungeon", 65)],
  },
  ember: {
    sky: ["#2a1630", "#7b2d3b"],
    ground: [ref("dungeon", 36), ref("dungeon", 37), ref("dungeon", 38), ref("dungeon", 37)],
    decor: [ref("dungeon", 29), ref("dungeon", 19), ref("dungeon", 41), ref("dungeon", 20)],
  },
};

interface UnitView {
  root: Container;
  body: Sprite;
  bar: Graphics;
  home: number;
  lunge: number;
  flash: number;
  flashColor: number;
  dying: number;
  dir: 1 | -1;
  size: number;
}

interface Floater {
  node: Container;
  vy: number;
  life: number;
  max: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${url}`));
    img.src = url;
  });
}

function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  return (Math.imul(h, 0xc2b2ae35) >>> 0) / 4294967296;
}

export class BattleView {
  readonly app = new Application();
  private images = {} as Record<SheetKey, HTMLImageElement>;
  private sheets = {} as Record<SheetKey, Texture>;
  private textures = new Map<string, Texture>();
  private sky = new Sprite();
  private decor = new TilingSprite();
  private ground = new TilingSprite();
  private units = new Container();
  private fx = new Container();
  private hud = new Container();
  private views = new Map<number, UnitView>();
  private floaters: Floater[] = [];
  private theme: Theme | null = null;
  private stageText!: Text;
  private goldText!: Text;
  private coin!: Sprite;
  private chestText!: Text;
  private banner!: Text;
  private pet = new Sprite();
  private petIndex = -1;
  private width = 640;
  private scroll = 0;
  private clock = 0;
  private lastFrame = 0;

  constructor(private readonly onChestClick: () => void) {}

  async init(): Promise<void> {
    await this.app.init({
      width: this.width,
      height: STRIP_HEIGHT,
      backgroundAlpha: 0,
      antialias: false,
      autoStart: false,
      autoDensity: true,
      resolution: Math.max(1, window.devicePixelRatio),
      roundPixels: true,
      preference: "webgl",
    });
    await document.fonts.load(`12px "${FONT}"`);
    for (const key of Object.keys(SHEETS) as SheetKey[]) {
      this.images[key] = await loadImage(SHEETS[key].url);
      this.sheets[key] = await Assets.load<Texture>(SHEETS[key].url);
    }
    this.ground.tileScale.set(2);
    this.decor.tileScale.set(2);
    this.pet.anchor.set(0.5, 1);
    this.pet.scale.set(1.5);
    this.app.stage.addChild(this.sky, this.decor, this.ground, this.pet, this.units, this.fx, this.hud);
    this.buildHud();
    this.layout();
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  resize(width: number): void {
    const w = Math.max(240, Math.floor(width));
    if (w === this.width) return;
    this.width = w;
    this.app.renderer.resize(w, STRIP_HEIGHT);
    this.layout();
  }

  frame(state: GameState, events: readonly GameEvent[]): void {
    const now = performance.now();
    const dt = this.lastFrame === 0 ? 0 : Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.clock += dt;
    const battle = state.battle;
    const theme = ACTS[stageInfo(battle.stage).act]!.theme;
    if (theme !== this.theme) this.applyTheme(theme);

    if (battle.phase.kind === "advancing") this.scroll += WALK_SPEED * dt;
    this.ground.tilePosition.x = -this.scroll;
    this.decor.tilePosition.x = -this.scroll * 0.5;

    this.syncUnits(state);
    for (const event of events) this.applyEvent(state, event);
    this.animateUnits(state, dt);
    this.animateFloaters(dt);
    this.updateHud(state);
    this.app.render();
  }

  private texture(sprite: SpriteRef): Texture {
    const key = sprite.sheet === "custom" ? `custom:${sprite.name}` : `${sprite.sheet}:${sprite.index}`;
    const cached = this.textures.get(key);
    if (cached) return cached;
    let texture: Texture;
    if (sprite.sheet === "custom") {
      texture = Texture.from(customCanvas(sprite.name));
    } else {
      const { x, y } = frameOf(sprite.sheet, sprite.index);
      texture = new Texture({ source: this.sheets[sprite.sheet].source, frame: new Rectangle(x, y, TILE, TILE) });
    }
    this.textures.set(key, texture);
    return texture;
  }

  private stripCanvas(tiles: number, pick: (i: number) => SpriteRef | null): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = tiles * TILE;
    canvas.height = TILE;
    const ctx = canvas.getContext("2d")!;
    for (let i = 0; i < tiles; i++) {
      const tile = pick(i);
      if (!tile || tile.sheet === "custom") continue;
      const { x, y } = frameOf(tile.sheet, tile.index);
      ctx.drawImage(this.images[tile.sheet], x, y, TILE, TILE, i * TILE, 0, TILE, TILE);
    }
    return canvas;
  }

  private applyTheme(theme: Theme): void {
    this.theme = theme;
    const def = THEMES[theme];
    const sky = document.createElement("canvas");
    sky.width = 1;
    sky.height = STRIP_HEIGHT;
    const ctx = sky.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, 0, STRIP_HEIGHT);
    gradient.addColorStop(0, def.sky[0]);
    gradient.addColorStop(1, def.sky[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1, STRIP_HEIGHT);
    this.sky.texture = Texture.from(sky);
    this.ground.texture = Texture.from(this.stripCanvas(16, (i) => def.ground[Math.floor(hash(i) * def.ground.length)]!));
    this.decor.texture = Texture.from(
      this.stripCanvas(32, (i) => (hash(i + 101) < 0.3 ? def.decor[Math.floor(hash(i + 7) * def.decor.length)]! : null)),
    );
    this.stageText.style.fill = theme === "ember" ? 0xffe9c4 : OUTLINE;
    this.layout();
  }

  private layout(): void {
    this.sky.width = this.width;
    this.sky.height = STRIP_HEIGHT;
    this.ground.width = this.width;
    this.ground.height = GROUND_H;
    this.ground.y = STRIP_HEIGHT - GROUND_H;
    this.decor.width = this.width;
    this.decor.height = GROUND_H;
    this.decor.y = STRIP_HEIGHT - GROUND_H * 2 + 6;
    this.goldText.x = this.width - 8;
    this.chestText.parent!.x = this.width - 92;
    this.banner.x = this.width / 2;
  }

  private label(text: string, size: number, fill: number): Text {
    return new Text({
      text,
      style: { fontFamily: FONT, fontSize: size, fill, stroke: { color: OUTLINE, width: 3 } },
      resolution: 2,
    });
  }

  private buildHud(): void {
    this.stageText = new Text({ text: "", style: { fontFamily: FONT, fontSize: 12, fill: OUTLINE }, resolution: 2 });
    this.stageText.position.set(8, 5);
    this.goldText = this.label("0", 12, 0xffd23f);
    this.goldText.anchor.set(1, 0);
    this.goldText.y = 5;
    const coin = new Sprite(this.texture({ sheet: "custom", name: "coin" }));
    coin.anchor.set(1, 0);
    coin.y = 2;
    const chest = new Container();
    const chestIcon = new Sprite(this.texture({ sheet: "dungeon", index: 89 }));
    chestIcon.y = 2;
    this.chestText = this.label("0", 12, 0xffffff);
    this.chestText.position.set(18, 3);
    chest.addChild(chestIcon, this.chestText);
    chest.eventMode = "static";
    chest.cursor = "pointer";
    chest.on("pointertap", this.onChestClick);
    this.banner = this.label("", 18, 0xffffff);
    this.banner.anchor.set(0.5);
    this.banner.y = 34;
    this.hud.addChild(this.stageText, this.goldText, coin, chest, this.banner);
    this.coin = coin;
  }

  private heroFront(): number {
    return Math.round(Math.max(140, Math.min(this.width * 0.4, 420)));
  }

  private syncUnits(state: GameState): void {
    const battle = state.battle;
    const alive = new Set<number>();
    battle.heroes.forEach((unit, i) => {
      alive.add(unit.id);
      const view = this.views.get(unit.id) ?? this.createView(unit.id, CLASSES[unit.cls].sprite, 2, 1, this.heroFront() - i * 40);
      view.home = this.heroFront() - i * 40;
    });
    const first = this.heroFront() + 60;
    const spacing = Math.min(38, (this.width - 24 - first) / Math.max(1, battle.monsters.length - 1));
    battle.monsters.forEach((m, i) => {
      alive.add(m.id);
      const size = m.rank === "act" ? 3 : m.rank === "stage" ? 2.5 : 2;
      const view = this.views.get(m.id) ?? this.createView(m.id, MONSTERS[m.kind].sprite, size, -1, this.width + 30 + i * 20);
      view.home = first + i * spacing;
    });
    for (const [id, view] of this.views) {
      if (!alive.has(id) && view.dying === 0) view.dying = 0.001;
    }
  }

  private createView(id: number, sprite: SpriteRef, size: number, dir: 1 | -1, x: number): UnitView {
    const root = new Container();
    const body = new Sprite(this.texture(sprite));
    body.anchor.set(0.5, 1);
    body.scale.set(size * (dir === -1 && sprite.sheet === "creatures" ? -1 : 1), size);
    const bar = new Graphics();
    root.addChild(body, bar);
    root.position.set(x, FEET_Y);
    this.units.addChild(root);
    const view: UnitView = { root, body, bar, home: x, lunge: 0, flash: 0, flashColor: 0xffffff, dying: 0, dir, size };
    this.views.set(id, view);
    return view;
  }

  private applyEvent(state: GameState, event: GameEvent): void {
    switch (event.type) {
      case "attack": {
        const from = this.views.get(event.from);
        const to = this.views.get(event.to);
        if (from) from.lunge = 1;
        if (!to) return;
        to.flash = 1;
        to.flashColor = 0xffffff;
        if (event.splash) return;
        const color = event.skill ? 0xff9b3f : event.crit ? 0xffd23f : 0xffffff;
        this.float(compact(event.amount) + (event.crit ? "!" : ""), to, event.crit || event.skill ? 15 : 11, color);
        return;
      }
      case "hurt": {
        const from = this.views.get(event.from);
        const to = this.views.get(event.to);
        if (from) from.lunge = 1;
        if (!to) return;
        to.flash = 1;
        to.flashColor = 0xff5a5a;
        this.float(compact(event.amount), to, 10, 0xff7b7b);
        return;
      }
      case "kill": {
        const view = this.views.get(event.id);
        if (view) this.float(`+${compact(event.gold)}g`, view, 10, 0xffd23f, -14);
        return;
      }
      case "chest": {
        const front = this.views.get(state.battle.heroes[0]?.id ?? -1);
        if (front) this.float("chest!", front, 12, 0x9ef0ff, -22);
        return;
      }
      case "levelUp": {
        const unit = state.battle.heroes.find((h) => h.cls === event.cls);
        const view = unit && this.views.get(unit.id);
        if (view) this.float(`LV ${event.level}`, view, 13, 0x6ff0ff, -26);
        return;
      }
      default:
        return;
    }
  }

  private float(text: string, view: UnitView, size: number, fill: number, offset = 0): void {
    const node = this.label(text, size, fill);
    node.anchor.set(0.5, 1);
    node.position.set(view.root.x + (Math.random() - 0.5) * 12, FEET_Y - TILE * view.size - 4 + offset);
    this.fx.addChild(node);
    this.floaters.push({ node, vy: -26, life: 0.9, max: 0.9 });
    if (this.floaters.length > 40) {
      const old = this.floaters.shift();
      old?.node.destroy();
    }
  }

  private animateUnits(state: GameState, dt: number): void {
    const battle = state.battle;
    const walking = battle.phase.kind === "advancing";
    const mods = modifiers(state);
    const maxHp = new Map(battle.heroes.map((h) => [h.id, heroStats(state, h.cls, mods).maxHp]));
    for (const [id, view] of this.views) {
      const { root, body } = view;
      if (view.dying > 0) {
        view.dying += dt;
        root.alpha = Math.max(0, 1 - view.dying / 0.4);
        root.y = FEET_Y + view.dying * 20;
        if (view.dying >= 0.4) {
          root.destroy({ children: true });
          this.views.delete(id);
        }
        continue;
      }
      root.x += (view.home - root.x) * Math.min(1, dt * 8);
      view.lunge = Math.max(0, view.lunge - dt * 6);
      body.x = Math.sin(view.lunge * Math.PI) * 7 * view.dir;
      const bob = walking && view.dir === 1 ? Math.abs(Math.sin(this.clock * 10 + id)) * 3 : Math.sin(this.clock * 3 + id) * 0.6;
      body.y = -bob;
      view.flash = Math.max(0, view.flash - dt * 7);
      body.tint = view.flash > 0.2 ? view.flashColor : 0xffffff;

      const hero = battle.heroes.find((h) => h.id === id);
      const monster = battle.monsters.find((m) => m.id === id);
      const down = !!hero && hero.reviveIn > 0;
      body.rotation = down ? -Math.PI / 2 : 0;
      body.alpha = down ? 0.55 : 1;
      const ratio = hero ? hero.hp / (maxHp.get(id) ?? 1) : monster ? monster.hp / monster.maxHp : 1;
      this.drawBar(view, Math.max(0, Math.min(1, ratio)), !!monster && monster.rank !== "none");
    }
    const lastHero = battle.heroes.at(-1);
    const petX = lastHero ? this.heroFront() - battle.heroes.length * 40 + 8 : 0;
    this.pet.x = petX;
    this.pet.y = FEET_Y - 2 - Math.abs(Math.sin(this.clock * 6)) * (walking ? 4 : 1.5);
  }

  private drawBar(view: UnitView, ratio: number, boss: boolean): void {
    const w = boss ? 34 : 22;
    const y = -TILE * view.size - 6;
    const color = ratio > 0.5 ? 0x5ad35f : ratio > 0.25 ? 0xffc43a : 0xff4d4d;
    view.bar.clear().rect(-w / 2 - 1, y - 1, w + 2, 5).fill(OUTLINE).rect(-w / 2, y, w * ratio, 3).fill(color);
  }

  private animateFloaters(dt: number): void {
    this.floaters = this.floaters.filter((f) => {
      f.life -= dt;
      f.node.y += f.vy * dt;
      f.vy *= 0.94;
      f.node.alpha = Math.min(1, f.life / (f.max * 0.4));
      if (f.life > 0) return true;
      f.node.destroy();
      return false;
    });
  }

  private updateHud(state: GameState): void {
    const battle = state.battle;
    const info = stageInfo(battle.stage);
    const wave = Math.min(battle.wave + 1, battle.waves);
    this.stageText.text = `${DIFFICULTIES[info.difficulty]} · ${ACTS[info.act]!.name} ${info.label}   wave ${wave}/${battle.waves}`;
    this.goldText.text = compact(state.gold);
    this.coin.x = this.goldText.x - this.goldText.width - 2;
    this.chestText.text = String(state.chests.length);
    this.banner.text =
      battle.phase.kind === "cleared" ? "Stage clear!" : battle.phase.kind === "defeated" ? (state.autoAdvance ? "Defeated, falling back" : "Defeated, retrying") : "";
    const unlocked = PETS.reduce((best, pet, i) => ((state.kills[pet.hunt] ?? 0) >= pet.kills ? i : best), -1);
    if (unlocked !== this.petIndex) {
      this.petIndex = unlocked;
      const pet = PETS[unlocked];
      this.pet.visible = !!pet;
      if (pet) this.pet.texture = this.texture(pet.sprite);
    }
  }
}
