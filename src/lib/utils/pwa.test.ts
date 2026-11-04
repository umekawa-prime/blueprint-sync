import { describe, expect, it } from "vitest";
import { shouldRegisterServiceWorker } from "./pwa";

describe("shouldRegisterServiceWorker", () => {
  it("registers the service worker only in production browsers", () => {
    expect(shouldRegisterServiceWorker(false, true, false)).toBe(true);
    expect(shouldRegisterServiceWorker(true, true, false)).toBe(false);
    expect(shouldRegisterServiceWorker(false, false, false)).toBe(false);
    expect(shouldRegisterServiceWorker(false, true, true)).toBe(false);
  });
});
