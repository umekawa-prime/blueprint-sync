import { describe, expect, it } from "vitest";
import { PIN_MARKER_SIZE, PIN_MARKER_TRIANGLE, pinMarkerLayout, renderPinMarkerOverlay } from "./pinMarkers";
import type { PhotoPinRecord } from "./annotationPersist";

describe("pinMarkerLayout", () => {
  it("puts the triangle tip on the normalized pin point", () => {
    const layout = pinMarkerLayout(0.25, 0.4, 200, 100);
    expect(layout.tipX).toBe(50);
    expect(layout.tipY).toBe(40);
    expect(layout.circle.cx).toBe(50);
    expect(layout.circle.cy).toBe(40 - PIN_MARKER_TRIANGLE - PIN_MARKER_SIZE / 2);
    expect(layout.circle.r).toBe(PIN_MARKER_SIZE / 2);
    expect(layout.number.x).toBe(50);
    expect(layout.number.y).toBeGreaterThan(40);
  });
});

describe("renderPinMarkerOverlay", () => {
  it("returns null when the page has no pins", async () => {
    expect(await renderPinMarkerOverlay([], 100, 80)).toBeNull();
  });

  it("returns png bytes when a 2d context is available", async () => {
    const pin: PhotoPinRecord = {
      id: "a",
      nx: 0.5,
      ny: 0.5,
      title: "",
      thumbnailDataUrl: "t",
      imageDataUrl: "f",
      createdAt: 1,
    };
    const bytes = await renderPinMarkerOverlay([pin], 80, 60);
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) {
      expect(bytes).toBeNull();
      return;
    }
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes?.length).toBeGreaterThan(8);
  });
});
