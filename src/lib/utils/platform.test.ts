import { describe, expect, it } from "vitest";
import {
  detectPlatform,
  isIosLike,
  shouldAutoStartWebDemo,
  shouldOfferBrowserDemo,
  usesRfdFileDialog,
} from "./platform";

describe("platform detection", () => {
  it("treats iPadOS desktop UA as iOS", () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    });
    Object.defineProperty(navigator, "platform", {
      configurable: true,
      value: "MacIntel",
    });
    Object.defineProperty(navigator, "maxTouchPoints", {
      configurable: true,
      value: 5,
    });
    expect(isIosLike()).toBe(true);
    expect(detectPlatform()).toBe("ios");
    expect(usesRfdFileDialog()).toBe(false);
  });

  it("hides the browser demo on the Tauri home screen", () => {
    expect(shouldOfferBrowserDemo(true)).toBe(false);
    expect(shouldOfferBrowserDemo(false)).toBe(true);
  });

  it("does not auto-start the in-memory demo inside Tauri even with ?demo=1", () => {
    expect(shouldAutoStartWebDemo("?demo=1", true)).toBe(false);
    expect(shouldAutoStartWebDemo("?demo=1", false)).toBe(true);
    expect(shouldAutoStartWebDemo("", false)).toBe(false);
  });
});
