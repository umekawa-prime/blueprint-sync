import { annotationStore } from "$lib/stores/annotationStore.svelte";
import { historyStore } from "$lib/stores/historyStore.svelte";
import { pdfStore } from "$lib/stores/pdfStore.svelte";
import { projectStore } from "$lib/stores/projectStore.svelte";
import { viewerApi } from "$lib/stores/viewerApi";
import { sendCurrentPdf } from "./connectionActions";
import { openPdfsFromDisk, pickImportFiles } from "./fileAccess";
import { isTauriRuntime, usesSandboxProjects } from "./platform";
import {
  createProjectMeta,
  dropRecent,
  folderDisplayName,
  isAllowedLinkUrl,
  isProjectPdfBasename,
  isProjectPdfRelPath,
  joinProjectPdfRelPath,
  projectPdfDisplayName,
  projectPdfKindDir,
  rememberRecent,
  type ProjectMeta,
  type ProjectPdfKind,
} from "./projectFormat";
import {
  deleteFile,
  httpGet,
  initProjectDir,
  listProjectFiles,
  listProjectPdfs,
  listSandboxProjects,
  loadRecentProjects,
  moveFileIntoFolder,
  pathExists,
  pickFolder,
  projectJsonPath,
  readAnnotationFile,
  readBinaryFile,
  readProjectMeta,
  removeDirAll,
  sandboxProjectsDir,
  saveRecentProjects,
  writeAnnotationFile,
  writeBinaryFile,
  writeProjectMeta,
} from "./projectIo";
import { importOneDrivePdfsIntoFolder } from "./oneDriveImport";
import { importZipPdfsIntoFolder } from "./zipImport";
import { isZipBasename } from "./zipPdf";
import { planIncoming, shareProjectBundle } from "./projectShare";
import { extractDrawingPdfBytes, pinSlideCounts } from "./pinSlides";
import { shareFileBytes } from "./shareFile";
import {
  WEB_DEMO_FOLDER,
  enableWebDemo,
  isWebDemo,
  resetWebDemo,
  webListPdfs,
  webPut,
} from "./webDemoFs";
import {
  closeTabList,
  createProjectTab,
  findTabByFolder,
  rememberLiveTab,
  type TabSession,
} from "./projectTabs";

function requireTauri() {
  if (!isTauriRuntime() && !isWebDemo()) {
    throw new Error("プロジェクト機能は Tauri アプリ上でのみ利用できます");
  }
}

