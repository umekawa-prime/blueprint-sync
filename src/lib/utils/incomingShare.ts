import { projectStore } from "$lib/stores/projectStore.svelte";
import { isTauriRuntime } from "./platform";
import { importIncomingFile } from "./projectActions";

async function importFromPath(pathOrUrl: string): Promise<void> {
  const path = pathOrUrl.replace(/^file:\/\//, "");
  const name = path.split(/[/\\]/).pop() ?? "incoming";
  const { invoke } = await import("@tauri-apps/api/core");
  const bytes = Uint8Array.from(await invoke<number[]>("read_file_bytes", { path }));
  const result = await importIncomingFile(name, bytes);
  if (result === "confirm-overwrite" && window.confirm("同じプロジェクトが既にあります。上書きしますか？")) {
    await importIncomingFile(name, bytes, true);
  }
  if (result === "ask-new-from-pdf" && window.confirm("プロジェクトが開いていません。この PDF で新規プロジェクトを作りますか？")) {
    await importIncomingFile(name, bytes, false, true);
  }
}

export async function listenIncomingFiles(): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => undefined;
  }
  const { listen } = await import("@tauri-apps/api/event");
  return listen<string[]>("incoming-files", async (event) => {
    for (const url of event.payload) {
      try {
        await importFromPath(url);
      } catch (error) {
        projectStore.error = error instanceof Error ? error.message : "取り込みに失敗しました";
      }
    }
  });
}
