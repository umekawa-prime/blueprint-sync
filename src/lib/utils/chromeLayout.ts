export const PHONE_MAX_WIDTH = 767;

export const SAFE_AREA_PADDING_STYLE = {
  paddingTop: "env(safe-area-inset-top, 0px)",
  paddingRight: "env(safe-area-inset-right, 0px)",
  paddingBottom: "env(safe-area-inset-bottom, 0px)",
  paddingLeft: "env(safe-area-inset-left, 0px)",
} as const;

export function safeAreaPaddingCss(
  style: typeof SAFE_AREA_PADDING_STYLE = SAFE_AREA_PADDING_STYLE,
): string {
  return [
    `padding-top:${style.paddingTop}`,
    `padding-right:${style.paddingRight}`,
    `padding-bottom:${style.paddingBottom}`,
    `padding-left:${style.paddingLeft}`,
  ].join(";");
}

export function isPhoneWidth(width: number): boolean {
  return width <= PHONE_MAX_WIDTH;
}

export function isTabletWidth(width: number): boolean {
  return width > PHONE_MAX_WIDTH;
}

export const CAMERA_OVERLAY_CLASS =
  "fixed inset-0 z-[80] flex items-center justify-center bg-slate-950 p-4";

export function drawingLayerHiddenClass(cameraOpen: boolean): string {
  return cameraOpen ? "hidden" : "";
}
