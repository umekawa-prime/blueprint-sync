import { describe, expect, it } from "vitest";
import {
  isPhoneWidth,
  isTabletWidth,
  PHONE_MAX_WIDTH,
  SAFE_AREA_PADDING_STYLE,
  safeAreaPaddingCss,
} from "./chromeLayout";

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

  it("keeps chrome padding on the system safe-area insets", () => {
    expect(SAFE_AREA_PADDING_STYLE).toEqual({
      paddingTop: "env(safe-area-inset-top, 0px)",
      paddingRight: "env(safe-area-inset-right, 0px)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
      paddingLeft: "env(safe-area-inset-left, 0px)",
    });
    expect(safeAreaPaddingCss()).toBe(
      "padding-top:env(safe-area-inset-top, 0px);padding-right:env(safe-area-inset-right, 0px);padding-bottom:env(safe-area-inset-bottom, 0px);padding-left:env(safe-area-inset-left, 0px)",
    );
  });
});
