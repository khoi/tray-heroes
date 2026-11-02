import { Vector3 } from "three";
import { CLASSES } from "../../game/data/classes";
import { PETS } from "../../game/data/pets";
import { SKILLS } from "../../game/data/skills";
import { STATUS, type DamageType, type StatusKind } from "../../game/data/stats";
import { DIFFICULTIES, MONSTERS, areaInfo, type MonsterKey } from "../../game/data/world";
import type { ClassKey } from "../../game/schema";
import { heroStats, modifiers, type HeroStats } from "../../game/stats";
import type { BossRank, GameEvent, GameState } from "../../game/types";
import { compact } from "../format";
import { loadModel } from "./assets";
import { audio } from "./audio";
import { Effects, type ProjectileKind } from "./fx";
import { Hud } from "./hud";
import { HERO_MODELS, MONSTER_MODELS, PET_MODELS, type UnitModel } from "./models";
import { Stage } from "./stage";
import { Unit } from "./unit";

const RUN_SPEED = 3.4;
const ENTER_SPEED = 6;
const HERO_GAP = 1.45;
const ENGAGE_GAP = 1.6;
const TYPE_COLOR: Record<DamageType, number> = { physical: 0xffffff, fire: 0xffa25a, cold: 0x9ee8ff, lightning: 0xfff07a, chaos: 0xc79bff };
const TYPE_BURST: Record<DamageType, number[]> = {
  physical: [0xffffff, 0xfff2a8, 0xd8d8d8],
  fire: [0xffa23a, 0xff5a2a, 0xffe08a],
  cold: [0x9ee8ff, 0xffffff, 0x6fc8ff],
  lightning: [0xfff07a, 0xffffff, 0xfff7b0],
  chaos: [0xc79bff, 0x8a4dff, 0xe8d0ff],
};
const TINT_ORDER: StatusKind[] = ["freeze", "stun", "chill", "shock", "ignite", "poison", "bleed"];
const STATUS_COLOR: Record<StatusKind, number> = { stun: 0xfff2a8, freeze: 0x9ee8ff, chill: 0x9ec8ff, ignite: 0xff9b3f, shock: 0xfff07a, bleed: 0xff5a5a, poison: 0x8aff6a };
const CAST_PROJECTILE: Record<DamageType, ProjectileKind> = { physical: "chaos", fire: "fireball", cold: "frost", lightning: "spark", chaos: "chaos" };
const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

interface Scheduled {
  at: number;
  run: () => void;
}

type AttackEvent = Extract<GameEvent, { type: "attack" }>;
type HurtEvent = Extract<GameEvent, { type: "hurt" }>;

export class BattleView {
  readonly element = document.createElement("div");
  private readonly stage = new Stage();
  private readonly fx = new Effects();
  private readonly hud: Hud;
  private readonly units = new Map<number, Unit>();
  private readonly loading = new Set<number>();
  private readonly wanted = new Set<number>();
  private readonly ranks = new Map<number, BossRank>();
  private readonly doomed = new Set<number>();
  private readonly impactAt = new Map<number, number>();
  private readonly stats = new Map<ClassKey, HeroStats>();
  private timeline: Scheduled[] = [];
  private pet: Unit | null = null;
  private petKey: MonsterKey | null = null;
  private clock = 0;
  private lastFrame = 0;
  private hitStop = 0;
  private shake = 0;
  private w = 0;
  private h = 0;
  private readonly tmp = new Vector3();

  constructor(onChestClick: () => void) {
    this.hud = new Hud(() => {
      audio.play("open", 0.5);
      onChestClick();
    });
    this.element.className = "battle";
    this.element.style.cssText = "position:relative;width:100%;height:100%;overflow:hidden";
    this.stage.canvas.style.cssText = "display:block;width:100%;height:100%";
    this.element.append(this.stage.canvas, this.hud.root);
    this.stage.scene.add(this.fx.root);
  }

  async init(): Promise<void> {
    await Promise.all([this.fx.load(), ...Object.values(HERO_MODELS).map(loadModel)]);
    for (const def of [...Object.values(MONSTER_MODELS), ...Object.values(PET_MODELS)]) void loadModel(def);
  }

