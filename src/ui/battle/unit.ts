import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Bone,
  Color,
  Euler,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from "three";
import { instantiate } from "./assets";
import { humanoidClips } from "./clips";
import { WEAPONS, type AttackStyle, type UnitModel, type WeaponKey } from "./models";

const TURN = 0.42;
const SINK_DEPTH = 0.9;

type Dir = readonly [number, number, number];
type Pose = Partial<Record<string, Dir>>;

interface Key {
  at: number;
  pose: Pose;
}

interface Motion {
  keys: Key[];
  impact: number;
  lunge?: number;
}

const MOTIONS: Record<AttackStyle | "lunge" | "hurt" | "buff", Motion> = {
  melee: {
    impact: 0.5,
    keys: [
      { at: 0, pose: {} },
      { at: 0.38, pose: { Spine: [0, 1, -0.25], RightArm: [-0.25, 0.85, -0.35], RightForeArm: [-0.1, 0.9, 0.3], LeftArm: [0.5, -0.6, 0.5] } },
      { at: 0.55, pose: { Spine: [0, 1, 0.45], RightArm: [-0.2, -0.2, 1], RightForeArm: [-0.1, -0.5, 1], LeftArm: [0.5, -0.8, -0.2] } },
      { at: 1, pose: {} },
    ],
  },
  shoot: {
    impact: 0.62,
    keys: [
      { at: 0, pose: {} },
      { at: 0.3, pose: { Spine: [0, 1, 0], LeftArm: [0.05, 0.05, 1], LeftForeArm: [0.05, 0.05, 1], RightArm: [-0.25, 0.05, 1], RightForeArm: [0.6, 0.05, 0.2] } },
      { at: 0.6, pose: { Spine: [0, 1, -0.05], LeftArm: [0.05, 0.05, 1], LeftForeArm: [0.05, 0.05, 1], RightArm: [-0.4, 0.05, 0.6], RightForeArm: [0.7, 0, -0.7] } },
      { at: 0.72, pose: { Spine: [0, 1, -0.1], LeftArm: [0.05, 0.08, 1], LeftForeArm: [0.05, 0.08, 1], RightArm: [-0.8, 0.1, 0.1], RightForeArm: [-0.9, 0.1, -0.3] } },
      { at: 1, pose: {} },
    ],
  },
  throw: {
    impact: 0.5,
    keys: [
      { at: 0, pose: {} },
      { at: 0.4, pose: { Spine: [0, 1, -0.35], RightArm: [-0.4, 0.6, -0.7], RightForeArm: [0, 1, -0.2], LeftArm: [0.3, 0.1, 1] } },
      { at: 0.55, pose: { Spine: [0, 1, 0.4], RightArm: [-0.1, 0.4, 1], RightForeArm: [0, 0.3, 1], LeftArm: [0.4, -0.7, -0.3] } },
      { at: 1, pose: {} },
    ],
  },
  cast: {
    impact: 0.55,
    keys: [
      { at: 0, pose: {} },
      { at: 0.35, pose: { Spine: [0, 1, -0.2], RightArm: [-0.4, 0.9, 0.2], RightForeArm: [-0.1, 1, 0.3], LeftArm: [0.4, 0.9, 0.2], LeftForeArm: [0.1, 1, 0.3] } },
      { at: 0.55, pose: { Spine: [0, 1, 0.3], RightArm: [-0.15, 0.2, 1], RightForeArm: [-0.05, 0.25, 1], LeftArm: [0.15, 0.2, 1], LeftForeArm: [0.05, 0.25, 1] } },
      { at: 1, pose: {} },
    ],
  },
  buff: {
    impact: 0.5,
    keys: [
      { at: 0, pose: {} },
      { at: 0.45, pose: { Spine: [0, 1, -0.15], RightArm: [-0.3, 1, 0.1], RightForeArm: [-0.05, 1, 0.1], LeftArm: [0.3, 1, 0.1], LeftForeArm: [0.05, 1, 0.1] } },
      { at: 1, pose: {} },
    ],
  },
  lunge: {
    impact: 0.5,
    lunge: 0.55,
    keys: [{ at: 0, pose: {} }, { at: 1, pose: {} }],
  },
  hurt: {
    impact: 0,
    keys: [
      { at: 0, pose: {} },
      { at: 0.15, pose: { Spine: [0, 1, -0.55], Neck: [0, 1, -0.5], RightArm: [-0.6, -0.6, 0.4], LeftArm: [0.6, -0.6, 0.4] } },
      { at: 1, pose: {} },
    ],
  },
};

