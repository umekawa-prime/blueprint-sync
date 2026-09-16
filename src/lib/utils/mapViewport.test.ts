import { describe, expect, it } from "vitest";
import {
  applyWheel,
  cameraCssTransform,
  centerInViewport,
  clampCamera,
  panBy,
  pinchCamera,
  scaleSerializedObject,
  shouldPanWithPointer,
  shouldHandleWheelAsViewport,
  wheelIntent,
  zoomAroundPoint,
} from "./mapViewport";

describe("zoomAroundPoint", () => {
  it("keeps the same content point under the cursor after zooming", () => {
    const camera = { x: 40, y: 80, zoom: 1 };
    const next = zoomAroundPoint(camera, 200, 140, 2);
    expect(next.zoom).toBe(2);
    expect((200 - next.x) / next.zoom).toBeCloseTo((200 - camera.x) / camera.zoom);
    expect((140 - next.y) / next.zoom).toBeCloseTo((140 - camera.y) / camera.zoom);
  });
});

describe("panBy", () => {
  it("moves the camera in viewport pixels", () => {
    expect(panBy({ x: 10, y: 20, zoom: 1.5 }, 8, -4)).toEqual({ x: 18, y: 16, zoom: 1.5 });
  });
});

describe("cameraCssTransform", () => {
  it("scales relative to the last rendered zoom so live zoom does not wait for a rerender", () => {
    expect(cameraCssTransform({ x: 12, y: -8, zoom: 2 }, 1)).toBe(
      "translate(12px, -8px) scale(2)",
    );
    expect(cameraCssTransform({ x: 12, y: -8, zoom: 2 }, 2)).toBe(
      "translate(12px, -8px) scale(1)",
    );
  });
});

describe("wheelIntent", () => {
  it("zooms only with ctrl/meta, and pans for plain or shift wheels", () => {
    expect(
      wheelIntent({ deltaX: 0, deltaY: 120, deltaMode: 0, ctrlKey: false, metaKey: false }),
    ).toBe("pan");
    expect(
      wheelIntent({ deltaX: 0, deltaY: 3, deltaMode: 1, ctrlKey: false, metaKey: false }),
    ).toBe("pan");
    expect(
      wheelIntent({
        deltaX: 0,
        deltaY: 120,
        deltaMode: 0,
        ctrlKey: false,
        metaKey: false,
        shiftKey: true,
      }),
    ).toBe("pan");
    expect(
      wheelIntent({ deltaX: 18, deltaY: 12, deltaMode: 0, ctrlKey: false, metaKey: false }),
    ).toBe("pan");
    expect(
      wheelIntent({ deltaX: 0, deltaY: 40, deltaMode: 0, ctrlKey: true, metaKey: false }),
    ).toBe("zoom");
    expect(
      wheelIntent({ deltaX: 4, deltaY: -6, deltaMode: 0, ctrlKey: true, metaKey: false }),
    ).toBe("zoom");
    expect(
      wheelIntent({ deltaX: 0, deltaY: -120, deltaMode: 0, ctrlKey: false, metaKey: true }),
    ).toBe("zoom");
  });
});

describe("shouldHandleWheelAsViewport", () => {
  it("handles trackpad pinch even when the cursor is not over the page", () => {
    expect(
      shouldHandleWheelAsViewport(
        { deltaX: 2, deltaY: -4, deltaMode: 0, ctrlKey: true, metaKey: false },
        false,
      ),
    ).toBe(true);
    expect(
      shouldHandleWheelAsViewport(
        { deltaX: 20, deltaY: -10, deltaMode: 0, ctrlKey: false, metaKey: false },
        false,
      ),
    ).toBe(false);
    expect(
      shouldHandleWheelAsViewport(
        { deltaX: 20, deltaY: -10, deltaMode: 0, ctrlKey: false, metaKey: false },
        true,
      ),
    ).toBe(true);
  });
});

