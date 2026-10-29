import { Application, Container, Graphics, Sprite, Text, type TextStyleOptions } from "pixi.js";
import { CLASSES } from "../../game/data/classes";
import { PETS } from "../../game/data/pets";
import { SKILLS } from "../../game/data/skills";
import { STATUS, type DamageType, type StatusKind } from "../../game/data/stats";
import { DIFFICULTIES, MONSTERS, areaInfo } from "../../game/data/world";
import type { ClassKey } from "../../game/schema";
import { heroStats, modifiers, type HeroStats } from "../../game/stats";
import type { GameEvent, GameState, MonsterUnit } from "../../game/types";
import { compact } from "../format";
import { audio } from "./audio";
import { Backdrop, GROUND_Y, WORLD_H, skyTop } from "./backdrop";
import { Effects } from "./fx";
import { TextureBank } from "./textures";
import { UnitView } from "./units";

const FONT = "Pixelify Sans";
const OUTLINE = 0x2e222f;
const FEET_Y = GROUND_Y + 3;
const WALK_SPEED = 30;
const HERO_GAP = 17;
const MONSTER_GAP = 16;
const MIN_WORLD_W = 240;
const TYPE_COLOR: Record<DamageType, number> = { physical: 0xffffff, fire: 0xffa25a, cold: 0x9ee8ff, lightning: 0xfff07a, chaos: 0xc79bff };
const TINT_ORDER: StatusKind[] = ["freeze", "stun", "chill", "shock", "ignite", "poison", "bleed"];
const STATUS_COLOR: Record<StatusKind, number> = { stun: 0xfff2a8, freeze: 0x9ee8ff, chill: 0x9ec8ff, ignite: 0xff9b3f, shock: 0xfff07a, bleed: 0xff5a5a, poison: 0x8aff6a };

interface Floater {
  text: Text;
  wx: number;
  wy: number;
  vy: number;
  life: number;
  max: number;
}

interface Scheduled {
  at: number;
  run: () => void;
}

export class BattleView {
  readonly app = new Application();
  private readonly bank = new TextureBank();
  private readonly world = new Container();
  private readonly unitLayer = new Container();
  private readonly overlay = new Container();
  private backdrop!: Backdrop;
  private fx!: Effects;
  private views = new Map<number, UnitView>();
  private doomed = new Set<number>();
  private ranks = new Map<number, MonsterUnit["rank"]>();
  private dustClock = 0;
  private readonly flashRect = new Graphics();
  private impactAt = new Map<number, number>();
  private timeline: Scheduled[] = [];
  private floaters: Floater[] = [];
  private pet = new Sprite();
  private petIndex = -2;
  private scale = 3;
  private worldW = 320;
  private screenW = 960;
  private screenH = 168;
  private clock = 0;
  private lastFrame = 0;
  private scroll = 0;
  private hitStop = 0;
  private screenFlash = 0;
  private shake = 0;
  private stats = new Map<ClassKey, HeroStats>();
  private stageText!: Text;
  private waveDots = new Graphics();
  private goldText!: Text;
  private goldPulse = 0;
  private chestText!: Text;
  private chestPulse = 0;
  private coin!: Sprite;
  private chest = new Container();
  private banner!: Text;
  private bannerT = 0;
  private bossBar = new Graphics();
  private bossName!: Text;

  constructor(private readonly onChestClick: () => void) {}

