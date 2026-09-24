import { describe, expect, it } from "vitest";
import {
  MEMO_PIN_SIZE,
  MEMO_PIN_TRIANGLE,
  memoPinLayout,
  renderMemoPinOverlay,
  wrapMemoLines,
} from "./memoPinLayout";

describe("wrapMemoLines", () => {
  it("wraps at 12 characters and ellipsizes after four lines", () => {
    expect(wrapMemoLines("梁成を現場で確認")).toEqual(["梁成を現場で確認"]);
    expect(wrapMemoLines("あ".repeat(13))).toEqual(["あ".repeat(12), "あ"]);
    expect(wrapMemoLines("あ".repeat(50))).toEqual([
      "あ".repeat(12),
      "あ".repeat(12),
      "あ".repeat(12),
      `${"あ".repeat(11)}…`,
    ]);
  });
});

describe("memoPinLayout", () => {
  it("puts the triangle tip on the normalized pin point and the bubble to the right", () => {
    const layout = memoPinLayout(0.25, 0.4, 400, 200, "確認", "#E81123");
    expect(layout.tipX).toBe(100);
    expect(layout.tipY).toBe(80);
    expect(layout.head.r).toBe(MEMO_PIN_SIZE / 2);
    expect(layout.head.cx).toBe(100);
    expect(layout.head.cy).toBe(80 - MEMO_PIN_TRIANGLE - MEMO_PIN_SIZE / 2);
    expect(layout.bubble.x).toBeGreaterThan(layout.head.cx);
    expect(layout.color).toBe("#E81123");
    expect(layout.lines).toEqual(["確認"]);
  });

  it("flips the bubble to the left near the right edge", () => {
    const layout = memoPinLayout(0.95, 0.5, 400, 200, "確認", "#38bdf8");
    expect(layout.bubble.x + layout.bubble.width).toBeLessThanOrEqual(layout.tipX);
  });
});

describe("renderMemoPinOverlay", () => {
  it("returns null when the page has no memo pins", async () => {
    expect(await renderMemoPinOverlay([], 100, 80)).toBeNull();
  });
});
