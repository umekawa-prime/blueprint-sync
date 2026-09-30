export type CameraRollFile = {
  name: string;
  bytes: number[];
};

export type SystemCameraShot = {
  name: string;
  bytes: Uint8Array;
};

export type SystemCameraWatchResult =
  | { status: "captured"; shots: SystemCameraShot[] }
  | { status: "cancelled" }
  | { status: "timeout" }
  | { status: "error"; message: string };

const DEFAULT_INTERVAL_MS = 500;
const DEFAULT_TIMEOUT_MS = 180_000;

export function shotsFromCameraRoll(files: CameraRollFile[]): SystemCameraShot[] {
  return files.map((file) => ({
    name: file.name,
    bytes: Uint8Array.from(file.bytes),
  }));
}

function cameraErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error) {
    return error;
  }
  return "Windows のカメラを起動できませんでした";
}

export async function launchWindowsCamera(): Promise<number> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<number>("launch_system_camera");
}

export async function focusAppWindow(): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("focus_main_window");
}

export async function listNewCameraPhotos(sinceUnixMs: number): Promise<CameraRollFile[]> {
  const { invoke } = await import("@tauri-apps/api/core");
  const files = await invoke<CameraRollFile[]>("list_new_camera_roll_images", { sinceUnixMs });
  return files ?? [];
}

export async function watchSystemCameraShots(options: {
  launch: () => Promise<number>;
  listSince: (sinceUnixMs: number) => Promise<CameraRollFile[]>;
  sleep: (ms: number) => Promise<void>;
  shouldStop: () => boolean;
  intervalMs?: number;
  timeoutMs?: number;
  now?: () => number;
}): Promise<SystemCameraWatchResult> {
  if (options.shouldStop()) {
    return { status: "cancelled" };
  }

  let since: number;
  try {
    since = await options.launch();
  } catch (error) {
    return { status: "error", message: cameraErrorMessage(error) };
  }

  if (options.shouldStop()) {
    return { status: "cancelled" };
  }

  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const now = options.now ?? (() => Date.now());
  const started = now();

  while (now() - started < timeoutMs) {
    if (options.shouldStop()) {
      return { status: "cancelled" };
    }
    let files: CameraRollFile[] = [];
    try {
      files = await options.listSince(since);
    } catch {
      files = [];
    }
    if (options.shouldStop()) {
      return { status: "cancelled" };
    }
    if (files.length > 0) {
      return { status: "captured", shots: shotsFromCameraRoll(files) };
    }
    await options.sleep(intervalMs);
  }

  return { status: "timeout" };
}
