import { AnimationClip, Box3, Mesh, MeshStandardMaterial, Object3D, Vector3 } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { publicUrl } from "../paths";
import { modelFile, type Source } from "./models";

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Promise<GLTF>>();

export function loadModel(src: Source): Promise<GLTF> {
  const url = modelFile(src);
  let hit = cache.get(url);
  if (!hit) {
    hit = loader.loadAsync(publicUrl(url)).catch((error: unknown) => {
      cache.delete(url);
      throw error;
    });
    cache.set(url, hit);
  }
  return hit;
}

export interface Instance {
  root: Object3D;
  clips: AnimationClip[];
  size: Vector3;
}

export async function instantiate(src: Source, { shadows = true, ownMaterials = false } = {}): Promise<Instance> {
  const gltf = await loadModel(src);
  const root = clone(gltf.scene);
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    o.castShadow = shadows;
    o.receiveShadow = true;
    if (ownMaterials && o.material instanceof MeshStandardMaterial) o.material = o.material.clone();
    if ("isSkinnedMesh" in o) o.frustumCulled = false;
  });
  const size = new Box3().setFromObject(gltf.scene).getSize(new Vector3());
  return { root, clips: gltf.animations, size };
}
