import { annotationStore } from "$lib/stores/annotationStore.svelte";
import { pdfStore } from "$lib/stores/pdfStore.svelte";
import { projectStore } from "$lib/stores/projectStore.svelte";
import { sendCurrentPdf } from "./connectionActions";
import { openPdfFromDisk } from "./fileAccess";
import { isTauriRuntime } from "./platform";
import {
  createProjectMeta,
  dropRecent,
  isAllowedLinkUrl,
  isProjectPdfBasename,
  rememberRecent,
} from "./projectFormat";
import {
  copyFileIntoFolder,
  initProjectDir,
  listProjectPdfs,
  loadRecentProjects,
  pathExists,
  pickFolder,
  readAnnotationFile,
  readBinaryFile,
  readProjectMeta,
  saveRecentProjects,
  writeAnnotationFile,
  writeProjectMeta,
} from "./projectIo";

function requireTauri() {
  if (!isTauriRuntime()) {
    throw new Error("プロジェクト機能は Tauri アプリ上でのみ利用できます");
  }
}

async function remember(name: string, path: string) {
  const next = rememberRecent(projectStore.recents, { name, path });
  projectStore.recents = next;
  await saveRecentProjects(next);
}

function setProjectImportError(error: unknown): Error {
  const message = error instanceof Error ? error.message : "PDF の取り込みに失敗しました";
  projectStore.error = message;
  pdfStore.status = message;
  return error instanceof Error ? error : new Error(message);
}

function setPdfOpenError(message: string) {
  projectStore.error = message;
  pdfStore.status = message;
}

export async function loadRecentsIntoStore(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  const items = await loadRecentProjects();
  const kept: typeof items = [];
  for (const item of items) {
    if (await pathExists(item.path)) {
      kept.push(item);
    }
  }
  const next = kept.slice(0, 8);
  projectStore.recents = next;
  if (next.length !== items.length) {
    await saveRecentProjects(next);
  }
}

export async function createProject(name: string): Promise<void> {
  requireTauri();
  const folder = await pickFolder();
  if (!folder) {
    return;
  }
  await initProjectDir(folder);
  const meta = createProjectMeta(name);
  await writeProjectMeta(folder, meta);
  projectStore.folder = folder;
  projectStore.meta = meta;
  projectStore.pdfs = await listProjectPdfs(folder);
  projectStore.currentPdf = "";
  projectStore.error = "";
  await remember(meta.name, folder);
}

export async function openProject(folder?: string): Promise<void> {
  requireTauri();
  const selected = folder ?? (await pickFolder());
  if (!selected) {
    return;
  }
  try {
    const meta = await readProjectMeta(selected);
    await initProjectDir(selected);
    projectStore.folder = selected;
    projectStore.meta = meta;
    projectStore.pdfs = await listProjectPdfs(selected);
    projectStore.currentPdf = "";
    projectStore.error = "";
    pdfStore.clear();
    annotationStore.clear();
    await remember(meta.name, selected);
  } catch (error) {
    const message = error instanceof Error ? error.message : "プロジェクトを開けませんでした";
    const friendly = message.includes("Invalid project")
      ? "project.json が見つからないか、内容が不正です"
      : message;
    if (folder) {
      projectStore.recents = dropRecent(projectStore.recents, selected);
      await saveRecentProjects(projectStore.recents);
    }
    projectStore.reset();
    projectStore.error = friendly;
    throw new Error(friendly);
  }
}

export async function closeProject(): Promise<void> {
  const persisted = await persistCurrentAnnotations();
  if (!persisted) {
    return;
  }
  projectStore.reset();
  pdfStore.clear();
  annotationStore.clear();
}