async function remember(name: string, path: string, id?: string) {
  const next = rememberRecent(projectStore.recents, { id, name, path });
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

function tabTitle(): string {
  return projectStore.meta?.name || folderDisplayName(projectStore.folder);
}

function captureLiveSession(): TabSession {
  return {
    folder: projectStore.folder,
    meta: projectStore.meta,
    pdfs: [...projectStore.pdfs],
    currentPdf: projectStore.currentPdf,
    error: projectStore.error,
    annotations: {
      byPage: JSON.parse(JSON.stringify(annotationStore.exportByPage())),
      photoPins: JSON.parse(JSON.stringify(annotationStore.exportPhotoPins())),
    },
    history: {
      undoStack: [...historyStore.undoStack],
      redoStack: [...historyStore.redoStack],
    },
    pdf: {
      name: pdfStore.name,
      bytes: pdfStore.bytes,
      pageIndex: pdfStore.pageIndex,
      zoom: pdfStore.zoom,
      status: pdfStore.status,
    },
  };
}

async function applyLiveSession(session: TabSession): Promise<void> {
  viewerApi.discardOverlays();
  projectStore.folder = session.folder;
  projectStore.meta = session.meta;
  projectStore.pdfs = [...session.pdfs];
  projectStore.currentPdf = session.currentPdf;
  projectStore.error = session.error;
  annotationStore.importByPage(session.annotations.byPage, session.annotations.photoPins);
  historyStore.replace(session.history);
  if (session.pdf.bytes) {
    await pdfStore.load(session.pdf.name, session.pdf.bytes);
    pdfStore.pageIndex = session.pdf.pageIndex;
    pdfStore.zoom = session.pdf.zoom;
    pdfStore.status = session.pdf.status;
    return;
  }
  pdfStore.clear();
  pdfStore.status = session.pdf.status;
}

function registerLiveTab(): void {
  if (!projectStore.folder) {
    return;
  }
  const existing = findTabByFolder(projectStore.tabs, projectStore.folder);
  if (existing) {
    projectStore.tabs = projectStore.tabs.map((tab) =>
      tab.id === existing.id
        ? { ...tab, folder: projectStore.folder, name: tabTitle(), session: null }
        : tab,
    );
    projectStore.activeTabId = existing.id;
    return;
  }
  const tab = createProjectTab({
    id: crypto.randomUUID(),
    folder: projectStore.folder,
    name: tabTitle(),
  });
  projectStore.tabs = [...projectStore.tabs, tab];
  projectStore.activeTabId = tab.id;
}

async function parkActiveTab(): Promise<boolean> {
  if (!projectStore.activeTabId || projectStore.tabs.length === 0) {
    return true;
  }
  viewerApi.persistPage();
  const persisted = await persistCurrentAnnotations();
  if (!persisted) {
    return false;
  }
  projectStore.tabs = rememberLiveTab(
    projectStore.tabs,
    projectStore.activeTabId,
    captureLiveSession(),
  );
  viewerApi.discardOverlays();
  return true;
}

async function openFirstProjectPdf(): Promise<void> {
  const first = projectStore.pdfs[0];
  if (first) {
    await openProjectPdf(first);
  }
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
  if (usesSandboxProjects()) {
    projectStore.sandboxProjects = await listSandboxProjects();
  }
}

export async function createProject(name?: string): Promise<void> {
  requireTauri();
  if (usesSandboxProjects()) {
    const trimmed = name?.trim();
    if (!trimmed) {
      return;
    }
    const root = (await sandboxProjectsDir()).replace(/[/\\]+$/, "");
    const meta = createProjectMeta(trimmed);
    await createProjectAt(`${root}/${meta.id}`, meta);
    return;
  }
  const folder = await pickFolder();
  if (!folder) {
    return;
  }
  await createProjectAt(folder);
}

async function createProjectAt(folder: string, meta?: ProjectMeta): Promise<void> {
  const existing = findTabByFolder(projectStore.tabs, folder);
  if (existing) {
    await switchProjectTab(existing.id);
    return;
  }
  await initProjectDir(folder);
  const nextMeta = meta ?? createProjectMeta(folderDisplayName(folder));
  await writeProjectMeta(folder, nextMeta);
  const pdfs = await listProjectPdfs(folder);
  const parked = await parkActiveTab();
  if (!parked) {
    return;
  }
  projectStore.folder = folder;
  projectStore.meta = nextMeta;
  projectStore.pdfs = pdfs;
  projectStore.currentPdf = "";
  projectStore.error = "";
  pdfStore.clear();
  annotationStore.clear();
  await remember(nextMeta.name, folder, nextMeta.id);
  registerLiveTab();
  await openFirstProjectPdf();
}

export async function openProject(folder?: string): Promise<void> {
  requireTauri();
  const selected = folder ?? (await pickFolder());
  if (!selected) {
    return;
  }
  const existing = findTabByFolder(projectStore.tabs, selected);
  if (existing) {
    await switchProjectTab(existing.id);
    return;
  }
  try {
    const meta = await readProjectMeta(selected);
    await initProjectDir(selected);
    const pdfs = await listProjectPdfs(selected);
    const parked = await parkActiveTab();
    if (!parked) {
      return;
    }
    projectStore.folder = selected;
    projectStore.meta = meta;
    projectStore.pdfs = pdfs;
    projectStore.currentPdf = "";
    projectStore.error = "";
    pdfStore.clear();
    annotationStore.clear();
    await remember(meta.name, selected, meta.id);
    registerLiveTab();
    await openFirstProjectPdf();
  } catch (error) {
    const message = error instanceof Error ? error.message : "プロジェクトを開けませんでした";
    const friendly = message.includes("Invalid project")
      ? "project.json が見つからないか、内容が不正です"
      : message;
    if (folder) {
      projectStore.recents = dropRecent(projectStore.recents, selected);
      await saveRecentProjects(projectStore.recents);
    }
    if (projectStore.tabs.length === 0) {
      projectStore.reset();
      projectStore.error = friendly;
    } else {
      pdfStore.status = friendly;
    }
    throw new Error(friendly);
  }
}

export async function switchProjectTab(tabId: string): Promise<void> {
  if (tabId === projectStore.activeTabId) {
    return;
  }
  const target = projectStore.tabs.find((tab) => tab.id === tabId);
  if (!target?.session) {
    return;
  }
  const parked = await parkActiveTab();
  if (!parked) {
    return;
  }
  await applyLiveSession(target.session);
  projectStore.tabs = projectStore.tabs.map((tab) =>
    tab.id === tabId ? { ...tab, session: null } : tab,
  );
  projectStore.activeTabId = tabId;
}

export async function closeProjectTab(tabId: string): Promise<void> {
  const closing = projectStore.tabs.find((tab) => tab.id === tabId);
  if (!closing) {
    return;
  }
  if (tabId === projectStore.activeTabId) {
    viewerApi.persistPage();
    const persisted = await persistCurrentAnnotations();
    if (!persisted) {
      return;
    }
  }
  const result = closeTabList(projectStore.tabs, tabId, projectStore.activeTabId);
  if (result.closedLast) {
    projectStore.reset();
    pdfStore.clear();
    annotationStore.clear();
    return;
  }
  projectStore.tabs = result.tabs;
  if (result.nextActiveId === projectStore.activeTabId) {
    return;
  }
  const next = result.tabs.find((tab) => tab.id === result.nextActiveId);
  if (!next?.session) {
    projectStore.activeTabId = result.nextActiveId;
    return;
  }
  await applyLiveSession(next.session);
  projectStore.tabs = result.tabs.map((tab) =>
    tab.id === next.id ? { ...tab, session: null } : tab,
  );
  projectStore.activeTabId = next.id;
}

export async function openProjectTab(): Promise<void> {
  requireTauri();
  if (usesSandboxProjects()) {
    return;
  }
  const folder = await pickFolder();
  if (!folder) {
    return;
  }
  const existing = findTabByFolder(projectStore.tabs, folder);
  if (existing) {
    await switchProjectTab(existing.id);
    return;
  }
  if (await pathExists(projectJsonPath(folder))) {
    await openProject(folder);
    return;
  }
  await createProjectAt(folder);
}

export async function closeProject(): Promise<void> {
  if (projectStore.activeTabId) {
    await closeProjectTab(projectStore.activeTabId);
    return;
  }
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

export async function importOneDriveLinkIntoProject(
  url: string,
  kind: ProjectPdfKind,
  fallbackTitle = "",
): Promise<void> {
  requireTauri();
  if (!projectStore.folder) {
    return;
  }
  if (!isAllowedLinkUrl(url.trim())) {
    setPdfOpenError("http または https の URL だけ取り込めます");
    return;
  }
  const persisted = await persistCurrentAnnotations();
  if (!persisted) {
    return;
  }
  try {
    const result = await importOneDrivePdfsIntoFolder({
      shareUrl: url.trim(),
      kind,
      projectFolder: projectStore.folder,
      fallbackTitle,
      httpGet,
      pathExists,
      writeFile: writeBinaryFile,
    });
    projectStore.error = "";
    projectStore.pdfs = await listProjectPdfs(projectStore.folder);
    const messages: string[] = [];
    if (result.imported.length > 0) {
      messages.push(`${result.imported.length}件を取り込みました`);
      await openProjectPdf(result.imported[0]);
    }
    if (result.skipped.length > 0) {
      messages.push(`既存のためスキップ: ${result.skipped.join(", ")}`);
    }
    pdfStore.status = messages.join(" / ") || "取り込むPDFがありませんでした";
  } catch (error) {
    throw setProjectImportError(error);
  }
}

export async function persistCurrentAnnotations(): Promise<boolean> {
  if (!projectStore.folder || !projectStore.currentPdf) {
    return true;
  }
  try {
    if (pdfStore.pageCount > 0) {
      await writeAnnotationFile(
        projectStore.folder,
        projectStore.currentPdf,
        annotationStore.exportByPage(),
        annotationStore.exportPhotoPins(),
        {
          drawingPageCount: pdfStore.pageCount,
          pinSlideCountByPage: pinSlideCounts(pdfStore.pageCount, annotationStore.exportPhotoPins()),
        },
      );
    } else {
      await writeAnnotationFile(
        projectStore.folder,
        projectStore.currentPdf,
        annotationStore.exportByPage(),
        annotationStore.exportPhotoPins(),
      );
    }
    annotationStore.dirty = false;
    return true;
  } catch (error) {
    pdfStore.status = error instanceof Error ? error.message : "注釈の保存に失敗しました";
    return false;
  }
}

let openPdfSeq = 0;

export async function openProjectPdf(fileName: string): Promise<void> {
  if (!projectStore.folder) {
    return;
  }
  if (!isProjectPdfRelPath(fileName)) {
    setPdfOpenError("PDFファイル名が不正です");
    return;
  }
  if (
    projectStore.currentPdf === fileName &&
    pdfStore.name === fileName &&
    pdfStore.document
  ) {
    return;
  }
  const seq = ++openPdfSeq;
  const persisted = await persistCurrentAnnotations();
  if (!persisted) {
    return;
  }
  if (seq !== openPdfSeq) {
    return;
  }
  try {
    const bytes = await readBinaryFile(
      `${projectStore.folder}/${fileName.replaceAll("\\", "/")}`,
    );
    let nextAnnotations: Awaited<ReturnType<typeof readAnnotationFile>> = {
      byPage: {},
      photoPins: {},
    };
    let annotationWarning = "";
    try {
      nextAnnotations = await readAnnotationFile(projectStore.folder, fileName);
    } catch {
      annotationWarning = "注釈を読み込めなかったため、空の注釈で開きました";
    }
    if (seq !== openPdfSeq) {
      return;
    }
    annotationStore.importByPage(nextAnnotations.byPage, nextAnnotations.photoPins);
    const drawingBytes =
      nextAnnotations.drawingPageCount && nextAnnotations.pinSlideCountByPage
        ? await extractDrawingPdfBytes(
            bytes,
            nextAnnotations.drawingPageCount,
            nextAnnotations.pinSlideCountByPage,
          )
        : bytes;
    await pdfStore.load(fileName, drawingBytes);
    if (seq !== openPdfSeq) {
      return;
    }
    projectStore.currentPdf = fileName;
    projectStore.error = "";
    pdfStore.status = annotationWarning;
    sendCurrentPdf();
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDFを開けませんでした";
    pdfStore.status = message;
    projectStore.error = message;
  }
}

async function makeDemoPdf(title: string): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const document = await PDFDocument.create();
  const page = document.addPage([720, 1020]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  page.drawText(title, {
    x: 64,
    y: 920,
    size: 28,
    font,
    color: rgb(0.1, 0.15, 0.2),
  });
  return new Uint8Array(await document.save());
}

export async function startWebDemo(): Promise<void> {
  if (isTauriRuntime()) {
    throw new Error("デモモードはブラウザ専用です");
  }
  resetWebDemo();
  enableWebDemo();
  const folder = WEB_DEMO_FOLDER;
  webPut(`${folder}/図面/既存図.pdf`, await makeDemoPdf("Drawing A"));
  webPut(`${folder}/図面/追加図.pdf`, await makeDemoPdf("Drawing B"));
  webPut(`${folder}/工程表/週間工程.pdf`, await makeDemoPdf("Schedule"));
  const meta = createProjectMeta("デモプロジェクト");
  projectStore.folder = folder;
  projectStore.meta = meta;
  projectStore.pdfs = webListPdfs(folder);
  projectStore.currentPdf = "";
  projectStore.error = "";
  pdfStore.status = "ブラウザデモ: 図面名をクリックして切り替えてください";
  registerLiveTab();
  await openProjectPdf("図面/既存図.pdf");
}

async function importZipBytesIntoOpenProject(
  zipBytes: Uint8Array,
  kind: ProjectPdfKind,
  sourcePath?: string,
): Promise<string> {
  const folder = projectStore.folder;
  if (!folder) {
    throw new Error("プロジェクトが開かれていません");
  }
  const result = await importZipPdfsIntoFolder({
    zipBytes,
    kind,
    projectFolder: folder,
    pathExists,
    writeFile: writeBinaryFile,
  });
  if (result.imported.length === 0) {
    throw new Error("同じ名前のPDFが既にあります");
  }
  if (sourcePath) {
    try {
      await deleteFile(sourcePath);
    } catch {
      // PDFs already written; keep them even if the zip cannot be removed.
    }
  }
  return result.imported[0];
}

export async function importPdfIntoProject(kind: ProjectPdfKind = "drawing"): Promise<void> {
  if (!projectStore.folder) {
    return;
  }
  const files = await openPdfsFromDisk();
  if (files.length === 0) {
    return;
  }
  const usable = files.filter(
    (file) => isZipBasename(file.name) || isProjectPdfBasename(file.name),
  );
  if (usable.length === 0) {
    setPdfOpenError("PDFファイル名が不正です");
    return;
  }
  const persisted = await persistCurrentAnnotations();
  if (!persisted) {
    return;
  }
  const imported: string[] = [];
  let lastError: unknown;
  for (const file of usable) {
    try {
      imported.push(...(await importPickedPdfIntoOpenProject(file, kind)));
    } catch (error) {
      lastError = error;
    }
  }
  if (imported.length === 0) {
    throw setProjectImportError(lastError ?? new Error("PDF の取り込みに失敗しました"));
  }
  projectStore.error = "";
  pdfStore.status = "";
  projectStore.pdfs = await listProjectPdfs(projectStore.folder);
  await openProjectPdf(imported[0]);
}

async function importPickedPdfIntoOpenProject(
  file: { name: string; bytes: Uint8Array; path?: string },
  kind: ProjectPdfKind,
): Promise<string[]> {
  if (isZipBasename(file.name)) {
    const zipBytes =
      file.bytes.length > 0 ? file.bytes : file.path ? await readBinaryFile(file.path) : file.bytes;
    const first = await importZipBytesIntoOpenProject(zipBytes, kind, file.path);
    return [first];
  }
  const relPath = joinProjectPdfRelPath(kind, file.name);
  if (file.path) {
    await moveFileIntoFolder(file.path, projectPdfKindDir(projectStore.folder!, kind));
  } else {
    const destPath = `${projectStore.folder}/${relPath}`;
    if (await pathExists(destPath)) {
      throw new Error("同じ名前のPDFが既にあります");
    }
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("write_file_bytes", {
      path: destPath,
      bytes: Array.from(file.bytes),
    });
  }
  return [relPath];
}

export async function refreshProjectPdfs(): Promise<void> {
  requireTauri();
  if (!projectStore.folder) {
    return;
  }
  projectStore.pdfs = await listProjectPdfs(projectStore.folder);
}

export async function shareCurrentProject(): Promise<boolean> {
  if (!projectStore.folder || !projectStore.meta) {
    pdfStore.status = "先にプロジェクトを開いてください";
    return false;
  }
  viewerApi.persistPage();
  const result = await shareProjectBundle({
    persist: persistCurrentAnnotations,
    folder: projectStore.folder,
    name: projectStore.meta.name,
    listFiles: listProjectFiles,
    readFile: readBinaryFile,
    share: shareFileBytes,
  });
  if (result === "persist-failed") {
    return false;
  }
  if (result === "pack-failed") {
    const message = "プロジェクトの共有に失敗しました";
    pdfStore.status = message;
    projectStore.error = message;
    return false;
  }
  return true;
}

export async function shareCurrentPdf(): Promise<boolean> {
  if (!pdfStore.bytes || !projectStore.currentPdf) {
    pdfStore.status = "先にPDFを開いてください";
    return false;
  }
  await shareFileBytes({
    name: projectPdfDisplayName(projectStore.currentPdf),
    bytes: pdfStore.bytes,
    mime: "application/pdf",
  });
  return true;
}

export async function pickAndImportIncoming(): Promise<string> {
  const files = await pickImportFiles();
  let last: "ok" | "confirm-overwrite" | "ask-new-from-pdf" | "empty" = "empty";
  for (const file of files) {
    last = await importIncomingFile(file.name, file.bytes);
    if (last !== "ok") {
      return last;
    }
  }
  return last;
}

export async function importIncomingFile(
  name: string,
  bytes: Uint8Array,
  overwrite = false,
  createFromPdf = false,
): Promise<"ok" | "confirm-overwrite" | "ask-new-from-pdf"> {
  const sandbox = usesSandboxProjects() ? await listSandboxProjects() : [];
  const existingIds = sandbox
    .map((item) => item.id)
    .filter((id): id is string => Boolean(id));
  const plan = planIncoming({
    name,
    bytes,
    projectOpen: projectStore.isOpen,
    existingIds,
    overwrite,
  });

  if (plan.action === "confirm-overwrite") {
    return "confirm-overwrite";
  }
  if (plan.action === "reject") {
    throw setProjectImportError(new Error(plan.reason));
  }
  if (plan.action === "ask-new-from-pdf") {
    if (!createFromPdf) {
      return "ask-new-from-pdf";
    }
    await createProject(plan.name.replace(/\.pdf$/i, "") || "無題プロジェクト");
    if (!projectStore.folder) {
      return "ok";
    }
    await writeIncomingPdf(plan.name, plan.bytes);
    return "ok";
  }
  if (plan.action === "import-pdf") {
    await writeIncomingPdf(plan.name, plan.bytes);
    return "ok";
  }
  if (plan.action === "import-pdfs") {
    if (!projectStore.folder) {
      throw setProjectImportError(new Error("先にプロジェクトを開くか、一式を共有してください"));
    }
    const persisted = await persistCurrentAnnotations();
    if (!persisted) {
      return "ok";
    }
    const first = await importZipBytesIntoOpenProject(plan.zipBytes, "drawing");
    projectStore.pdfs = await listProjectPdfs(projectStore.folder);
    await openProjectPdf(first);
    return "ok";
  }
  if (plan.action === "install-project" || plan.action === "overwrite-project") {
    await installBundle(plan.meta, plan.files, plan.action === "overwrite-project");
    return "ok";
  }
  return "ok";
}

async function writeIncomingPdf(name: string, bytes: Uint8Array): Promise<void> {
  if (!projectStore.folder) {
    throw setProjectImportError(new Error("プロジェクトが開かれていません"));
  }
  const persisted = await persistCurrentAnnotations();
  if (!persisted) {
    return;
  }
  const relPath = joinProjectPdfRelPath("drawing", name);
  const destPath = `${projectStore.folder}/${relPath}`;
  if (await pathExists(destPath)) {
    throw setProjectImportError(new Error("同じ名前のPDFが既にあります"));
  }
  await writeBinaryFile(destPath, bytes);
  projectStore.pdfs = await listProjectPdfs(projectStore.folder);
  await openProjectPdf(relPath);
}

async function installBundle(
  meta: ProjectMeta,
  files: Record<string, Uint8Array>,
  overwrite: boolean,
): Promise<void> {
  const root = (await sandboxProjectsDir()).replace(/[/\\]+$/, "");
  const folder = `${root}/${meta.id}`;
  if (overwrite) {
    await removeDirAll(folder);
  }
  await initProjectDir(folder);
  for (const [rel, data] of Object.entries(files)) {
    await writeBinaryFile(`${folder}/${rel}`, data);
  }
  await openProject(folder);
}

