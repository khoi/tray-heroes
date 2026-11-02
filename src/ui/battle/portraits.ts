import { Box3, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from "three";
import { modelFile, type UnitModel } from "./models";
import { Unit } from "./unit";

const SIZE = 192;
const FOV = 20;
const cache = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();
let stage: { renderer: WebGLRenderer; scene: Scene; camera: PerspectiveCamera } | null = null;

function setup() {
  if (stage) return stage;
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE, false);
  renderer.outputColorSpace = SRGBColorSpace;
  const scene = new Scene();
  scene.add(new HemisphereLight(0xe8f0ff, 0x5a4a3a, 1.4));
  const key = new DirectionalLight(0xfff1d6, 2.2);
  key.position.set(-2, 3, 4);
  scene.add(key);
  stage = { renderer, scene, camera: new PerspectiveCamera(FOV, 1, 0.1, 100) };
  return stage;
}

async function render(def: UnitModel): Promise<string> {
  const { renderer, scene, camera } = setup();
  const unit = await Unit.create(def, 1);
  unit.body.rotation.y = 0.5;
  unit.update(0, false, false, 0);
  scene.add(unit.root);
  unit.root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(unit.root);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const bust = unit.humanoid;
  const span = bust ? size.y * 0.5 : Math.max(size.x, size.y) * 1.05;
  if (bust) center.y = box.max.y - span * 0.48;
  const dist = span / 2 / Math.tan((FOV * Math.PI) / 360);
  camera.position.set(center.x, center.y + span * 0.08, center.z + dist);
  camera.lookAt(center);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/png");
  unit.dispose();
  return url;
}

export function portrait(def: UnitModel): Promise<string> {
  const key = modelFile(def);
  let hit = cache.get(key);
  if (!hit) {
    hit = queue.then(() => render(def));
    queue = hit.catch(() => undefined);
    cache.set(key, hit);
  }
  return hit;
}
