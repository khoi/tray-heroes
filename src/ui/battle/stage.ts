import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoToneMapping,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PointLight,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import type { Theme } from "../../game/data/world";
import { instantiate } from "./assets";
import { LOOKS, type Band, type Look, type SceneryModel } from "./models";

export const VIEW_H = 3.8;
const CAMERA_D = 30;
const FEET_AT = 0.8;
const CHUNK_W = 8;
const CHUNK_CELLS = 10;
const GROUND_NEAR = 12;
const GROUND_FAR = -16;
const LANE = 1.5;
const HILL_Z = -46;
const HILL_W = 30;
const LIGHTS = 5;

const BANDS: Record<Band, { z: [number, number]; spacing: number }> = {
  back: { z: [-9, -3.4], spacing: 2.2 },
  mid: { z: [-3.1, -2.2], spacing: 3.2 },
  front: { z: [2.1, 3.6], spacing: 1.6 },
};

function hash(x: number, z: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fz = z - zi;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash(xi, zi, seed) + (hash(xi + 1, zi, seed) - hash(xi, zi, seed)) * s(fx);
  const b = hash(xi, zi + 1, seed) + (hash(xi + 1, zi + 1, seed) - hash(xi, zi + 1, seed)) * s(fx);
  return a + (b - a) * s(fz);
}

function groundHeight(x: number, z: number, crypt: boolean): number {
  if (crypt) return 0;
  const lane = Math.abs(z) < LANE + 0.4 ? 0 : 1;
  const behind = z < -3 ? Math.min(1, (-3 - z) / 10) : 0;
  return lane * (noise(x * 0.35, z * 0.35, 3) * 0.25 + behind * (noise(x * 0.12, z * 0.2, 7) * 3.2 + 0.4));
}

interface Placed {
  x: number;
  width: number;
  span: number;
  z: number;
}

interface Scroller extends Placed {
  obj: Object3D;
  light?: number;
  regenerate?: (x: number) => void;
  dispose?: () => void;
}

const MARGIN = 24;
const RETRY_MS = 5000;

export function recycle(item: Placed, travelled: number, viewWidth: number): boolean {
  const depth = (CAMERA_D - item.z) / CAMERA_D;
  if (item.x - travelled >= -(viewWidth / 2) * depth - item.width - 6) return false;
  item.x += item.span;
  return true;
}

export class Stage {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(10, 6, 1, 200);
  theme: Theme | null = null;
  width = 30;
  private look: Look = LOOKS.forest;
  private readonly sun = new DirectionalLight(0xffffff, 2);
  private readonly hemi = new HemisphereLight(0xffffff, 0x444444, 1);
  private readonly world = new Group();
  private scrollers: Scroller[] = [];
  private readonly lights: PointLight[] = [];
  private sky = new CanvasTexture(document.createElement("canvas"));
  private shake = new Vector3();
  private loading = 0;
  private travelled = 0;
  private built = 0;
  private readonly groundMaterial = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
  private readonly hillMaterial = new MeshBasicMaterial({ vertexColors: true });

  constructor() {
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 1024);
    Object.assign(this.sun.shadow.camera, { left: -22, right: 22, top: 9, bottom: -9, near: 1, far: 60 });
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    this.sun.position.set(-8, 16, 10);
    this.sun.target.position.set(0, 0, -1);
    for (let i = 0; i < LIGHTS; i++) {
      const light = new PointLight(0xffffff, 0, 7, 1.6);
      this.lights.push(light);
      this.scene.add(light);
    }
    this.scene.add(this.sun, this.sun.target, this.hemi, this.world);
    this.scene.background = this.sky;
    this.scene.fog = new Fog(0xffffff, CAMERA_D + 8, CAMERA_D + 70);
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  get left(): number {
    return -this.width / 2;
  }

  get right(): number {
    return this.width / 2;
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    const fov = (2 * Math.atan(VIEW_H / 2 / CAMERA_D) * 180) / Math.PI;
    this.camera.fov = fov;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.width = VIEW_H * (w / h);
    this.placeCamera();
    if (this.theme && this.width + MARGIN > this.built) this.rebuild(this.theme);
  }

  private placeCamera(): void {
    const target = (FEET_AT - 0.5) * VIEW_H;
    this.camera.position.set(this.shake.x, 2.6 + this.shake.y, CAMERA_D);
    this.camera.lookAt(this.shake.x * 0.5, target, 0);
  }

  setShake(amount: number): void {
    if (amount <= 0.01) this.shake.set(0, 0, 0);
    else this.shake.set((Math.random() - 0.5) * amount * 0.06, (Math.random() - 0.5) * amount * 0.04, 0);
    this.placeCamera();
  }

