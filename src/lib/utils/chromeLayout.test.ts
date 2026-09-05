import { describe, expect, it } from "vitest";
import { isPhoneWidth, isTabletWidth, PHONE_MAX_WIDTH } from "./chromeLayout";

describe("chromeLayout", () => {
  it("treats widths at or below 767 as phone chrome", () => {
    expect(PHONE_MAX_WIDTH).toBe(767);
    expect(isPhoneWidth(320)).toBe(true);
    expect(isPhoneWidth(767)).toBe(true);
    expect(isPhoneWidth(768)).toBe(false);
  });

  it("treats tablet widths as able to show a sidebar", () => {
    expect(isTabletWidth(768)).toBe(true);
    expect(isTabletWidth(1024)).toBe(true);
    expect(isTabletWidth(767)).toBe(false);
  });
});
