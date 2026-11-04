import { annotationStore } from "$lib/stores/annotationStore.svelte";
import { historyStore } from "$lib/stores/historyStore.svelte";
import { pdfStore } from "$lib/stores/pdfStore.svelte";
import { projectStore } from "$lib/stores/projectStore.svelte";
import { viewerApi } from "$lib/stores/viewerApi";
import { openPdfsFromDisk, pickImportFiles } from "./fileAccess";
import { convertCadBytesToPdf, isCadDrawingBasename, openCadFileInJwCad } from "./cadImport";
import { isTauriRuntime, supportsBrowserFolders, usesSandboxProjects } from "./platform";
import { withAutoSaveSuspended } from "./autoSaveGate";
import { acquireFolderLock, releaseFolderLock } from "./folderLock";
import {
  createProjectMeta,
  dropRecent,
  folderDisplayName,
  isAllowedLinkUrl,
  isProjectCadRelPath,
  isProjectFileRelPath,
  isProjectPdfBasename,
  isProjectPdfRelPath,
  joinProjectPdfRelPath,
  pairedDrawingPdfRelPath,
  parseProjectWorkflowStatus,
  PROJECT_PDF_DIRS,
  projectPdfDisplayName,
  projectPdfKindDir,
  rememberRecent,
  renamedProjectRelPath,
  type ProjectMeta,
  type ProjectPdfKind,
  type ProjectWorkflowStatus,
  type RecentProject,
} from "./projectFormat";
import {
  browserFolderName,
  deleteFile,
  ensureFolderAccess,
  httpGet,
  initProjectDir,
  listProjectFiles,
  listProjectPdfs,
  listSandboxProjects,
  loadRecentProjects,
  loadOpenSession,
  saveOpenSession,
  annotationPath,
  legacyAnnotationPath,
  moveFileIntoFolder,
  pathExists,
  pickFolder,
  projectJsonPath,
  readAnnotationFile,
  readBinaryFile,
  readProjectMeta,
  removeDirAll,
  renameFile,
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
  sameProjectFolder,
  type TabSession,
} from "./projectTabs";
import { captureOpenSession } from "./projectSession";
import { loadProjectTodos, resetTodoState } from "./todoActions";
import { loadProjectNotes, resetNoteState } from "./noteActions";
import { resetScheduleState } from "./scheduleActions";

let restoringSession = false;

function requireTauri() {
  if (!isTauriRuntime() && !supportsBrowserFolders() && !isWebDemo()) {
    throw new Error("プロジェクト機能は Tauri アプリ上でのみ利用できます");
  }
}

async function loadProjectLists(folder: string): Promise<void> {
  await loadProjectTodos(folder);
  await loadProjectNotes(folder);
}

function resetProjectLists() {
  resetTodoState();
  resetNoteState();
  resetScheduleState();
}

async function persistOpenSession(): Promise<void> {
  if (restoringSession || (!isTauriRuntime() && !supportsBrowserFolders())) {
    return;
  }
  try {
    await saveOpenSession(
      captureOpenSession({
        // Folders still waiting for a permission grant stay in the saved session.
        tabs: [...projectStore.tabs, ...projectStore.awaitingAccess.map((folder) => ({ folder }))],
        activeFolder: projectStore.folder || null,
      }),
    );
  } catch {
    // Opening and closing a project should not fail just because the cache could not be written.
  }
}

async function remember(name: string, path: string, id?: string) {
  const status = parseProjectWorkflowStatus(
    projectStore.meta?.status ?? projectStore.recents.find((item) => item.path === path)?.status,
  );
  const next = rememberRecent(projectStore.recents, { id, name, path, status });
  projectStore.recents = next;
  await saveRecentProjects(next);
}

function patchProjectStatus(items: RecentProject[], folder: string, status: ProjectWorkflowStatus) {
  return items.map((item) => (item.path === folder ? { ...item, status } : item));
}

