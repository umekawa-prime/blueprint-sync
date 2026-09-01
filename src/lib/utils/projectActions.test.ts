import { zipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { annotationStore } from "$lib/stores/annotationStore.svelte";
import { pdfStore } from "$lib/stores/pdfStore.svelte";
import { projectStore } from "$lib/stores/projectStore.svelte";
import type { ProjectMeta, RecentProject } from "./projectFormat";

const {
  mockOpenPdfFromDisk,
  mockIsTauriRuntime,
  mockPickFolder,
  mockInitProjectDir,
  mockListProjectPdfs,
  mockMoveFileIntoFolder,
  mockLoadRecentProjects,
  mockSaveRecentProjects,
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
} = vi.hoisted(() => ({
  mockOpenPdfFromDisk: vi.fn(),
  mockIsTauriRuntime: vi.fn(() => true),
  mockPickFolder: vi.fn(),
  mockInitProjectDir: vi.fn(),
  mockListProjectPdfs: vi.fn(),
  mockMoveFileIntoFolder: vi.fn(),
  mockLoadRecentProjects: vi.fn(),
  mockSaveRecentProjects: vi.fn(),
  mockPathExists: vi.fn(),
  mockReadAnnotationFile: vi.fn(),
  mockReadBinaryFile: vi.fn(),
  mockReadProjectMeta: vi.fn(),
  mockWriteAnnotationFile: vi.fn(),
  mockWriteBinaryFile: vi.fn(),
  mockWriteProjectMeta: vi.fn(),
  mockDeleteFile: vi.fn(),
  mockOpenUrl: vi.fn(),
  mockSendCurrentPdf: vi.fn(),
  mockImportOneDrive: vi.fn(),
}));

vi.mock("./fileAccess", () => ({
  openPdfFromDisk: mockOpenPdfFromDisk,
}));

vi.mock("./platform", () => ({
  isTauriRuntime: mockIsTauriRuntime,
}));

vi.mock("./projectIo", () => ({
  annotationPath: (folder: string, pdfName: string) =>
    `${folder}/.blueprint-sync/annotations/${pdfName}.json`,
  copyFileIntoFolder: vi.fn(),
  moveFileIntoFolder: mockMoveFileIntoFolder,
  initProjectDir: mockInitProjectDir,
  listProjectPdfs: mockListProjectPdfs,
  loadRecentProjects: mockLoadRecentProjects,
  pathExists: mockPathExists,
  pickFolder: mockPickFolder,
  httpGet: vi.fn(),
  writeBinaryFile: mockWriteBinaryFile,
  deleteFile: mockDeleteFile,
  readAnnotationFile: mockReadAnnotationFile,
  readBinaryFile: mockReadBinaryFile,
  readProjectMeta: mockReadProjectMeta,
  saveRecentProjects: mockSaveRecentProjects,
  writeAnnotationFile: mockWriteAnnotationFile,
  writeProjectMeta: mockWriteProjectMeta,
}));

vi.mock("./oneDriveImport", () => ({
  importOneDrivePdfsIntoFolder: mockImportOneDrive,
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: mockOpenUrl,
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
  openProjectLink,
  openProject,
  openProjectPdf,
  persistCurrentAnnotations,
  refreshProjectPdfs,
  removeProjectLink,
} from "./projectActions";

function sampleMeta(overrides: Partial<ProjectMeta> = {}): ProjectMeta {
  return {
    id: "project-1",
    name: "現場A",
    createdAt: "2026-08-30T08:00:00.000Z",
    links: [],
    ...overrides,
  };
}

function sampleRecent(path: string, name = "現場A"): RecentProject {
  return { path, name };
}

describe("projectActions", () => {
  beforeEach(() => {
    projectStore.reset();
    projectStore.recents = [];
    annotationStore.clear();
    pdfStore.clear();
    vi.clearAllMocks();
    mockIsTauriRuntime.mockReturnValue(true);
    mockListProjectPdfs.mockResolvedValue([]);
    mockReadAnnotationFile.mockResolvedValue({});
    mockReadBinaryFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockWriteAnnotationFile.mockResolvedValue(undefined);
    mockWriteProjectMeta.mockResolvedValue(undefined);
    vi.spyOn(pdfStore, "load").mockResolvedValue();
    vi.spyOn(pdfStore, "clear");
    vi.spyOn(annotationStore, "clear");
  });

  it("loads recents and removes entries whose path no longer exists", async () => {
    mockLoadRecentProjects.mockResolvedValue([
      sampleRecent("/keep", "keep"),
      sampleRecent("/drop", "drop"),
    ]);
    mockPathExists.mockImplementation(async (path: string) => path === "/keep");

    await loadRecentsIntoStore();

    expect(projectStore.recents).toEqual([sampleRecent("/keep", "keep")]);
    expect(mockSaveRecentProjects).toHaveBeenCalledWith([sampleRecent("/keep", "keep")]);
  });

  it("loads recents, caps them at 8, and persists the trimmed list", async () => {
    const items = Array.from({ length: 10 }, (_, index) =>
      sampleRecent(`/projects/${index}`, `project-${index}`),
    );
    mockLoadRecentProjects.mockResolvedValue(items);
    mockPathExists.mockResolvedValue(true);

    await loadRecentsIntoStore();

    expect(projectStore.recents).toEqual(items.slice(0, 8));
    expect(mockSaveRecentProjects).toHaveBeenCalledWith(items.slice(0, 8));
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
      { name: "a", path: "/projects/a" },
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
      { name: "a", path: "/projects/a" },
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
    expect(mockWriteAnnotationFile).toHaveBeenCalledWith("/projects/a", "A.pdf", {
      0: { a: { id: "a", type: "path" } },
    });
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
    expect(mockWriteAnnotationFile).toHaveBeenCalledWith("/projects/a", "A.pdf", {
      0: { a: { id: "a", type: "path" } },
    });
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
    mockReadAnnotationFile.mockResolvedValue({ 1: { next: { id: "next", type: "path" } } });

    await openProjectPdf("After.pdf");

    expect(mockWriteAnnotationFile).toHaveBeenCalledWith("/projects/a", "Before.pdf", {
      2: { prev: { id: "prev", type: "path" } },
    });
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
    mockReadAnnotationFile.mockResolvedValue({});

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

  it("keeps the current drawing and shows a Japanese message when reading annotations fails", async () => {
    projectStore.folder = "/projects/a";
    projectStore.currentPdf = "Before.pdf";
    annotationStore.importByPage({ 2: { prev: { id: "prev", type: "path" } } });
    mockReadAnnotationFile.mockRejectedValue(new Error("broken annotation"));

    await openProjectPdf("After.pdf");

    expect(mockReadBinaryFile).toHaveBeenCalledWith("/projects/a/After.pdf");
    expect(pdfStore.load).not.toHaveBeenCalled();
    expect(projectStore.currentPdf).toBe("Before.pdf");
    expect(annotationStore.exportByPage()).toEqual({
      2: { prev: { id: "prev", type: "path" } },
    });
    expect(pdfStore.status).toBe("注釈ファイルの読み込みに失敗しました");
    expect(mockSendCurrentPdf).not.toHaveBeenCalled();
  });

  it("rejects invalid pdf names before importing into a project", async () => {
    projectStore.folder = "/projects/a";
    mockOpenPdfFromDisk.mockResolvedValue({
      name: ".hidden.pdf",
      path: "/downloads/.hidden.pdf",
      bytes: new Uint8Array([9]),
    });

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
    mockOpenPdfFromDisk.mockResolvedValue({
      name: "After.pdf",
      path: "/downloads/After.pdf",
      bytes: new Uint8Array([9]),
    });
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
    mockOpenPdfFromDisk.mockResolvedValue({
      name: "A.pdf",
      path: "/downloads/A.pdf",
      bytes: new Uint8Array([9]),
    });
    mockMoveFileIntoFolder.mockRejectedValue(new Error("同じ名前のPDFが既にあります"));

    await expect(importPdfIntoProject()).rejects.toThrow("同じ名前のPDFが既にあります");

    expect(projectStore.error).toBe("同じ名前のPDFが既にあります");
    expect(pdfStore.status).toBe("同じ名前のPDFが既にあります");
  });

  it("moves a picked drawing pdf into 図面 and opens it", async () => {
    projectStore.folder = "/projects/a";
    mockOpenPdfFromDisk.mockResolvedValue({
      name: "A.pdf",
      path: "/downloads/A.pdf",
      bytes: new Uint8Array([9]),
    });
    mockMoveFileIntoFolder.mockResolvedValue("/projects/a/図面/A.pdf");
    mockListProjectPdfs.mockResolvedValue(["図面/A.pdf"]);

    await importPdfIntoProject();

    expect(mockMoveFileIntoFolder).toHaveBeenCalledWith("/downloads/A.pdf", "/projects/a/図面");
    expect(mockReadBinaryFile).toHaveBeenCalledWith("/projects/a/図面/A.pdf");
    expect(pdfStore.load).toHaveBeenCalledWith("図面/A.pdf", new Uint8Array([1, 2, 3]));
    expect(projectStore.currentPdf).toBe("図面/A.pdf");
  });

  it("moves a picked schedule pdf into 工程表 and opens it", async () => {
    projectStore.folder = "/projects/a";
    mockOpenPdfFromDisk.mockResolvedValue({
      name: "週間工程.pdf",
      path: "/downloads/週間工程.pdf",
      bytes: new Uint8Array([9]),
    });
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
    mockOpenPdfFromDisk.mockResolvedValue({
      name: "plans.zip",
      path: "/downloads/plans.zip",
      bytes: zipSync({ "1F.pdf": pdfA, "nested/2F.pdf": pdfB }),
    });
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
    mockOpenPdfFromDisk.mockResolvedValue({
      name: "schedules.zip",
      path: "/downloads/schedules.zip",
      bytes: zipSync({ "週間工程.pdf": pdfA }),
    });
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
    mockOpenPdfFromDisk.mockResolvedValue({
      name: "empty.zip",
      path: "/downloads/empty.zip",
      bytes: zipSync({ "notes.txt": new Uint8Array([1, 2, 3]) }),
    });

    await expect(importPdfIntoProject()).rejects.toThrow(/PDF/);

    expect(mockWriteBinaryFile).not.toHaveBeenCalled();
    expect(mockDeleteFile).not.toHaveBeenCalled();
    expect(mockMoveFileIntoFolder).not.toHaveBeenCalled();
    expect(pdfStore.load).not.toHaveBeenCalled();
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
});