const LIMB_ORDER = ["Spine", "Neck", "RightArm", "RightForeArm", "LeftArm", "LeftForeArm"];

const tmpV = new Vector3();
const tmpV2 = new Vector3();
const tmpQ = new Quaternion();
const tmpQ2 = new Quaternion();
const tmpM = new Matrix4();

function smooth(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

function sample(motion: Motion, t: number, bone: string, out: Vector3): number {
  const keys = motion.keys;
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1]!.at <= t) i++;
  const a = keys[i]!;
  const b = keys[i + 1]!;
  const k = smooth((t - a.at) / Math.max(1e-4, b.at - a.at));
  const da = a.pose[bone];
  const db = b.pose[bone];
  if (!da && !db) return 0;
  const from = da ?? db!;
  const to = db ?? da!;
  out.set(from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, from[2] + (to[2] - from[2]) * k).normalize();
  return da && db ? 1 : da ? 1 - k : k;
}

interface Playing {
  motion: Motion;
  t: number;
  duration: number;
}

function advance(p: Playing | null, dt: number): Playing | null {
  if (!p) return null;
  p.t += dt / p.duration;
  return p.t >= 1 ? null : p;
}

export class Unit {
  readonly root = new Group();
  readonly body = new Group();
  readonly height: number;
  readonly radius: number;
  readonly humanoid: boolean;
  home = 0;
  pending = 0;
  alive = true;
  shown = 1;
  private readonly model: Object3D;
  private readonly mixer: AnimationMixer;
  private readonly bones: Record<string, Bone> = {};
  private readonly materials: MeshStandardMaterial[] = [];
  private readonly locomotion: Partial<Record<"idle" | "walk" | "run", AnimationAction>> = {};
  private current: AnimationAction | null = null;
  private playing: Playing | null = null;
  private hurting: Playing | null = null;
  private flash = 0;
  private flashColor = new Color();
  private tint: Color | null = null;
  private dying = -1;
  private sinks = true;
  private sink = 0;
  private vanishing = -1;
  private bob = Math.random() * 10;
  private readonly baseY: number;

  private constructor(
    readonly def: UnitModel,
    model: Object3D,
    clips: AnimationClip[],
    size: Vector3,
    readonly facing: 1 | -1,
  ) {
    this.model = model;
    this.height = def.height;
    this.baseY = def.fly ?? 0;
    const scale = def.height / Math.max(0.01, size.y);
    this.radius = Math.max(0.45, Math.max(size.x, size.z) * scale * 0.42);
    this.body.scale.setScalar(scale);
    this.body.rotation.y = facing === 1 ? Math.PI / 2 - TURN : -Math.PI / 2 + TURN;
    this.body.add(model);
    this.root.add(this.body);
    model.traverse((o) => {
      if (o instanceof Bone && !this.bones[o.name]) this.bones[o.name] = o;
      if (o instanceof Mesh && o.material instanceof MeshStandardMaterial) this.materials.push(o.material);
    });
    this.humanoid = !!(this.bones.Spine2 && this.bones.LeftForeArm && this.bones.RightUpLeg);
    this.mixer = new AnimationMixer(model);
    this.useClips(clips);
  }

  static async create(def: UnitModel, facing: 1 | -1): Promise<Unit> {
    const inst = await instantiate(def, { ownMaterials: true });
    const unit = new Unit(def, inst.root, inst.clips, inst.size, facing);
    if (unit.humanoid) await unit.loadHumanoidClips();
    unit.mixer.update(0);
    await Promise.all([unit.attach("RightHand", def.right), unit.attach("LeftHand", def.left)]);
    return unit;
  }

  private useClips(clips: AnimationClip[]): void {
    const find = (...names: string[]) => clips.find((c) => names.includes(c.name));
    const idle = find("Idle");
    const walk = this.def.fly ? find("Fly", "Walk") : find("Walk", "Crawl");
    const run = this.def.fly ? find("Fly fast", "Fly", "Run") : find("Run", "Walk", "Crawl");
    if (idle && !this.def.fly) this.locomotion.idle = this.mixer.clipAction(idle);
    else if (walk) this.locomotion.idle = this.mixer.clipAction(walk);
    if (walk) this.locomotion.walk = this.mixer.clipAction(walk);
    if (run) this.locomotion.run = this.mixer.clipAction(run);
    this.setLoco("idle", 0);
  }

