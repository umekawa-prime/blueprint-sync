export type AppPlatform = "windows" | "android" | "ios" | "other";

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
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

export function usesRfdFileDialog(): boolean {
  return isTauriRuntime() && detectPlatform() !== "android" && detectPlatform() !== "ios";
}

export function prefersCameraCapture(platform = detectPlatform()): boolean {
  return platform === "android" || platform === "ios";
}