export async function addProjectLink(url: string, title: string): Promise<void> {
  if (!projectStore.meta || !projectStore.folder) {
    return;
  }
  if (!isAllowedLinkUrl(url.trim())) {
    projectStore.error = "http または https の URL だけ追加できます";
    return;
  }
  const nextMeta = {
    ...projectStore.meta,
    links: [
      ...projectStore.meta.links,
      { id: crypto.randomUUID(), title: title.trim(), url: url.trim() },
    ],
  };
  try {
    await writeProjectMeta(projectStore.folder, nextMeta);
    projectStore.meta = nextMeta;
    projectStore.error = "";
  } catch (error) {
    projectStore.error = error instanceof Error ? error.message : "リンクの保存に失敗しました";
  }
}

export async function removeProjectLink(id: string): Promise<void> {
  if (!projectStore.meta || !projectStore.folder) {
    return;
  }
  const nextMeta = {
    ...projectStore.meta,
    links: projectStore.meta.links.filter((link) => link.id !== id),
  };
  try {
    await writeProjectMeta(projectStore.folder, nextMeta);
    projectStore.meta = nextMeta;
    projectStore.error = "";
  } catch (error) {
    projectStore.error = error instanceof Error ? error.message : "リンクの保存に失敗しました";
  }
}

export async function openProjectLink(url: string): Promise<void> {
  requireTauri();
  if (!isAllowedLinkUrl(url)) {
    return;
  }
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(url);
}

export async function persistCurrentAnnotations(): Promise<boolean> {
  if (!projectStore.folder || !projectStore.currentPdf) {
    return true;
  }
  try {
    await writeAnnotationFile(
      projectStore.folder,
      projectStore.currentPdf,
      annotationStore.exportByPage(),
    );
    return true;
  } catch (error) {
    pdfStore.status = error instanceof Error ? error.message : "注釈の保存に失敗しました";
    return false;
  }
}

export async function openProjectPdf(fileName: string): Promise<void> {
  if (!projectStore.folder) {
    return;
  }
  if (!isProjectPdfBasename(fileName)) {
    setPdfOpenError("PDFファイル名が不正です");
    return;
  }
  const persisted = await persistCurrentAnnotations();
  if (!persisted) {
    return;
  }
  try {
    const bytes = await readBinaryFile(`${projectStore.folder}/${fileName}`);
    let nextAnnotations: Awaited<ReturnType<typeof readAnnotationFile>>;
    try {
      nextAnnotations = await readAnnotationFile(projectStore.folder, fileName);
    } catch {
      pdfStore.status = "注釈ファイルの読み込みに失敗しました";
      return;
    }
    await pdfStore.load(fileName, bytes);
    annotationStore.importByPage(nextAnnotations);
    projectStore.currentPdf = fileName;
    projectStore.error = "";
    pdfStore.status = "";
    sendCurrentPdf();
  } catch (error) {
    pdfStore.status = error instanceof Error ? error.message : "PDFを開けませんでした";
  }
}

export async function importPdfIntoProject(): Promise<void> {
  if (!projectStore.folder) {
    return;
  }
  const file = await openPdfFromDisk();
  if (!file) {
    return;
  }
  if (!isProjectPdfBasename(file.name)) {
    setPdfOpenError("PDFファイル名が不正です");
    return;
  }
  const persisted = await persistCurrentAnnotations();
  if (!persisted) {
    return;
  }
  let name = file.name;
  try {
    if (file.path) {
      const dest = await copyFileIntoFolder(file.path, projectStore.folder);
      name = dest.split(/[/\\]/).pop() ?? file.name;
    } else {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("write_file_bytes", {
        path: `${projectStore.folder}/${file.name}`,
        bytes: Array.from(file.bytes),
      });
    }
  } catch (error) {
    throw setProjectImportError(error);
  }
  projectStore.error = "";
  pdfStore.status = "";
  projectStore.pdfs = await listProjectPdfs(projectStore.folder);
  await openProjectPdf(name);
}

export async function refreshProjectPdfs(): Promise<void> {
  requireTauri();
  if (!projectStore.folder) {
    return;
  }
  projectStore.pdfs = await listProjectPdfs(projectStore.folder);
}