  private async loadHumanoidClips(): Promise<void> {
    const clips = await humanoidClips(this.bones);
    this.mixer.stopAllAction();
    this.current = null;
    if (clips.Idle) this.locomotion.idle = this.mixer.clipAction(clips.Idle);
    if (clips.Walk) this.locomotion.walk = this.mixer.clipAction(clips.Walk);
    if (clips.Run) this.locomotion.run = this.mixer.clipAction(clips.Run);
    this.setLoco("idle", 0);
  }

  private async attach(handName: "RightHand" | "LeftHand", key: WeaponKey | undefined): Promise<void> {
    const hand = key && this.bones[handName];
    if (!hand) return;
    const def = WEAPONS[key];
    const { root } = await instantiate(def);
    this.model.updateMatrixWorld(true);
    const toModel = new Matrix4().copy(this.model.matrixWorld).invert();
    const handInModel = new Matrix4().multiplyMatrices(toModel, hand.matrixWorld);
    const at = new Vector3().setFromMatrixPosition(handInModel).add(new Vector3(...(def.pos ?? [0, 0, 0])));
    const turn = new Quaternion().setFromEuler(new Euler(...((def.rot ?? [0, 0, 0]).map((d) => (d * Math.PI) / 180) as [number, number, number])));
    const want = new Matrix4().compose(at, turn, new Vector3().setScalar(def.scale ?? 1));
    new Matrix4().copy(handInModel).invert().multiply(want).decompose(root.position, root.quaternion, root.scale);
    hand.add(root);
  }

  private setLoco(kind: "idle" | "walk" | "run", fade = 0.25, timeScale = 1): void {
    const next = this.locomotion[kind] ?? this.locomotion.idle;
    if (!next) return;
    next.timeScale = timeScale;
    if (next === this.current) return;
    next.reset().play();
    if (this.current) this.current.crossFadeTo(next, fade, false);
    this.current = next;
  }

  attack(style: AttackStyle | "lunge" | "buff", interval: number, heavy = false): number {
    const motion = MOTIONS[this.humanoid ? style : "lunge"];
    const duration = Math.min(0.9, Math.max(0.38, interval * 0.75)) * (heavy ? 1.15 : 1);
    this.playing = { motion, t: 0, duration };
    return duration * motion.impact;
  }

  hurt(color = 0xffffff): void {
    this.flash = 1;
    this.flashColor.set(color);
    this.hurting = { motion: MOTIONS.hurt, t: 0, duration: 0.32 };
  }

  setTint(color: number | null): void {
    if (color === null) this.tint = null;
    else (this.tint ??= new Color()).set(color);
  }

  die(sinks = true): void {
    this.alive = false;
    this.playing = null;
    this.dying = 0;
    this.sinks = sinks;
  }

  vanish(): void {
    if (this.vanishing < 0) this.vanishing = 0;
  }

  get finished(): boolean {
    return this.sink >= 1 || this.vanishing >= 0.35;
  }

  applyHit(ratio: number): void {
    this.pending = Math.max(0, this.pending - 1);
    this.shown = ratio;
  }

  revive(): void {
    this.alive = true;
    this.dying = -1;
    this.sink = 0;
    this.body.rotation.x = 0;
    this.body.rotation.z = 0;
    this.body.position.y = 0;
    this.flash = 1;
    this.flashColor.set(0xfff2a8);
  }

  get down(): boolean {
    return this.dying >= 0;
  }

  head(out = new Vector3()): Vector3 {
    return out.set(this.root.position.x, this.root.position.y + this.baseY + this.height + 0.12, this.root.position.z);
  }

  chest(out = new Vector3()): Vector3 {
    return out.set(this.root.position.x, this.root.position.y + this.baseY + this.height * 0.6, this.root.position.z);
  }

