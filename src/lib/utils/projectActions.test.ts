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
  mockCopyFileIntoFolder,
  mockLoadRecentProjects,
  mockSaveRecentProjects,
  mockPathExists,
  mockReadAnnotationFile,
  mockReadBinaryFile,
  mockReadProjectMeta,
  mockWriteAnnotationFile,
  mockWriteProjectMeta,
  mockOpenUrl,
} = vi.hoisted(() => ({
  mockOpenPdfFromDisk: vi.fn(),
  mockIsTauriRuntime: vi.fn(() => true),
  mockPickFolder: vi.fn(),
  mockInitProjectDir: vi.fn(),
  mockListProjectPdfs: vi.fn(),
  mockCopyFileIntoFolder: vi.fn(),
  mockLoadRecentProjects: vi.fn(),
  mockSaveRecentProjects: vi.fn(),
  mockPathExists: vi.fn(),
  mockReadAnnotationFile: vi.fn(),
  mockReadBinaryFile: vi.fn(),
  mockReadProjectMeta: vi.fn(),
  mockWriteAnnotationFile: vi.fn(),
  mockWriteProjectMeta: vi.fn(),
  mockOpenUrl: vi.fn(),
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
  copyFileIntoFolder: mockCopyFileIntoFolder,
  initProjectDir: mockInitProjectDir,
  listProjectPdfs: mockListProjectPdfs,
  loadRecentProjects: mockLoadRecentProjects,
  pathExists: mockPathExists,
  pickFolder: mockPickFolder,
  readAnnotationFile: mockReadAnnotationFile,
  readBinaryFile: mockReadBinaryFile,
  readProjectMeta: mockReadProjectMeta,
  saveRecentProjects: mockSaveRecentProjects,
  writeAnnotationFile: mockWriteAnnotationFile,
  writeProjectMeta: mockWriteProjectMeta,
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: mockOpenUrl,
}));

import {
  addProjectLink,
  closeProject,
  createProject,
  importPdfIntoProject,
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
    vi.clearAllMocks();
    projectStore.reset();
    projectStore.recents = [];
    annotationStore.clear();
    pdfStore.clear();
    mockIsTauriRuntime.mockReturnValue(true);
    mockListProjectPdfs.mockResolvedValue([]);
    mockReadAnnotationFile.mockResolvedValue({});
    mockReadBinaryFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
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

    await createProject("現場A");

    expect(mockInitProjectDir).toHaveBeenCalledWith("/projects/a");
    expect(projectStore.folder).toBe("/projects/a");
    expect(projectStore.meta?.name).toBe("現場A");
    expect(projectStore.pdfs).toEqual(["A.pdf"]);
    expect(mockSaveRecentProjects).toHaveBeenCalledWith([
      { name: "現場A", path: "/projects/a" },
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
    expect(projectStore.currentPdf).toBe("");
    expect(pdfStore.clear).toHaveBeenCalled();
    expect(annotationStore.clear).toHaveBeenCalled();
    expect(mockSaveRecentProjects).toHaveBeenCalledWith([
      { name: "現場A", path: "/projects/a" },
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

    await persistCurrentAnnotations();

    expect(mockWriteAnnotationFile).toHaveBeenCalledWith("/projects/a", "A.pdf", {
      0: { a: { id: "a", type: "path" } },
    });
    expect(pdfStore.status).toBe("write failed");
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
  });

  it("surfaces duplicate-name import errors instead of swallowing them", async () => {
    projectStore.folder = "/projects/a";
    mockOpenPdfFromDisk.mockResolvedValue({
      name: "A.pdf",
      path: "/downloads/A.pdf",
      bytes: new Uint8Array([9]),
    });
    mockCopyFileIntoFolder.mockRejectedValue(new Error("同じ名前のPDFが既にあります"));

    await expect(importPdfIntoProject()).rejects.toThrow("同じ名前のPDFが既にあります");

    expect(projectStore.error).toBe("同じ名前のPDFが既にあります");
    expect(pdfStore.status).toBe("同じ名前のPDFが既にあります");
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

  it("opens project links only in tauri runtime", async () => {
    mockIsTauriRuntime.mockReturnValue(false);

    await expect(openProjectLink("https://example.com/share")).rejects.toThrow(
      "プロジェクト機能は Tauri アプリ上でのみ利用できます",
    );

    expect(mockOpenUrl).not.toHaveBeenCalled();
  });

  it("rejects invalid project pdf names before reading files", async () => {
    projectStore.folder = "/projects/a";

    await openProjectPdf(".hidden.pdf");

    expect(projectStore.error).toBe("PDFファイル名が不正です");
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
});
