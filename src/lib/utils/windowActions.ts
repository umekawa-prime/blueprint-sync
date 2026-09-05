import { isTauriRuntime } from "./platform";

async function currentWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export async function minimizeAppWindow(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await (await currentWindow()).minimize();
}

export async function toggleMaximizeAppWindow(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await (await currentWindow()).toggleMaximize();
}

export async function closeAppWindow(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await (await currentWindow()).close();
}

export async function startDraggingAppWindow(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await (await currentWindow()).startDragging();
}