  setTheme(theme: Theme): void {
    if (theme === this.theme) return;
    this.theme = theme;
    this.look = LOOKS[theme];
    const look = this.look;
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 256;
    const g = canvas.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, `#${look.skyTop.toString(16).padStart(6, "0")}`);
    grad.addColorStop(0.75, `#${look.skyBottom.toString(16).padStart(6, "0")}`);
    grad.addColorStop(1, `#${look.fog.toString(16).padStart(6, "0")}`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 2, 256);
    this.sky.dispose();
    this.sky = new CanvasTexture(canvas);
    this.sky.colorSpace = SRGBColorSpace;
    this.scene.background = this.sky;
    (this.scene.fog as Fog).color.set(look.fog);
    this.sun.color.set(look.sun);
    this.sun.intensity = look.sunIntensity;
    this.hemi.color.set(look.ambient);
    this.hemi.groundColor.set(look.ambientGround);
    this.hemi.intensity = look.ambientIntensity;
    this.rebuild(theme);
  }

  private rebuild(theme: Theme): void {
    this.build(theme).catch((error: unknown) => {
      console.warn(`Scenery for ${theme} failed to load`, error);
      setTimeout(() => {
        if (this.theme === theme) this.theme = null;
      }, RETRY_MS);
    });
  }

  private async build(theme: Theme): Promise<void> {
    const token = ++this.loading;
    const look = this.look;
    const span = this.width + MARGIN;
    this.built = span;
    const start = this.travelled - span / 2;
    const next: Scroller[] = [];
    try {
      const ground = Math.ceil(span / CHUNK_W) + 1;
      for (let i = 0; i < ground; i++) next.push(this.groundChunk(start + i * CHUNK_W, ground * CHUNK_W, look, theme === "crypt"));
      if (theme !== "crypt") {
        const hillSpan = span * ((CAMERA_D - HILL_Z) / CAMERA_D) + HILL_W * 2;
        const hills = Math.ceil(hillSpan / HILL_W) + 1;
        for (let i = 0; i < hills; i++) next.push(this.hill(this.travelled - hillSpan / 2 + i * HILL_W, hills * HILL_W, look));
      }
      if (look.wall) {
        const wall = await instantiate(look.wall, { shadows: false });
        const w = wall.size.x;
        const count = Math.ceil(span / w) + 1;
        for (let i = 0; i < count; i++) {
          const obj = i === 0 ? wall.root : wall.root.clone();
          obj.position.z = -3.9;
          next.push({ obj, x: start + i * w, width: w, span: count * w, z: -3.9 });
        }
      }
      next.push(...(await this.scatter(look.scenery, span, theme === "crypt")));
    } catch (error) {
      for (const s of next) s.dispose?.();
      throw error;
    }
    if (token !== this.loading) {
      for (const s of next) s.dispose?.();
      return;
    }
    for (const s of this.scrollers) {
      s.obj.removeFromParent();
      s.dispose?.();
    }
    this.scrollers = next;
    for (const s of next) {
      s.obj.position.x = s.x - this.travelled;
      this.world.add(s.obj);
    }
  }

  private async scatter(models: SceneryModel[], span: number, crypt: boolean): Promise<Scroller[]> {
    const templates = await Promise.all(models.map((m) => instantiate(m)));
    const out: Scroller[] = [];
    const rand = mulberry(this.theme?.length ?? 1);
    for (const band of Object.keys(BANDS) as Band[]) {
      const pool = models.map((m, i) => ({ m, t: templates[i]! })).filter(({ m }) => m.band === band);
      if (pool.length === 0) continue;
      const total = pool.reduce((n, p) => n + p.m.weight, 0);
      const { z, spacing } = BANDS[band];
      const width = span * ((CAMERA_D - z[0]) / CAMERA_D);
      for (let x = this.travelled - width / 2; x < this.travelled + width / 2; x += spacing * (0.6 + rand() * 0.8)) {
        let pick = rand() * total;
        const choice = pool.find((p) => (pick -= p.m.weight) < 0) ?? pool[0]!;
        const obj = choice.t.root.clone();
        const scale = (choice.m.scale ?? 1) * (0.85 + rand() * 0.3);
        obj.scale.setScalar(scale);
        obj.rotation.y = (rand() - 0.5) * 1.6;
        const pz = z[0] + rand() * (z[1] - z[0]);
        obj.position.z = pz;
        const settle = (wx: number) => (obj.position.y = groundHeight(wx, pz, crypt) - 0.05);
        settle(x);
        obj.traverse((o) => {
          if (o instanceof Mesh && o.material instanceof MeshBasicMaterial && o.material.name.startsWith("glow")) o.material.vertexColors = false;
          if (o instanceof Mesh && band === "front") o.castShadow = false;
        });
        out.push({ obj, x, width: spacing, span: width, z: pz, regenerate: settle, ...(choice.m.light ? { light: choice.m.light } : {}) });
      }
    }
    return out;
  }

  private groundChunk(x0: number, span: number, look: Look, crypt: boolean): Scroller {
    const geometry = new BufferGeometry();
    const cellsZ = Math.round(((GROUND_NEAR - GROUND_FAR) / CHUNK_W) * CHUNK_CELLS);
    const tris = CHUNK_CELLS * cellsZ * 2;
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(tris * 9), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(tris * 9), 3));
    const mesh = new Mesh(geometry, this.groundMaterial);
    mesh.receiveShadow = true;
    const scroller: Scroller = { obj: mesh, x: x0, width: CHUNK_W, span, z: 0, dispose: () => geometry.dispose() };
    const palette = look.ground.map((c) => new Color(c));
    const lane = new Color(look.lane);
    const cell = CHUNK_W / CHUNK_CELLS;
    const tmp = new Color();
    scroller.regenerate = (wx: number) => {
      const pos = geometry.getAttribute("position") as BufferAttribute;
      const col = geometry.getAttribute("color") as BufferAttribute;
      let v = 0;
      const put = (lx: number, z: number, c: Color) => {
        pos.setXYZ(v, lx, groundHeight(wx + lx, z, crypt), z);
        col.setXYZ(v, c.r, c.g, c.b);
        v++;
      };
      for (let i = 0; i < CHUNK_CELLS; i++) {
        for (let j = 0; j < cellsZ; j++) {
          const ax = i * cell;
          const az = GROUND_FAR + j * cell;
          const gx = Math.round((wx + ax) / cell);
          const gz = Math.round(az / cell);
          for (const half of [0, 1]) {
            const r = hash(gx, gz, half + 11);
            const inLane = Math.abs(az + cell / 2) < LANE;
            const base = crypt ? palette[(Math.floor(gx / 2) + Math.floor(gz / 2)) & 1 ? 0 : 1]! : inLane ? lane : palette[Math.floor(r * palette.length)]!;
            tmp.copy(base).multiplyScalar(0.92 + r * 0.16);
            if (half === 0) {
              put(ax, az, tmp);
              put(ax, az + cell, tmp);
              put(ax + cell, az, tmp);
            } else {
              put(ax + cell, az, tmp);
              put(ax, az + cell, tmp);
              put(ax + cell, az + cell, tmp);
            }
          }
        }
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
    };
    scroller.regenerate(x0);
    return scroller;
  }

  private hill(x0: number, span: number, look: Look): Scroller {
    const geometry = new BufferGeometry();
    const steps = 6;
    const positions: number[] = [];
    const colors: number[] = [];
    const base = new Color(look.hills);
    const far = new Color(look.fog);
    const scroller: Scroller = { obj: new Mesh(geometry, this.hillMaterial), x: x0, width: HILL_W, span, z: HILL_Z, dispose: () => geometry.dispose() };
    scroller.regenerate = (wx: number) => {
      positions.length = 0;
      colors.length = 0;
      const peak = (x: number) => 3 + noise((wx + x) * 0.05, 1, 5) * 9 + noise((wx + x) * 0.2, 2, 9) * 2;
      for (let layer = 0; layer < 2; layer++) {
        const z = HILL_Z - layer * 14;
        const tint = base.clone().lerp(far, 0.25 + layer * 0.35);
        for (let i = 0; i < steps; i++) {
          const a = (i / steps) * HILL_W;
          const b = ((i + 1) / steps) * HILL_W;
          const ha = peak(a + layer * 40) * (1 + layer * 0.6);
          const hb = peak(b + layer * 40) * (1 + layer * 0.6);
          positions.push(a, -2, z, b, -2, z, a, ha, z, b, -2, z, b, hb, z, a, ha, z);
          const shade = 0.9 + hash(Math.round(wx + a), layer, 3) * 0.2;
          for (let k = 0; k < 6; k++) colors.push(tint.r * shade, tint.g * shade, tint.b * shade);
        }
      }
      geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
      geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
      geometry.computeBoundingSphere();
    };
    scroller.regenerate(x0);
    return scroller;
  }

  scroll(dx: number): void {
    if (dx === 0) return;
    this.travelled += dx;
    for (const s of this.scrollers) {
      if (recycle(s, this.travelled, this.width)) s.regenerate?.(s.x);
      s.obj.position.x = s.x - this.travelled;
    }
  }

  update(): void {
    const shown = (s: Scroller) => Math.abs(s.x - this.travelled);
    const lit = this.scrollers.filter((s) => s.light !== undefined && shown(s) < this.width / 2 + 2).sort((a, b) => shown(a) - shown(b));
    this.lights.forEach((light, i) => {
      const s = lit[i];
      if (!s) {
        light.intensity = 0;
        return;
      }
      light.color.set(s.light!);
      light.intensity = 6 * (0.85 + Math.random() * 0.15);
      light.position.set(s.x - this.travelled, 1.3, s.z + 0.6);
    });
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  toScreen(p: Vector3, out = { x: 0, y: 0 }): { x: number; y: number } {
    const v = p.clone().project(this.camera);
    const el = this.renderer.domElement;
    out.x = ((v.x + 1) / 2) * el.clientWidth;
    out.y = ((1 - v.y) / 2) * el.clientHeight;
    return out;
  }

  fromScreen(x: number, y: number, z = 1.5): Vector3 {
    const el = this.renderer.domElement;
    const ndc = new Vector3((x / el.clientWidth) * 2 - 1, -(y / el.clientHeight) * 2 + 1, 0.5).unproject(this.camera);
    const dir = ndc.sub(this.camera.position).normalize();
    const t = (z - this.camera.position.z) / dir.z;
    return this.camera.position.clone().add(dir.multiplyScalar(t));
  }
}

function mulberry(seed: number): () => number {
  let s = seed * 2654435761;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
