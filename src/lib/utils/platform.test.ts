import { describe, expect, it } from "vitest";
import { detectPlatform, isIosLike, usesRfdFileDialog } from "./platform";

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
});
