import { beforeEach, describe, expect, it, vi } from "vitest";
import { pdfStore } from "$lib/stores/pdfStore.svelte";
import { projectStore } from "$lib/stores/projectStore.svelte";

const {
  mockInvoke,
  mockReadFileAsBytes,
  mockSendCurrentPdf,
  mockPersistCurrentAnnotations,
  mockOpenProjectPdf,
  mockCopyFileIntoFolder,
  mockListProjectPdfs,
  mockPathExists,
} = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockReadFileAsBytes: vi.fn(),
  mockSendCurrentPdf: vi.fn(),
  mockPersistCurrentAnnotations: vi.fn(),
  mockOpenProjectPdf: vi.fn(),
  mockCopyFileIntoFolder: vi.fn(),
  mockListProjectPdfs: vi.fn(),
  mockPathExists: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("./fileAccess", () => ({
  readFileAsBytes: mockReadFileAsBytes,
}));

vi.mock("./connectionActions", () => ({
  sendCurrentPdf: mockSendCurrentPdf,
}));

vi.mock("./projectActions", async () => {
  const actual = await vi.importActual<typeof import("./projectActions")>("./projectActions");
  return {
    ...actual,
    persistCurrentAnnotations: mockPersistCurrentAnnotations,
    openProjectPdf: mockOpenProjectPdf,
  };
});

vi.mock("./projectIo", async () => {
  const actual = await vi.importActual<typeof import("./projectIo")>("./projectIo");
  return {
    ...actual,
    copyFileIntoFolder: mockCopyFileIntoFolder,
    listProjectPdfs: mockListProjectPdfs,
    pathExists: mockPathExists,
  };
});

import { importBrowserPdfIntoProject, importTauriPdfIntoProject } from "./projectDrop";

describe("projectDrop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectStore.reset();
    pdfStore.clear();
    projectStore.meta = {
      id: "project-1",
      name: "現場A",
      createdAt: "2026-08-30T08:00:00.000Z",
      links: [],
    };
    projectStore.folder = "/projects/a";
    mockPersistCurrentAnnotations.mockResolvedValue(true);
    mockReadFileAsBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockListProjectPdfs.mockResolvedValue(["A.pdf"]);
    mockPathExists.mockResolvedValue(false);
  });

  it("writes browser-dropped PDFs into the current project and opens them", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "A.pdf", {
      type: "application/pdf",
    });

    await expect(importBrowserPdfIntoProject(file)).resolves.toBe(true);

    expect(mockPersistCurrentAnnotations).toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledWith("write_file_bytes", {
      path: "/projects/a/A.pdf",
      bytes: [1, 2, 3],
    });
    expect(projectStore.pdfs).toEqual(["A.pdf"]);
    expect(mockOpenProjectPdf).toHaveBeenCalledWith("A.pdf");
    expect(mockSendCurrentPdf).not.toHaveBeenCalled();
  });

  it("keeps the current drawing when browser-drop persistence fails", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "A.pdf", {
      type: "application/pdf",
    });
    mockPersistCurrentAnnotations.mockResolvedValue(false);

    await expect(importBrowserPdfIntoProject(file)).resolves.toBe(false);

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockListProjectPdfs).not.toHaveBeenCalled();
    expect(mockOpenProjectPdf).not.toHaveBeenCalled();
    expect(mockSendCurrentPdf).not.toHaveBeenCalled();
  });

  it("copies tauri-dropped PDFs into the current project and opens them", async () => {
    mockCopyFileIntoFolder.mockResolvedValue("/projects/a/B.pdf");
    mockListProjectPdfs.mockResolvedValue(["A.pdf", "B.pdf"]);

    await expect(importTauriPdfIntoProject("/downloads/B.pdf")).resolves.toBe(true);

    expect(mockPersistCurrentAnnotations).toHaveBeenCalled();
    expect(mockCopyFileIntoFolder).toHaveBeenCalledWith("/downloads/B.pdf", "/projects/a");
    expect(projectStore.pdfs).toEqual(["A.pdf", "B.pdf"]);
    expect(mockOpenProjectPdf).toHaveBeenCalledWith("B.pdf");
    expect(mockSendCurrentPdf).not.toHaveBeenCalled();
  });

  it("keeps the current drawing when tauri-drop persistence fails", async () => {
    mockPersistCurrentAnnotations.mockResolvedValue(false);

    await expect(importTauriPdfIntoProject("/downloads/B.pdf")).resolves.toBe(false);

    expect(mockCopyFileIntoFolder).not.toHaveBeenCalled();
    expect(mockListProjectPdfs).not.toHaveBeenCalled();
    expect(mockOpenProjectPdf).not.toHaveBeenCalled();
    expect(mockSendCurrentPdf).not.toHaveBeenCalled();
  });

  it("ignores project imports when no project folder is open", async () => {
    projectStore.reset();

    await expect(
      importBrowserPdfIntoProject(
        new File([new Uint8Array([1])], "A.pdf", { type: "application/pdf" }),
      ),
    ).resolves.toBe(false);
    await expect(importTauriPdfIntoProject("/downloads/A.pdf")).resolves.toBe(false);

    expect(mockPersistCurrentAnnotations).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockCopyFileIntoFolder).not.toHaveBeenCalled();
    expect(mockOpenProjectPdf).not.toHaveBeenCalled();
  });

  it("rejects browser drops with invalid pdf basenames before writing", async () => {
    const dotted = new File([new Uint8Array([1])], "A..pdf", { type: "application/pdf" });
    await expect(importBrowserPdfIntoProject(dotted)).resolves.toBe(false);
    expect(projectStore.error).toBe("PDFファイル名が不正です");
    expect(pdfStore.status).toBe("PDFファイル名が不正です");
    expect(mockPersistCurrentAnnotations).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockOpenProjectPdf).not.toHaveBeenCalled();

    projectStore.error = "";
    const traversal = new File([new Uint8Array([1])], "../x.pdf", { type: "application/pdf" });
    await expect(importBrowserPdfIntoProject(traversal)).resolves.toBe(false);
    expect(projectStore.error).toBe("PDFファイル名が不正です");
    expect(pdfStore.status).toBe("PDFファイル名が不正です");
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("rejects tauri drops with invalid pdf basenames before copying", async () => {
    await expect(importTauriPdfIntoProject("/downloads/A..pdf")).resolves.toBe(false);

    expect(projectStore.error).toBe("PDFファイル名が不正です");
    expect(pdfStore.status).toBe("PDFファイル名が不正です");
    expect(mockPersistCurrentAnnotations).not.toHaveBeenCalled();
    expect(mockCopyFileIntoFolder).not.toHaveBeenCalled();
    expect(mockOpenProjectPdf).not.toHaveBeenCalled();
  });

  it("rejects browser drops that would overwrite an existing pdf", async () => {
    mockPathExists.mockResolvedValue(true);
    const file = new File([new Uint8Array([1, 2, 3])], "A.pdf", {
      type: "application/pdf",
    });

    await expect(importBrowserPdfIntoProject(file)).resolves.toBe(false);

    expect(projectStore.error).toBe("同じ名前のPDFが既にあります");
    expect(pdfStore.status).toBe("同じ名前のPDFが既にあります");
    expect(mockPathExists).toHaveBeenCalledWith("/projects/a/A.pdf");
    expect(mockPersistCurrentAnnotations).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockOpenProjectPdf).not.toHaveBeenCalled();
  });
});
