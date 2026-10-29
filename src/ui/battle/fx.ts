import { Container, Sprite, Texture, type BLEND_MODES } from "pixi.js";
import type { Theme } from "../../game/data/world";
import { GROUND_Y } from "./backdrop";
import type { FxKey, TextureBank } from "./textures";

interface Anim {
  sprite: Sprite;
  frames: Texture[];
  fps: number;
  t: number;
}

interface Projectile {
  spin: boolean;
  sprite: Sprite;
  frames: Texture[];
  from: { x: number; y: number };
  to: { x: number; y: number };
  t: number;
  duration: number;
  arc: number;
  onHit: () => void;
}

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  life: number;
  max: number;
  target?: { x: number; y: number };
}

export interface PlayOptions {
  fps?: number;
  flip?: boolean;
  scale?: number;
  tint?: number;
  blend?: BLEND_MODES;
  rotation?: number;
  anchorY?: number;
}

const MAX_PARTICLES = 420;

export class Effects {
  readonly back = new Container();
  readonly front = new Container();
  readonly ambient = new Container();
  private anims: Anim[] = [];
  private projectiles: Projectile[] = [];
  private particles: Particle[] = [];
  private ambientParticles: Particle[] = [];
  private theme: Theme = "forest";
  private width = 320;
  private spawnClock = 0;

  constructor(private readonly bank: TextureBank) {}

  setTheme(theme: Theme, width: number): void {
    this.width = width;
    if (theme === this.theme && this.ambientParticles.length > 0) return;
    this.theme = theme;
    for (const p of this.ambientParticles) p.sprite.destroy();
    this.ambientParticles = [];
  }

  play(key: FxKey, x: number, y: number, opts: PlayOptions = {}): void {
    const frames = this.bank.effect(key);
    const sprite = new Sprite(frames[0]);
    sprite.anchor.set(0.5, opts.anchorY ?? 0.5);
    sprite.position.set(x, y);
    const scale = opts.scale ?? 1;
    sprite.scale.set(opts.flip ? -scale : scale, scale);
    if (opts.tint !== undefined) sprite.tint = opts.tint;
    if (opts.blend) sprite.blendMode = opts.blend;
    if (opts.rotation) sprite.rotation = opts.rotation;
    this.front.addChild(sprite);
    this.anims.push({ sprite, frames, fps: opts.fps ?? 18, t: 0 });
  }

  projectile(look: FxKey | Texture[], from: { x: number; y: number }, to: { x: number; y: number }, duration: number, arc: number, onHit: () => void, spin = true): void {
    const frames = typeof look === "string" ? this.bank.effect(look) : look;
    const sprite = new Sprite(frames[0]);
    sprite.anchor.set(0.5);
    sprite.position.set(from.x, from.y);
    this.front.addChild(sprite);
    this.projectiles.push({ sprite, frames, from, to, t: 0, duration, arc, onHit, spin });
  }

