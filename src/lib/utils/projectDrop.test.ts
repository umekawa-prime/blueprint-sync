import { zipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pdfStore } from "$lib/stores/pdfStore.svelte";
import { projectStore } from "$lib/stores/projectStore.svelte";

const {
  mockInvoke,
  mockReadFileAsBytes,
  mockSendCurrentPdf,
  mockPersistCurrentAnnotations,
  mockOpenProjectPdf,
  mockMoveFileIntoFolder,
  mockListProjectPdfs,
  mockPathExists,
  mockWriteBinaryFile,
  mockDeleteFile,
  mockReadBinaryFile,
} = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockReadFileAsBytes: vi.fn(),
  mockSendCurrentPdf: vi.fn(),
  mockPersistCurrentAnnotations: vi.fn(),
  mockOpenProjectPdf: vi.fn(),
  mockMoveFileIntoFolder: vi.fn(),
  mockListProjectPdfs: vi.fn(),
  mockPathExists: vi.fn(),
  mockWriteBinaryFile: vi.fn(),
  mockDeleteFile: vi.fn(),
  mockReadBinaryFile: vi.fn(),
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
    copyFileIntoFolder: vi.fn(),
    moveFileIntoFolder: mockMoveFileIntoFolder,
    listProjectPdfs: mockListProjectPdfs,
    pathExists: mockPathExists,
    writeBinaryFile: mockWriteBinaryFile,
    deleteFile: mockDeleteFile,
    readBinaryFile: mockReadBinaryFile,
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
    mockListProjectPdfs.mockResolvedValue(["図面/A.pdf"]);
    mockPathExists.mockResolvedValue(false);
  });

  it("writes browser-dropped PDFs into the current project and opens them", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "A.pdf", {
      type: "application/pdf",
    });

    await expect(importBrowserPdfIntoProject(file)).resolves.toBe(true);

    expect(mockPersistCurrentAnnotations).toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledWith("write_file_bytes", {
      path: "/projects/a/図面/A.pdf",
      bytes: [1, 2, 3],
    });
    expect(projectStore.pdfs).toEqual(["図面/A.pdf"]);
    expect(mockOpenProjectPdf).toHaveBeenCalledWith("図面/A.pdf");
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

  it("moves tauri-dropped PDFs into the drawing folder and opens them", async () => {
    mockMoveFileIntoFolder.mockResolvedValue("/projects/a/図面/B.pdf");
    mockListProjectPdfs.mockResolvedValue(["図面/A.pdf", "図面/B.pdf"]);

    await expect(importTauriPdfIntoProject("/downloads/B.pdf")).resolves.toBe(true);

    expect(mockPersistCurrentAnnotations).toHaveBeenCalled();
    expect(mockMoveFileIntoFolder).toHaveBeenCalledWith("/downloads/B.pdf", "/projects/a/図面");
    expect(projectStore.pdfs).toEqual(["図面/A.pdf", "図面/B.pdf"]);
    expect(mockOpenProjectPdf).toHaveBeenCalledWith("図面/B.pdf");
    expect(mockSendCurrentPdf).not.toHaveBeenCalled();
  });

  it("moves tauri-dropped PDFs into the schedule folder when requested", async () => {
    mockMoveFileIntoFolder.mockResolvedValue("/projects/a/工程表/工程.pdf");
    mockListProjectPdfs.mockResolvedValue(["工程表/工程.pdf"]);

    await expect(importTauriPdfIntoProject("/downloads/工程.pdf", "schedule")).resolves.toBe(true);

    expect(mockMoveFileIntoFolder).toHaveBeenCalledWith("/downloads/工程.pdf", "/projects/a/工程表");
    expect(mockOpenProjectPdf).toHaveBeenCalledWith("工程表/工程.pdf");
  });

  it("keeps the current drawing when tauri-drop persistence fails", async () => {
    mockPersistCurrentAnnotations.mockResolvedValue(false);

    await expect(importTauriPdfIntoProject("/downloads/B.pdf")).resolves.toBe(false);

    expect(mockMoveFileIntoFolder).not.toHaveBeenCalled();
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
    expect(mockMoveFileIntoFolder).not.toHaveBeenCalled();
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
    expect(mockMoveFileIntoFolder).not.toHaveBeenCalled();
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
    expect(mockPathExists).toHaveBeenCalledWith("/projects/a/図面/A.pdf");
    expect(mockPersistCurrentAnnotations).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockOpenProjectPdf).not.toHaveBeenCalled();
  });

  it("extracts browser-dropped zips into 図面 and opens the first pdf", async () => {
    const pdfA = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    const zipBytes = zipSync({ "1F.pdf": pdfA, "nested/2F.pdf": pdfA });
    mockReadFileAsBytes.mockResolvedValue(zipBytes);
    mockPathExists.mockResolvedValue(false);
    mockWriteBinaryFile.mockResolvedValue(undefined);
    mockListProjectPdfs.mockResolvedValue(["図面/1F.pdf", "図面/2F.pdf"]);
    const file = new File([zipBytes], "plans.zip", { type: "application/zip" });

    await expect(importBrowserPdfIntoProject(file)).resolves.toBe(true);

    expect(mockWriteBinaryFile).toHaveBeenCalledWith("/projects/a/図面/1F.pdf", pdfA);
    expect(mockWriteBinaryFile).toHaveBeenCalledWith("/projects/a/図面/2F.pdf", pdfA);
    expect(mockDeleteFile).not.toHaveBeenCalled();
    expect(mockOpenProjectPdf).toHaveBeenCalledWith("図面/1F.pdf");
  });

  it("extracts tauri-dropped zips, opens the first pdf, then deletes the zip", async () => {
    const pdfA = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    const zipBytes = zipSync({ "週間工程.pdf": pdfA });
    mockReadBinaryFile.mockResolvedValue(zipBytes);
    mockPathExists.mockResolvedValue(false);
    mockWriteBinaryFile.mockResolvedValue(undefined);
    mockDeleteFile.mockResolvedValue(undefined);
    mockListProjectPdfs.mockResolvedValue(["工程表/週間工程.pdf"]);

    await expect(importTauriPdfIntoProject("/downloads/schedules.zip", "schedule")).resolves.toBe(
      true,
    );

    expect(mockReadBinaryFile).toHaveBeenCalledWith("/downloads/schedules.zip");
    expect(mockWriteBinaryFile).toHaveBeenCalledWith("/projects/a/工程表/週間工程.pdf", pdfA);
    expect(mockMoveFileIntoFolder).not.toHaveBeenCalled();
    expect(mockDeleteFile).toHaveBeenCalledWith("/downloads/schedules.zip");
    expect(mockOpenProjectPdf).toHaveBeenCalledWith("工程表/週間工程.pdf");
  });

  it("keeps a tauri-dropped zip when it contains no pdfs", async () => {
    mockReadBinaryFile.mockResolvedValue(zipSync({ "notes.txt": new Uint8Array([1]) }));

    await expect(importTauriPdfIntoProject("/downloads/empty.zip")).resolves.toBe(false);

    expect(projectStore.error).toBe("ZIPにPDFが見つかりませんでした");
    expect(mockWriteBinaryFile).not.toHaveBeenCalled();
    expect(mockDeleteFile).not.toHaveBeenCalled();
    expect(mockOpenProjectPdf).not.toHaveBeenCalled();
  });
});