async function hydrateProjectWorkflow(items: RecentProject[]): Promise<RecentProject[]> {
  const result: RecentProject[] = [];
  for (const item of items) {
    try {
      const meta = await readProjectMeta(item.path);
      result.push({ ...item, status: parseProjectWorkflowStatus(meta.status) });
    } catch {
      result.push({ ...item, status: "open" });
    }
  }
  return result;
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
      memoPins: JSON.parse(JSON.stringify(annotationStore.exportMemoPins())),
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

function discardViewerOverlays() {
  try {
    viewerApi.discardOverlays();
  } catch {
    // PdfViewer may already be unmounted (home screen).
  }
}

async function applyLiveSession(session: TabSession): Promise<void> {
  discardViewerOverlays();
  projectStore.folder = session.folder;
  projectStore.meta = session.meta;
  projectStore.pdfs = [...session.pdfs];
  projectStore.currentPdf = session.currentPdf;
  projectStore.error = session.error;
  annotationStore.importByPage(
    session.annotations.byPage,
    session.annotations.photoPins,
    session.annotations.memoPins,
  );
  historyStore.replace(session.history);
  if (session.pdf.bytes) {
    await pdfStore.load(session.pdf.name, session.pdf.bytes);
    pdfStore.pageIndex = session.pdf.pageIndex;
    pdfStore.zoom = session.pdf.zoom;
    pdfStore.status = session.pdf.status;
    await loadProjectLists(session.folder);
    return;
  }
  pdfStore.clear();
  pdfStore.status = session.pdf.status;
  await loadProjectLists(session.folder);
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
  discardViewerOverlays();
  return true;
}

async function openFirstProjectPdf(): Promise<void> {
  const first = projectStore.pdfs[0];
  if (first) {
    await openProjectPdf(first);
  }
}

export async function loadRecentsIntoStore(): Promise<void> {
  const web = supportsBrowserFolders();
  if (!isTauriRuntime() && !web) {
    return;
  }
  const items = await loadRecentProjects();
  const kept: typeof items = [];
  for (const item of items) {
    // Without permission the browser cannot tell whether a folder still exists, so keep it.
    if (web || (await pathExists(item.path))) {
      kept.push(item);
    }
  }
  const next = kept.slice(0, 8);
  projectStore.recents = await hydrateProjectWorkflow(next);
  if (next.length !== items.length) {
    await saveRecentProjects(next);
  }
  if (usesSandboxProjects()) {
    projectStore.sandboxProjects = await hydrateProjectWorkflow(await listSandboxProjects());
  }
}

async function bootstrapOpenSessionUnguarded(): Promise<void> {
  if (projectStore.bootstrapped) {
    return;
  }
  try {
    const web = supportsBrowserFolders();
    if (!isTauriRuntime() && !web) {
      return;
    }
    await loadRecentsIntoStore();
    restoringSession = true;
    let restored = false;
    try {
      const session = await loadOpenSession();
      const existing: string[] = [];
      const awaiting: string[] = [];
      for (const folder of session.folders) {
        if (web) {
          const access = await ensureFolderAccess(folder, false);
          if (access === "granted") {
            existing.push(folder);
          } else if (access === "prompt") {
            awaiting.push(folder);
          }
        } else if (await pathExists(folder)) {
          existing.push(folder);
        }
      }
      if (awaiting.length > 0) {
        projectStore.awaitingAccess = awaiting;
      }
      for (const folder of existing) {
        try {
          await openProject(folder);
        } catch {
          // Skip folders that disappeared or have a broken project.json.
        }
      }
      const active =
        session.activeFolder &&
        existing.some((folder) => sameProjectFolder(folder, session.activeFolder as string))
          ? session.activeFolder
          : (existing.at(-1) ?? null);
      if (active) {
        const tab = findTabByFolder(projectStore.tabs, active);
        if (tab) {
          await switchProjectTab(tab.id);
        }
      }
      restored = true;
    } catch {
      // Missing cache commands or a corrupt file should not block the home screen.
    } finally {
      restoringSession = false;
    }
    if (restored) {
      await persistOpenSession();
    }
  } finally {
    projectStore.bootstrapped = true;
  }
}

export async function setProjectWorkflowStatus(
  folder: string,
  status: ProjectWorkflowStatus,
): Promise<void> {
  requireTauri();
  const nextStatus = parseProjectWorkflowStatus(status);
  const meta = await readProjectMeta(folder);
  const nextMeta = { ...meta, status: nextStatus };
  await writeProjectMeta(folder, nextMeta);
  if (projectStore.folder === folder) {
    projectStore.meta = nextMeta;
  }
  projectStore.recents = patchProjectStatus(projectStore.recents, folder, nextStatus);
  projectStore.sandboxProjects = patchProjectStatus(projectStore.sandboxProjects, folder, nextStatus);
}

export async function resumeAwaitingProjects(): Promise<void> {
  for (const folder of [...projectStore.awaitingAccess]) {
    const access = await ensureFolderAccess(folder, true);
    if (access !== "granted") {
      continue;
    }
    projectStore.awaitingAccess = projectStore.awaitingAccess.filter((item) => item !== folder);
    try {
      await openProject(folder);
    } catch {
      // openProject already reports the failure and drops broken recents.
    }
  }
}

async function createProjectUnguarded(name?: string): Promise<void> {
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
  if (supportsBrowserFolders()) {
    await createProjectAt(folder, createProjectMeta(await browserFolderName(folder)));
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
  const web = supportsBrowserFolders();
  if (web) {
    await requireFolderAccessAndLock(folder);
  }
  let opened = false;
  try {
    await initProjectDir(folder);
    const nextMeta =
      meta ??
      createProjectMeta(web ? await browserFolderName(folder) : folderDisplayName(folder));
    await writeProjectMeta(folder, nextMeta);
    const pdfs = await listProjectPdfs(folder);
    const parked = await parkActiveTab();
    if (!parked) {
      return;
    }
    opened = true;
    await finishCreateProject(folder, nextMeta, pdfs);
  } finally {
    if (web && !opened) {
      releaseFolderLock(folder);
    }
  }
}

async function requireFolderAccessAndLock(folder: string): Promise<void> {
  if ((await ensureFolderAccess(folder, true)) !== "granted") {
    throw new Error("フォルダへのアクセスが許可されませんでした");
  }
  const lock = await acquireFolderLock(folder);
  if (!lock) {
    throw new Error("このプロジェクトは別のタブで開いています");
  }
}

async function finishCreateProject(
  folder: string,
  nextMeta: ProjectMeta,
  pdfs: string[],
): Promise<void> {
  projectStore.folder = folder;
  projectStore.meta = nextMeta;
  projectStore.pdfs = pdfs;
  projectStore.currentPdf = "";
  projectStore.error = "";
  pdfStore.clear();
  annotationStore.clear();
  await remember(nextMeta.name, folder, nextMeta.id);
  registerLiveTab();
  await loadProjectLists(folder);
  await openFirstProjectPdf();
  await persistOpenSession();
}

async function openProjectUnguarded(folder?: string): Promise<void> {
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
  const web = supportsBrowserFolders();
  if (web) {
    await requireFolderAccessAndLock(selected);
  }
  let opened = false;
  try {
    const meta = await readProjectMeta(selected);
    await initProjectDir(selected);
    const pdfs = await listProjectPdfs(selected);
    const parked = await parkActiveTab();
    if (!parked) {
      return;
    }
    opened = true;
    projectStore.folder = selected;
    projectStore.meta = meta;
    projectStore.pdfs = pdfs;
    projectStore.currentPdf = "";
    projectStore.error = "";
    pdfStore.clear();
    annotationStore.clear();
    await remember(meta.name, selected, meta.id);
    registerLiveTab();
    await loadProjectLists(selected);
    await openFirstProjectPdf();
    await persistOpenSession();
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
  } finally {
    if (web && !opened) {
      releaseFolderLock(selected);
    }
  }
}

async function switchProjectTabUnguarded(tabId: string): Promise<void> {
  const target = projectStore.tabs.find((tab) => tab.id === tabId);
  if (!target) {
    return;
  }
  if (tabId === projectStore.activeTabId && sameProjectFolder(projectStore.folder, target.folder)) {
    return;
  }
  if (!target.session) {
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
  await persistOpenSession();
}

async function closeProjectTabUnguarded(tabId: string): Promise<void> {
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
  if (supportsBrowserFolders()) {
    releaseFolderLock(closing.folder);
  }
  const result = closeTabList(projectStore.tabs, tabId, projectStore.activeTabId);
  if (result.closedLast) {
    projectStore.reset();
    pdfStore.clear();
    annotationStore.clear();
    resetProjectLists();
    await persistOpenSession();
    return;
  }
  projectStore.tabs = result.tabs;
  if (result.nextActiveId === projectStore.activeTabId) {
    await persistOpenSession();
    return;
  }
  const next = result.tabs.find((tab) => tab.id === result.nextActiveId);
  if (!next?.session) {
    projectStore.activeTabId = result.nextActiveId;
    await persistOpenSession();
    return;
  }
  await applyLiveSession(next.session);
  projectStore.tabs = result.tabs.map((tab) =>
    tab.id === next.id ? { ...tab, session: null } : tab,
  );
  projectStore.activeTabId = next.id;
  await persistOpenSession();
}

async function openProjectTabUnguarded(): Promise<void> {
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

async function showProjectHomeUnguarded(): Promise<void> {
  if (!projectStore.isOpen || !projectStore.activeTabId) {
    return;
  }
  const parked = await parkActiveTab();
  if (!parked) {
    return;
  }
  await persistOpenSession();
  projectStore.folder = "";
  projectStore.meta = null;
  projectStore.pdfs = [];
  projectStore.currentPdf = "";
  projectStore.error = "";
  projectStore.activeTabId = null;
  pdfStore.clear();
  annotationStore.clear();
  resetProjectLists();
}

async function closeProjectUnguarded(): Promise<void> {
  if (projectStore.activeTabId) {
    await closeProjectTab(projectStore.activeTabId);
    return;
  }
  const persisted = await persistCurrentAnnotations();
  if (!persisted) {
    return;
  }
  if (supportsBrowserFolders() && projectStore.folder) {
    releaseFolderLock(projectStore.folder);
  }
  projectStore.reset();
  pdfStore.clear();
  annotationStore.clear();
  resetProjectLists();
  await persistOpenSession();
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

export async function updateProjectLink(id: string, url: string, title: string): Promise<void> {
  if (!projectStore.meta || !projectStore.folder) {
    return;
  }
  const trimmedUrl = url.trim();
  if (!isAllowedLinkUrl(trimmedUrl)) {
    projectStore.error = "http または https の URL だけ追加できます";
    return;
  }
  const trimmedTitle = title.trim();
  const current = projectStore.meta.links.find((link) => link.id === id);
  if (!current || (current.url === trimmedUrl && current.title === trimmedTitle)) {
    projectStore.error = "";
    return;
  }
  const nextMeta = {
    ...projectStore.meta,
    links: projectStore.meta.links.map((link) =>
      link.id === id ? { id, title: trimmedTitle, url: trimmedUrl } : link,
    ),
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

async function removeProjectPdfUnguarded(relPath: string): Promise<void> {
  const folder = projectStore.folder;
  if (!folder) {
    throw new Error("プロジェクトが開かれていません");
  }
  if (!isProjectFileRelPath(relPath)) {
    throw new Error("PDFファイル名が不正です");
  }
  await deleteFile(`${folder}/${relPath}`);
  if (isProjectFileRelPath(relPath)) {
    const note = annotationPath(folder, relPath);
    try {
      await deleteFile(note);
    } catch {
      // Annotation file may not exist yet.
    }
    const legacy = legacyAnnotationPath(folder, relPath);
    if (legacy !== note) {
      try {
        await deleteFile(legacy);
      } catch {
        // Legacy annotation file is optional.
      }
    }
  }
  const wasCurrent = projectStore.currentPdf === relPath;
  projectStore.pdfs = await listProjectPdfs(folder);
  projectStore.error = "";
  if (!wasCurrent) {
    return;
  }
  annotationStore.clear();
  pdfStore.clear();
  projectStore.currentPdf = "";
  const next = projectStore.pdfs[0];
  if (next) {
    await openProjectPdf(next);
  }
}

async function renameProjectFileUnguarded(relPath: string, nextName: string): Promise<void> {
  const folder = projectStore.folder;
  if (!folder) {
    throw new Error("プロジェクトが開かれていません");
  }
  const nextRel = renamedProjectRelPath(relPath, nextName);
  if (!nextRel) {
    throw new Error("ファイル名が不正です");
  }
  const fromRel = relPath.replaceAll("\\", "/");
  if (nextRel === fromRel) {
    return;
  }
  const destPath = `${folder}/${nextRel}`;
  if (await pathExists(destPath)) {
    throw new Error("同じ名前のファイルが既にあります");
  }
  await renameFile(`${folder}/${fromRel}`, destPath);
  if (isProjectFileRelPath(fromRel)) {
    try {
      await renameFile(annotationPath(folder, fromRel), annotationPath(folder, nextRel));
    } catch {
      // Annotation file may not exist yet.
    }
    const legacy = legacyAnnotationPath(folder, fromRel);
    if (legacy !== annotationPath(folder, fromRel)) {
      try {
        await renameFile(legacy, annotationPath(folder, nextRel));
      } catch {
        // Legacy annotation file is optional.
      }
    }
  }
  projectStore.pdfs = await listProjectPdfs(folder);
  projectStore.error = "";
  if (projectStore.currentPdf === fromRel) {
    projectStore.currentPdf = nextRel;
    if (pdfStore.name === fromRel) {
      pdfStore.name = nextRel;
    }
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
  const seqAtStart = annotationStore.editSeq;
  try {
    await writeAnnotationFile(
      projectStore.folder,
      projectStore.currentPdf,
      annotationStore.exportByPage(),
      annotationStore.exportPhotoPins(),
      {
        ...(pdfStore.pageCount > 0
          ? {
              drawingPageCount: pdfStore.pageCount,
              pinSlideCountByPage: pinSlideCounts(pdfStore.pageCount, annotationStore.exportPhotoPins()),
            }
          : {}),
        memoPins: annotationStore.exportMemoPins(),
      },
    );
    if (annotationStore.editSeq === seqAtStart) {
      annotationStore.dirty = false;
    }
    return true;
  } catch (error) {
    pdfStore.status = error instanceof Error ? error.message : "注釈の保存に失敗しました";
    return false;
  }
}

let openPdfSeq = 0;

async function openProjectPdfUnguarded(fileName: string): Promise<void> {
  if (!projectStore.folder) {
    return;
  }
  const normalized = fileName.replaceAll("\\", "/");
  if (isProjectCadRelPath(normalized)) {
    try {
      await openCadFileInJwCad(`${projectStore.folder}/${normalized}`);
      projectStore.error = "";
      pdfStore.status = "";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Jw_cad を起動できませんでした";
      pdfStore.status = message;
      projectStore.error = message;
    }
    return;
  }
  if (!isProjectPdfRelPath(normalized)) {
    setPdfOpenError("PDFファイル名が不正です");
    return;
  }
  if (
    projectStore.currentPdf === normalized &&
    pdfStore.name === normalized &&
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
    const bytes = await readBinaryFile(`${projectStore.folder}/${normalized}`);
    let nextAnnotations: Awaited<ReturnType<typeof readAnnotationFile>> = {
      byPage: {},
      photoPins: {},
      memoPins: {},
    };
    let annotationWarning = "";
    try {
      nextAnnotations = await readAnnotationFile(projectStore.folder, normalized);
    } catch {
      annotationWarning = "注釈を読み込めなかったため、空の注釈で開きました";
    }
    if (seq !== openPdfSeq) {
      return;
    }
    annotationStore.importByPage(
      nextAnnotations.byPage,
      nextAnnotations.photoPins,
      nextAnnotations.memoPins,
    );
    const drawingBytes =
      nextAnnotations.drawingPageCount && nextAnnotations.pinSlideCountByPage
        ? await extractDrawingPdfBytes(
            bytes,
            nextAnnotations.drawingPageCount,
            nextAnnotations.pinSlideCountByPage,
          )
        : bytes;
    await pdfStore.load(normalized, drawingBytes);
    if (seq !== openPdfSeq) {
      return;
    }
    projectStore.currentPdf = normalized;
    projectStore.error = "";
    pdfStore.status = annotationWarning;
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDFを開けませんでした";
    pdfStore.status = message;
    projectStore.error = message;
  }
}

export async function convertCadFileToDrawingPdf(relPath: string): Promise<void> {
  const folder = projectStore.folder;
  if (!folder) {
    throw new Error("プロジェクトが開かれていません");
  }
  const normalized = relPath.replaceAll("\\", "/");
  const destRel = pairedDrawingPdfRelPath(normalized);
  if (!destRel) {
    throw new Error("JWW/JWC/DXFファイルではありません");
  }
  const destPath = `${folder}/${destRel}`;
  if (await pathExists(destPath)) {
    throw new Error("同じ名前のPDFが既にあります");
  }
  const cadBytes = await readBinaryFile(`${folder}/${normalized}`);
  const converted = await convertCadBytesToPdf(projectPdfDisplayName(normalized), cadBytes);
  await writeBinaryFile(destPath, converted.bytes);
  projectStore.pdfs = await listProjectPdfs(folder);
  projectStore.error = "";
  pdfStore.status = "";
}

async function makeDemoPdf(title: string): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
    const page = document.addPage([720, 1020]);
    page.drawText(`${title}  p.${pageIndex + 1}`, {
      x: 64,
      y: 920,
      size: 28,
      font,
      color: rgb(0.1, 0.15, 0.2),
    });
  }
  return new Uint8Array(await document.save());
}

async function startWebDemoUnguarded(): Promise<void> {
  if (isTauriRuntime()) {
    throw new Error("デモモードはブラウザ専用です");
  }
  resetWebDemo();
  enableWebDemo();
  const folder = WEB_DEMO_FOLDER;
  webPut(`${folder}/図面/既存図.pdf`, await makeDemoPdf("Drawing A"));
  webPut(`${folder}/図面/追加図.pdf`, await makeDemoPdf("Drawing B"));
  webPut(`${folder}/工程表/週間工程.pdf`, await makeDemoPdf("Schedule"));
  webPut(
    `${folder}/TODO.md`,
    new TextEncoder().encode(`# TODO

## 未対応
- [ ] TODO-1 現場で寸法を確認する 期限:2026-09-20

## 処理中
- [ ] TODO-2 図面の赤字を反映する

## 処理済み
- [x] TODO-3 キックオフを実施する
`),
  );
  webPut(
    `${folder}/NOTE.md`,
    new TextEncoder().encode(`# NOTE

- 現場で寸法を確認する
- 図面の赤字を反映する
`),
  );
  const meta = createProjectMeta("デモプロジェクト");
  projectStore.folder = folder;
  projectStore.meta = meta;
  projectStore.pdfs = webListPdfs(folder);
  projectStore.currentPdf = "";
  projectStore.error = "";
  pdfStore.status = "ブラウザデモ: 図面名をクリックして切り替えてください";
  registerLiveTab();
  await loadProjectLists(folder);
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
  const usable = files.filter((file) => {
    if (kind === "cad") {
      return isCadDrawingBasename(file.name);
    }
    return (
      isZipBasename(file.name) || isProjectPdfBasename(file.name) || isCadDrawingBasename(file.name)
    );
  });
  if (usable.length === 0) {
    setPdfOpenError(kind === "cad" ? "JWW/JWC/DXFファイルを選んでください" : "PDFファイル名が不正です");
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
  if (!isProjectCadRelPath(imported[0])) {
    await openProjectPdf(imported[0]);
  }
}

export async function importCadBytesIntoOpenProject(
  name: string,
  bytes: Uint8Array,
  _kind: ProjectPdfKind,
): Promise<string> {
  const folder = projectStore.folder;
  if (!folder) {
    throw new Error("プロジェクトが開かれていません");
  }
  if (!isCadDrawingBasename(name)) {
    throw new Error("PDFファイル名が不正です");
  }
  const cadRel = `${PROJECT_PDF_DIRS.cad}/${name}`;
  const cadDest = `${folder}/${cadRel}`;
  if (await pathExists(cadDest)) {
    throw new Error("同じ名前のファイルが既にあります");
  }
  await writeBinaryFile(cadDest, bytes);
  return cadRel;
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
  if (isCadDrawingBasename(file.name)) {
    const sourceBytes =
      file.bytes.length > 0 ? file.bytes : file.path ? await readBinaryFile(file.path) : file.bytes;
    return [await importCadBytesIntoOpenProject(file.name, sourceBytes, kind)];
  }
  const relPath = joinProjectPdfRelPath(kind, file.name);
  if (file.path) {
    await moveFileIntoFolder(file.path, projectPdfKindDir(projectStore.folder!, kind));
  } else {
    const destPath = `${projectStore.folder}/${relPath}`;
    if (await pathExists(destPath)) {
      throw new Error("同じ名前のPDFが既にあります");
    }
    await writeBinaryFile(destPath, file.bytes);
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
  const sandbox =
    usesSandboxProjects() && !supportsBrowserFolders() ? await listSandboxProjects() : [];
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
  if (supportsBrowserFolders()) {
    await installBundleIntoBrowserFolder(meta, files);
    return;
  }
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


async function installBundleIntoBrowserFolder(
  meta: ProjectMeta,
  files: Record<string, Uint8Array>,
): Promise<void> {
  const parent = await pickFolder();
  if (!parent) {
    return;
  }
  const root = parent.replace(/[/\\]+$/, "");
  const base = meta.name.replace(/[/\\:*?"<>|]/g, "_").trim() || "無題プロジェクト";
  // Never overwrite in the browser: pick the first free sibling name instead.
  let name = base;
  for (let n = 2; await pathExists(`${root}/${name}`); n += 1) {
    name = `${base} (${n})`;
  }
  const folder = `${root}/${name}`;
  await initProjectDir(folder);
  for (const [rel, data] of Object.entries(files)) {
    await writeBinaryFile(`${folder}/${rel}`, data);
  }
  await openProject(folder);
}

export function openProjectPdf(...args: Parameters<typeof openProjectPdfUnguarded>): ReturnType<typeof openProjectPdfUnguarded> {
  return withAutoSaveSuspended(() => openProjectPdfUnguarded(...args));
}

export function renameProjectFile(...args: Parameters<typeof renameProjectFileUnguarded>): ReturnType<typeof renameProjectFileUnguarded> {
  return withAutoSaveSuspended(() => renameProjectFileUnguarded(...args));
}

export function removeProjectPdf(...args: Parameters<typeof removeProjectPdfUnguarded>): ReturnType<typeof removeProjectPdfUnguarded> {
  return withAutoSaveSuspended(() => removeProjectPdfUnguarded(...args));
}

export function switchProjectTab(...args: Parameters<typeof switchProjectTabUnguarded>): ReturnType<typeof switchProjectTabUnguarded> {
  return withAutoSaveSuspended(() => switchProjectTabUnguarded(...args));
}

export function closeProjectTab(...args: Parameters<typeof closeProjectTabUnguarded>): ReturnType<typeof closeProjectTabUnguarded> {
  return withAutoSaveSuspended(() => closeProjectTabUnguarded(...args));
}

export function showProjectHome(...args: Parameters<typeof showProjectHomeUnguarded>): ReturnType<typeof showProjectHomeUnguarded> {
  return withAutoSaveSuspended(() => showProjectHomeUnguarded(...args));
}

export function closeProject(...args: Parameters<typeof closeProjectUnguarded>): ReturnType<typeof closeProjectUnguarded> {
  return withAutoSaveSuspended(() => closeProjectUnguarded(...args));
}

export function openProject(...args: Parameters<typeof openProjectUnguarded>): ReturnType<typeof openProjectUnguarded> {
  return withAutoSaveSuspended(() => openProjectUnguarded(...args));
}

export function createProject(...args: Parameters<typeof createProjectUnguarded>): ReturnType<typeof createProjectUnguarded> {
  return withAutoSaveSuspended(() => createProjectUnguarded(...args));
}

export function startWebDemo(...args: Parameters<typeof startWebDemoUnguarded>): ReturnType<typeof startWebDemoUnguarded> {
  return withAutoSaveSuspended(() => startWebDemoUnguarded(...args));
}

export function bootstrapOpenSession(...args: Parameters<typeof bootstrapOpenSessionUnguarded>): ReturnType<typeof bootstrapOpenSessionUnguarded> {
  return withAutoSaveSuspended(() => bootstrapOpenSessionUnguarded(...args));
}

export function openProjectTab(...args: Parameters<typeof openProjectTabUnguarded>): ReturnType<typeof openProjectTabUnguarded> {
  return withAutoSaveSuspended(() => openProjectTabUnguarded(...args));
}