describe("applyWheel", () => {
  it("zooms toward the cursor with ctrl+wheel and pans with trackpad deltas", () => {
    const zoomed = applyWheel(
      { x: 0, y: 0, zoom: 1 },
      { deltaX: 0, deltaY: -120, deltaMode: 0, ctrlKey: true, metaKey: false },
      { x: 100, y: 80 },
    );
    expect(zoomed.zoom).toBeGreaterThan(1);
    expect((100 - zoomed.x) / zoomed.zoom).toBeCloseTo(100);
    expect((80 - zoomed.y) / zoomed.zoom).toBeCloseTo(80);

    expect(
      applyWheel(
        { x: 5, y: 6, zoom: 1 },
        { deltaX: 20, deltaY: -10, deltaMode: 0, ctrlKey: false, metaKey: false },
        { x: 0, y: 0 },
      ),
    ).toEqual({ x: -15, y: 16, zoom: 1 });
  });

  it("pans vertically with a mouse wheel, matching Windows scroll direction", () => {
    expect(
      applyWheel(
        { x: 5, y: 6, zoom: 1 },
        { deltaX: 0, deltaY: 120, deltaMode: 0, ctrlKey: false, metaKey: false },
        { x: 0, y: 0 },
      ),
    ).toEqual({ x: 5, y: -114, zoom: 1 });
  });

  it("pans horizontally with shift+wheel, matching Windows shift-scroll", () => {
    expect(
      applyWheel(
        { x: 5, y: 6, zoom: 1 },
        {
          deltaX: 0,
          deltaY: 120,
          deltaMode: 0,
          ctrlKey: false,
          metaKey: false,
          shiftKey: true,
        },
        { x: 0, y: 0 },
      ),
    ).toEqual({ x: -115, y: 6, zoom: 1 });
    expect(
      applyWheel(
        { x: 5, y: 6, zoom: 1 },
        {
          deltaX: 120,
          deltaY: 0,
          deltaMode: 0,
          ctrlKey: false,
          metaKey: false,
          shiftKey: true,
        },
        { x: 0, y: 0 },
      ),
    ).toEqual({ x: -115, y: 6, zoom: 1 });
  });

  it("converts line-mode mouse wheels into a pixel pan", () => {
    expect(
      applyWheel(
        { x: 5, y: 6, zoom: 1 },
        { deltaX: 0, deltaY: 3, deltaMode: 1, ctrlKey: false, metaKey: false },
        { x: 0, y: 0 },
      ),
    ).toEqual({ x: 5, y: -42, zoom: 1 });
  });

  it("zooms from a precision-touchpad pinch made of small ctrl+wheel ticks", () => {
    const firstTick = applyWheel(
      { x: 0, y: 0, zoom: 1 },
      { deltaX: 0, deltaY: -1, deltaMode: 0, ctrlKey: true, metaKey: false },
      { x: 100, y: 80 },
    );
    expect(firstTick.zoom).toBeGreaterThan(1);

    let camera = { x: 0, y: 0, zoom: 1 };
    for (let i = 0; i < 12; i += 1) {
      camera = applyWheel(
        camera,
        { deltaX: 0, deltaY: -1, deltaMode: 0, ctrlKey: true, metaKey: false },
        { x: 100, y: 80 },
      );
    }
    expect(camera.zoom).toBeGreaterThan(1.1);
  });
});

describe("pinchCamera", () => {
  it("zooms around the pinch start and follows the midpoint", () => {
    const next = pinchCamera(
      { zoom: 1, x: 0, y: 0, cx: 100, cy: 80 },
      { cx: 120, cy: 90, scale: 2 },
    );
    expect(next.zoom).toBe(2);
    expect((120 - next.x) / next.zoom).toBeCloseTo(100);
    expect((90 - next.y) / next.zoom).toBeCloseTo(80);
  });
});

describe("centerInViewport", () => {
  it("places the rendered page in the middle of the viewport", () => {
    expect(centerInViewport(200, 100, 800, 600, 1, 1)).toEqual({ x: 300, y: 250, zoom: 1 });
    expect(centerInViewport(200, 100, 800, 600, 2, 1)).toEqual({ x: 200, y: 200, zoom: 2 });
  });
});

describe("clampCamera", () => {
  it("keeps part of the page on screen without snapping back to a document scroll", () => {
    const lost = clampCamera({ x: -4000, y: -4000, zoom: 1 }, 400, 300, 800, 600, 1, 80);
    expect(lost.x).toBeGreaterThan(-400);
    expect(lost.y).toBeGreaterThan(-300);
    expect(lost.x).toBeLessThan(800);
    expect(lost.y).toBeLessThan(600);
  });
});

describe("shouldPanWithPointer", () => {
  it("pans with the hand tool or a middle-mouse drag", () => {
    expect(shouldPanWithPointer("pan", 0)).toBe(true);
    expect(shouldPanWithPointer("select", 1)).toBe(true);
    expect(shouldPanWithPointer("pen", 0)).toBe(false);
    expect(shouldPanWithPointer("select", 0)).toBe(false);
  });

  it("pans with one finger while the select tool is active on a touch screen", () => {
    expect(shouldPanWithPointer("select", 0, "touch")).toBe(true);
    expect(shouldPanWithPointer("select", 0, "mouse")).toBe(false);
    expect(shouldPanWithPointer("select", 0, "pen")).toBe(false);
    expect(shouldPanWithPointer("pen", 0, "touch")).toBe(false);
    expect(shouldPanWithPointer("pan", 0, "touch")).toBe(true);
  });
});

describe("scaleSerializedObject", () => {
  it("scales fabric object placement when the page bitmap is rerendered at a new zoom", () => {
    expect(
      scaleSerializedObject({ left: 10, top: 20, scaleX: 1, scaleY: 2, id: "a" }, 2),
    ).toEqual({ left: 20, top: 40, scaleX: 2, scaleY: 4, id: "a" });
  });
});
