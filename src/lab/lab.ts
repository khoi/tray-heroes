import { Color, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, WebGLRenderer } from "three";
import { HERO_MODELS, MONSTER_MODELS, type AttackStyle } from "../ui/battle/models";
import { Unit } from "../ui/battle/unit";

const q = new URLSearchParams(location.search);
const keys = (q.get("units") ?? "knight,ranger,mage,priest,hunter,slayer").split(",");
const pose = q.get("pose") as AttackStyle | "hurt" | "die" | "lunge" | "buff" | null;
const at = Number(q.get("t") ?? 0.5);
const walk = q.has("walk");
const W = Number(q.get("w") ?? 1400);
const H = Number(q.get("h") ?? 420);
const spacing = Number(q.get("gap") ?? 2.2);

const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
document.body.append(renderer.domElement);
const scene = new Scene();
scene.background = new Color(0x9fc9e8);
scene.add(new HemisphereLight(0xcfe8ff, 0x6b7b3a, 1.2));
const sun = new DirectionalLight(0xfff1d6, 2.4);
sun.position.set(-4, 10, 6);
sun.castShadow = true;
sun.shadow.camera.left = -15;
sun.shadow.camera.right = 15;
scene.add(sun);
const ground = new Mesh(new PlaneGeometry(60, 20), new MeshStandardMaterial({ color: 0x7fae4c }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const span = (keys.length - 1) * spacing;
const camera = new PerspectiveCamera(Number(q.get("fov") ?? 14), W / H, 0.1, 200);
camera.position.set(0, Number(q.get("cy") ?? 2.6), Number(q.get("cz") ?? 26));
camera.lookAt(0, Number(q.get("ty") ?? 1.1), 0);

const units = await Promise.all(
  keys.map(async (key, i) => {
    const hero = key in HERO_MODELS;
    const def = hero ? HERO_MODELS[key as keyof typeof HERO_MODELS] : MONSTER_MODELS[key as keyof typeof MONSTER_MODELS];
    const unit = await Unit.create(def, q.has("left") ? -1 : hero ? 1 : -1);
    unit.root.position.x = -span / 2 + i * spacing;
    scene.add(unit.root);
    return unit;
  }),
);
for (const unit of units) unit.update(0.5, walk, false, 0);
if (pose === "die") for (const unit of units) unit.die();
else if (pose === "hurt") for (const unit of units) unit.hurt();
else if (pose) for (const unit of units) unit.attack(unit.humanoid ? (pose === "lunge" ? "melee" : pose) : "lunge", 1);
const steps = 30;
const total = pose === "die" ? at * 1.6 : pose === "hurt" ? at * 0.32 : pose ? at * 0.75 : 0;
for (let i = 0; i < steps; i++) for (const unit of units) unit.update(total / steps, walk, false, 0);
renderer.render(scene, camera);
document.title = "ready";