  resize(width: number, height: number): void {
    const w = Math.max(240, Math.floor(width));
    const h = Math.max(60, Math.floor(height));
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.stage.resize(w, h);
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
    this.stage.setTheme(area.theme);
    audio.setTheme(area.theme);

    const mods = modifiers(state);
    this.stats.clear();
    for (const unit of battle.heroes) this.stats.set(unit.cls, heroStats(state, unit.cls, mods, {}, area.resPenalty));

    const running = battle.phase.kind === "advancing";
    if (running) this.stage.scroll(RUN_SPEED * dt);

    this.sync(state);
    for (const event of events) this.handle(state, event);
    this.vanishOrphans();
    this.runTimeline();

    const alive = new Set<number>();
    for (const [id, unit] of this.units) {
      const hero = battle.heroes.find((x) => x.id === id);
      const monster = hero ? undefined : battle.monsters.find((x) => x.id === id);
      const gap = unit.home - unit.root.position.x;
      const step = Math.sign(gap) * Math.min(Math.abs(gap), ENTER_SPEED * dt);
      if (unit.alive) unit.root.position.x += step;
      const walking = Math.abs(gap) > 0.05;
      unit.update(dt, (running && !!hero) || walking, running && !!hero, this.clock);
      const statuses = (hero ?? monster)?.statuses ?? [];
      const top = TINT_ORDER.find((k) => statuses.some((s) => s.kind === k));
      unit.setTint(top ? STATUS_COLOR[top] : null);
      const ratio = hero ? hero.hp / (this.stats.get(hero.cls)?.maxLife ?? 1) : monster ? monster.hp / monster.maxHp : 0;
      if (unit.pending === 0) unit.shown = ratio;
      const head = this.stage.toScreen(unit.head(this.tmp));
      this.hud.bar(id, head.x, head.y - 6, unit.shown, !hero, unit.alive && (!!hero || !!monster) && (unit.shown < 0.999 || !!monster));
      alive.add(id);
      if (unit.finished) {
        unit.dispose();
        this.units.delete(id);
      }
    }
    this.hud.prune(alive);
    this.updatePet(state, dt, running);
    this.fx.update(dt);
    this.stage.update();

    this.shake = Math.max(0, this.shake - realDt * 18);
    this.stage.setShake(this.shake);
    this.updateHud(state, realDt);
    this.stage.render();
  }

  private heroFront(): number {
    return this.stage.left + this.stage.width * 0.4;
  }

  private spawn(id: number, def: UnitModel, facing: 1 | -1, x: number, rank: BossRank = "none"): void {
    if (this.units.has(id) || this.loading.has(id)) return;
    this.loading.add(id);
    const boosted = rank !== "none" && def.height < 2 ? { ...def, height: def.height * 1.5 } : def;
    void Unit.create(boosted, facing).then((unit) => {
      this.loading.delete(id);
      if (!this.wanted.has(id)) return unit.dispose();
      unit.root.position.x = x;
      unit.home = x;
      this.stage.scene.add(unit.root);
      this.units.set(id, unit);
    });
  }

  private sync(state: GameState): void {
    const battle = state.battle;
    this.wanted.clear();
    battle.heroes.forEach((h, i) => {
      this.wanted.add(h.id);
      const home = this.heroFront() - i * HERO_GAP;
      this.spawn(h.id, HERO_MODELS[h.cls], 1, home - 4);
      const unit = this.units.get(h.id);
      if (!unit) return;
      unit.home = home;
      unit.root.position.z = (i % 2) * -0.35;
      if (h.reviveIn <= 0 && unit.down && unit.pending === 0) {
        unit.revive();
        this.fx.burst(unit.chest(this.tmp), 14, [0xfff2a8, 0xffffff], { glow: true, gravity: -2, life: 0.9 });
        audio.play("heal", 0.5);
      }
    });
    let x = this.heroFront() + ENGAGE_GAP;
    battle.monsters.forEach((m, i) => {
      this.wanted.add(m.id);
      if (!this.ranks.has(m.id)) this.ranks.set(m.id, m.rank);
      const unit = this.units.get(m.id);
      const r = unit?.radius ?? Math.max(0.5, MONSTER_MODELS[m.kind].height * 0.4);
      x += r;
      const home = Math.min(x, this.stage.right - r);
      this.spawn(m.id, MONSTER_MODELS[m.kind], -1, home + 2.5 + i * 0.4, m.rank);
      if (unit) {
        unit.home = home;
        unit.root.position.z = i === 0 ? 0 : ((i % 3) - 1) * 0.45;
      }
      x += r + 0.3;
    });
  }

