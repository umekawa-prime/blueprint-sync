import { pdfStore } from "$lib/stores/pdfStore.svelte";
import { projectStore } from "$lib/stores/projectStore.svelte";
import { readFileAsBytes } from "./fileAccess";
import { openProjectPdf, persistCurrentAnnotations } from "./projectActions";
import {
  isProjectPdfBasename,
  joinProjectPdfRelPath,
  projectPdfKindDir,
  type ProjectPdfKind,
} from "./projectFormat";
import { listProjectPdfs, moveFileIntoFolder, pathExists } from "./projectIo";

export async function importBrowserPdfIntoProject(
  file: File,
  kind: ProjectPdfKind = "drawing",
): Promise<boolean> {
  if (!projectStore.folder) {
    return false;
  }
  if (!isProjectPdfBasename(file.name)) {
    projectStore.error = "PDFファイル名が不正です";
    pdfStore.status = "PDFファイル名が不正です";
    return false;
  }
  const relPath = joinProjectPdfRelPath(kind, file.name);
  const destPath = `${projectStore.folder}/${relPath}`;
  if (await pathExists(destPath)) {
    projectStore.error = "同じ名前のPDFが既にあります";
    pdfStore.status = "同じ名前のPDFが既にあります";
    return false;
  }
  const persisted = await persistCurrentAnnotations();
  if (!persisted) {
    return false;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  const bytes = await readFileAsBytes(file);
  await invoke("write_file_bytes", {
    path: destPath,
    bytes: Array.from(bytes),
  });
  projectStore.pdfs = await listProjectPdfs(projectStore.folder);
  await openProjectPdf(relPath);
  return true;
}

export async function importTauriPdfIntoProject(
  path: string,
  kind: ProjectPdfKind = "drawing",
): Promise<boolean> {
  if (!projectStore.folder) {
    return false;
  }
  const name = path.split(/[/\\]/).pop() ?? "";
  if (!isProjectPdfBasename(name)) {
    projectStore.error = "PDFファイル名が不正です";
    pdfStore.status = "PDFファイル名が不正です";
    return false;
  }
  const persisted = await persistCurrentAnnotations();
  if (!persisted) {
    return false;
  }
  const relPath = joinProjectPdfRelPath(kind, name);
  await moveFileIntoFolder(path, projectPdfKindDir(projectStore.folder, kind));
  projectStore.pdfs = await listProjectPdfs(projectStore.folder);
  await openProjectPdf(relPath);
  return true;
}
