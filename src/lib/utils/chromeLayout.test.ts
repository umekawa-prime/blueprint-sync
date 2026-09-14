import { describe, expect, it } from "vitest";
import {
  CAMERA_OVERLAY_CLASS,
  drawingLayerHiddenClass,
  isPhoneWidth,
  isTabletWidth,
  pageSidebarClass,
  PHONE_MAX_WIDTH,
  SAFE_AREA_PADDING_STYLE,
  safeAreaPaddingCss,
  todoPanelClass,
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

  it("puts the camera UI in a fixed overlay above canvas compositing", () => {
    expect(CAMERA_OVERLAY_CLASS).toContain("fixed");
    expect(CAMERA_OVERLAY_CLASS).toContain("inset-0");
    expect(CAMERA_OVERLAY_CLASS).toContain("z-[80]");
    expect(CAMERA_OVERLAY_CLASS).not.toContain("absolute");
  });

  it("hides the drawing surface while the camera is open so Android WebView cannot paint canvas over it", () => {
    expect(drawingLayerHiddenClass(true)).toBe("hidden");
    expect(drawingLayerHiddenClass(false)).toBe("");
  });

  it("uses a PowerPoint-style filmstrip: vertical on desktop, horizontal on phone", () => {
    expect(pageSidebarClass(false)).toContain("flex-col");
    expect(pageSidebarClass(false)).toContain("overflow-y-auto");
    expect(pageSidebarClass(false)).not.toContain("flex-row");
    expect(pageSidebarClass(true)).toContain("flex-row");
    expect(pageSidebarClass(true)).toContain("overflow-x-auto");
    expect(pageSidebarClass(true)).not.toContain("flex-col");
  });

  it("puts the Backlog-style issue list in a right column on desktop and a full overlay on phone", () => {
    expect(todoPanelClass(false)).toContain("w-[22rem]");
    expect(todoPanelClass(false)).toContain("border-l");
    expect(todoPanelClass(true)).toContain("absolute");
    expect(todoPanelClass(true)).toContain("inset-0");
  });
});
