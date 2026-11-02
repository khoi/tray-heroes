import { AnimationClip, Bone, QuaternionKeyframeTrack, VectorKeyframeTrack } from "three";

const CDN = "https://polyfork.dev/cdn/";
const BAKED_HIP = 0.95;

export const HUMANOID_CLIPS = ["Idle", "Walk", "Run"] as const;
export type HumanoidClip = (typeof HUMANOID_CLIPS)[number];

interface RawClip {
  times: number[];
  tracks: Record<string, number[]>;
  hips: number[];
}

const fetched = new Map<string, Promise<RawClip>>();

function raw(name: HumanoidClip): Promise<RawClip> {
  let hit = fetched.get(name);
  if (!hit) {
    hit = fetch(`${CDN}anim-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`).then((r) => {
      if (!r.ok) throw new Error(`clip ${name}: HTTP ${r.status}`);
      return r.json() as Promise<RawClip>;
    });
    hit.catch(() => fetched.delete(name));
    fetched.set(name, hit);
  }
  return hit;
}

export async function humanoidClips(bones: Record<string, Bone>): Promise<Partial<Record<HumanoidClip, AnimationClip>>> {
  const hips = bones.Hips;
  if (!hips) return {};
  const rest = hips.position.clone();
  const ratio = (rest.y || BAKED_HIP) / BAKED_HIP;
  const out: Partial<Record<HumanoidClip, AnimationClip>> = {};
  const loaded = await Promise.allSettled(HUMANOID_CLIPS.map(raw));
  loaded.forEach((result, i) => {
    if (result.status !== "fulfilled") return;
    const clip = result.value;
    const tracks = Object.entries(clip.tracks).flatMap(([name, values]) => {
      const bone = bones[name];
      return bone && values.length ? [new QuaternionKeyframeTrack(`${bone.uuid}.quaternion`, clip.times, values)] : [];
    });
    const pos = new Float32Array(clip.hips.length);
    for (let k = 0; k < clip.hips.length; k += 3) {
      pos[k] = rest.x;
      pos[k + 1] = rest.y + clip.hips[k + 1]! * ratio;
      pos[k + 2] = rest.z;
    }
    tracks.push(new VectorKeyframeTrack(`${hips.uuid}.position`, clip.times, pos));
    out[HUMANOID_CLIPS[i]!] = new AnimationClip(HUMANOID_CLIPS[i], -1, tracks);
  });
  return out;
}
