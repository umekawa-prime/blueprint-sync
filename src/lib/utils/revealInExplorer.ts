import { projectFileAbsolutePath } from "./fileSearch";
import { isDesktopTauriRuntime } from "./platform";

export async function revealProjectFileInExplorer(folder: string, relPath: string): Promise<void> {
  if (!isDesktopTauriRuntime()) {
    throw new Error("エクスプローラーで表示はデスクトップ版で使えます");
  }
  const absolute = projectFileAbsolutePath(folder, relPath);
  if (!absolute) {
    throw new Error("ファイルパスが不正です");
  }
  const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
  await revealItemInDir(absolute);
}
