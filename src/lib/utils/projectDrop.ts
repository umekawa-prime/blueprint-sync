import { pdfStore } from "$lib/stores/pdfStore.svelte";
import { projectStore } from "$lib/stores/projectStore.svelte";
import { readFileAsBytes } from "./fileAccess";
import { isCadDrawingBasename } from "./cadImport";
import { importCadBytesIntoOpenProject, openProjectPdf, persistCurrentAnnotations } from "./projectActions";
import {
  isProjectPdfBasename,
  joinProjectPdfRelPath,
  projectPdfKindDir,
  type ProjectPdfKind,
} from "./projectFormat";
import {
  deleteFile,
  listProjectPdfs,
  moveFileIntoFolder,
  pathExists,
  readBinaryFile,
  writeBinaryFile,
} from "./projectIo";
import { importZipPdfsIntoFolder } from "./zipImport";
import { isZipBasename } from "./zipPdf";

function setDropError(message: string) {
  projectStore.error = message;
  pdfStore.status = message;
}

async function importZipIntoOpenProject(
  zipBytes: Uint8Array,
  kind: ProjectPdfKind,
  sourcePath?: string,
): Promise<boolean> {
  const folder = projectStore.folder;
  if (!folder) {
    return false;
  }
  const persisted = await persistCurrentAnnotations();
  if (!persisted) {
    return false;
  }
  try {
    const result = await importZipPdfsIntoFolder({
      zipBytes,
      kind,
      projectFolder: folder,
      pathExists,
      writeFile: writeBinaryFile,
    });
    if (result.imported.length === 0) {
      setDropError("同じ名前のPDFが既にあります");
      return false;
    }
    if (sourcePath) {
      try {
        await deleteFile(sourcePath);
      } catch {
        // PDFs already written; keep them even if the zip cannot be removed.
      }
    }
    projectStore.pdfs = await listProjectPdfs(folder);
    await openProjectPdf(result.imported[0]);
    return true;
  } catch (error) {
    setDropError(error instanceof Error ? error.message : "PDF の取り込みに失敗しました");
    return false;
  }
}

export async function importBrowserPdfIntoProject(
  file: File,
  kind: ProjectPdfKind = "drawing",
): Promise<boolean> {
  if (!projectStore.folder) {
    return false;
  }
  if (isZipBasename(file.name)) {
    return importZipIntoOpenProject(await readFileAsBytes(file), kind);
  }
  if (isCadDrawingBasename(file.name)) {
    const persisted = await persistCurrentAnnotations();
    if (!persisted) {
      return false;
    }
    try {
      await importCadBytesIntoOpenProject(
        file.name,
        await readFileAsBytes(file),
        kind,
      );
      projectStore.pdfs = await listProjectPdfs(projectStore.folder);
      return true;
    } catch (error) {
      setDropError(error instanceof Error ? error.message : "図面を読み込めませんでした");
      return false;
    }
  }
  if (!isProjectPdfBasename(file.name)) {
    setDropError("PDFファイル名が不正です");
    return false;
  }
  const relPath = joinProjectPdfRelPath(kind, file.name);
  const destPath = `${projectStore.folder}/${relPath}`;
  if (await pathExists(destPath)) {
    setDropError("同じ名前のPDFが既にあります");
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
  if (isZipBasename(name)) {
    return importZipIntoOpenProject(await readBinaryFile(path), kind, path);
  }
  if (isCadDrawingBasename(name)) {
    const persisted = await persistCurrentAnnotations();
    if (!persisted) {
      return false;
    }
    try {
      await importCadBytesIntoOpenProject(name, await readBinaryFile(path), kind);
      projectStore.pdfs = await listProjectPdfs(projectStore.folder);
      return true;
    } catch (error) {
      setDropError(error instanceof Error ? error.message : "図面を読み込めませんでした");
      return false;
    }
  }
  if (!isProjectPdfBasename(name)) {
    setDropError("PDFファイル名が不正です");
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
