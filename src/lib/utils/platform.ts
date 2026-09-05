export type AppPlatform = "windows" | "android" | "ios" | "other";

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function shouldOfferBrowserDemo(isTauri = isTauriRuntime()): boolean {
  return !isTauri;
}

export function shouldAutoStartWebDemo(
  search = typeof window === "undefined" ? "" : window.location.search,
  isTauri = isTauriRuntime(),
): boolean {
  return !isTauri && new URLSearchParams(search).get("demo") === "1";
}

export function isIosLike(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) {
    return true;
  }
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function detectPlatform(): AppPlatform {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android")) {
    return "android";
  }
  if (ua.includes("windows")) {
    return "windows";
  }
  if (isIosLike()) {
    return "ios";
  }
  return "other";
}

export function isDesktopTauriRuntime(
  isTauri = isTauriRuntime(),
  platform: AppPlatform = typeof navigator === "undefined" ? "other" : detectPlatform(),
): boolean {
  return isTauri && platform !== "android" && platform !== "ios";
}

export function usesRfdFileDialog(): boolean {
  return isDesktopTauriRuntime();
}

export function prefersCameraCapture(platform = detectPlatform()): boolean {
  return platform === "android" || platform === "ios";
}
