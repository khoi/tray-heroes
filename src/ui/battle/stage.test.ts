import { describe, expect, it } from "vitest";
import { recycle } from "./stage";

describe("scenery recycling", () => {
  it("keeps a layer contiguous in world space and covering the view while the party runs", () => {
    const view = 30;
    const width = 8;
    const count = Math.ceil((view + 24) / width) + 1;
    const items = Array.from({ length: count }, (_, i) => ({ x: -(view + 24) / 2 + i * width, width, span: count * width, z: 0 }));
    let travelled = 0;
    for (let step = 0; step < 2000; step++) {
      travelled += 0.37;
      for (const item of items) recycle(item, travelled, view);
      const xs = items.map((i) => i.x).sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeCloseTo(width, 6);
      expect(xs[0]! - travelled).toBeLessThanOrEqual(-view / 2);
      expect(xs.at(-1)! + width - travelled).toBeGreaterThanOrEqual(view / 2);
    }
  });
});
