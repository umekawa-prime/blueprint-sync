import { describe, expect, it } from "vitest";
import {
  LONG_PRESS_MS,
  menuPosition,
  shouldOpenViewerMenu,
  shouldStartLongPress,
  viewerMenuSize,
  zoomStep,
} from "./viewerMenu";

describe("shouldOpenViewerMenu", () => {
  it("opens on a right click or contextmenu event", () => {
    expect(shouldOpenViewerMenu({ type: "contextmenu", button: 0 })).toBe(true);
    expect(shouldOpenViewerMenu({ type: "pointerdown", button: 2 })).toBe(true);
    expect(shouldOpenViewerMenu({ type: "pointerdown", button: 0, pointerType: "mouse" })).toBe(
      false,
    );
  });
});

describe("shouldStartLongPress", () => {
  it("starts a long-press menu on finger down, not while drawing with a mouse", () => {
    expect(shouldStartLongPress({ pointerType: "touch", button: 0 })).toBe(true);
    expect(shouldStartLongPress({ pointerType: "mouse", button: 0 })).toBe(false);
    expect(shouldStartLongPress({ pointerType: "pen", button: 0 })).toBe(false);
    expect(LONG_PRESS_MS).toBeGreaterThanOrEqual(400);
  });
});

describe("menuPosition", () => {
  it("keeps the menu inside the viewport", () => {
    expect(menuPosition(10, 20, 160, 80, 800, 600)).toEqual({ x: 10, y: 20 });
    expect(menuPosition(780, 590, 160, 80, 800, 600)).toEqual({ x: 640, y: 520 });
  });
});

describe("viewerMenuSize", () => {
  it("sizes the context menu for insert and capture actions", () => {
    expect(viewerMenuSize(2)).toEqual({ width: 180, height: 88 });
  });
});

describe("zoomStep", () => {
  it("moves zoom by one notch and stays in range", () => {
    expect(zoomStep(1, 1)).toBe(1.1);
    expect(zoomStep(1, -1)).toBe(0.9);
    expect(zoomStep(0.4, -1)).toBe(0.4);
    expect(zoomStep(3, 1)).toBeGreaterThan(3);
  });
});
