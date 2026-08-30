import { describe, expect, it } from "vitest";
import { fitImageSize } from "./imageResize";

describe("fitImageSize", () => {
  it("keeps dimensions when already within the max edge", () => {
    expect(fitImageSize(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("scales down a landscape image so the long edge equals max", () => {
    expect(fitImageSize(4000, 2000, 1600)).toEqual({
      width: 1600,
      height: 800,
    });
  });

  it("scales down a portrait image so the long edge equals max", () => {
    expect(fitImageSize(900, 1800, 1200)).toEqual({
      width: 600,
      height: 1200,
    });
  });

  it("does not upscale tiny images", () => {
    expect(fitImageSize(100, 50, 1600)).toEqual({ width: 100, height: 50 });
  });
});
