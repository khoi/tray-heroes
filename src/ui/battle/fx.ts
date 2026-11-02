import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  PointLight,
  Quaternion,
  RingGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from "three";
import { instantiate } from "./assets";
import { CHEST, WEAPONS } from "./models";

export type ProjectileKind = "arrow" | "spear" | "fireball" | "frost" | "chaos" | "spark" | "bone";

interface Particle {
  pos: Vector3;
  vel: Vector3;
  spin: Vector3;
  rot: Quaternion;
  gravity: number;
  drag: number;
  life: number;
  max: number;
  size: number;
  color: Color;
  home?: { to: Vector3; done: () => void; delay: number };
}

interface Transient {
  obj: Object3D;
  t: number;
  max: number;
  tick: (k: number, dt: number) => void;
  done?: () => void;
}

const CAPACITY = 700;
const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpS = new Vector3();
const ZERO = new Matrix4().makeScale(0, 0, 0);

class ParticlePool {
  readonly mesh: InstancedMesh;
  private list: Particle[] = [];

  constructor(geometry: BufferGeometry, material: Material) {
    this.mesh = new InstancedMesh(geometry, material, CAPACITY);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < CAPACITY; i++) {
      this.mesh.setMatrixAt(i, ZERO);
      this.mesh.setColorAt(i, new Color());
    }
  }

  add(p: Particle): void {
    if (this.list.length >= CAPACITY) this.list.shift();
    this.list.push(p);
  }

  update(dt: number): void {
    const arrived: (() => void)[] = [];
    this.list = this.list.filter((p) => {
      p.life -= dt;
      if (p.home) {
        p.home.delay -= dt;
        if (p.home.delay <= 0) {
          const to = p.home.to.clone().sub(p.pos);
          const dist = to.length();
          if (dist < 0.25) {
            arrived.push(p.home.done);
            return false;
          }
          p.vel.lerp(to.normalize().multiplyScalar(Math.max(10, dist * 4)), Math.min(1, dt * 8));
          p.life = Math.max(p.life, 0.2);
        }
      } else p.vel.y -= p.gravity * dt;
      p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.pos.addScaledVector(p.vel, dt);
      p.rot.multiply(tmpQ.setFromAxisAngle(p.spin, dt * 8));
      return p.life > 0;
    });
    for (const done of arrived) done();
    for (let i = 0; i < CAPACITY; i++) {
      const p = this.list[i];
      if (!p) {
        this.mesh.setMatrixAt(i, ZERO);
        continue;
      }
      const k = p.home ? 1 : Math.sqrt(Math.max(0, p.life / p.max));
      tmpM.compose(p.pos, p.rot, tmpS.setScalar(p.size * k));
      this.mesh.setMatrixAt(i, tmpM);
      this.mesh.setColorAt(i, p.color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export interface BurstOptions {
  speed?: number;
  gravity?: number;
  life?: number;
  up?: number;
  size?: number;
  glow?: boolean;
  drag?: number;
  spread?: number;
}

const additive = (color: number, opacity = 1) => new MeshBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });

export class Effects {
  readonly root = new Group();
  private readonly solid = new ParticlePool(new OctahedronGeometry(1, 0), new MeshStandardMaterial({ flatShading: true, roughness: 0.8 }));
  private readonly glow = new ParticlePool(new OctahedronGeometry(1, 0), new MeshBasicMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false }));
  private readonly coins = new ParticlePool(new CylinderGeometry(1, 1, 0.3, 8), new MeshStandardMaterial({ color: 0xffd23f, emissive: 0x7a4a00, metalness: 0.3, roughness: 0.4 }));
  private transients: Transient[] = [];
  private readonly flashes: PointLight[] = [];
  private spear: Object3D | null = null;
  private chest: Object3D | null = null;

  constructor() {
    this.root.add(this.solid.mesh, this.glow.mesh, this.coins.mesh);
    for (let i = 0; i < 2; i++) {
      const light = new PointLight(0xffffff, 0, 9, 1.4);
      this.flashes.push(light);
      this.root.add(light);
    }
  }

  async load(): Promise<void> {
    const [spear, chest] = await Promise.all([instantiate(WEAPONS.spear, { shadows: false }), instantiate(CHEST, { shadows: false })]);
    this.spear = spear.root;
    this.spear.scale.setScalar(WEAPONS.spear.scale ?? 1);
    this.chest = chest.root;
    for (const shared of [this.spear, this.chest]) shared.traverse((o) => (o.userData.shared = true));
  }

  burst(at: Vector3, count: number, colors: number[], opts: BurstOptions = {}): void {
    const pool = opts.glow ? this.glow : this.solid;
    const speed = opts.speed ?? 3;
    for (let i = 0; i < count; i++) {
      const dir = new Vector3((Math.random() - 0.5) * 2, Math.random() * 1.2 - 0.2, (Math.random() - 0.5) * (opts.spread ?? 1.2)).normalize();
      const life = (opts.life ?? 0.6) * (0.6 + Math.random() * 0.6);
      pool.add({
        pos: at.clone(),
        vel: dir.multiplyScalar(speed * (0.4 + Math.random() * 0.8)).add(new Vector3(0, opts.up ?? 1.5, 0)),
        spin: new Vector3(Math.random(), Math.random(), Math.random()).normalize(),
        rot: new Quaternion(),
        gravity: opts.gravity ?? 9,
        drag: opts.drag ?? 0.6,
        life,
        max: life,
        size: (opts.size ?? 0.06) * (0.6 + Math.random() * 0.8),
        color: new Color(colors[Math.floor(Math.random() * colors.length)]!),
      });
    }
  }

  coinsTo(from: Vector3, count: number, to: Vector3, done: () => void): void {
    let left = count;
    for (let i = 0; i < count; i++) {
      this.coins.add({
        pos: from.clone(),
        vel: new Vector3((Math.random() - 0.5) * 3, 3 + Math.random() * 2, (Math.random() - 0.2) * 2),
        spin: new Vector3(1, Math.random(), 0).normalize(),
        rot: new Quaternion(),
        gravity: 9,
        drag: 0.5,
        life: 3,
        max: 3,
        size: 0.09,
        color: new Color(0xffffff),
        home: { to, delay: 0.35 + i * 0.05, done: () => --left === 0 && done() },
      });
    }
  }

  flash(at: Vector3, color: number, intensity = 30): void {
    const light = this.flashes.find((l) => l.intensity <= 0.01) ?? this.flashes[0]!;
    light.color.set(color);
    light.position.copy(at).add(new Vector3(0, 0.5, 1));
    light.intensity = intensity;
  }

  private add(t: Transient): void {
    this.root.add(t.obj);
    this.transients.push(t);
  }

  slash(at: Vector3, color: number, dir: 1 | -1, big = false): void {
    const arc = new Mesh(new TorusGeometry(big ? 0.75 : 0.55, big ? 0.09 : 0.06, 3, 14, Math.PI * 0.85), additive(color));
    arc.position.copy(at);
    const tilt = (Math.random() - 0.5) * 1.2 + (dir === 1 ? -0.6 : 0.6 + Math.PI);
    arc.rotation.set(0, 0, tilt);
    this.add({
      obj: arc,
      t: 0,
      max: 0.2,
      tick: (k) => {
        arc.rotation.z = tilt - dir * k * 1.4;
        arc.scale.setScalar(0.7 + k * 0.5);
        (arc.material as MeshBasicMaterial).opacity = 1 - k * k;
      },
    });
  }

  ring(at: Vector3, color: number, size = 1.2, time = 0.6): void {
    const ring = new Mesh(new RingGeometry(0.75, 1, 28), additive(color, 0.9));
    ring.position.copy(at);
    ring.rotation.x = -Math.PI / 2;
    this.add({
      obj: ring,
      t: 0,
      max: time,
      tick: (k) => {
        ring.scale.setScalar(0.2 + k * size);
        (ring.material as MeshBasicMaterial).opacity = 0.9 * (1 - k);
      },
    });
  }

  pillar(at: Vector3, color: number, height = 2.4, time = 0.8): void {
    const beam = new Mesh(new CylinderGeometry(0.35, 0.55, height, 10, 1, true), additive(color, 0.5));
    beam.position.copy(at).add(new Vector3(0, height / 2, 0));
    this.add({
      obj: beam,
      t: 0,
      max: time,
      tick: (k) => {
        beam.scale.set(1 - k * 0.6, 0.6 + k * 0.4, 1 - k * 0.6);
        (beam.material as MeshBasicMaterial).opacity = 0.5 * Math.sin(Math.PI * Math.min(1, k * 1.3));
      },
    });
  }

  explosion(at: Vector3, colors: number[], size = 1.4): void {
    const core = new Mesh(new IcosahedronGeometry(1, 0), additive(colors[1] ?? colors[0]!, 0.55));
    core.position.copy(at);
    const spin = Math.random() * Math.PI;
    this.add({
      obj: core,
      t: 0,
      max: 0.3,
      tick: (k) => {
        core.scale.setScalar((0.25 + k * 0.75) * size * 0.55);
        core.rotation.set(spin + k, spin, 0);
        (core.material as MeshBasicMaterial).opacity = 0.55 * (1 - k) * (1 - k);
      },
    });
    this.burst(at, 22, colors, { speed: 6, up: 2, life: 0.8, size: 0.09 });
    this.burst(at, 14, colors, { speed: 4, up: 1, life: 0.5, glow: true, size: 0.12, gravity: 0 });
    this.flash(at, colors[0]!, 25);
  }

  lightning(at: Vector3): void {
    const bolt = new Group();
    const material = additive(0xfff7b0);
    let prev = at.clone().add(new Vector3((Math.random() - 0.5) * 1.5, 7, 0));
    const steps = 7;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      const next = new Vector3(at.x + (i === steps ? 0 : (Math.random() - 0.5) * 0.9), at.y + 7 * (1 - k), at.z);
      const seg = new Mesh(new BoxGeometry(0.08, prev.distanceTo(next), 0.08), material);
      seg.position.copy(prev).add(next).multiplyScalar(0.5);
      seg.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), next.clone().sub(prev).normalize());
      bolt.add(seg);
      prev = next;
    }
    this.add({ obj: bolt, t: 0, max: 0.22, tick: (k) => (bolt.visible = k < 0.3 || (k > 0.45 && k < 0.7)) });
    this.burst(at, 12, [0xfff7b0, 0xffffff, 0x9ee8ff], { speed: 5, glow: true, life: 0.4, gravity: 0, size: 0.08 });
    this.flash(at, 0xfff2a8, 50);
  }

  projectile(kind: ProjectileKind, from: Vector3, to: Vector3, duration: number, arc: number, onHit: () => void): void {
    const obj = this.projectileMesh(kind);
    const dir = to.clone().sub(from);
    const last = from.clone();
    const color = PROJECTILE_COLOR[kind];
    let trail = 0;
    this.add({
      obj,
      t: 0,
      max: Math.max(0.05, duration),
      tick: (k, dt) => {
        const p = from.clone().addScaledVector(dir, k);
        p.y += Math.sin(Math.PI * k) * arc;
        obj.position.copy(p);
        const v = p.clone().sub(last);
        if (v.lengthSq() > 1e-6) obj.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), v.normalize());
        last.copy(p);
        trail += dt;
        if (color !== null && trail > 0.02) {
          trail = 0;
          this.burst(p, 1, [color], { speed: 0.3, up: 0, gravity: 0, glow: true, life: 0.3, size: kind === "fireball" ? 0.16 : 0.08 });
        }
      },
      done: onHit,
    });
  }

  chestTo(from: Vector3, to: Vector3, done: () => void): void {
    if (!this.chest) return done();
    const obj = this.chest.clone();
    obj.scale.setScalar(0.9);
    const mid = from.clone().lerp(to, 0.5).add(new Vector3(0, 1.6, 0));
    this.add({
      obj,
      t: 0,
      max: 0.9,
      tick: (k) => {
        const a = from.clone().lerp(mid, k);
        const b = mid.clone().lerp(to, k);
        obj.position.copy(a.lerp(b, k));
        obj.rotation.y = k * 6;
        obj.scale.setScalar(0.9 - k * 0.6);
      },
      done,
    });
  }

  private projectileMesh(kind: ProjectileKind): Object3D {
    switch (kind) {
      case "arrow":
      case "bone": {
        const g = new Group();
        const shaft = new Mesh(new CylinderGeometry(0.015, 0.015, 0.8, 4), new MeshStandardMaterial({ color: kind === "bone" ? 0xe8e0c8 : 0x8a5a32, flatShading: true }));
        const head = new Mesh(new ConeGeometry(0.04, 0.12, 4), new MeshStandardMaterial({ color: 0xc8ccd4, flatShading: true }));
        head.position.y = 0.45;
        const fletch = new Mesh(new BoxGeometry(0.08, 0.14, 0.01), new MeshStandardMaterial({ color: 0xf2efe6 }));
        fletch.position.y = -0.36;
        g.add(shaft, head, fletch);
        return g;
      }
      case "spear": {
        const g = new Group();
        if (this.spear) {
          const s = this.spear.clone();
          s.position.y = -0.8;
          g.add(s);
        }
        return g;
      }
      default: {
        const g = new Group();
        const color = PROJECTILE_COLOR[kind]!;
        g.add(new Mesh(new IcosahedronGeometry(kind === "fireball" ? 0.22 : 0.16, 0), new MeshBasicMaterial({ color })));
        g.add(new Mesh(new IcosahedronGeometry(kind === "fireball" ? 0.4 : 0.3, 1), additive(color, 0.45)));
        return g;
      }
    }
  }

  update(dt: number): void {
    this.solid.update(dt);
    this.glow.update(dt);
    this.coins.update(dt);
    for (const light of this.flashes) light.intensity = Math.max(0, light.intensity - dt * 180);
    const finished: Transient[] = [];
    this.transients = this.transients.filter((t) => {
      t.t += dt;
      const k = Math.min(1, t.t / t.max);
      t.tick(k, dt);
      if (k < 1) return true;
      finished.push(t);
      return false;
    });
    for (const t of finished) {
      t.obj.removeFromParent();
      t.obj.traverse((o) => {
        if (!(o instanceof Mesh) || o.userData.shared) return;
        o.geometry.dispose();
        (o.material as Material).dispose();
      });
      t.done?.();
    }
  }
}

const PROJECTILE_COLOR: Record<ProjectileKind, number | null> = {
  arrow: null,
  bone: null,
  spear: null,
  fireball: 0xff8a2a,
  frost: 0x9ee8ff,
  chaos: 0xb06bff,
  spark: 0xfff07a,
};
