export type AppPlatform = "windows" | "android" | "other";

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function detectPlatform(): AppPlatform {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android")) {
    return "android";
  }
  if (ua.includes("windows")) {
    return "windows";
  }
  return "other";
}

export function prefersCameraCapture(platform = detectPlatform()): boolean {
  return platform === "android";
}
