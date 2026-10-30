import { Container, Graphics, Sprite, Texture } from "pixi.js";
import type { Clip } from "./manifest";
import type { UnitArt } from "./textures";

export type Pose = "idle" | "walk" | "attack" | "hurt" | "death";

const FPS = { idle: 7, walk: 11, hurt: 10, death: 9 };
const OUTLINE = 0x2e222f;
const IDLE_ANGLE = { blade: 0.45, bow: 0, staff: 0.15 };
const WEAPON_SCALE = 0.62;

export interface UnitLook {
  art: UnitArt | null;
  still: Texture;
  weapon: Texture | null;
  dir: 1 | -1;
  size: number;
  boss: boolean;
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export class UnitView {
  readonly root = new Container();
  private readonly rig = new Container();
  private readonly body = new Sprite();
  private readonly weapon = new Sprite();
  private readonly bar = new Graphics();
  private readonly shadow = new Graphics();
  private readonly aura = new Graphics();
  private readonly look: UnitLook;
  pose: Pose = "idle";
  private frames: Texture[] = [];
  private fps = 8;
  private loop = true;
  private t = 0;
  private swing = -1;
  private swingDuration = 0.3;
  private attackIndex = 0;
  home: number;
  private knock = 0;
  private flash = 0;
  private flashColor = 0xffffff;
  private fall = 0;
  statusTint: number | null = null;
  shownHp = 1;
  pending = 0;
  fade = 0;
  down = false;

  constructor(look: UnitLook, x: number, y: number) {
    this.look = look;
    this.home = x;
    this.root.position.set(x, y);
    this.rig.scale.set(look.size * look.dir, look.size);
    this.root.addChild(this.aura, this.shadow, this.rig, this.bar);
    const m = look.art?.manifest;
    const foot = Math.max(4, Math.round(((m?.w ?? 16) * look.size) / (m && m.w >= 32 ? 3.2 : 2.6)));
    this.shadow.ellipse(0, 0, foot, 1.5).fill({ color: 0x140b1a, alpha: 0.32 });
    if (m) this.body.anchor.set(m.anchorX / m.w, m.anchorY / m.h);
    else {
      this.body.texture = look.still;
      this.body.anchor.set(0.5, 1);
    }
    this.rig.addChild(this.body);
    if (look.weapon && m?.weapon) {
      this.weapon.texture = look.weapon;
      this.weapon.anchor.set(0.5, m.weapon.kind === "bow" ? 0.5 : 0.85);
      this.weapon.scale.set(WEAPON_SCALE);
      this.weapon.position.set(this.restX(), -Math.round((m.anchorY - m.top) * 0.32));
      this.weapon.rotation = IDLE_ANGLE[m.weapon.kind];
      this.rig.addChild(this.weapon);
    }
    this.play("idle");
  }

  get height(): number {
    const m = this.look.art?.manifest;
    return (m ? m.anchorY - m.top : 14) * this.look.size;
  }

  get alive(): boolean {
    return !this.down && this.fade === 0;
  }

  get worldTop(): number {
    return this.root.y - this.height;
  }

  private clip(clip: Clip | null): void {
    const art = this.look.art;
    this.frames = art && clip ? art.clip(clip) : [];
  }

  play(pose: "idle" | "walk" | "hurt"): void {
    if (this.down) return;
    const m = this.look.art?.manifest;
    if (pose === "hurt" && !m?.hurt) return;
    this.pose = pose;
    this.t = 0;
    this.loop = pose !== "hurt";
    this.fps = FPS[pose];
    this.clip(m ? m[pose] : null);
  }

  attack(heavy: boolean, interval: number): number {
    if (this.down) return 0;
    const m = this.look.art?.manifest;
    const duration = Math.min(0.85, Math.max(0.3, interval * 0.75));
    if (m && m.attacks.length > 0) {
      const clip = heavy ? m.attacks[m.attacks.length - 1]! : m.attacks[this.attackIndex++ % Math.max(1, m.attacks.length - 1)]!;
      this.pose = "attack";
      this.t = 0;
      this.loop = false;
      this.clip(clip);
      this.fps = clip.frames / duration;
      return clip.impact / this.fps;
    }
    this.swing = 0;
    this.swingDuration = Math.min(0.42, duration * 0.8);
    return this.swingDuration * 0.5;
  }

  hurt(color = 0xffffff): void {
    this.flash = 1;
    this.flashColor = color;
    this.knock = 1;
    if (this.pose === "idle" || this.pose === "walk") this.play("hurt");
  }

  die(): void {
    if (this.down) return;
    this.down = true;
    this.swing = -1;
    const death = this.look.art?.manifest.death ?? null;
    this.pose = "death";
    this.t = 0;
    this.loop = false;
    this.fps = FPS.death;
    this.clip(death);
    this.weapon.visible = false;
  }

  revive(): void {
    this.down = false;
    this.fall = 0;
    this.weapon.visible = true;
    this.play("idle");
  }

  update(dt: number, walking: boolean, clock: number): void {
    this.t += dt;
    if (this.look.boss && !this.down) {
      const pulse = 0.5 + Math.sin(clock * 5) * 0.5;
      const r = 7 + this.look.size * 4;
      this.aura
        .clear()
        .ellipse(0, 0, r + pulse, 2.5 + pulse * 0.5)
        .stroke({ color: 0xff4d4d, width: 1, alpha: 0.35 + pulse * 0.35 });
    } else {
      this.aura.clear();
    }
    const m = this.look.art?.manifest;
    if (this.frames.length > 0) {
      let index = Math.floor(this.t * this.fps);
      if (index >= this.frames.length) {
        if (this.loop) index %= this.frames.length;
        else if (this.pose === "death") index = this.frames.length - 1;
        else {
          this.play(walking ? "walk" : "idle");
          index = 0;
        }
      }
      this.body.texture = this.frames[index] ?? this.body.texture;
    } else if (this.pose === "hurt" || (this.pose === "attack" && this.t > this.swingDuration)) {
      this.play(walking ? "walk" : "idle");
    }
    if (!this.down) {
      if (walking && this.pose === "idle") this.play("walk");
      if (!walking && this.pose === "walk") this.play("idle");
    }

    const animated = !!m && (m.walk.frames > 1 || m.idle.frames > 1);
    const bob = animated ? 0 : this.pose === "walk" ? Math.abs(Math.sin(clock * 12 + this.home)) * 2 : Math.sin(clock * 3 + this.home) * 0.4;
    this.body.y = -bob;

    const deathClip = !!m?.death;
    this.fall = this.down && !deathClip ? Math.min(1, this.fall + dt * 5) : 0;
    this.rig.rotation = -this.fall * (Math.PI / 2) * this.look.dir;

    this.updateWeapon(dt);
    this.root.x += (this.home - this.root.x) * Math.min(1, dt * 7);
    this.knock = Math.max(0, this.knock - dt * 6);
    this.rig.x = -this.knock * 2 * this.look.dir;
    this.flash = Math.max(0, this.flash - dt * 6);
    const tint = this.flash > 0.35 ? this.flashColor : (this.statusTint ?? 0xffffff);
    this.body.tint = tint;
    this.weapon.tint = tint;
    this.rig.alpha = this.down && !deathClip && this.fade === 0 ? 0.6 : 1;
    if (this.fade > 0) {
      this.fade += dt;
      this.root.alpha = Math.max(0, 1 - Math.max(0, this.fade - 0.45) / 0.45);
    }
  }

  private updateWeapon(dt: number): void {
    const kind = this.look.art?.manifest.weapon?.kind;
    if (this.swing < 0) {
      this.body.x = 0;
      if (kind) this.weapon.rotation += (IDLE_ANGLE[kind] - this.weapon.rotation) * Math.min(1, dt * 10);
      this.weapon.x += (this.restX() - this.weapon.x) * Math.min(1, dt * 10);
      return;
    }
    this.swing += dt / this.swingDuration;
    const t = Math.min(1, this.swing);
    if (kind === "bow") {
      this.weapon.x = this.restX() - (t < 0.5 ? ease(t * 2) * 2 : (1 - ease((t - 0.5) * 2)) * 2);
      this.body.x = t < 0.5 ? -ease(t * 2) : -(1 - (t - 0.5) * 2);
    } else if (kind === "staff") {
      this.weapon.rotation = t < 0.4 ? mix(IDLE_ANGLE.staff, -0.6, ease(t / 0.4)) : t < 0.6 ? mix(-0.6, 1, ease((t - 0.4) / 0.2)) : mix(1, IDLE_ANGLE.staff, ease((t - 0.6) / 0.4));
      this.body.x = t < 0.6 ? 0 : Math.sin(((t - 0.6) / 0.4) * Math.PI) * 2;
    } else {
      if (kind) {
        this.weapon.rotation = t < 0.35 ? mix(IDLE_ANGLE.blade, -1.3, ease(t / 0.35)) : t < 0.6 ? mix(-1.3, 2.1, ease((t - 0.35) / 0.25)) : mix(2.1, IDLE_ANGLE.blade, ease((t - 0.6) / 0.4));
      }
      this.body.x = t < 0.35 ? -ease(t / 0.35) * 1.5 : t < 0.6 ? mix(-1.5, 5, ease((t - 0.35) / 0.25)) : mix(5, 0, ease((t - 0.6) / 0.4));
    }
    if (this.swing >= 1) this.swing = -1;
  }

  private restX(): number {
    const m = this.look.art?.manifest;
    return m ? Math.round(m.w * 0.3) : 0;
  }

  drawBar(ratio: number): void {
    if (this.pending === 0) this.shownHp += (ratio - this.shownHp) * 0.25;
    const shown = Math.max(0, Math.min(1, this.shownHp));
    if (this.down || this.fade > 0) {
      this.bar.clear();
      return;
    }
    const w = this.look.boss ? 20 : 12;
    const y = -this.height - 4;
    const color = shown > 0.5 ? 0x6fd36a : shown > 0.25 ? 0xffc43a : 0xff4d4d;
    this.bar
      .clear()
      .rect(-w / 2 - 1, y - 1, w + 2, 3)
      .fill(OUTLINE)
      .rect(-w / 2, y, Math.max(0, Math.round(w * shown)), 1)
      .fill(color);
  }

  applyHit(ratio: number): void {
    this.pending = Math.max(0, this.pending - 1);
    this.shownHp = ratio;
  }
}