  private vanishOrphans(): void {
    for (const [id, unit] of this.units) {
      if (this.wanted.has(id) || this.doomed.has(id) || !unit.alive) continue;
      unit.vanish();
      this.fx.burst(unit.chest(this.tmp), 8, [0xd9c7a3, 0xffffff], { speed: 2, life: 0.5 });
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

  private float(text: string, at: Vector3, size: number, color: number): void {
    const p = this.stage.toScreen(at);
    this.hud.float(text, p.x, p.y, size, hex(color));
  }

  private anchorWorld(anchor: { x: number; y: number }): Vector3 {
    return this.stage.fromScreen(anchor.x, anchor.y, 3);
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
        const front = state.battle.monsters[0];
        const source = (front && this.units.get(front.id)) ?? [...this.units.values()].at(-1);
        const from = source ? source.chest(new Vector3()) : new Vector3(this.heroFront() + 2, 1, 0);
        this.schedule(0.35, () => {
          this.fx.burst(from, 16, [0xfff2a8, 0xffffff, 0x9ef0ff], { glow: true, speed: 4, life: 0.7, gravity: 2 });
          this.fx.ring(new Vector3(from.x, 0.05, from.z), 0xfff2a8, 2.2, 0.6);
          this.fx.chestTo(from, this.anchorWorld(this.hud.chestAnchor), () => this.hud.pulseChest());
          audio.play("chest", 0.7);
        });
        return;
      }
      case "levelUp": {
        const unit = [...this.units.entries()].find(([id]) => state.battle.heroes.some((h) => h.id === id && h.cls === e.cls))?.[1];
        if (!unit) return;
        const feet = unit.root.position.clone();
        this.fx.pillar(feet, 0x7ff3ff, 2.6, 0.9);
        this.fx.ring(feet.clone().setY(0.05), 0x9ef0ff, 2.4, 0.8);
        this.fx.burst(unit.chest(new Vector3()), 20, [0x9ef0ff, 0xffffff, 0x6fd3ff], { glow: true, gravity: -3, life: 1, speed: 2 });
        this.float("LEVEL UP!", unit.head(new Vector3()), 13, 0x7ff3ff);
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
        this.hud.showBanner("STAGE CLEAR");
        audio.play("clear", 0.3);
        return;
      case "defeated":
        this.hud.showBanner(state.autoAdvance ? "DEFEATED · FALLING BACK" : "DEFEATED · RETRYING");
        audio.play("defeat", 0.35);
        return;
      default:
        return;
    }
  }

  private skillAoe(e: AttackEvent): boolean {
    const def = e.skill ? SKILLS[e.skill] : null;
    return !!def && def.kind === "active" && def.effects.some((ef) => (ef.kind === "hit" || ef.kind === "trap") && ef.target !== "front");
  }

  private heroAttack(state: GameState, e: AttackEvent): void {
    const target = this.units.get(e.to);
    const attacker = this.units.get(e.from);
    const hero = state.battle.heroes.find((h) => h.id === e.from);
    if (!target || !hero) return;
    const cls = hero.cls;
    const aoe = this.skillAoe(e);
    target.pending++;
    if (e.splash && !aoe) {
      const delay = Math.max(0, (this.impactAt.get(e.to) ?? this.clock) - this.clock);
      this.schedule(delay, () => {
        target.applyHit(this.ratioOf(state, e.to));
        target.hurt(0xffb38a);
        this.fx.burst(target.chest(new Vector3()), 6, TYPE_BURST[e.damage], { speed: 3, life: 0.4 });
      });
      return;
    }
    const style = HERO_MODELS[cls].attack ?? "melee";
    const interval = this.stats.get(cls)?.interval ?? 1;
    const windup = attacker && !e.splash ? attacker.attack(style, interval, e.skill !== null) : 0;
    const from = attacker ? attacker.chest(new Vector3()).add(new Vector3(0.45, 0.25, 0.1)) : new Vector3(this.heroFront(), 1.2, 0);
    const to = target.chest(new Vector3());
    const impact = () => this.impact(state, e, cls);
    const stagger = e.splash ? 0.07 * (1 + Math.random()) : 0;
    let land = windup;
    if (aoe && (e.damage === "fire" || e.damage === "cold")) {
      land = windup + 0.45 + stagger;
      this.schedule(windup + stagger, () => {
        this.fx.projectile(e.damage === "fire" ? "fireball" : "frost", to.clone().add(new Vector3(-2.5, 6, 0)), to, 0.45, 0, impact);
        if (!e.splash) audio.play("fireball", 0.5);
      });
    } else if (aoe && style === "shoot") {
      land = windup + 0.35 + stagger;
      this.schedule(windup + stagger, () => {
        this.fx.projectile("arrow", to.clone().add(new Vector3(-3, 6, 0)), to, 0.35, 0, impact);
        if (!e.splash) audio.play("bow", 0.6);
      });
    } else if (e.damage === "lightning" && e.skill) {
      land = windup + 0.05 + stagger;
      this.schedule(land, impact);
    } else if (style === "shoot" || style === "throw" || style === "cast") {
      const kind: ProjectileKind = style === "shoot" ? "arrow" : style === "throw" ? "spear" : CAST_PROJECTILE[e.damage];
      const speed = style === "cast" ? 11 : 18;
      const flight = Math.max(0.1, from.distanceTo(to) / speed);
      land = windup + flight;
      this.schedule(windup, () => {
        this.fx.projectile(kind, from, to, flight, style === "cast" ? 0.15 : 0.4, impact);
        audio.play(style === "cast" ? "magic" : "bow", 0.4);
      });
    } else {
      this.schedule(windup, impact);
      this.schedule(Math.max(0, windup - 0.08), () => audio.play(e.skill ? "slash2" : "slash", 0.45));
    }
    this.impactAt.set(e.to, Math.max(this.impactAt.get(e.to) ?? 0, this.clock + land));
  }

  private impact(state: GameState, e: AttackEvent, cls: ClassKey): void {
    const target = this.units.get(e.to);
    if (!target) return;
    const crit = e.outcome === "crit";
    const skill = e.skill !== null;
    target.applyHit(this.ratioOf(state, e.to));
    target.hurt();
    const at = target.chest(new Vector3());
    const feet = target.root.position.clone().setY(0.1);
    const melee = !CLASSES[cls].ranged;
    if (skill && (e.damage === "fire" || this.skillAoe(e))) {
      this.fx.explosion(at, TYPE_BURST[e.damage], e.damage === "fire" ? 1.8 : 1.3);
      this.fx.ring(feet, TYPE_COLOR[e.damage], 2.6, 0.5);
      this.shake = Math.max(this.shake, 2.5);
      if (!e.splash) audio.play("explosion", 0.45);
    } else if (skill && e.damage === "lightning") {
      this.fx.lightning(target.root.position.clone());
      this.shake = Math.max(this.shake, 2);
      audio.play("heavy", 0.5);
    } else if (skill && melee) {
      this.fx.slash(at, 0xffffff, 1, true);
      this.fx.slash(at, cls === "slayer" ? 0xff6a6a : 0xfff2a8, -1, true);
      this.fx.ring(feet, 0xd9c7a3, 1.8, 0.4);
      this.fx.burst(feet, 12, [0xd9c7a3, 0xb8a27a], { speed: 3, up: 2, life: 0.6 });
      this.shake = Math.max(this.shake, 2.5);
      audio.play("heavy", 0.6);
    } else if (melee) {
      this.fx.slash(at, cls === "slayer" ? 0xff8a8a : 0xffffff, Math.random() < 0.5 ? 1 : -1, crit);
      audio.play(crit ? "crit" : (["hit1", "hit2", "hit3"] as const)[Math.floor(Math.random() * 3)]!, 0.5);
    } else {
      this.fx.burst(at, 8, TYPE_BURST[e.damage], { glow: e.damage !== "physical", speed: 3.5, life: 0.45, gravity: 3 });
      audio.play(crit ? "crit" : "hit1", 0.4);
    }
    this.fx.burst(at, crit ? 12 : 6, [0xffffff, 0xfff2a8], { speed: crit ? 5 : 3.5, life: 0.35, size: 0.05 });
    if (crit || skill) this.hitStop = Math.max(this.hitStop, skill ? 0.08 : 0.05);
    if (crit) this.shake = Math.max(this.shake, 1.5);
    const color = skill ? 0xff9b3f : crit ? 0xffd23f : TYPE_COLOR[e.damage];
    this.float(compact(e.amount) + (crit ? "!" : ""), target.head(new Vector3()), crit || skill ? 16 : 12, color);
  }

  private monsterAttack(state: GameState, e: HurtEvent): void {
    const target = this.units.get(e.to);
    const attacker = this.units.get(e.from);
    const monster = state.battle.monsters.find((m) => m.id === e.from);
    if (!target) return;
    const def = monster ? MONSTER_MODELS[monster.kind] : null;
    const windup = attacker && monster ? attacker.attack(def?.attack ?? "melee", MONSTERS[monster.kind].interval, e.heavy) : 0;
    target.pending++;
    const impact = () => {
      target.applyHit(this.ratioOf(state, e.to));
      const head = target.head(new Vector3());
      if (e.outcome === "dodged") {
        this.float("Dodge", head, 11, 0xc9c4bd);
        audio.play("whoosh", 0.25);
        return;
      }
      target.hurt(e.outcome === "blocked" ? 0xc7d2e0 : 0xff6b6b);
      const at = target.chest(new Vector3());
      this.fx.slash(at, e.damage === "physical" ? 0xff6b6b : TYPE_COLOR[e.damage], -1);
      this.fx.burst(at, 6, [0xff6b6b, 0xffffff], { speed: 3, life: 0.3 });
      if (e.heavy) this.shake = Math.max(this.shake, 2);
      this.float(e.outcome === "blocked" ? `Block ${compact(e.amount)}` : compact(e.amount), head, 11, e.outcome === "blocked" ? 0xc7d2e0 : 0xff8080);
      audio.play("hit3", e.outcome === "blocked" ? 0.2 : 0.3, e.outcome === "blocked" ? 1.4 : 0.8);
    };
    let land = windup;
    if (monster && MONSTERS[monster.kind].ranged && attacker) {
      const from = attacker.chest(new Vector3()).add(new Vector3(-0.45, 0.2, 0.1));
      const to = target.chest(new Vector3());
      const kind: ProjectileKind = def?.attack === "shoot" ? "bone" : CAST_PROJECTILE[MONSTERS[monster.kind].type];
      const flight = Math.max(0.1, from.distanceTo(to) / 14);
      land = windup + flight;
      this.schedule(windup, () => this.fx.projectile(kind, from, to, flight, 0.3, impact));
    } else {
      this.schedule(windup, impact);
    }
    this.impactAt.set(e.to, Math.max(this.impactAt.get(e.to) ?? 0, this.clock + land));
  }

  private support(state: GameState, e: GameEvent): void {
    switch (e.type) {
      case "heal": {
        const unit = this.units.get(e.to);
        if (!unit) return;
        this.fx.burst(unit.chest(new Vector3()), 12, [0x9effa8, 0xffffff, 0x5aff7a], { glow: true, gravity: -3, life: 0.9, speed: 1.5 });
        this.fx.ring(unit.root.position.clone().setY(0.05), 0x7dff8a, 1.6, 0.6);
        this.float(`+${compact(e.amount)}`, unit.head(new Vector3()), 12, 0x7dff8a);
        audio.play("heal", 0.3);
        return;
      }
      case "buff": {
        const unit = this.units.get(e.from);
        if (!unit) return;
        unit.attack("buff", 0.8);
        this.fx.ring(unit.root.position.clone().setY(0.05), 0xffd23f, 2, 0.7);
        this.fx.pillar(unit.root.position.clone(), 0xffd23f, 2.2, 0.7);
        this.float(SKILLS[e.skill].name, unit.head(new Vector3()).add(new Vector3(0, 0.3, 0)), 11, 0xffe08a);
        audio.play("magic", 0.35);
        return;
      }
      case "trap": {
        this.units.get(e.from)?.attack("throw", 0.8);
        const front = state.battle.monsters[0];
        const target = front && this.units.get(front.id);
        if (target) {
          const at = target.root.position.clone().setY(0.05);
          this.fx.ring(at, 0xd9c7a3, 1.4, 0.8);
          this.fx.burst(at, 8, [0xb8a27a, 0x8a7a5a], { speed: 2, up: 2, life: 0.5 });
        }
        return;
      }
      case "revive": {
        const unit = this.units.get(e.to);
        if (!unit) return;
        unit.revive();
        this.fx.pillar(unit.root.position.clone(), 0xfff2a8, 3, 1);
        this.fx.burst(unit.chest(new Vector3()), 24, [0xfff2a8, 0xffffff], { glow: true, gravity: -3, life: 1.1, speed: 2 });
        this.float("REVIVED", unit.head(new Vector3()), 13, 0xfff2a8);
        audio.play("heal", 0.5, 0.8);
        return;
      }
      case "dot": {
        const unit = this.units.get(e.to);
        if (unit) this.float(compact(e.amount), unit.head(new Vector3()).add(new Vector3(0.3, -0.3, 0)), 10, STATUS_COLOR[e.status]);
        return;
      }
      case "status": {
        const unit = this.units.get(e.to);
        if (!unit) return;
        if (e.status === "freeze" || e.status === "stun") this.float(STATUS[e.status].label, unit.head(new Vector3()).add(new Vector3(0, 0.35, 0)), 10, STATUS_COLOR[e.status]);
        this.fx.burst(unit.chest(new Vector3()), 6, [STATUS_COLOR[e.status], 0xffffff], { glow: true, speed: 2, life: 0.5, gravity: 0 });
        return;
      }
      default:
        return;
    }
  }

  private kill(id: number, gold: number): void {
    const unit = this.units.get(id);
    this.doomed.delete(id);
    this.impactAt.delete(id);
    const rank = this.ranks.get(id) ?? "none";
    this.ranks.delete(id);
    if (!unit) return;
    unit.pending = 0;
    if (gold <= 0) {
      unit.die(false);
      audio.play("hit3", 0.4, 0.6);
      return;
    }
    unit.die(true);
    const at = unit.chest(new Vector3());
    this.fx.burst(at, 10, [0xd9c7a3, 0xffffff, 0x8a8a8a], { speed: 2.5, life: 0.7, gravity: 2 });
    if (rank !== "none") {
      this.fx.explosion(at, [0xffd23f, 0xffffff, 0xff9b3f], rank === "act" ? 3.4 : 2.2);
      this.shake = rank === "act" ? 5 : 3;
      this.hitStop = 0.12;
      this.hud.screenFlash(rank === "act" ? 0.7 : 0.35);
      if (rank === "act") this.hud.showBanner("BOSS DEFEATED");
      audio.play("explosion", 0.6, 0.8);
    }
    this.fx.coinsTo(at, rank === "act" ? 14 : rank === "stage" ? 9 : 5, this.anchorWorld(this.hud.goldAnchor), () => {
      this.hud.pulseGold();
      audio.play("coin", 0.25);
    });
    this.float(`+${compact(gold)}`, unit.head(new Vector3()).add(new Vector3(0, 0.25, 0)), 11, 0xffd23f);
  }

  private updatePet(state: GameState, dt: number, running: boolean): void {
    const best = PETS.reduce<MonsterKey | null>((found, pet) => ((state.kills[pet.hunt] ?? 0) >= pet.kills ? pet.hunt : found), null);
    if (best !== this.petKey) {
      this.petKey = best;
      this.pet?.dispose();
      this.pet = null;
      const def = best ? PET_MODELS[best] : undefined;
      if (def)
        void Unit.create(def, 1).then((unit) => {
          if (this.petKey !== best) return unit.dispose();
          unit.root.position.x = this.heroFront() - 4;
          this.stage.scene.add(unit.root);
          this.pet = unit;
        });
    }
    const pet = this.pet;
    if (!pet) return;
    pet.home = this.heroFront() - state.battle.heroes.length * HERO_GAP + 0.4;
    pet.root.position.z = 0.9;
    const gap = pet.home - pet.root.position.x;
    pet.root.position.x += gap * Math.min(1, dt * 4);
    pet.update(dt, running || Math.abs(gap) > 0.1, running, this.clock);
  }

  private updateHud(state: GameState, dt: number): void {
    const battle = state.battle;
    const area = areaInfo(battle.location);
    this.hud.setStage(area.plague ? `${area.name} ${area.label}  ·  contamination ${Math.floor(state.plague.contamination)}` : `${area.name} ${area.label}  ·  ${DIFFICULTIES[area.difficulty]}`);
    this.hud.setWaves(battle.waves, battle.wave);
    this.hud.setGold(compact(state.gold));
    this.hud.setChests(state.chests.length);
    const boss = battle.monsters.find((m) => m.rank !== "none");
    this.hud.setBoss(boss ? `${MONSTERS[boss.kind].name}${boss.rank === "act" ? " · ACT BOSS" : ""}` : null, boss ? boss.hp / boss.maxHp : 0, boss?.rank === "act");
    this.hud.update(dt);
  }
}
