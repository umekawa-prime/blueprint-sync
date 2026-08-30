import { projectStore } from "$lib/stores/projectStore.svelte";
import { sendCurrentPdf } from "./connectionActions";
import { readFileAsBytes } from "./fileAccess";
import { openProjectPdf, persistCurrentAnnotations } from "./projectActions";
import { isProjectPdfBasename } from "./projectFormat";
import { copyFileIntoFolder, listProjectPdfs, pathExists } from "./projectIo";

export async function importBrowserPdfIntoProject(file: File): Promise<boolean> {
  if (!projectStore.folder) {
    return false;
  }
  if (!isProjectPdfBasename(file.name)) {
    projectStore.error = "PDFファイル名が不正です";
    return false;
  }
  const destPath = `${projectStore.folder}/${file.name}`;
  if (await pathExists(destPath)) {
    projectStore.error = "同じ名前のPDFが既にあります";
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
  const name = path.split(/[/\\]/).pop() ?? "";
  if (!isProjectPdfBasename(name)) {
    projectStore.error = "PDFファイル名が不正です";
    return false;
  }
  await persistCurrentAnnotations();
  const dest = await copyFileIntoFolder(path, projectStore.folder);
  projectStore.pdfs = await listProjectPdfs(projectStore.folder);
  await openProjectPdf(name);
  sendCurrentPdf();
  return true;
}
