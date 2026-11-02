import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Logger, NodeIO, type Document, type Primitive } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsUnlit } from "@gltf-transform/extensions";
import { meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import { allSources, modelFile, type Source } from "../src/ui/battle/models";

const CDN = "https://polyfork.dev/cdn";
const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const CACHE = join(ROOT, ".cache/polyfork");
const OUT = join(ROOT, "public");
const USER_AGENT = "TrayHeroes-build/0.1 (asset fetch at build time)";

function sourceUrl(src: Source): string {
  return src.p ? `${CDN}/${src.id}-remix.glb?p=${encodeURIComponent(JSON.stringify(src.p))}` : `${CDN}/${src.id}.glb`;
}

async function download(src: Source): Promise<Uint8Array> {
  const cached = join(CACHE, modelFile(src).replace("models/", ""));
  if (existsSync(cached)) return readFileSync(cached);
  const res = await fetch(sourceUrl(src), { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${src.id}: HTTP ${res.status} ${await res.text()}`);
  const notBaked = res.headers.get("x-remix-not-baked");
  if (notBaked) throw new Error(`${src.id}: knobs not baked into the GLB (${notBaked}); only structural knobs survive a download`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(cached, bytes);
  return bytes;
}

interface NightZone {
  color: string;
  albedo: string | null;
  findable?: boolean;
}

async function nightZones(src: Source): Promise<NightZone[]> {
  const cached = join(CACHE, `${src.id}-params.json`);
  if (!existsSync(cached)) {
    const res = await fetch(`${CDN}/${src.id}-params.json`, { headers: { "User-Agent": USER_AGENT } });
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(cached, res.ok ? await res.text() : "{}");
  }
  const night = (JSON.parse(readFileSync(cached, "utf8")) as { night?: Record<string, NightZone> }).night ?? {};
  return Object.values(night).filter((z) => z.albedo && z.findable !== false);
}

function linear(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)];
}

function splitGlow(doc: Document, prim: Primitive, zones: NightZone[]): number {
  const colors = prim.getAttribute("COLOR_0");
  const indices = prim.getIndices();
  if (!colors || !indices) return 0;
  const targets = zones.map((z) => linear(z.albedo!));
  const zoneOf = (v: number): number => {
    const c = colors.getElement(v, []);
    return targets.findIndex((t) => Math.abs(t[0] - c[0]!) + Math.abs(t[1] - c[1]!) + Math.abs(t[2] - c[2]!) < 0.02);
  };
  const keep: number[] = [];
  const glow = zones.map((): number[] => []);
  const idx = indices.getArray()!;
  for (let i = 0; i < idx.length; i += 3) {
    const tri = [idx[i]!, idx[i + 1]!, idx[i + 2]!];
    const zone = zoneOf(tri[0]!);
    if (zone >= 0 && zoneOf(tri[1]!) === zone && zoneOf(tri[2]!) === zone) glow[zone]!.push(...tri);
    else keep.push(...tri);
  }
  const moved = idx.length / 3 - keep.length / 3;
  if (moved === 0) return 0;
  indices.setArray(new Uint32Array(keep));
  const unlit = doc.createExtension(KHRMaterialsUnlit);
  const mesh = doc.getRoot().listMeshes().find((m) => m.listPrimitives().includes(prim))!;
  zones.forEach((zone, z) => {
    if (glow[z]!.length === 0) return;
    const out = doc.createPrimitive().setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(glow[z]!)).setBuffer(indices.getBuffer()));
    for (const semantic of prim.listSemantics()) out.setAttribute(semantic, prim.getAttribute(semantic));
    out.setMaterial(doc.createMaterial(`glow-${z}`).setBaseColorFactor([...linear(zone.color), 1]).setExtension("KHR_materials_unlit", unlit.createUnlit()));
    mesh.addPrimitive(out);
  });
  return moved;
}

const io = new NodeIO().setLogger(new Logger(Logger.Verbosity.WARN)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
await MeshoptEncoder.ready;
mkdirSync(join(OUT, "models"), { recursive: true });

const only = process.argv.slice(2);
let total = 0;
for (const src of allSources()) {
  if (only.length > 0 && !only.some((o) => src.id.includes(o))) continue;
  const original = await download(src);
  const doc = await io.readBinary(original);
  const root = doc.getRoot();
  const triangles = root.listMeshes().reduce((n, mesh) => n + mesh.listPrimitives().reduce((m, prim) => m + (prim.getIndices()?.getCount() ?? 0) / 3, 0), 0);
  const clips = root.listAnimations().map((a) => a.getName());
  const bones = new Set(root.listSkins().flatMap((skin) => skin.listJoints().map((j) => j.getName())));
  const hands = root.listNodes().filter((n) => n.getName().startsWith("attach-") && n.getName().endsWith("hand")).length;
  const zones = bones.size === 0 ? await nightZones(src) : [];
  const glow = (d: Document) => (zones.length ? d.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((n, prim) => n + splitGlow(d, prim, zones), 0) : 0);
  const glowing = glow(doc);
  let bytes: Uint8Array;
  try {
    await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "medium" }));
    bytes = await io.writeBinary(doc);
  } catch {
    const plain = await io.readBinary(original);
    glow(plain);
    bytes = await io.writeBinary(plain);
  }
  writeFileSync(join(OUT, modelFile(src)), bytes);
  total += bytes.byteLength;
  const kind = bones.has("Spine2") ? "humanoid" : bones.size > 0 ? "creature" : "prop";
  console.log(`${modelFile(src).padEnd(58)} ${String(Math.round(triangles)).padStart(6)} tris ${(bytes.byteLength / 1024).toFixed(0).padStart(5)} KB  ${kind}${clips.length ? `  clips: ${clips.join(", ")}` : ""}${hands ? `  hands: ${hands}` : ""}${glowing ? `  glow: ${glowing} tris` : ""}`);
}
console.log(`total ${(total / 1024 / 1024).toFixed(1)} MB`);
