import { projectStore } from "$lib/stores/projectStore.svelte";
import { sendCurrentPdf } from "./connectionActions";
import { readFileAsBytes } from "./fileAccess";
import { openProjectPdf, persistCurrentAnnotations } from "./projectActions";
import { copyFileIntoFolder, listProjectPdfs } from "./projectIo";

export async function importBrowserPdfIntoProject(file: File): Promise<boolean> {
  if (!projectStore.folder) {
    return false;
  }
  await persistCurrentAnnotations();
  const { invoke } = await import("@tauri-apps/api/core");
  const bytes = await readFileAsBytes(file);
  await invoke("write_file_bytes", {
    path: `${projectStore.folder}/${file.name}`,
    bytes: Array.from(bytes),
  });
  projectStore.pdfs = await listProjectPdfs(projectStore.folder);
  await openProjectPdf(file.name);
  sendCurrentPdf();
  return true;
}

export async function importTauriPdfIntoProject(path: string): Promise<boolean> {
  if (!projectStore.folder) {
    return false;
  }
  await persistCurrentAnnotations();
  const dest = await copyFileIntoFolder(path, projectStore.folder);
  const name = dest.split(/[/\\]/).pop() ?? "document.pdf";
  projectStore.pdfs = await listProjectPdfs(projectStore.folder);
  await openProjectPdf(name);
  sendCurrentPdf();
  return true;
}
