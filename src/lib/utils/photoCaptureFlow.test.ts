import { describe, expect, it } from "vitest";
import {
  photoCaptureAfterCancel,
  photoCaptureAfterDone,
  photoCaptureAfterPlace,
  photoCaptureAfterShot,
} from "./photoCaptureFlow";

describe("photoCaptureFlow", () => {
  it("opens pen markup after one shot, then waits for a pin position", () => {
    const markup = photoCaptureAfterShot("idle");
    expect(markup).toBe("markup");
    expect(photoCaptureAfterDone(markup)).toBe("place");
    expect(photoCaptureAfterPlace("place")).toBe("idle");
  });

  it("returns to idle when the shot is cancelled", () => {
    expect(photoCaptureAfterCancel()).toBe("idle");
    expect(photoCaptureAfterDone("idle")).toBe("idle");
    expect(photoCaptureAfterPlace("markup")).toBe("markup");
  });
});
