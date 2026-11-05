// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { installPageZoomGuard, isPageZoomKey, isPageZoomWheel } from "./pageZoomGuard";

function key(init: Partial<KeyboardEvent>) {
  return { ctrlKey: false, metaKey: false, altKey: false, key: "", code: "", ...init };
}

describe("isPageZoomKey", () => {
  it("matches browser zoom shortcuts", () => {
    expect(isPageZoomKey(key({ ctrlKey: true, key: "+" }))).toBe(true);
    expect(isPageZoomKey(key({ ctrlKey: true, key: "=" }))).toBe(true);
    expect(isPageZoomKey(key({ ctrlKey: true, key: "-" }))).toBe(true);
    expect(isPageZoomKey(key({ ctrlKey: true, key: "0" }))).toBe(true);
    expect(isPageZoomKey(key({ ctrlKey: true, key: ";" }))).toBe(true);
    expect(isPageZoomKey(key({ metaKey: true, key: "-" }))).toBe(true);
    expect(isPageZoomKey(key({ ctrlKey: true, code: "NumpadAdd", key: "+" }))).toBe(true);
  });

  it("leaves other shortcuts alone", () => {
    expect(isPageZoomKey(key({ key: "-" }))).toBe(false);
    expect(isPageZoomKey(key({ ctrlKey: true, key: "z" }))).toBe(false);
    expect(isPageZoomKey(key({ ctrlKey: true, altKey: true, key: "0" }))).toBe(false);
  });
});

describe("isPageZoomWheel", () => {
  it("treats ctrl+wheel (and touchpad pinch) as page zoom", () => {
    expect(isPageZoomWheel({ ctrlKey: true, metaKey: false })).toBe(true);
    expect(isPageZoomWheel({ ctrlKey: false, metaKey: false })).toBe(false);
  });
});

describe("installPageZoomGuard", () => {
  let uninstall: (() => void) | undefined;

  afterEach(() => {
    uninstall?.();
    uninstall = undefined;
  });

  it("cancels zoom keys and ctrl+wheel but not normal input", () => {
    uninstall = installPageZoomGuard(window);

    const zoomKey = new KeyboardEvent("keydown", { key: "+", ctrlKey: true, cancelable: true });
    window.dispatchEvent(zoomKey);
    expect(zoomKey.defaultPrevented).toBe(true);

    const typing = new KeyboardEvent("keydown", { key: "+", cancelable: true });
    window.dispatchEvent(typing);
    expect(typing.defaultPrevented).toBe(false);

    const pinch = new WheelEvent("wheel", { deltaY: 5, ctrlKey: true, cancelable: true });
    window.dispatchEvent(pinch);
    expect(pinch.defaultPrevented).toBe(true);

    const scroll = new WheelEvent("wheel", { deltaY: 100, cancelable: true });
    window.dispatchEvent(scroll);
    expect(scroll.defaultPrevented).toBe(false);
  });

  it("disables touchscreen pinch-zoom on the page and restores it", () => {
    uninstall = installPageZoomGuard(window);
    expect(document.documentElement.style.touchAction).toBe("pan-x pan-y");

    uninstall();
    uninstall = undefined;
    expect(document.documentElement.style.touchAction).toBe("");

    const zoomKey = new KeyboardEvent("keydown", { key: "-", ctrlKey: true, cancelable: true });
    window.dispatchEvent(zoomKey);
    expect(zoomKey.defaultPrevented).toBe(false);
  });
});