  burst(x: number, y: number, count: number, colors: number[], speed: number, opts: { gravity?: number; life?: number; up?: number; blend?: BLEND_MODES; size?: number } = {}): void {
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      const sprite = new Sprite(Texture.WHITE);
      const size = opts.size ?? 1;
      sprite.width = size;
      sprite.height = size;
      sprite.tint = colors[Math.floor(Math.random() * colors.length)]!;
      if (opts.blend) sprite.blendMode = opts.blend;
      sprite.position.set(x, y);
      this.front.addChild(sprite);
      const life = (opts.life ?? 0.5) * (0.6 + Math.random() * 0.6);
      this.particles.push({ sprite, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - (opts.up ?? 0), gravity: opts.gravity ?? 60, drag: 2.5, life, max: life });
    }
  }

  coins(x: number, y: number, count: number, target: { x: number; y: number }): void {
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const sprite = new Sprite(Texture.WHITE);
      sprite.width = 2;
      sprite.height = 2;
      sprite.tint = i % 3 === 0 ? 0xfff2a8 : 0xffcc2e;
      sprite.position.set(x + (Math.random() - 0.5) * 6, y);
      this.front.addChild(sprite);
      const life = 1.1 + Math.random() * 0.3;
      this.particles.push({ sprite, vx: (Math.random() - 0.5) * 50, vy: -50 - Math.random() * 30, gravity: 160, drag: 1, life, max: life, target });
    }
  }

  update(dt: number, scrollSpeed: number): void {
    this.anims = this.anims.filter((a) => {
      a.t += dt;
      const index = Math.floor(a.t * a.fps);
      if (index >= a.frames.length) {
        a.sprite.destroy();
        return false;
      }
      a.sprite.texture = a.frames[index]!;
      return true;
    });
    this.projectiles = this.projectiles.filter((p) => {
      p.t += dt;
      const k = Math.min(1, p.t / p.duration);
      const x = p.from.x + (p.to.x - p.from.x) * k;
      const y = p.from.y + (p.to.y - p.from.y) * k - Math.sin(k * Math.PI) * p.arc;
      const dx = x - p.sprite.x;
      const dy = y - p.sprite.y;
      if (p.spin && (dx !== 0 || dy !== 0)) p.sprite.rotation = Math.atan2(dy, dx);
      p.sprite.position.set(x, y);
      p.sprite.texture = p.frames[Math.floor(p.t * 14) % p.frames.length]!;
      if (k < 1) return true;
      p.sprite.destroy();
      p.onHit();
      return false;
    });
    this.particles = this.particles.filter((p) => this.step(p, dt));
    this.spawnAmbient(dt, scrollSpeed);
    this.ambientParticles = this.ambientParticles.filter((p) => {
      p.sprite.x -= scrollSpeed * dt * 0.9;
      return this.step(p, dt);
    });
  }

  private step(p: Particle, dt: number): boolean {
    p.life -= dt;
    if (p.target && p.life < p.max - 0.45) {
      const k = Math.min(1, dt * 7);
      p.sprite.x += (p.target.x - p.sprite.x) * k;
      p.sprite.y += (p.target.y - p.sprite.y) * k;
      if (Math.hypot(p.target.x - p.sprite.x, p.target.y - p.sprite.y) < 3) p.life = 0;
    } else {
      p.vy += p.gravity * dt;
      p.vx *= 1 - p.drag * dt;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      if (!p.target && p.gravity > 0 && p.sprite.y > GROUND_Y + 2) {
        p.sprite.y = GROUND_Y + 2;
        p.vy *= -0.3;
      }
    }
    p.sprite.alpha = p.target ? 1 : Math.min(1, (p.life / p.max) * 2);
    if (p.life > 0) return true;
    p.sprite.destroy();
    return false;
  }

  private spawnAmbient(dt: number, scrollSpeed: number): void {
    this.spawnClock += dt;
    const every = this.theme === "ember" || this.theme === "plague" ? 0.06 : this.theme === "forest" ? 0.35 : 0.12;
    while (this.spawnClock > every && this.ambientParticles.length < 90) {
      this.spawnClock -= every;
      const sprite = new Sprite(Texture.WHITE);
      sprite.width = 1;
      sprite.height = 1;
      let p: Particle;
      if (this.theme === "ember" || this.theme === "plague") {
        sprite.tint = this.theme === "plague" ? (Math.random() < 0.5 ? 0x9fe84a : 0xd7ff7a) : Math.random() < 0.5 ? 0xff7a3a : 0xffc04a;
        sprite.blendMode = "add";
        sprite.position.set(Math.random() * (this.width + scrollSpeed), GROUND_Y + Math.random() * 6);
        const life = 1.6 + Math.random() * 2;
        p = { sprite, vx: (Math.random() - 0.5) * 6, vy: -10 - Math.random() * 12, gravity: 0, drag: 0, life, max: life };
      } else if (this.theme === "desert") {
        sprite.tint = 0xfff0d0;
        sprite.alpha = 0.6;
        sprite.position.set(this.width + 4, 8 + Math.random() * (GROUND_Y - 4));
        const life = 3 + Math.random() * 2;
        p = { sprite, vx: -40 - Math.random() * 40, vy: (Math.random() - 0.5) * 4, gravity: 0, drag: 0, life, max: life };
      } else {
        const leaf = Math.random() < 0.45;
        if (leaf) {
          const frames = this.bank.effect("leaf");
          sprite.texture = frames[Math.floor(Math.random() * frames.length)]!;
          sprite.width = 6;
          sprite.height = 3.5;
        } else {
          sprite.tint = 0xfff7a0;
          sprite.blendMode = "add";
        }
        sprite.position.set(Math.random() * this.width, leaf ? -4 : 14 + Math.random() * (GROUND_Y - 16));
        const life = leaf ? 4 + Math.random() * 3 : 2 + Math.random() * 2;
        p = { sprite, vx: leaf ? -8 - Math.random() * 8 : (Math.random() - 0.5) * 6, vy: leaf ? 9 + Math.random() * 5 : (Math.random() - 0.5) * 6, gravity: 0, drag: 0, life, max: life };
      }
      this.ambient.addChild(sprite);
      this.ambientParticles.push(p);
    }
  }

  clear(): void {
    for (const a of this.anims) a.sprite.destroy();
    for (const p of this.projectiles) p.sprite.destroy();
    for (const p of this.particles) p.sprite.destroy();
    this.anims = [];
    this.projectiles = [];
    this.particles = [];
  }
}
