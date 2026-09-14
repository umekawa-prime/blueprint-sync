import { projectStore } from "$lib/stores/projectStore.svelte";
import { isTauriRuntime } from "./platform";

export async function openFolderInCursor(folder: string): Promise<void> {
  if (!folder.trim()) {
    throw new Error("プロジェクトが開いていません");
  }
  if (!isTauriRuntime()) {
    throw new Error("Cursor で開くのはデスクトップ版で使えます");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("open_folder_in_cursor", { path: folder });
}

export async function openCurrentProjectInCursor(): Promise<void> {
  await openFolderInCursor(projectStore.folder);
}
