import { zipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { annotationStore } from "$lib/stores/annotationStore.svelte";
import { pdfStore } from "$lib/stores/pdfStore.svelte";
import { projectStore } from "$lib/stores/projectStore.svelte";
import { viewerApi } from "$lib/stores/viewerApi";
import type { ProjectMeta, RecentProject } from "./projectFormat";

const {
  mockOpenPdfsFromDisk,
  mockIsTauriRuntime,
  mockUsesSandboxProjects,
  mockPickFolder,
  mockInitProjectDir,
  mockListProjectPdfs,
  mockMoveFileIntoFolder,
  mockLoadRecentProjects,
  mockSaveRecentProjects,
  mockLoadOpenSession,
  mockSaveOpenSession,
  mockPathExists,
  mockReadAnnotationFile,
  mockReadBinaryFile,
  mockReadProjectMeta,
  mockWriteAnnotationFile,
  mockWriteBinaryFile,
  mockWriteProjectMeta,
  mockDeleteFile,
  mockOpenUrl,
  mockSendCurrentPdf,
  mockImportOneDrive,
  mockSandboxProjectsDir,
  mockListProjectFiles,
  mockRemoveDirAll,
  mockListSandboxProjects,
  mockShareFileBytes,
  mockConvertCadBytesToPdf,
  mockOpenCadFileInJwCad,
  mockRenameFile,
} = vi.hoisted(() => ({
  mockOpenPdfsFromDisk: vi.fn(),
  mockIsTauriRuntime: vi.fn(() => true),
  mockUsesSandboxProjects: vi.fn(() => false),
  mockPickFolder: vi.fn(),
  mockInitProjectDir: vi.fn(),
  mockListProjectPdfs: vi.fn(),
  mockMoveFileIntoFolder: vi.fn(),
  mockLoadRecentProjects: vi.fn(),
  mockSaveRecentProjects: vi.fn(),
  mockLoadOpenSession: vi.fn(),
  mockSaveOpenSession: vi.fn(),
  mockPathExists: vi.fn(),
  mockReadAnnotationFile: vi.fn(),
  mockReadBinaryFile: vi.fn(),
  mockReadProjectMeta: vi.fn(),
  mockWriteAnnotationFile: vi.fn(),
  mockWriteBinaryFile: vi.fn(),
  mockWriteProjectMeta: vi.fn(),
  mockDeleteFile: vi.fn(),
  mockRenameFile: vi.fn(),
  mockOpenUrl: vi.fn(),
  mockSendCurrentPdf: vi.fn(),
  mockImportOneDrive: vi.fn(),
  mockSandboxProjectsDir: vi.fn(),
  mockListProjectFiles: vi.fn(),
  mockRemoveDirAll: vi.fn(),
  mockListSandboxProjects: vi.fn(),
  mockShareFileBytes: vi.fn(),
  mockConvertCadBytesToPdf: vi.fn(),
  mockOpenCadFileInJwCad: vi.fn(),
}));

vi.mock("./fileAccess", () => ({
  openPdfsFromDisk: mockOpenPdfsFromDisk,
}));

vi.mock("./cadImport", async () => {
  const actual = await vi.importActual<typeof import("./cadImport")>("./cadImport");
  return {
    ...actual,
    convertCadBytesToPdf: mockConvertCadBytesToPdf,
    openCadFileInJwCad: mockOpenCadFileInJwCad,
  };
});

vi.mock("./platform", () => ({
  isTauriRuntime: mockIsTauriRuntime,
  usesSandboxProjects: () => mockUsesSandboxProjects(),
}));

vi.mock("./projectIo", () => ({
  annotationPath: (folder: string, pdfName: string) =>
    `${folder}/.blueprint-sync/annotations/${pdfName}.json`,
  legacyAnnotationPath: (folder: string, pdfName: string) =>
    `${folder}/.blueprint-sync/annotations/legacy-${pdfName}.json`,
  projectJsonPath: (folder: string) => `${folder}/.blueprint-sync/project.json`,
  copyFileIntoFolder: vi.fn(),
  moveFileIntoFolder: mockMoveFileIntoFolder,
  initProjectDir: mockInitProjectDir,
  listProjectPdfs: mockListProjectPdfs,
  loadRecentProjects: mockLoadRecentProjects,
  loadOpenSession: mockLoadOpenSession,
  pathExists: mockPathExists,
  pickFolder: mockPickFolder,
  httpGet: vi.fn(),
  writeBinaryFile: mockWriteBinaryFile,
  deleteFile: mockDeleteFile,
  renameFile: mockRenameFile,
  readAnnotationFile: mockReadAnnotationFile,
  readBinaryFile: mockReadBinaryFile,
  readProjectMeta: mockReadProjectMeta,
  saveRecentProjects: mockSaveRecentProjects,
  saveOpenSession: mockSaveOpenSession,
  writeAnnotationFile: mockWriteAnnotationFile,
  writeProjectMeta: mockWriteProjectMeta,
  sandboxProjectsDir: mockSandboxProjectsDir,
  listProjectFiles: mockListProjectFiles,
  removeDirAll: mockRemoveDirAll,
  listSandboxProjects: mockListSandboxProjects,
}));

vi.mock("./shareFile", () => ({
  shareFileBytes: mockShareFileBytes,
}));

vi.mock("./oneDriveImport", () => ({
  importOneDrivePdfsIntoFolder: mockImportOneDrive,
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: mockOpenUrl,
}));

vi.mock("./todoActions", () => ({
  loadProjectTodos: vi.fn(async () => {}),
  resetTodoState: vi.fn(),
}));

vi.mock("./noteActions", () => ({
  loadProjectNotes: vi.fn(async () => {}),
  resetNoteState: vi.fn(),
}));

vi.mock("./connectionActions", () => ({
  sendCurrentPdf: mockSendCurrentPdf,
}));

import {
  addProjectLink,
  closeProject,
  createProject,
  importPdfIntoProject,
  importOneDriveLinkIntoProject,
  loadRecentsIntoStore,
  bootstrapOpenSession,
  openProjectLink,
  openProject,
  openProjectPdf,
  openProjectTab,
  showProjectHome,
  persistCurrentAnnotations,
  switchProjectTab,
  refreshProjectPdfs,
  removeProjectLink,
  updateProjectLink,
  removeProjectPdf,
  renameProjectFile,
  importIncomingFile,
  shareCurrentProject,
  convertCadFileToDrawingPdf,
  setProjectWorkflowStatus,
} from "./projectActions";

function sampleMeta(overrides: Partial<ProjectMeta> = {}): ProjectMeta {
  return {
    id: "project-1",
    name: "現場A",
    createdAt: "2026-08-30T08:00:00.000Z",
    status: "open",
    links: [],
    ...overrides,
  };
}

function sampleRecent(path: string, name = "現場A"): RecentProject {
  return { path, name };
}

describe("projectActions", () => {
  beforeEach(() => {
    const uuidFn = crypto.randomUUID as typeof crypto.randomUUID & { mockRestore?: () => void };
    uuidFn.mockRestore?.();
    projectStore.reset();
    projectStore.bootstrapped = false;
    projectStore.recents = [];
    annotationStore.clear();
    pdfStore.clear();
    vi.clearAllMocks();
    mockIsTauriRuntime.mockReturnValue(true);
    mockUsesSandboxProjects.mockReturnValue(false);
    mockListProjectPdfs.mockResolvedValue([]);
    mockShareFileBytes.mockResolvedValue(undefined);
    mockListSandboxProjects.mockResolvedValue([]);
    mockSandboxProjectsDir.mockResolvedValue("/data/projects");
    mockRemoveDirAll.mockResolvedValue(undefined);
    mockListProjectFiles.mockResolvedValue([]);
    mockReadAnnotationFile.mockResolvedValue({ byPage: {}, photoPins: {} });
    mockReadBinaryFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockWriteAnnotationFile.mockResolvedValue(undefined);
    mockWriteProjectMeta.mockResolvedValue(undefined);
    mockLoadOpenSession.mockResolvedValue({ folders: [], activeFolder: null });
    mockSaveOpenSession.mockResolvedValue(undefined);
    mockLoadRecentProjects.mockResolvedValue([]);
    vi.spyOn(pdfStore, "load").mockResolvedValue();
    vi.spyOn(pdfStore, "clear");
    vi.spyOn(annotationStore, "clear");
    viewerApi.discardOverlays = () => undefined;
  });

  it("reset clears open tabs", () => {
    projectStore.tabs = [{ id: "t", folder: "/a", name: "a", session: null }];
    projectStore.activeTabId = "t";
    projectStore.reset();
    expect(projectStore.tabs).toEqual([]);
    expect(projectStore.activeTabId).toBeNull();
  });

  it("loads recents and removes entries whose path no longer exists", async () => {
    mockLoadRecentProjects.mockResolvedValue([
      sampleRecent("/keep", "keep"),
      sampleRecent("/drop", "drop"),
    ]);
    mockPathExists.mockImplementation(async (path: string) => path === "/keep");

    await loadRecentsIntoStore();

    expect(projectStore.recents).toEqual([{ ...sampleRecent("/keep", "keep"), status: "open" }]);
    expect(mockSaveRecentProjects).toHaveBeenCalledWith([sampleRecent("/keep", "keep")]);
  });

  it("loads recents, caps them at 8, and persists the trimmed list", async () => {
    const items = Array.from({ length: 10 }, (_, index) =>
      sampleRecent(`/projects/${index}`, `project-${index}`),
    );
    mockLoadRecentProjects.mockResolvedValue(items);
    mockPathExists.mockResolvedValue(true);

    await loadRecentsIntoStore();

    expect(projectStore.recents).toEqual(
      items.slice(0, 8).map((item) => ({ ...item, status: "open" })),
    );
    expect(mockSaveRecentProjects).toHaveBeenCalledWith(items.slice(0, 8));
  });

  it("hydrates recents with workflow status from project.json", async () => {
    mockLoadRecentProjects.mockResolvedValue([sampleRecent("/keep", "keep")]);
    mockPathExists.mockResolvedValue(true);
    mockReadProjectMeta.mockResolvedValue(sampleMeta({ name: "keep", status: "in_progress" }));

    await loadRecentsIntoStore();

    expect(projectStore.recents).toEqual([
      { name: "keep", path: "/keep", status: "in_progress" },
    ]);
  });

  it("defaults recents to 未着手 when project.json cannot be read", async () => {
    mockLoadRecentProjects.mockResolvedValue([sampleRecent("/keep", "keep")]);
    mockPathExists.mockResolvedValue(true);
    mockReadProjectMeta.mockRejectedValue(new Error("Invalid project.json"));

    await loadRecentsIntoStore();

    expect(projectStore.recents).toEqual([{ name: "keep", path: "/keep", status: "open" }]);
  });

  it("writes workflow status without opening the project", async () => {
    const meta = sampleMeta();
    projectStore.recents = [{ name: "現場A", path: "/projects/a", status: "open" }];
    projectStore.sandboxProjects = [{ id: "project-1", name: "現場A", path: "/projects/a", status: "open" }];
    mockReadProjectMeta.mockResolvedValue(meta);

    await setProjectWorkflowStatus("/projects/a", "closed");

    expect(mockWriteProjectMeta).toHaveBeenCalledWith("/projects/a", { ...meta, status: "closed" });
    expect(projectStore.recents).toEqual([
      { name: "現場A", path: "/projects/a", status: "closed" },
    ]);
    expect(projectStore.sandboxProjects).toEqual([
      { id: "project-1", name: "現場A", path: "/projects/a", status: "closed" },
    ]);
    expect(projectStore.folder).toBe("");
    expect(projectStore.meta).toBeNull();
  });

  it("keeps the open project's meta in sync when its workflow status changes", async () => {
    const meta = sampleMeta();
    projectStore.folder = "/projects/a";
    projectStore.meta = meta;
    projectStore.recents = [{ name: "現場A", path: "/projects/a", status: "open" }];
    mockReadProjectMeta.mockResolvedValue(meta);

    await setProjectWorkflowStatus("/projects/a", "reviewing");

    expect(projectStore.meta).toEqual({ ...meta, status: "reviewing" });
    expect(projectStore.folder).toBe("/projects/a");
  });

  it("creates a project and remembers it", async () => {
    mockPickFolder.mockResolvedValue("/projects/a");
    mockListProjectPdfs.mockResolvedValue(["A.pdf"]);

    await createProject();

    expect(mockInitProjectDir).toHaveBeenCalledWith("/projects/a");
    expect(projectStore.folder).toBe("/projects/a");
    expect(projectStore.meta?.name).toBe("a");
    expect(projectStore.pdfs).toEqual(["A.pdf"]);
    expect(projectStore.currentPdf).toBe("A.pdf");
    expect(pdfStore.load).toHaveBeenCalledWith("A.pdf", new Uint8Array([1, 2, 3]));
    expect(mockSaveRecentProjects).toHaveBeenCalledWith([
      expect.objectContaining({ name: "a", path: "/projects/a" }),
    ]);
  });

  it("opens a valid project and clears active document state", async () => {
    const meta = sampleMeta();
    projectStore.recents = [sampleRecent("/projects/a")];
    mockReadProjectMeta.mockResolvedValue(meta);
    mockListProjectPdfs.mockResolvedValue(["A.pdf", "B.pdf"]);

    await openProject("/projects/a");

    expect(projectStore.folder).toBe("/projects/a");
    expect(projectStore.meta).toEqual(meta);
    expect(projectStore.pdfs).toEqual(["A.pdf", "B.pdf"]);
    expect(projectStore.currentPdf).toBe("A.pdf");
    expect(pdfStore.load).toHaveBeenCalledWith("A.pdf", new Uint8Array([1, 2, 3]));
    expect(mockInitProjectDir).toHaveBeenCalledWith("/projects/a");
    expect(pdfStore.clear).toHaveBeenCalled();
    expect(annotationStore.clear).toHaveBeenCalled();
    expect(mockSaveRecentProjects).toHaveBeenCalledWith([
      { id: "project-1", name: "現場A", path: "/projects/a", status: "open" },
    ]);
  });

  it("resets state, drops recent, and surfaces a friendly error for invalid projects", async () => {
    projectStore.recents = [sampleRecent("/broken", "broken")];
    projectStore.folder = "/stale";
    projectStore.error = "old";
    mockReadProjectMeta.mockRejectedValue(new Error("Invalid project.json"));

    await expect(openProject("/broken")).rejects.toThrow(
      "project.json が見つからないか、内容が不正です",
    );

    expect(projectStore.folder).toBe("");
    expect(projectStore.meta).toBeNull();
    expect(projectStore.pdfs).toEqual([]);
    expect(projectStore.error).toBe("project.json が見つからないか、内容が不正です");
    expect(projectStore.recents).toEqual([]);
    expect(mockSaveRecentProjects).toHaveBeenCalledWith([]);
  });

  it("persists current annotations and records failures on pdfStore.status", async () => {
    projectStore.folder = "/projects/a";
    projectStore.currentPdf = "A.pdf";
    annotationStore.importByPage({ 0: { a: { id: "a", type: "path" } } });
    mockWriteAnnotationFile.mockRejectedValue(new Error("write failed"));

    const persisted = await persistCurrentAnnotations();

    expect(persisted).toBe(false);
    expect(mockWriteAnnotationFile).toHaveBeenCalledWith(
      "/projects/a",
      "A.pdf",
      {
        0: { a: { id: "a", type: "path" } },
      },
      {},
      { memoPins: {} },
    );
    expect(pdfStore.status).toBe("write failed");
  });

  it("returns true when annotations are persisted successfully", async () => {
    projectStore.folder = "/projects/a";
    projectStore.currentPdf = "A.pdf";
    annotationStore.importByPage({ 0: { a: { id: "a", type: "path" } } });
    annotationStore.dirty = true;
    mockWriteAnnotationFile.mockResolvedValue(undefined);

    const persisted = await persistCurrentAnnotations();

    expect(persisted).toBe(true);
    expect(annotationStore.dirty).toBe(false);
    expect(mockWriteAnnotationFile).toHaveBeenCalledWith(
      "/projects/a",
      "A.pdf",
      {
        0: { a: { id: "a", type: "path" } },
      },
      {},
      { memoPins: {} },
    );
  });

  it("returns true when there is nothing to persist", async () => {
    projectStore.folder = "";
    projectStore.currentPdf = "";

    const persisted = await persistCurrentAnnotations();

    expect(persisted).toBe(true);
    expect(mockWriteAnnotationFile).not.toHaveBeenCalled();
  });

  it("opens a project pdf after persisting current annotations", async () => {
    projectStore.folder = "/projects/a";
    projectStore.currentPdf = "Before.pdf";
    annotationStore.importByPage({ 2: { prev: { id: "prev", type: "path" } } });
    mockReadAnnotationFile.mockResolvedValue({
      byPage: { 1: { next: { id: "next", type: "path" } } },
      photoPins: {},
    });

    await openProjectPdf("After.pdf");

    expect(mockWriteAnnotationFile).toHaveBeenCalledWith(
      "/projects/a",
      "Before.pdf",
      {
        2: { prev: { id: "prev", type: "path" } },
      },
      {},
      { memoPins: {} },
    );
    expect(mockReadBinaryFile).toHaveBeenCalledWith("/projects/a/After.pdf");
    expect(pdfStore.load).toHaveBeenCalledWith("After.pdf", new Uint8Array([1, 2, 3]));
    expect(projectStore.currentPdf).toBe("After.pdf");
    expect(annotationStore.exportByPage()).toEqual({
      1: { next: { id: "next", type: "path" } },
    });
    expect(mockSendCurrentPdf).toHaveBeenCalledTimes(1);
  });

  it("opens a schedule pdf from the 工程表 subfolder", async () => {
    projectStore.folder = "/projects/a";
    mockReadAnnotationFile.mockResolvedValue({ byPage: {}, photoPins: {} });

    await openProjectPdf("工程表/週間工程.pdf");

    expect(mockReadBinaryFile).toHaveBeenCalledWith("/projects/a/工程表/週間工程.pdf");
    expect(pdfStore.load).toHaveBeenCalledWith("工程表/週間工程.pdf", new Uint8Array([1, 2, 3]));
    expect(projectStore.currentPdf).toBe("工程表/週間工程.pdf");
  });

  it("keeps the current drawing when annotation persistence fails before switching pdfs", async () => {
    projectStore.folder = "/projects/a";
    projectStore.currentPdf = "Before.pdf";
    annotationStore.importByPage({ 2: { prev: { id: "prev", type: "path" } } });
    mockWriteAnnotationFile.mockRejectedValue(new Error("write failed"));

    await openProjectPdf("After.pdf");

    expect(mockReadBinaryFile).not.toHaveBeenCalled();
    expect(mockReadAnnotationFile).not.toHaveBeenCalled();
    expect(pdfStore.load).not.toHaveBeenCalled();
    expect(projectStore.currentPdf).toBe("Before.pdf");
    expect(annotationStore.exportByPage()).toEqual({
      2: { prev: { id: "prev", type: "path" } },
    });
    expect(pdfStore.status).toBe("write failed");
    expect(mockSendCurrentPdf).not.toHaveBeenCalled();
  });

  it("still opens the next drawing when its annotation file cannot be read", async () => {
    projectStore.folder = "/projects/a";
    projectStore.currentPdf = "Before.pdf";
    annotationStore.importByPage({ 2: { prev: { id: "prev", type: "path" } } });
    mockReadAnnotationFile.mockRejectedValue(new Error("broken annotation"));

    await openProjectPdf("図面/After.pdf");

    expect(mockReadBinaryFile).toHaveBeenCalledWith("/projects/a/図面/After.pdf");
    expect(pdfStore.load).toHaveBeenCalledWith("図面/After.pdf", new Uint8Array([1, 2, 3]));
    expect(projectStore.currentPdf).toBe("図面/After.pdf");
    expect(annotationStore.exportByPage()).toEqual({});
    expect(pdfStore.status).toBe("注釈を読み込めなかったため、空の注釈で開きました");
    expect(mockSendCurrentPdf).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid pdf names before importing into a project", async () => {
    projectStore.folder = "/projects/a";
    mockOpenPdfsFromDisk.mockResolvedValue([
      {
        name: ".hidden.pdf",
        path: "/downloads/.hidden.pdf",
        bytes: new Uint8Array([9]),
      },
    ]);

    await importPdfIntoProject();

    expect(projectStore.error).toBe("PDFファイル名が不正です");
    expect(pdfStore.status).toBe("PDFファイル名が不正です");
    expect(mockWriteAnnotationFile).not.toHaveBeenCalled();
    expect(mockMoveFileIntoFolder).not.toHaveBeenCalled();
    expect(mockListProjectPdfs).not.toHaveBeenCalled();
    expect(pdfStore.load).not.toHaveBeenCalled();
  });

  it("aborts project import when annotation persistence fails", async () => {
    projectStore.folder = "/projects/a";
    projectStore.currentPdf = "Before.pdf";
    annotationStore.importByPage({ 2: { prev: { id: "prev", type: "path" } } });
    mockOpenPdfsFromDisk.mockResolvedValue([
      {
        name: "After.pdf",
        path: "/downloads/After.pdf",
        bytes: new Uint8Array([9]),
      },
    ]);
    mockWriteAnnotationFile.mockRejectedValue(new Error("write failed"));

    await importPdfIntoProject();

    expect(mockMoveFileIntoFolder).not.toHaveBeenCalled();
    expect(mockListProjectPdfs).not.toHaveBeenCalled();
    expect(mockReadBinaryFile).not.toHaveBeenCalled();
    expect(pdfStore.load).not.toHaveBeenCalled();
    expect(projectStore.currentPdf).toBe("Before.pdf");
    expect(annotationStore.exportByPage()).toEqual({
      2: { prev: { id: "prev", type: "path" } },
    });
  });

  it("surfaces duplicate-name import errors instead of swallowing them", async () => {
    projectStore.folder = "/projects/a";
    mockOpenPdfsFromDisk.mockResolvedValue([
      {
        name: "A.pdf",
        path: "/downloads/A.pdf",
        bytes: new Uint8Array([9]),
      },
    ]);
    mockMoveFileIntoFolder.mockRejectedValue(new Error("同じ名前のPDFが既にあります"));

    await expect(importPdfIntoProject()).rejects.toThrow("同じ名前のPDFが既にあります");

    expect(projectStore.error).toBe("同じ名前のPDFが既にあります");
    expect(pdfStore.status).toBe("同じ名前のPDFが既にあります");
  });

  it("moves a picked drawing pdf into 図面 and opens it", async () => {
    projectStore.folder = "/projects/a";
    mockOpenPdfsFromDisk.mockResolvedValue([
      {
        name: "A.pdf",
        path: "/downloads/A.pdf",
        bytes: new Uint8Array([9]),
      },
    ]);
    mockMoveFileIntoFolder.mockResolvedValue("/projects/a/図面/A.pdf");
    mockListProjectPdfs.mockResolvedValue(["図面/A.pdf"]);

    await importPdfIntoProject();

    expect(mockMoveFileIntoFolder).toHaveBeenCalledWith("/downloads/A.pdf", "/projects/a/図面");
    expect(mockReadBinaryFile).toHaveBeenCalledWith("/projects/a/図面/A.pdf");
    expect(pdfStore.load).toHaveBeenCalledWith("図面/A.pdf", new Uint8Array([1, 2, 3]));
    expect(projectStore.currentPdf).toBe("図面/A.pdf");
  });

  it("copies a picked jww into 図面JWW without converting it to pdf", async () => {
    projectStore.folder = "/projects/a";
    mockOpenPdfsFromDisk.mockResolvedValue([
      {
        name: "1F.jww",
        path: "/downloads/1F.jww",
        bytes: new Uint8Array(),
      },
    ]);
    mockReadBinaryFile.mockResolvedValue(Uint8Array.from([10, 11, 12]));
    mockPathExists.mockResolvedValue(false);
    mockListProjectPdfs.mockResolvedValue(["図面JWW/1F.jww"]);

    await importPdfIntoProject();

    expect(mockReadBinaryFile).toHaveBeenCalledWith("/downloads/1F.jww");
    expect(mockWriteBinaryFile).toHaveBeenCalledWith(
      "/projects/a/図面JWW/1F.jww",
      Uint8Array.from([10, 11, 12]),
    );
    expect(mockConvertCadBytesToPdf).not.toHaveBeenCalled();
    expect(mockWriteBinaryFile).not.toHaveBeenCalledWith(
      "/projects/a/図面/1F.pdf",
      expect.anything(),
    );
    expect(mockMoveFileIntoFolder).not.toHaveBeenCalled();
    expect(mockDeleteFile).not.toHaveBeenCalled();
    expect(pdfStore.load).not.toHaveBeenCalled();
    expect(projectStore.currentPdf).toBe("");
    expect(projectStore.pdfs).toEqual(["図面JWW/1F.jww"]);
  });

  it("copies a picked dxf into 図面JWW without converting it to pdf", async () => {
    projectStore.folder = "/projects/a";
    mockOpenPdfsFromDisk.mockResolvedValue([
      {
        name: "平面.dxf",
        path: "/downloads/平面.dxf",
        bytes: new Uint8Array(),
      },
    ]);
    mockReadBinaryFile.mockResolvedValue(Uint8Array.from([10, 11, 12]));
    mockPathExists.mockResolvedValue(false);
    mockListProjectPdfs.mockResolvedValue(["図面JWW/平面.dxf"]);

    await importPdfIntoProject("cad");

    expect(mockWriteBinaryFile).toHaveBeenCalledWith(
      "/projects/a/図面JWW/平面.dxf",
      Uint8Array.from([10, 11, 12]),
    );
    expect(mockConvertCadBytesToPdf).not.toHaveBeenCalled();
    expect(pdfStore.load).not.toHaveBeenCalled();
    expect(projectStore.pdfs).toEqual(["図面JWW/平面.dxf"]);
  });

  it("opens a dxf in Jw_cad without loading a converted pdf", async () => {
    projectStore.folder = "/projects/a";
    projectStore.currentPdf = "図面/A.pdf";
    mockOpenCadFileInJwCad.mockResolvedValue(undefined);

    await openProjectPdf("図面JWW/平面.dxf");

    expect(mockOpenCadFileInJwCad).toHaveBeenCalledWith("/projects/a/図面JWW/平面.dxf");
    expect(pdfStore.load).not.toHaveBeenCalled();
    expect(projectStore.currentPdf).toBe("図面/A.pdf");
  });

  it("adds a jww even when the converted drawing pdf already exists", async () => {
    projectStore.folder = "/projects/a";
    mockOpenPdfsFromDisk.mockResolvedValue([
      {
        name: "1F.jww",
        path: "/downloads/1F.jww",
        bytes: new Uint8Array(),
      },
    ]);
    mockReadBinaryFile.mockImplementation(async (path: string) => {
      if (path === "/downloads/1F.jww") {
        return Uint8Array.from([10, 11, 12]);
      }
      return Uint8Array.from([1, 2, 3]);
    });
    mockPathExists.mockImplementation(async (path: string) => path === "/projects/a/図面/1F.pdf");
    mockListProjectPdfs.mockResolvedValue(["図面/1F.pdf", "図面JWW/1F.jww"]);

    await importPdfIntoProject();

    expect(mockWriteBinaryFile).toHaveBeenCalledWith(
      "/projects/a/図面JWW/1F.jww",
      Uint8Array.from([10, 11, 12]),
    );
    expect(mockWriteBinaryFile).not.toHaveBeenCalledWith(
      "/projects/a/図面/1F.pdf",
      expect.anything(),
    );
    expect(mockConvertCadBytesToPdf).not.toHaveBeenCalled();
    expect(pdfStore.load).not.toHaveBeenCalled();
    expect(projectStore.currentPdf).toBe("");
  });

  it("rejects a jww when the same jww is already in the project", async () => {
    projectStore.folder = "/projects/a";
    mockOpenPdfsFromDisk.mockResolvedValue([
      {
        name: "1F.jww",
        path: "/downloads/1F.jww",
        bytes: new Uint8Array(),
      },
    ]);
    mockReadBinaryFile.mockResolvedValue(Uint8Array.from([10, 11, 12]));
    mockPathExists.mockImplementation(async (path: string) => path === "/projects/a/図面JWW/1F.jww");

    await expect(importPdfIntoProject()).rejects.toThrow("同じ名前のファイルが既にあります");

    expect(mockWriteBinaryFile).not.toHaveBeenCalled();
    expect(mockConvertCadBytesToPdf).not.toHaveBeenCalled();
  });

  it("opens a jww in Jw_cad without loading a converted pdf", async () => {
    projectStore.folder = "/projects/a";
    projectStore.currentPdf = "図面/A.pdf";
    mockOpenCadFileInJwCad.mockResolvedValue(undefined);

    await openProjectPdf("図面JWW/1F.jww");

    expect(mockOpenCadFileInJwCad).toHaveBeenCalledWith("/projects/a/図面JWW/1F.jww");
    expect(mockConvertCadBytesToPdf).not.toHaveBeenCalled();
    expect(pdfStore.load).not.toHaveBeenCalled();
    expect(projectStore.currentPdf).toBe("図面/A.pdf");
    expect(pdfStore.status).toBe("");
  });

  it("surfaces Jw_cad launch errors on the status bar", async () => {
    projectStore.folder = "/projects/a";
    mockOpenCadFileInJwCad.mockRejectedValue(new Error("Jw_cad が見つかりません"));

    await openProjectPdf("図面JWW/1F.jww");

    expect(pdfStore.load).not.toHaveBeenCalled();
    expect(pdfStore.status).toBe("Jw_cad が見つかりません");
    expect(projectStore.error).toBe("Jw_cad が見つかりません");
  });

  it("converts a jww into 図面 without opening the new pdf", async () => {
    projectStore.folder = "/projects/a";
    projectStore.currentPdf = "図面/A.pdf";
    mockPathExists.mockResolvedValue(false);
    mockReadBinaryFile.mockResolvedValue(Uint8Array.from([10, 11, 12]));
    mockConvertCadBytesToPdf.mockResolvedValue({
      pdfName: "1F.pdf",
      bytes: Uint8Array.from([0x25, 0x50, 0x44, 0x46]),
    });
    mockListProjectPdfs.mockResolvedValue(["図面/A.pdf", "図面/1F.pdf", "図面JWW/1F.jww"]);

    await convertCadFileToDrawingPdf("図面JWW/1F.jww");

    expect(mockReadBinaryFile).toHaveBeenCalledWith("/projects/a/図面JWW/1F.jww");
    expect(mockConvertCadBytesToPdf).toHaveBeenCalledWith("1F.jww", Uint8Array.from([10, 11, 12]));
    expect(mockWriteBinaryFile).toHaveBeenCalledWith(
      "/projects/a/図面/1F.pdf",
      Uint8Array.from([0x25, 0x50, 0x44, 0x46]),
    );
    expect(pdfStore.load).not.toHaveBeenCalled();
    expect(projectStore.currentPdf).toBe("図面/A.pdf");
    expect(projectStore.pdfs).toEqual(["図面/A.pdf", "図面/1F.pdf", "図面JWW/1F.jww"]);
  });

  it("does not overwrite an existing drawing pdf when converting a jww", async () => {
    projectStore.folder = "/projects/a";
    mockPathExists.mockImplementation(async (path: string) => path === "/projects/a/図面/1F.pdf");

    await expect(convertCadFileToDrawingPdf("図面JWW/1F.jww")).rejects.toThrow(
      "同じ名前のPDFが既にあります",
    );
    expect(mockConvertCadBytesToPdf).not.toHaveBeenCalled();
    expect(mockWriteBinaryFile).not.toHaveBeenCalled();
  });

  it("moves a picked schedule pdf into 工程表 and opens it", async () => {
    projectStore.folder = "/projects/a";
    mockOpenPdfsFromDisk.mockResolvedValue([
      {
        name: "週間工程.pdf",
        path: "/downloads/週間工程.pdf",
        bytes: new Uint8Array([9]),
      },
    ]);
    mockMoveFileIntoFolder.mockResolvedValue("/projects/a/工程表/週間工程.pdf");
    mockListProjectPdfs.mockResolvedValue(["工程表/週間工程.pdf"]);

    await importPdfIntoProject("schedule");

    expect(mockMoveFileIntoFolder).toHaveBeenCalledWith(
      "/downloads/週間工程.pdf",
      "/projects/a/工程表",
    );
    expect(mockReadBinaryFile).toHaveBeenCalledWith("/projects/a/工程表/週間工程.pdf");
    expect(pdfStore.load).toHaveBeenCalledWith("工程表/週間工程.pdf", new Uint8Array([1, 2, 3]));
    expect(projectStore.currentPdf).toBe("工程表/週間工程.pdf");
  });

  it("extracts pdfs from a picked zip into 図面, opens the first, then deletes the zip", async () => {
    const pdfA = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    const pdfB = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x32]);
    projectStore.folder = "/projects/a";
    mockOpenPdfsFromDisk.mockResolvedValue([
      {
        name: "plans.zip",
        path: "/downloads/plans.zip",
        bytes: zipSync({ "1F.pdf": pdfA, "nested/2F.pdf": pdfB }),
      },
    ]);
    mockPathExists.mockResolvedValue(false);
    mockWriteBinaryFile.mockResolvedValue(undefined);
    mockDeleteFile.mockResolvedValue(undefined);
    mockListProjectPdfs.mockResolvedValue(["図面/1F.pdf", "図面/2F.pdf"]);

    await importPdfIntoProject();

    expect(mockMoveFileIntoFolder).not.toHaveBeenCalled();
    expect(mockWriteBinaryFile).toHaveBeenCalledWith("/projects/a/図面/1F.pdf", pdfA);
    expect(mockWriteBinaryFile).toHaveBeenCalledWith("/projects/a/図面/2F.pdf", pdfB);
    expect(mockDeleteFile).toHaveBeenCalledWith("/downloads/plans.zip");
    expect(pdfStore.load).toHaveBeenCalledWith("図面/1F.pdf", new Uint8Array([1, 2, 3]));
    expect(projectStore.currentPdf).toBe("図面/1F.pdf");
  });

  it("extracts zip pdfs into 工程表 when adding a schedule", async () => {
    const pdfA = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    projectStore.folder = "/projects/a";
    mockOpenPdfsFromDisk.mockResolvedValue([
      {
        name: "schedules.zip",
        path: "/downloads/schedules.zip",
        bytes: zipSync({ "週間工程.pdf": pdfA }),
      },
    ]);
    mockPathExists.mockResolvedValue(false);
    mockWriteBinaryFile.mockResolvedValue(undefined);
    mockDeleteFile.mockResolvedValue(undefined);
    mockListProjectPdfs.mockResolvedValue(["工程表/週間工程.pdf"]);

    await importPdfIntoProject("schedule");

    expect(mockWriteBinaryFile).toHaveBeenCalledWith("/projects/a/工程表/週間工程.pdf", pdfA);
    expect(mockDeleteFile).toHaveBeenCalledWith("/downloads/schedules.zip");
    expect(projectStore.currentPdf).toBe("工程表/週間工程.pdf");
  });

  it("keeps the original zip when it contains no pdfs", async () => {
    projectStore.folder = "/projects/a";
    mockOpenPdfsFromDisk.mockResolvedValue([
      {
        name: "empty.zip",
        path: "/downloads/empty.zip",
        bytes: zipSync({ "notes.txt": new Uint8Array([1, 2, 3]) }),
      },
    ]);

    await expect(importPdfIntoProject()).rejects.toThrow(/PDF/);

    expect(mockWriteBinaryFile).not.toHaveBeenCalled();
    expect(mockDeleteFile).not.toHaveBeenCalled();
    expect(mockMoveFileIntoFolder).not.toHaveBeenCalled();
    expect(pdfStore.load).not.toHaveBeenCalled();
  });

  it("moves every picked drawing pdf into 図面 and opens the first", async () => {
    projectStore.folder = "/projects/a";
    mockOpenPdfsFromDisk.mockResolvedValue([
      {
        name: "A.pdf",
        path: "/downloads/A.pdf",
        bytes: new Uint8Array([9]),
      },
      {
        name: "B.pdf",
        path: "/downloads/B.pdf",
        bytes: new Uint8Array([8]),
      },
    ]);
    mockMoveFileIntoFolder.mockImplementation(async (source: string) =>
      source.endsWith("A.pdf") ? "/projects/a/図面/A.pdf" : "/projects/a/図面/B.pdf",
    );
    mockListProjectPdfs.mockResolvedValue(["図面/A.pdf", "図面/B.pdf"]);

    await importPdfIntoProject();

    expect(mockMoveFileIntoFolder).toHaveBeenCalledWith("/downloads/A.pdf", "/projects/a/図面");
    expect(mockMoveFileIntoFolder).toHaveBeenCalledWith("/downloads/B.pdf", "/projects/a/図面");
    expect(pdfStore.load).toHaveBeenCalledWith("図面/A.pdf", new Uint8Array([1, 2, 3]));
    expect(projectStore.currentPdf).toBe("図面/A.pdf");
  });

  it("moves every picked schedule pdf into 工程表 and opens the first", async () => {
    projectStore.folder = "/projects/a";
    mockOpenPdfsFromDisk.mockResolvedValue([
      {
        name: "週間工程.pdf",
        path: "/downloads/週間工程.pdf",
        bytes: new Uint8Array([9]),
      },
      {
        name: "月間工程.pdf",
        path: "/downloads/月間工程.pdf",
        bytes: new Uint8Array([8]),
      },
    ]);
    mockMoveFileIntoFolder.mockImplementation(async (source: string) =>
      source.includes("週間") ? "/projects/a/工程表/週間工程.pdf" : "/projects/a/工程表/月間工程.pdf",
    );
    mockListProjectPdfs.mockResolvedValue(["工程表/週間工程.pdf", "工程表/月間工程.pdf"]);

    await importPdfIntoProject("schedule");

    expect(mockMoveFileIntoFolder).toHaveBeenCalledWith(
      "/downloads/週間工程.pdf",
      "/projects/a/工程表",
    );
    expect(mockMoveFileIntoFolder).toHaveBeenCalledWith(
      "/downloads/月間工程.pdf",
      "/projects/a/工程表",
    );
    expect(pdfStore.load).toHaveBeenCalledWith("工程表/週間工程.pdf", new Uint8Array([1, 2, 3]));
    expect(projectStore.currentPdf).toBe("工程表/週間工程.pdf");
  });

  it("keeps importing remaining pdfs when one picked name already exists", async () => {
    projectStore.folder = "/projects/a";
    mockOpenPdfsFromDisk.mockResolvedValue([
      {
        name: "A.pdf",
        path: "/downloads/A.pdf",
        bytes: new Uint8Array([9]),
      },
      {
        name: "B.pdf",
        path: "/downloads/B.pdf",
        bytes: new Uint8Array([8]),
      },
    ]);
    mockMoveFileIntoFolder
      .mockRejectedValueOnce(new Error("同じ名前のPDFが既にあります"))
      .mockResolvedValueOnce("/projects/a/図面/B.pdf");
    mockListProjectPdfs.mockResolvedValue(["図面/B.pdf"]);

    await importPdfIntoProject();

    expect(mockMoveFileIntoFolder).toHaveBeenCalledWith("/downloads/A.pdf", "/projects/a/図面");
    expect(mockMoveFileIntoFolder).toHaveBeenCalledWith("/downloads/B.pdf", "/projects/a/図面");
    expect(projectStore.currentPdf).toBe("図面/B.pdf");
  });

  it("adds and removes project links via project metadata persistence", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000001",
    );
    projectStore.folder = "/projects/a";
    projectStore.meta = sampleMeta();

    await addProjectLink("https://example.com/share", "共有");
    await removeProjectLink("00000000-0000-4000-8000-000000000001");

    expect(mockWriteProjectMeta).toHaveBeenNthCalledWith(
      1,
      "/projects/a",
      expect.objectContaining({
        links: [
          {
            id: "00000000-0000-4000-8000-000000000001",
            title: "共有",
            url: "https://example.com/share",
          },
        ],
      }),
    );
    expect(mockWriteProjectMeta).toHaveBeenNthCalledWith(
      2,
      "/projects/a",
      expect.objectContaining({ links: [] }),
    );
  });

  it("deletes a project pdf without switching the open drawing", async () => {
    projectStore.folder = "/projects/a";
    projectStore.currentPdf = "図面/A.pdf";
    mockDeleteFile.mockResolvedValue(undefined);
    mockListProjectPdfs.mockResolvedValue(["図面/A.pdf"]);

    await removeProjectPdf("図面/B.pdf");

    expect(mockDeleteFile).toHaveBeenCalledWith("/projects/a/図面/B.pdf");
    expect(mockDeleteFile).toHaveBeenCalledWith(
      "/projects/a/.blueprint-sync/annotations/図面/B.pdf.json",
    );
    expect(projectStore.currentPdf).toBe("図面/A.pdf");
    expect(projectStore.pdfs).toEqual(["図面/A.pdf"]);
    expect(pdfStore.load).not.toHaveBeenCalled();
  });

  it("opens the next remaining pdf when the current drawing is deleted", async () => {
    projectStore.folder = "/projects/a";
    projectStore.currentPdf = "図面/A.pdf";
    mockDeleteFile.mockResolvedValue(undefined);
    mockListProjectPdfs.mockResolvedValue(["図面JWW/1F.pdf"]);

    await removeProjectPdf("図面/A.pdf");

    expect(mockDeleteFile).toHaveBeenCalledWith("/projects/a/図面/A.pdf");
    expect(projectStore.currentPdf).toBe("図面JWW/1F.pdf");
    expect(pdfStore.load).toHaveBeenCalledWith("図面JWW/1F.pdf", new Uint8Array([1, 2, 3]));
  });

  it("renames a pdf and its annotation without reloading when it is the open drawing", async () => {
    projectStore.folder = "/projects/a";
    projectStore.currentPdf = "図面/1F.pdf";
    pdfStore.name = "図面/1F.pdf";
    mockPathExists.mockResolvedValue(false);
    mockRenameFile.mockResolvedValue(undefined);
    mockListProjectPdfs.mockResolvedValue(["図面/平面.pdf"]);
    mockWriteAnnotationFile.mockResolvedValue(undefined);

    await renameProjectFile("図面/1F.pdf", "平面");

    expect(mockRenameFile).toHaveBeenCalledWith("/projects/a/図面/1F.pdf", "/projects/a/図面/平面.pdf");
    expect(mockRenameFile).toHaveBeenCalledWith(
      "/projects/a/.blueprint-sync/annotations/図面/1F.pdf.json",
      "/projects/a/.blueprint-sync/annotations/図面/平面.pdf.json",
    );
    expect(projectStore.currentPdf).toBe("図面/平面.pdf");
    expect(pdfStore.name).toBe("図面/平面.pdf");
    expect(pdfStore.load).not.toHaveBeenCalled();
  });

  it("renames a jww without touching the converted pdf", async () => {
    projectStore.folder = "/projects/a";
    projectStore.currentPdf = "図面/1F.pdf";
    mockPathExists.mockResolvedValue(false);
    mockRenameFile.mockResolvedValue(undefined);
    mockListProjectPdfs.mockResolvedValue(["図面/1F.pdf", "図面JWW/平面.jww"]);

    await renameProjectFile("図面JWW/1F.jww", "平面");

    expect(mockRenameFile).toHaveBeenCalledWith(
      "/projects/a/図面JWW/1F.jww",
      "/projects/a/図面JWW/平面.jww",
    );
    expect(projectStore.currentPdf).toBe("図面/1F.pdf");
  });

  it("rejects invalid rename stems", async () => {
    projectStore.folder = "/projects/a";

    await expect(renameProjectFile("図面/1F.pdf", "..")).rejects.toThrow("ファイル名が不正です");
    expect(mockRenameFile).not.toHaveBeenCalled();
  });

  it("deletes a jww without deleting the converted pdf", async () => {
    projectStore.folder = "/projects/a";
    projectStore.currentPdf = "図面/1F.pdf";
    mockDeleteFile.mockResolvedValue(undefined);
    mockListProjectPdfs.mockResolvedValue(["図面/1F.pdf"]);

    await removeProjectPdf("図面JWW/1F.jww");

    expect(mockDeleteFile).toHaveBeenCalledWith("/projects/a/図面JWW/1F.jww");
    expect(mockDeleteFile).not.toHaveBeenCalledWith("/projects/a/図面/1F.pdf");
    expect(projectStore.currentPdf).toBe("図面/1F.pdf");
  });

  it("keeps project links unchanged when writing a new link fails", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000001",
    );
    projectStore.folder = "/projects/a";
    projectStore.meta = sampleMeta();
    mockWriteProjectMeta.mockRejectedValue(new Error("write failed"));

    await addProjectLink("https://example.com/share", "共有");

    expect(projectStore.meta.links).toEqual([]);
    expect(projectStore.error).toBe("write failed");
  });

  it("updates a project link url and title", async () => {
    projectStore.folder = "/projects/a";
    projectStore.meta = sampleMeta({
      links: [
        { id: "link-1", title: "共有", url: "https://example.com/share" },
        { id: "link-2", title: "別", url: "https://example.com/other" },
      ],
    });

    await updateProjectLink("link-1", " https://1drv.ms/f/s!abc ", " 図面共有 ");

    expect(mockWriteProjectMeta).toHaveBeenCalledWith(
      "/projects/a",
      expect.objectContaining({
        links: [
          { id: "link-1", title: "図面共有", url: "https://1drv.ms/f/s!abc" },
          { id: "link-2", title: "別", url: "https://example.com/other" },
        ],
      }),
    );
    expect(projectStore.meta.links[0]).toEqual({
      id: "link-1",
      title: "図面共有",
      url: "https://1drv.ms/f/s!abc",
    });
    expect(projectStore.error).toBe("");
  });

  it("keeps a project link unchanged when the edited url is not http(s)", async () => {
    projectStore.folder = "/projects/a";
    projectStore.meta = sampleMeta({
      links: [{ id: "link-1", title: "共有", url: "https://example.com/share" }],
    });

    await updateProjectLink("link-1", "file:///C:/secret.pdf", "共有");

    expect(mockWriteProjectMeta).not.toHaveBeenCalled();
    expect(projectStore.meta.links).toEqual([
      { id: "link-1", title: "共有", url: "https://example.com/share" },
    ]);
    expect(projectStore.error).toBe("http または https の URL だけ追加できます");
  });

  it("keeps a project link unchanged when saving an edit fails", async () => {
    projectStore.folder = "/projects/a";
    projectStore.meta = sampleMeta({
      links: [{ id: "link-1", title: "共有", url: "https://example.com/share" }],
    });
    mockWriteProjectMeta.mockRejectedValue(new Error("write failed"));

    await updateProjectLink("link-1", "https://example.com/next", "更新");

    expect(projectStore.meta.links).toEqual([
      { id: "link-1", title: "共有", url: "https://example.com/share" },
    ]);
    expect(projectStore.error).toBe("write failed");
  });

  it("keeps project links unchanged when removing a link fails to persist", async () => {
    projectStore.folder = "/projects/a";
    projectStore.meta = sampleMeta({
      links: [{ id: "link-1", title: "共有", url: "https://example.com/share" }],
    });
    mockWriteProjectMeta.mockRejectedValue(new Error("write failed"));

    await removeProjectLink("link-1");

    expect(projectStore.meta.links).toEqual([
      { id: "link-1", title: "共有", url: "https://example.com/share" },
    ]);
    expect(projectStore.error).toBe("write failed");
  });

  it("opens project links only in tauri runtime", async () => {
    mockIsTauriRuntime.mockReturnValue(false);

    await expect(openProjectLink("https://example.com/share")).rejects.toThrow(
      "プロジェクト機能は Tauri アプリ上でのみ利用できます",
    );

    expect(mockOpenUrl).not.toHaveBeenCalled();
  });

  it("imports onedrive files into 図面 and opens the first pdf", async () => {
    projectStore.folder = "/projects/a";
    mockImportOneDrive.mockResolvedValue({ imported: ["図面/1F.pdf"], skipped: [] });
    mockListProjectPdfs.mockResolvedValue(["図面/1F.pdf"]);

    await importOneDriveLinkIntoProject("https://1drv.ms/b/s!Abc", "drawing", "1F");

    expect(mockImportOneDrive).toHaveBeenCalledWith(
      expect.objectContaining({
        shareUrl: "https://1drv.ms/b/s!Abc",
        kind: "drawing",
        projectFolder: "/projects/a",
        fallbackTitle: "1F",
      }),
    );
    expect(mockReadBinaryFile).toHaveBeenCalledWith("/projects/a/図面/1F.pdf");
    expect(projectStore.currentPdf).toBe("図面/1F.pdf");
    expect(pdfStore.status).toBe("1件を取り込みました");
  });

  it("imports onedrive files into 工程表", async () => {
    projectStore.folder = "/projects/a";
    mockImportOneDrive.mockResolvedValue({ imported: ["工程表/週間工程.pdf"], skipped: [] });
    mockListProjectPdfs.mockResolvedValue(["工程表/週間工程.pdf"]);

    await importOneDriveLinkIntoProject("https://1drv.ms/f/s!Folder", "schedule");

    expect(mockImportOneDrive).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "schedule", projectFolder: "/projects/a" }),
    );
    expect(mockReadBinaryFile).toHaveBeenCalledWith("/projects/a/工程表/週間工程.pdf");
  });

  it("rejects invalid project pdf names before reading files", async () => {
    projectStore.folder = "/projects/a";

    await openProjectPdf(".hidden.pdf");

    expect(projectStore.error).toBe("PDFファイル名が不正です");
    expect(pdfStore.status).toBe("PDFファイル名が不正です");
    expect(mockWriteAnnotationFile).not.toHaveBeenCalled();
    expect(mockReadBinaryFile).not.toHaveBeenCalled();
    expect(mockReadAnnotationFile).not.toHaveBeenCalled();
    expect(pdfStore.load).not.toHaveBeenCalled();
  });

  it("refreshes the project pdf list", async () => {
    projectStore.folder = "/projects/a";
    mockListProjectPdfs.mockResolvedValue(["A.pdf", "B.pdf"]);

    await refreshProjectPdfs();

    expect(projectStore.pdfs).toEqual(["A.pdf", "B.pdf"]);
  });

  it("requires tauri runtime to refresh project pdfs", async () => {
    mockIsTauriRuntime.mockReturnValue(false);
    projectStore.folder = "/projects/a";

    await expect(refreshProjectPdfs()).rejects.toThrow(
      "プロジェクト機能は Tauri アプリ上でのみ利用できます",
    );

    expect(mockListProjectPdfs).not.toHaveBeenCalled();
  });

  it("closes a project after attempting to persist annotations", async () => {
    projectStore.folder = "/projects/a";
    projectStore.currentPdf = "A.pdf";

    await closeProject();

    expect(mockWriteAnnotationFile).toHaveBeenCalled();
    expect(projectStore.folder).toBe("");
    expect(projectStore.meta).toBeNull();
    expect(pdfStore.clear).toHaveBeenCalled();
    expect(annotationStore.clear).toHaveBeenCalled();
  });

  it("keeps the project open when annotation persistence fails during close", async () => {
    projectStore.folder = "/projects/a";
    projectStore.meta = sampleMeta();
    projectStore.currentPdf = "A.pdf";
    annotationStore.importByPage({ 0: { a: { id: "a", type: "path" } } });
    mockWriteAnnotationFile.mockRejectedValue(new Error("write failed"));

    await closeProject();

    expect(projectStore.folder).toBe("/projects/a");
    expect(projectStore.meta).toEqual(sampleMeta());
    expect(projectStore.currentPdf).toBe("A.pdf");
    expect(pdfStore.clear).not.toHaveBeenCalled();
    expect(annotationStore.clear).not.toHaveBeenCalled();
    expect(pdfStore.status).toBe("write failed");
  });

  it("registers a tab when opening a project", async () => {
    mockReadProjectMeta.mockResolvedValue(sampleMeta());
    mockListProjectPdfs.mockResolvedValue(["A.pdf"]);

    await openProject("/projects/a");

    expect(projectStore.tabs).toHaveLength(1);
    expect(projectStore.tabs[0].folder).toBe("/projects/a");
    expect(projectStore.activeTabId).toBe(projectStore.tabs[0].id);
  });

  it("does not add a tab when folder picker is cancelled", async () => {
    mockPickFolder.mockResolvedValue(null);

    await openProjectTab();

    expect(projectStore.tabs).toEqual([]);
    expect(mockReadProjectMeta).not.toHaveBeenCalled();
  });

  it("switches to an existing tab instead of opening a duplicate", async () => {
    mockReadProjectMeta.mockResolvedValue(sampleMeta());
    mockListProjectPdfs.mockResolvedValue(["A.pdf"]);
    await openProject("/projects/a");
    const id = projectStore.activeTabId;
    mockPickFolder.mockResolvedValue("/projects/a");

    await openProjectTab();

    expect(projectStore.tabs).toHaveLength(1);
    expect(projectStore.activeTabId).toBe(id);
  });

  it("creates a project in a new tab when the folder has no project.json", async () => {
    mockReadProjectMeta.mockResolvedValue(sampleMeta());
    mockListProjectPdfs.mockResolvedValue(["A.pdf"]);
    await openProject("/projects/a");
    mockPickFolder.mockResolvedValue("/projects/b");
    mockPathExists.mockImplementation(async (path: string) => !String(path).includes("project.json"));
    mockListProjectPdfs.mockResolvedValue([]);

    await openProjectTab();

    expect(projectStore.tabs).toHaveLength(2);
    expect(projectStore.folder).toBe("/projects/b");
    expect(mockInitProjectDir).toHaveBeenCalledWith("/projects/b");
    expect(mockWriteProjectMeta).toHaveBeenCalled();
  });

  it("keeps other tabs when a second open fails", async () => {
    mockReadProjectMeta.mockResolvedValue(sampleMeta());
    mockListProjectPdfs.mockResolvedValue(["A.pdf"]);
    await openProject("/projects/a");
    mockReadProjectMeta.mockRejectedValue(new Error("Invalid project"));

    await expect(openProject("/broken")).rejects.toThrow("project.json");

    expect(projectStore.folder).toBe("/projects/a");
    expect(projectStore.tabs).toHaveLength(1);
  });

  it("returns to the home screen after closing the last tab", async () => {
    mockReadProjectMeta.mockResolvedValue(sampleMeta());
    mockListProjectPdfs.mockResolvedValue(["A.pdf"]);
    await openProject("/projects/a");

    await closeProject();

    expect(projectStore.tabs).toEqual([]);
    expect(projectStore.isOpen).toBe(false);
  });

  it("shows the home screen from plus without closing open tabs", async () => {
    mockReadProjectMeta.mockResolvedValue(sampleMeta());
    mockListProjectPdfs.mockResolvedValue(["A.pdf"]);
    await openProject("/projects/a");
    const tabId = projectStore.activeTabId;

    await showProjectHome();

    expect(projectStore.isOpen).toBe(false);
    expect(projectStore.folder).toBe("");
    expect(projectStore.meta).toBeNull();
    expect(projectStore.tabs).toHaveLength(1);
    expect(projectStore.tabs[0].id).toBe(tabId);
    expect(projectStore.tabs[0].session).not.toBeNull();
    expect(projectStore.activeTabId).toBeNull();
    expect(pdfStore.clear).toHaveBeenCalled();
    expect(annotationStore.clear).toHaveBeenCalled();
  });

  it("restores a parked tab after showing home", async () => {
    mockReadProjectMeta.mockResolvedValue(sampleMeta());
    mockListProjectPdfs.mockResolvedValue(["A.pdf"]);
    await openProject("/projects/a");
    const tabId = projectStore.activeTabId;

    await showProjectHome();
    await switchProjectTab(tabId!);

    expect(projectStore.isOpen).toBe(true);
    expect(projectStore.folder).toBe("/projects/a");
    expect(projectStore.activeTabId).toBe(tabId);
  });

  it("restores a parked tab even if the canvas was already unmounted", async () => {
    mockReadProjectMeta.mockResolvedValue(sampleMeta());
    mockListProjectPdfs.mockResolvedValue(["A.pdf"]);
    await openProject("/projects/a");
    const tabId = projectStore.activeTabId;
    await showProjectHome();
    viewerApi.discardOverlays = () => {
      throw new Error("Cannot read properties of undefined (reading 'clearRect')");
    };

    await expect(switchProjectTab(tabId!)).resolves.toBeUndefined();

    expect(projectStore.isOpen).toBe(true);
    expect(projectStore.folder).toBe("/projects/a");
    expect(projectStore.activeTabId).toBe(tabId);
    viewerApi.discardOverlays = () => undefined;
  });

  it("opens another project from home into a new tab", async () => {
    mockReadProjectMeta.mockResolvedValue(sampleMeta());
    mockListProjectPdfs.mockResolvedValue(["A.pdf"]);
    await openProject("/projects/a");

    await showProjectHome();
    mockReadProjectMeta.mockResolvedValue(sampleMeta({ name: "現場B" }));
    await openProject("/projects/b");

    expect(projectStore.tabs).toHaveLength(2);
    expect(projectStore.folder).toBe("/projects/b");
    expect(projectStore.isOpen).toBe(true);
  });

  it("does not leave the project when annotation persist fails on plus", async () => {
    mockReadProjectMeta.mockResolvedValue(sampleMeta());
    mockListProjectPdfs.mockResolvedValue(["A.pdf"]);
    await openProject("/projects/a");
    projectStore.currentPdf = "A.pdf";
    mockWriteAnnotationFile.mockRejectedValue(new Error("write failed"));

    await showProjectHome();

    expect(projectStore.isOpen).toBe(true);
    expect(projectStore.folder).toBe("/projects/a");
    expect(projectStore.activeTabId).toBeTruthy();
  });

  it("is a no-op when already on the home screen", async () => {
    await showProjectHome();

    expect(projectStore.tabs).toEqual([]);
    expect(projectStore.isOpen).toBe(false);
    expect(mockWriteAnnotationFile).not.toHaveBeenCalled();
  });

  it("creates a named sandbox project without a folder picker", async () => {
    mockUsesSandboxProjects.mockReturnValue(true);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("22222222-2222-4222-8222-222222222222");

    await createProject("現場B");

    expect(mockPickFolder).not.toHaveBeenCalled();
    expect(mockInitProjectDir).toHaveBeenCalledWith(
      "/data/projects/22222222-2222-4222-8222-222222222222",
    );
    expect(projectStore.folder).toBe("/data/projects/22222222-2222-4222-8222-222222222222");
    expect(projectStore.meta?.name).toBe("現場B");
    expect(projectStore.meta?.id).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("does not share when annotation persist fails", async () => {
    mockReadProjectMeta.mockResolvedValue(sampleMeta());
    mockListProjectPdfs.mockResolvedValue(["A.pdf"]);
    await openProject("/projects/a");
    mockWriteAnnotationFile.mockRejectedValue(new Error("disk full"));

    await expect(shareCurrentProject()).resolves.toBe(false);
    expect(mockShareFileBytes).not.toHaveBeenCalled();
    expect(mockListProjectFiles).not.toHaveBeenCalled();
  });

  it("installs a project bundle and refuses a silent merge of the same id", async () => {
    mockUsesSandboxProjects.mockReturnValue(true);
    const zip = zipSync({
      ".blueprint-sync/project.json": new TextEncoder().encode(
        JSON.stringify(sampleMeta({ id: "project-1", name: "現場A" })),
      ),
      "図面/1F.pdf": new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    });
    mockListSandboxProjects.mockResolvedValue([
      { id: "project-1", name: "現場A", path: "/data/projects/project-1" },
    ]);
    mockReadProjectMeta.mockResolvedValue(sampleMeta({ id: "project-1", name: "現場A" }));
    mockPathExists.mockResolvedValue(true);

    await expect(importIncomingFile("現場A.bpsync.zip", zip)).resolves.toBe("confirm-overwrite");
    expect(mockWriteBinaryFile).not.toHaveBeenCalled();

    await expect(importIncomingFile("現場A.bpsync.zip", zip, true)).resolves.toBe("ok");
    expect(mockRemoveDirAll).toHaveBeenCalledWith("/data/projects/project-1");
    expect(mockWriteBinaryFile).toHaveBeenCalled();
  });

  it("saves the open session after opening a project", async () => {
    mockReadProjectMeta.mockResolvedValue(sampleMeta());
    mockListProjectPdfs.mockResolvedValue([]);

    await openProject("/projects/a");

    expect(mockSaveOpenSession).toHaveBeenCalledWith({
      folders: ["/projects/a"],
      activeFolder: "/projects/a",
    });
  });

  it("clears the open session when the last tab is closed", async () => {
    mockReadProjectMeta.mockResolvedValue(sampleMeta());
    mockListProjectPdfs.mockResolvedValue([]);
    await openProject("/projects/a");
    mockSaveOpenSession.mockClear();

    await closeProject();

    expect(mockSaveOpenSession).toHaveBeenCalledWith({ folders: [], activeFolder: null });
  });

  it("restores the cached open project on bootstrap", async () => {
    mockLoadOpenSession.mockResolvedValue({
      folders: ["/projects/a"],
      activeFolder: "/projects/a",
    });
    mockPathExists.mockResolvedValue(true);
    mockReadProjectMeta.mockResolvedValue(sampleMeta());
    mockListProjectPdfs.mockResolvedValue(["A.pdf"]);

    await bootstrapOpenSession();

    expect(projectStore.folder).toBe("/projects/a");
    expect(projectStore.bootstrapped).toBe(true);
  });

  it("opens cached tabs and activates the saved folder", async () => {
    mockLoadOpenSession.mockResolvedValue({
      folders: ["/projects/a", "/projects/b"],
      activeFolder: "/projects/a",
    });
    mockPathExists.mockResolvedValue(true);
    mockReadProjectMeta.mockImplementation(async (folder: string) =>
      sampleMeta({
        id: folder,
        name: folder === "/projects/a" ? "現場A" : "現場B",
      }),
    );
    mockListProjectPdfs.mockResolvedValue([]);

    await bootstrapOpenSession();

    expect(projectStore.tabs.map((tab) => tab.folder)).toEqual(["/projects/a", "/projects/b"]);
    expect(projectStore.folder).toBe("/projects/a");
  });

  it("skips cached folders that no longer exist", async () => {
    mockLoadOpenSession.mockResolvedValue({
      folders: ["/gone", "/projects/a"],
      activeFolder: "/gone",
    });
    mockPathExists.mockImplementation(async (path: string) => path !== "/gone");
    mockReadProjectMeta.mockResolvedValue(sampleMeta());
    mockListProjectPdfs.mockResolvedValue([]);

    await bootstrapOpenSession();

    expect(projectStore.folder).toBe("/projects/a");
    expect(projectStore.tabs).toHaveLength(1);
  });

  it("does not restore when the cache is empty", async () => {
    mockLoadOpenSession.mockResolvedValue({ folders: [], activeFolder: null });

    await bootstrapOpenSession();

    expect(projectStore.folder).toBe("");
    expect(mockReadProjectMeta).not.toHaveBeenCalled();
    expect(projectStore.bootstrapped).toBe(true);
  });

  it("skips restore when not running in Tauri", async () => {
    mockIsTauriRuntime.mockReturnValue(false);

    await bootstrapOpenSession();

    expect(mockLoadOpenSession).not.toHaveBeenCalled();
    expect(projectStore.bootstrapped).toBe(true);
  });
});