  async init(): Promise<void> {
    await this.app.init({
      width: this.screenW,
      height: this.screenH,
      background: skyTop("forest"),
      antialias: false,
      autoStart: false,
      autoDensity: true,
      resolution: Math.max(1, window.devicePixelRatio),
      roundPixels: true,
      preference: "webgl",
    });
    await document.fonts.load(`12px "${FONT}"`);
    await this.bank.load();
    this.backdrop = new Backdrop(this.bank);
    this.fx = new Effects(this.bank);
    this.pet.anchor.set(0.5, 1);
    this.world.addChild(this.backdrop.root, this.fx.ambient, this.fx.back, this.pet, this.unitLayer, this.fx.front);
    this.app.stage.addChild(this.world, this.flashRect, this.overlay);
    this.buildHud();
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  resize(width: number, height: number): void {
    const w = Math.max(240, Math.floor(width));
    const h = Math.max(WORLD_H, Math.floor(height));
    if (w === this.screenW && h === this.screenH) return;
    this.screenW = w;
    this.screenH = h;
    this.scale = Math.max(1, Math.min(Math.floor(h / WORLD_H), Math.floor(w / MIN_WORLD_W)));
    this.worldW = Math.ceil(w / this.scale);
    this.app.renderer.resize(w, h);
    this.world.scale.set(this.scale);
    this.world.y = h - WORLD_H * this.scale;
    this.backdrop.layout(this.worldW);
    this.layoutHud();
  }

  frame(state: GameState, events: readonly GameEvent[]): void {
    const now = performance.now();
    const realDt = this.lastFrame === 0 ? 0 : Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.clock += realDt;
    this.hitStop = Math.max(0, this.hitStop - realDt);
    const dt = this.hitStop > 0 ? 0 : realDt;

    const battle = state.battle;
    const area = areaInfo(battle.location);
    const theme = area.theme;
    if (this.backdrop.theme !== theme) this.app.renderer.background.color = skyTop(theme);
    this.backdrop.setTheme(theme);
    this.fx.setTheme(theme, this.worldW);
    audio.setTheme(theme);

    const mods = modifiers(state);
    this.stats.clear();
    for (const unit of battle.heroes) this.stats.set(unit.cls, heroStats(state, unit.cls, mods, {}, area.resPenalty));

    const walking = battle.phase.kind === "advancing";
    if (walking) {
      this.scroll += WALK_SPEED * dt;
      this.dustClock += dt;
      if (this.dustClock > 0.16) {
        this.dustClock = 0;
        for (const unit of battle.heroes) {
          const view = this.views.get(unit.id);
          if (view?.alive) this.fx.burst(view.root.x - 3, FEET_Y - 1, 2, [0xd9c7a3, 0xb8a27a], 14, { gravity: 10, life: 0.45, up: 8 });
        }
      }
    }
    this.backdrop.update(this.scroll, dt);

    this.sync(state);
    for (const event of events) this.handle(state, event);
    this.fadeOrphans(state);
    this.runTimeline();

    for (const [id, view] of this.views) {
      const moving = Math.abs(view.home - view.root.x) > 1.5;
      view.update(dt, walking || moving, this.clock);
      const hero = battle.heroes.find((h) => h.id === id);
      const monster = battle.monsters.find((m) => m.id === id);
      const statuses = (hero ?? monster)?.statuses ?? [];
      const top = TINT_ORDER.find((k) => statuses.some((st) => st.kind === k));
      view.statusTint = top ? STATUS_COLOR[top] : null;
      view.drawBar(hero ? hero.hp / (this.stats.get(hero.cls)?.maxLife ?? 1) : monster ? monster.hp / monster.maxHp : 0);
      if (view.fade > 1) {
        view.root.destroy({ children: true });
        this.views.delete(id);
      }
    }
    this.fx.update(dt, walking ? WALK_SPEED : 0);
    this.updatePet(state, dt);

    this.shake = Math.max(0, this.shake - realDt * 18);
    const jitter = this.shake > 0.05 ? Math.round((Math.random() - 0.5) * this.shake) : 0;
    this.world.x = jitter * this.scale;
    this.screenFlash = Math.max(0, this.screenFlash - realDt * 2.5);
    this.flashRect.clear();
    if (this.screenFlash > 0) this.flashRect.rect(0, 0, this.screenW, this.screenH).fill({ color: 0xffffff, alpha: this.screenFlash * 0.5 });
    this.updateHud(state, realDt);
    this.updateFloaters(realDt);
    this.app.render();
  }

  private heroFront(): number {
    return Math.round(this.worldW * 0.42);
  }

  private sync(state: GameState): void {
    const battle = state.battle;
    battle.heroes.forEach((unit, i) => {
      const home = this.heroFront() - i * HERO_GAP;
      let view = this.views.get(unit.id);
      if (!view) {
        const art = this.bank.units[unit.cls] ?? null;
        view = new UnitView({ art, weapon: art?.weapon ?? null, still: this.bank.sprite(CLASSES[unit.cls].sprite), dir: 1, size: 1, boss: false }, home - 30, FEET_Y);
        this.unitLayer.addChild(view.root);
        this.views.set(unit.id, view);
      }
      view.home = home;
      if (unit.reviveIn <= 0 && view.down && view.pending === 0) {
        view.revive();
        this.fx.play("spark", view.root.x, view.worldTop + 4, { fps: 16 });
        audio.play("heal", 0.5);
      }
    });
    const first = this.heroFront() + 30;
    const gap = Math.min(MONSTER_GAP, (this.worldW - 12 - first) / Math.max(1, battle.monsters.length - 1));
    battle.monsters.forEach((m, i) => {
      let view = this.views.get(m.id);
      if (!view) {
        const art = this.bank.units[m.kind] ?? null;
        const size = m.rank === "act" && (art?.manifest.w ?? 16) < 32 ? 2 : 1;
        view = new UnitView(
          { art, weapon: art?.weapon ?? null, still: this.bank.sprite(MONSTERS[m.kind].sprite), dir: -1, size, boss: m.rank !== "none" },
          this.worldW + 14 + i * 12,
          FEET_Y,
        );
        this.unitLayer.addChild(view.root);
        this.views.set(m.id, view);
        this.ranks.set(m.id, m.rank);
      }
      view.home = Math.round(first + i * gap + (m.rank === "act" ? 6 : 0));
    });
    this.unitLayer.children.sort((a, b) => a.x - b.x);
  }

  private fadeOrphans(state: GameState): void {
    const battle = state.battle;
    const alive = new Set<number>([...battle.heroes.map((h) => h.id), ...battle.monsters.map((m) => m.id)]);
    for (const [id, view] of this.views) {
      if (alive.has(id) || this.doomed.has(id) || view.fade > 0) continue;
      view.fade = 0.5;
    }
  }

  private schedule(delay: number, run: () => void): void {
    this.timeline.push({ at: this.clock + Math.max(0, delay), run });
  }

  private runTimeline(): void {
    const due = this.timeline.filter((s) => s.at <= this.clock);
    if (due.length === 0) return;
    this.timeline = this.timeline.filter((s) => s.at > this.clock);
    for (const s of due) s.run();
  }

  private ratioOf(state: GameState, id: number): number {
    const hero = state.battle.heroes.find((h) => h.id === id);
    if (hero) return hero.hp / (this.stats.get(hero.cls)?.maxLife ?? 1);
    const monster = state.battle.monsters.find((m) => m.id === id);
    return monster ? monster.hp / monster.maxHp : 0;
  }

  private chestPoint() {
    return { x: (this.chest.x + 6) / this.scale, y: (12 - this.world.y) / this.scale };
  }

  private goldPoint() {
    return { x: (this.coin.x + 6) / this.scale, y: (12 - this.world.y) / this.scale };
  }

  private handle(state: GameState, e: GameEvent): void {
    switch (e.type) {
      case "attack":
        return this.heroAttack(state, e);
      case "hurt":
        return this.monsterAttack(state, e);
      case "kill":
      case "heroDown": {
        const id = e.id;
        this.doomed.add(id);
        const at = Math.max(this.clock, (this.impactAt.get(id) ?? 0) + 0.02);
        this.schedule(at - this.clock, () => this.kill(id, e.type === "kill" ? e.gold : 0));
        return;
      }
      case "chest": {
        const target = [...this.views.values()].find((v) => v.alive && v.root.x > this.heroFront()) ?? [...this.views.values()][0];
        const from = { x: target?.root.x ?? this.heroFront() + 30, y: FEET_Y - 10 };
        this.schedule(0.35, () => {
          this.fx.burst(from.x, from.y, 14, [0xfff2a8, 0xffffff, 0x9ef0ff], 60, { gravity: 20, life: 0.6 });
          this.fx.play("twinkle", from.x, from.y - 4, { fps: 16 });
          this.fx.projectile([this.bank.sprite({ sheet: "dungeon", index: e.kind === "common" ? 89 : e.kind === "boss" ? 90 : 91 })], from, this.chestPoint(), 0.9, 26, () => {
            this.chestPulse = 1;
          }, false);
          audio.play("chest", 0.7);
        });
        return;
      }
      case "levelUp": {
        const unit = state.battle.heroes.find((h) => h.cls === e.cls);
        const view = unit && this.views.get(unit.id);
        if (!view) return;
        this.fx.play("halo", view.root.x, FEET_Y - 6, { fps: 12, tint: 0x9ef0ff });
        this.fx.play("twinkle", view.root.x, view.worldTop - 2, { fps: 14 });
        this.fx.burst(view.root.x, FEET_Y - 4, 16, [0x9ef0ff, 0xffffff, 0x6fd3ff], 40, { gravity: -30, life: 0.9, blend: "add" });
        this.float("LEVEL UP!", view.root.x, view.worldTop - 4, 13, 0x7ff3ff);
        audio.play("levelup", 0.35);
        return;
      }
      case "heal":
      case "buff":
      case "trap":
      case "revive":
      case "dot":
      case "status":
        return this.support(state, e);
      case "stageCleared":
        this.showBanner("STAGE CLEAR");
        audio.play("clear", 0.3);
        return;
      case "defeated":
        this.showBanner(state.autoAdvance ? "DEFEATED · FALLING BACK" : "DEFEATED · RETRYING");
        audio.play("defeat", 0.35);
        return;
      default:
        return;
    }
  }

  private skillAoe(e: Extract<GameEvent, { type: "attack" }>): boolean {
    const def = e.skill ? SKILLS[e.skill] : null;
    return !!def && def.kind === "active" && def.effects.some((ef) => (ef.kind === "hit" || ef.kind === "trap") && ef.target !== "front");
  }

  private heroAttack(state: GameState, e: Extract<GameEvent, { type: "attack" }>): void {
    const target = this.views.get(e.to);
    const attacker = this.views.get(e.from);
    const unit = state.battle.heroes.find((h) => h.id === e.from);
    if (!target || !unit) return;
    const cls = unit.cls;
    const aoe = this.skillAoe(e);
    if (e.splash && !aoe) {
      target.pending++;
      const delay = Math.max(0, (this.impactAt.get(e.to) ?? this.clock) - this.clock);
      this.schedule(delay, () => {
        target.applyHit(this.ratioOf(state, e.to));
        target.hurt(0xffb38a);
        this.typeFx(e.damage, target.root.x, FEET_Y - 4, 0.7);
      });
      return;
    }
    const interval = this.stats.get(cls)?.interval ?? 1;
    const windup = attacker && !e.splash ? attacker.attack(e.skill !== null, interval) : 0;
    target.pending++;
    const from = attacker ? { x: attacker.root.x + 6, y: FEET_Y - 9 } : { x: this.heroFront(), y: FEET_Y - 9 };
    const to = { x: target.root.x, y: FEET_Y - Math.min(10, target.height * 0.6) };
    const impact = () => this.impact(state, e, cls);
    const ranged = CLASSES[cls].ranged;
    const stagger = e.splash ? 0.07 * (1 + Math.random()) : 0;
    let land = windup;
    if (aoe && (e.damage === "fire" || e.damage === "cold")) {
      land = windup + 0.45 + stagger;
      this.schedule(windup + stagger, () => {
        this.fx.projectile(e.damage === "fire" ? "fireball" : "orb", { x: to.x - 18, y: -8 }, to, 0.45, 0, impact);
        if (!e.splash) audio.play("fireball", 0.5);
      });
    } else if (aoe && ranged && e.damage !== "lightning") {
      land = windup + 0.3 + stagger;
      this.schedule(windup + stagger, () => {
        this.fx.projectile("arrow", { x: to.x - 26, y: -6 }, to, 0.3, 0, impact);
        if (!e.splash) audio.play("bow", 0.6);
      });
    } else if (e.damage === "lightning" && e.skill) {
      land = windup + 0.05 + stagger;
      this.schedule(land - this.clock + this.clock, impact);
    } else if (ranged) {
      const arrow = cls === "ranger" || cls === "hunter";
      const flight = Math.max(0.12, (to.x - from.x) / (arrow ? 260 : 150));
      land = windup + flight;
      this.schedule(windup, () => {
        this.fx.projectile(arrow ? "arrow" : e.damage === "fire" ? "fireball" : "orb", from, to, flight, arrow ? 3 : 1, impact);
        audio.play(arrow ? "bow" : "magic", 0.4);
      });
    } else {
      this.schedule(windup, impact);
      this.schedule(Math.max(0, windup - 0.08), () => audio.play(e.skill ? "slash2" : "slash", 0.45));
    }
    this.impactAt.set(e.to, Math.max(this.impactAt.get(e.to) ?? 0, this.clock + land));
  }

  private typeFx(type: DamageType, x: number, y: number, scale = 1): void {
    if (type === "fire") this.fx.play("flame", x, y + 6, { fps: 20, anchorY: 1, scale });
    else if (type === "cold") this.fx.play("spark", x, y, { fps: 22, tint: 0x9ee8ff, scale });
    else if (type === "lightning") this.fx.play("thunder", x, y + 6, { fps: 22, anchorY: 1, scale });
    else if (type === "chaos") this.fx.play("claw", x, y, { fps: 22, tint: 0xb06bff, scale });
    else this.fx.play("cut", x, y, { fps: 24, scale: scale * 0.8 });
  }

  private impact(state: GameState, e: Extract<GameEvent, { type: "attack" }>, cls: ClassKey): void {
    const target = this.views.get(e.to);
    if (!target) return;
    const crit = e.outcome === "crit";
    const skill = e.skill !== null;
    target.applyHit(this.ratioOf(state, e.to));
    target.hurt();
    const x = target.root.x;
    const y = FEET_Y - Math.min(10, target.height * 0.6);
    if (skill && (e.damage === "fire" || this.skillAoe(e))) {
      this.fx.play("explosion", x, FEET_Y + 2, { fps: 22, anchorY: 1, scale: e.damage === "fire" ? 1 : 0.7 });
      this.fx.burst(x, FEET_Y - 4, 14, e.damage === "fire" ? [0xffa23a, 0xff5a2a, 0xffe08a] : [0xffffff, 0xfff2a8], 90, { up: 30, life: 0.7 });
      this.shake = Math.max(this.shake, 2.5);
      if (!e.splash) audio.play("explosion", 0.45);
    } else if (skill && e.damage === "lightning") {
      this.fx.play("thunder", x, FEET_Y + 2, { fps: 20, anchorY: 1, scale: 1.4 });
      this.shake = Math.max(this.shake, 2);
      audio.play("heavy", 0.5);
    } else if (skill && !CLASSES[cls].ranged) {
      this.fx.play("cross", x, y, { fps: 18 });
      this.fx.play("dust", x, FEET_Y, { fps: 20, anchorY: 1 });
      this.shake = Math.max(this.shake, 2.5);
      audio.play("heavy", 0.6);
    } else if (!CLASSES[cls].ranged) {
      this.fx.play(crit ? "slash2" : "slash", x, y, { fps: 22, flip: Math.random() < 0.5, tint: cls === "slayer" ? 0xff8a8a : undefined });
      audio.play(crit ? "crit" : (["hit1", "hit2", "hit3"] as const)[Math.floor(Math.random() * 3)]!, 0.5);
    } else {
      this.typeFx(e.damage, x, y, crit ? 1 : 0.8);
      audio.play(crit ? "crit" : "hit1", 0.4);
    }
    this.fx.burst(x, y, crit ? 10 : 5, [0xffffff, 0xfff2a8], crit ? 70 : 45, { life: 0.35 });
    if (crit || skill) this.hitStop = Math.max(this.hitStop, skill ? 0.08 : 0.05);
    if (crit) this.shake = Math.max(this.shake, 1.5);
    const color = skill ? 0xff9b3f : crit ? 0xffd23f : TYPE_COLOR[e.damage];
    this.float(compact(e.amount) + (crit ? "!" : ""), x, target.worldTop - 2, crit || skill ? 16 : 12, color);
  }

  private monsterAttack(state: GameState, e: Extract<GameEvent, { type: "hurt" }>): void {
    const target = this.views.get(e.to);
    const attacker = this.views.get(e.from);
    const monster = state.battle.monsters.find((m) => m.id === e.from);
    if (!target) return;
    const windup = attacker && monster ? attacker.attack(e.heavy, MONSTERS[monster.kind].interval) : 0;
    target.pending++;
    const impact = () => {
      target.applyHit(this.ratioOf(state, e.to));
      if (e.outcome === "dodged") {
        this.float("Dodge", target.root.x, target.worldTop - 2, 11, 0xc9c4bd);
        audio.play("whoosh", 0.25);
        return;
      }
      target.hurt(e.outcome === "blocked" ? 0xc7d2e0 : 0xff6b6b);
      this.fx.play("claw", target.root.x + 2, FEET_Y - 8, { fps: 22, flip: true, scale: 0.8, tint: e.damage === "physical" ? undefined : TYPE_COLOR[e.damage] });
      this.fx.burst(target.root.x, FEET_Y - 8, 5, [0xff6b6b, 0xffffff], 40, { life: 0.3 });
      if (e.heavy) this.shake = Math.max(this.shake, 2);
      this.float(e.outcome === "blocked" ? `Block ${compact(e.amount)}` : compact(e.amount), target.root.x, target.worldTop - 2, 11, e.outcome === "blocked" ? 0xc7d2e0 : 0xff8080);
      audio.play("hit3", e.outcome === "blocked" ? 0.2 : 0.3, e.outcome === "blocked" ? 1.4 : 0.8);
    };
    let land = windup;
    if (monster && MONSTERS[monster.kind].ranged && attacker) {
      const from = { x: attacker.root.x - 6, y: FEET_Y - 9 };
      const to = { x: target.root.x, y: FEET_Y - 8 };
      const flight = Math.max(0.12, (from.x - to.x) / 180);
      land = windup + flight;
      this.schedule(windup, () => this.fx.projectile(MONSTERS[monster.kind].type === "physical" ? "arrow" : "orb", from, to, flight, 2, impact));
    } else {
      this.schedule(windup, impact);
    }
    this.impactAt.set(e.to, Math.max(this.impactAt.get(e.to) ?? 0, this.clock + land));
  }

  private support(state: GameState, e: GameEvent): void {
    switch (e.type) {
      case "heal": {
        const view = this.views.get(e.to);
        if (!view) return;
        this.fx.play("twinkle", view.root.x, view.worldTop + 4, { fps: 18, tint: 0x9effa8 });
        this.fx.burst(view.root.x, FEET_Y - 6, 8, [0x9effa8, 0xffffff], 30, { gravity: -40, life: 0.8, blend: "add" });
        this.float(`+${compact(e.amount)}`, view.root.x, view.worldTop - 2, 12, 0x7dff8a);
        audio.play("heal", 0.3);
        return;
      }
      case "buff": {
        const view = this.views.get(e.from);
        if (!view) return;
        view.attack(false, 0.8);
        this.fx.play("halo", view.root.x, FEET_Y - 6, { fps: 14, tint: 0xffd23f });
        this.float(SKILLS[e.skill].name, view.root.x, view.worldTop - 6, 11, 0xffe08a);
        audio.play("magic", 0.35);
        return;
      }
      case "trap": {
        const view = this.views.get(e.from);
        view?.attack(false, 0.8);
        const front = state.battle.monsters[0];
        const target = front && this.views.get(front.id);
        if (target) this.fx.play("ring", target.root.x, FEET_Y, { fps: 12, scale: 0.6, anchorY: 1, tint: 0xd9c7a3 });
        return;
      }
      case "revive": {
        const view = this.views.get(e.to);
        if (!view) return;
        view.revive();
        this.fx.play("halo", view.root.x, FEET_Y - 6, { fps: 10, tint: 0xfff2a8 });
        this.fx.burst(view.root.x, FEET_Y - 4, 20, [0xfff2a8, 0xffffff], 50, { gravity: -40, life: 1, blend: "add" });
        this.float("REVIVED", view.root.x, view.worldTop - 4, 13, 0xfff2a8);
        audio.play("heal", 0.5, 0.8);
        return;
      }
      case "dot": {
        const view = this.views.get(e.to);
        if (view) this.float(compact(e.amount), view.root.x + 4, view.worldTop + 2, 10, STATUS_COLOR[e.status]);
        return;
      }
      case "status": {
        const view = this.views.get(e.to);
        if (view && (e.status === "freeze" || e.status === "stun")) this.float(STATUS[e.status].label, view.root.x, view.worldTop - 8, 10, STATUS_COLOR[e.status]);
        return;
      }
      default:
        return;
    }
  }

  private kill(id: number, gold: number): void {
    const view = this.views.get(id);
    this.doomed.delete(id);
    this.impactAt.delete(id);
    if (!view) return;
    view.pending = 0;
    view.die();
    if (gold <= 0) {
      audio.play("hit3", 0.4, 0.6);
      return;
    }
    view.fade = 0.001;
    this.fx.play("smoke", view.root.x, FEET_Y + 1, { fps: 20, anchorY: 1, scale: 0.6 });
    const rank = this.ranks.get(id);
    this.ranks.delete(id);
    if (rank === "act" || rank === "stage") {
      this.fx.play("explosion", view.root.x, FEET_Y + 2, { fps: 16, anchorY: 1, scale: rank === "act" ? 1.5 : 1 });
      this.fx.burst(view.root.x, FEET_Y - 8, rank === "act" ? 40 : 20, [0xffd23f, 0xffffff, 0xff9b3f], 110, { up: 40, life: 0.9 });
      this.shake = rank === "act" ? 5 : 3;
      this.hitStop = 0.12;
      this.screenFlash = rank === "act" ? 0.7 : 0.35;
      if (rank === "act") this.showBanner("BOSS DEFEATED");
      audio.play("explosion", 0.6, 0.8);
    }
    this.fx.coins(view.root.x, FEET_Y - 6, 5, this.goldPoint());
    this.schedule(0.9, () => {
      this.goldPulse = 1;
      audio.play("coin", 0.25);
    });
    this.float(`+${compact(gold)}`, view.root.x, view.worldTop - 8, 11, 0xffd23f);
  }

  private updatePet(state: GameState, dt: number): void {
    const unlocked = PETS.reduce((best, pet, i) => ((state.kills[pet.hunt] ?? 0) >= pet.kills ? i : best), -1);
    if (unlocked !== this.petIndex) {
      this.petIndex = unlocked;
      const pet = PETS[unlocked];
      this.pet.visible = !!pet;
      if (pet) this.pet.texture = this.bank.sprite(pet.sprite);
    }
    const target = this.heroFront() - state.battle.heroes.length * HERO_GAP + 4;
    this.pet.x += (target - this.pet.x) * Math.min(1, dt * 5);
    this.pet.y = FEET_Y - 1 - Math.abs(Math.sin(this.clock * 6)) * (state.battle.phase.kind === "advancing" ? 3 : 1);
  }

  private textStyle(size: number, fill: number): TextStyleOptions {
    return { fontFamily: FONT, fontSize: size, fill, fontWeight: "600", stroke: { color: OUTLINE, width: 4, join: "round" } };
  }

  private float(text: string, wx: number, wy: number, size: number, fill: number): void {
    const node = new Text({ text, style: this.textStyle(size, fill) });
    node.anchor.set(0.5, 1);
    this.overlay.addChild(node);
    this.floaters.push({ text: node, wx: wx + (Math.random() - 0.5) * 4, wy, vy: -16, life: 0.9, max: 0.9 });
    if (this.floaters.length > 36) this.floaters.shift()?.text.destroy();
  }

  private updateFloaters(dt: number): void {
    this.floaters = this.floaters.filter((f) => {
      f.life -= dt;
      f.wy += f.vy * dt;
      f.vy *= 0.92;
      const k = 1 - f.life / f.max;
      f.text.scale.set(k < 0.12 ? 0.6 + k * 4 : 1);
      f.text.alpha = Math.min(1, f.life / (f.max * 0.35));
      f.text.position.set(Math.round(f.wx * this.scale + this.world.x), Math.round(this.world.y + f.wy * this.scale));
      if (f.life > 0) return true;
      f.text.destroy();
      return false;
    });
  }

  private buildHud(): void {
    this.stageText = new Text({ text: "", style: this.textStyle(13, 0xffffff) });
    this.stageText.position.set(10, 6);
    this.waveDots.position.set(11, 26);
    this.coin = new Sprite(this.bank.sprite({ sheet: "custom", name: "coin" }));
    this.coin.scale.set(1.5);
    this.goldText = new Text({ text: "0", style: this.textStyle(14, 0xffd23f) });
    this.goldText.anchor.set(1, 0);
    const chestIcon = new Sprite(this.bank.sprite({ sheet: "dungeon", index: 89 }));
    chestIcon.scale.set(1.5);
    this.chestText = new Text({ text: "0", style: this.textStyle(14, 0xffffff) });
    this.chestText.position.set(26, 3);
    this.chest.addChild(chestIcon, this.chestText);
    this.chest.eventMode = "static";
    this.chest.cursor = "pointer";
    this.chest.on("pointertap", () => {
      audio.play("open", 0.5);
      this.onChestClick();
    });
    this.banner = new Text({ text: "", style: { ...this.textStyle(22, 0xffffff), letterSpacing: 2 } });
    this.banner.anchor.set(0.5);
    this.bossName = new Text({ text: "", style: this.textStyle(11, 0xffb0b0) });
    this.bossName.anchor.set(0.5, 0);
    this.overlay.addChild(this.stageText, this.waveDots, this.coin, this.goldText, this.chest, this.banner, this.bossBar, this.bossName);
  }

  private layoutHud(): void {
    this.goldText.x = this.screenW - 10;
    this.goldText.y = 6;
    this.chest.position.set(this.screenW - 150, 4);
    this.banner.position.set(this.screenW / 2, this.screenH * 0.36);
    this.bossName.position.set(this.screenW / 2, 4);
  }

  private showBanner(text: string): void {
    this.banner.text = text;
    this.bannerT = 1.4;
  }

  private updateHud(state: GameState, dt: number): void {
    const battle = state.battle;
    const area = areaInfo(battle.location);
    const contamination = area.plague ? `  ·  contamination ${Math.floor(state.plague.contamination)}` : "";
    this.stageText.text = area.plague ? `${area.name} ${area.label}${contamination}` : `${area.name} ${area.label}  ·  ${DIFFICULTIES[area.difficulty]}`;
    this.waveDots.clear();
    for (let i = 0; i < battle.waves; i++) {
      const done = i < battle.wave;
      const current = i === battle.wave;
      this.waveDots.rect(i * 9, 0, 6, 4).fill(done ? 0xffd23f : current ? 0xffffff : 0x000000);
      if (!done && !current) this.waveDots.rect(i * 9, 0, 6, 4).stroke({ color: 0xffffff, width: 1, alpha: 0.6 });
    }
    this.goldText.text = compact(state.gold);
    this.goldPulse = Math.max(0, this.goldPulse - dt * 4);
    this.goldText.scale.set(1 + this.goldPulse * 0.25);
    this.coin.position.set(this.goldText.x - this.goldText.width - 30, 2);
    this.chestText.text = String(state.chests.length);
    this.chestPulse = Math.max(0, this.chestPulse - dt * 3);
    this.chest.scale.set(1 + this.chestPulse * 0.3);
    this.chest.x = this.coin.x - 70;

    this.bannerT = Math.max(0, this.bannerT - dt);
    this.banner.alpha = Math.min(1, this.bannerT * 3);
    this.banner.scale.set(1 + Math.max(0, this.bannerT - 1.2) * 2);
    this.banner.visible = this.bannerT > 0;

    const boss = battle.monsters.find((m) => m.rank !== "none");
    this.bossBar.clear();
    this.bossName.visible = !!boss;
    if (boss) {
      const w = Math.min(220, this.screenW * 0.3);
      const ratio = Math.max(0, boss.hp / boss.maxHp);
      this.bossName.text = `${MONSTERS[boss.kind].name}${boss.rank === "act" ? " · ACT BOSS" : ""}`;
      this.bossBar
        .rect(this.screenW / 2 - w / 2 - 2, 22, w + 4, 9)
        .fill(OUTLINE)
        .rect(this.screenW / 2 - w / 2, 24, w * ratio, 5)
        .fill(boss.rank === "act" ? 0xff4d6d : 0xff8a3d);
    }
  }
}
