import { afterEach, describe, expect, it, vi } from "vitest";
import { publicUrl } from "./paths";

describe("public asset URLs", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("serves assets from the deploy subpath", () => {
    vi.stubEnv("BASE_URL", "/tray-heroes/");
    expect(publicUrl("models/wolf-base.glb")).toBe("/tray-heroes/models/wolf-base.glb");
    expect(publicUrl("/sfx/hit1.m4a")).toBe("/tray-heroes/sfx/hit1.m4a");
  });

  it("serves assets from the root in development", () => {
    vi.stubEnv("BASE_URL", "/");
    expect(publicUrl("assets/dungeon.png")).toBe("/assets/dungeon.png");
  });
});
