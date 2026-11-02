import { Group } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it, vi } from "vitest";
import { loadModel } from "./assets";

describe("model loading", () => {
  it("retries a model whose first request failed instead of caching the failure", async () => {
    const gltf = { scene: new Group(), animations: [] } as unknown as GLTF;
    const load = vi.spyOn(GLTFLoader.prototype, "loadAsync").mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(gltf);
    await expect(loadModel({ id: "flaky-model" })).rejects.toThrow("offline");
    await expect(loadModel({ id: "flaky-model" })).resolves.toBe(gltf);
    expect(load).toHaveBeenCalledTimes(2);
    load.mockRestore();
  });
});