  update(dt: number, moving: boolean, running: boolean, clock: number): void {
    if (this.dying < 0) this.setLoco(moving ? (running ? "run" : "walk") : "idle", 0.25, running ? 1.15 : 1);
    this.mixer.update(dt);
    this.body.position.set(0, this.baseY, 0);
    if (this.def.fly) this.body.position.y += Math.sin(clock * 4 + this.bob) * 0.08;
    this.body.rotation.x = 0;
    this.body.rotation.z = 0;

    this.playing = advance(this.playing, dt);
    this.hurting = advance(this.hurting, dt);
    this.model.updateMatrixWorld(true);
    if (this.def.carry && this.alive) this.applyPose(this.def.carry);
    if (this.playing) this.applyMotion(this.playing);
    if (this.hurting && this.alive) this.applyMotion(this.hurting);

    if (this.dying >= 0) {
      this.dying += dt;
      const fall = smooth(this.dying / 0.45);
      this.body.rotation.z = -this.facing * fall * (Math.PI / 2) * 0.98;
      this.body.position.y = this.baseY * (1 - fall);
      if (this.dying > 0.9 && this.sinks) this.sink = Math.min(1, (this.dying - 0.9) / 0.7);
      this.body.position.y -= this.sink * SINK_DEPTH;
    }

    if (this.vanishing >= 0) {
      this.vanishing += dt;
      this.root.scale.setScalar(Math.max(0.001, 1 - this.vanishing / 0.35));
    }

    this.flash = Math.max(0, this.flash - dt * 6);
    for (const mat of this.materials) {
      if (this.flash > 0) mat.emissive.copy(this.flashColor).multiplyScalar(this.flash * 0.5);
      else if (this.tint) mat.emissive.copy(this.tint).multiplyScalar(0.16);
      else mat.emissive.setRGB(0, 0, 0);
    }
  }

  private applyMotion(p: Playing): void {
    const m = p.motion;
    if (m.lunge) {
      const k = Math.sin(Math.min(1, p.t) * Math.PI);
      const reach = Math.pow(k, 1.6) * m.lunge;
      this.body.position.x += this.facing * reach;
      this.body.rotation.z = -this.facing * 0.18 * k;
      this.rotateBone("Jaw", tmpV.set(1, 0, 0), 0.5 * k);
      this.rotateBone("Head", tmpV.set(1, 0, 0), 0.25 * k);
      return;
    }
    for (const name of LIMB_ORDER) {
      const bone = this.bones[name];
      if (!bone) continue;
      const w = sample(m, p.t, name, tmpV2);
      if (w > 0.001) this.aim(bone, tmpV2, w);
    }
  }

  private applyPose(pose: Pose): void {
    for (const name of LIMB_ORDER) {
      const bone = this.bones[name];
      const dir = pose[name];
      if (bone && dir) this.aim(bone, tmpV2.set(...dir).normalize(), 1);
    }
  }

  private modelQuat(o: Object3D, out: Quaternion): Quaternion {
    o.getWorldQuaternion(out);
    return out.premultiply(this.model.getWorldQuaternion(tmpQ2).invert());
  }

  private rotateBone(name: string, axis: Vector3, angle: number): void {
    const bone = this.bones[name];
    if (!bone?.parent) return;
    const parent = this.modelQuat(bone.parent, new Quaternion());
    const r = tmpQ.setFromAxisAngle(axis, angle);
    bone.quaternion.premultiply(parent.clone().invert().multiply(r).multiply(parent));
    bone.updateMatrixWorld(true);
  }

  private aim(bone: Bone, dir: Vector3, weight: number): void {
    const tip = bone.children.find((c): c is Bone => c instanceof Bone);
    if (!tip || !bone.parent) return;
    const inv = tmpM.copy(this.model.matrixWorld).invert();
    const from = bone.getWorldPosition(new Vector3()).applyMatrix4(inv);
    const to = tip.getWorldPosition(new Vector3()).applyMatrix4(inv);
    const cur = to.sub(from).normalize();
    const r = new Quaternion().setFromUnitVectors(cur, dir);
    const blended = new Quaternion().slerp(r, weight);
    const parent = this.modelQuat(bone.parent, new Quaternion());
    bone.quaternion.premultiply(parent.clone().invert().multiply(blended).multiply(parent));
    bone.updateMatrixWorld(true);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.root.removeFromParent();
    for (const mat of this.materials) mat.dispose();
  }
}

