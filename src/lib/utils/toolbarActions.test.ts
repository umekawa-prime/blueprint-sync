import { beforeEach, describe, expect, it, vi } from "vitest";
import { annotationStore } from "$lib/stores/annotationStore.svelte";
import { pdfStore } from "$lib/stores/pdfStore.svelte";
import { projectStore } from "$lib/stores/projectStore.svelte";
import { viewerApi } from "$lib/stores/viewerApi";

const {
  mockImportPdfIntoProject,
  mockPersistCurrentAnnotations,
  mockSavePdfToDisk,
  mockWriteBinaryFile,
  mockEmbedAnnotationPngOnPdf,
  mockAppendPhotoPinSlides,
  mockLoadPdfDocument,
} = vi.hoisted(() => ({
  mockImportPdfIntoProject: vi.fn(),
  mockPersistCurrentAnnotations: vi.fn(),
  mockSavePdfToDisk: vi.fn(),
  mockWriteBinaryFile: vi.fn(),
  mockEmbedAnnotationPngOnPdf: vi.fn(),
  mockAppendPhotoPinSlides: vi.fn(),
  mockLoadPdfDocument: vi.fn(),
}));

vi.mock("./projectActions", async () => {
  const actual = await vi.importActual<typeof import("./projectActions")>("./projectActions");
  return {
    ...actual,
    importPdfIntoProject: mockImportPdfIntoProject,
    persistCurrentAnnotations: mockPersistCurrentAnnotations,
  };
});

vi.mock("./fileAccess", () => ({
  savePdfToDisk: mockSavePdfToDisk,
}));

vi.mock("./projectIo", async () => {
  const actual = await vi.importActual<typeof import("./projectIo")>("./projectIo");
  return {
    ...actual,
    writeBinaryFile: mockWriteBinaryFile,
  };
});

vi.mock("./pdfExport", () => ({
  embedAnnotationPngOnPdf: mockEmbedAnnotationPngOnPdf,
  suggestedExportName: vi.fn(),
}));

vi.mock("./pinSlides", () => ({
  appendPhotoPinSlides: mockAppendPhotoPinSlides,
}));

vi.mock("$lib/utils/pdfRenderer", () => ({
  loadPdfDocument: mockLoadPdfDocument,
}));

import { saveCurrentPdf, openPdfIntoCurrentProject } from "./toolbarActions";

describe("toolbarActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectStore.reset();
    annotationStore.clear();
    pdfStore.clear();
    projectStore.folder = "/projects/a";
    projectStore.currentPdf = "図面/A.pdf";
    pdfStore.name = "図面/A.pdf";
    pdfStore.bytes = new Uint8Array([9, 8, 7]);
    annotationStore.dirty = true;
    viewerApi.exportOverlays = vi.fn().mockResolvedValue([
      {
        pageIndex: 0,
        pngBytes: new Uint8Array([1]),
        canvasWidth: 100,
        canvasHeight: 200,
      },
    ]);
    mockEmbedAnnotationPngOnPdf.mockResolvedValue(new Uint8Array([4, 5, 6]));
    mockAppendPhotoPinSlides.mockResolvedValue(new Uint8Array([4, 5, 6]));
    mockLoadPdfDocument.mockResolvedValue({ numPages: 2, destroy: vi.fn() });
    mockPersistCurrentAnnotations.mockResolvedValue(true);
  });

  it("opens PDFs by importing them into the current project", async () => {
    await openPdfIntoCurrentProject();

    expect(mockImportPdfIntoProject).toHaveBeenCalledTimes(1);
  });

  it("surfaces open errors on the status bar instead of rejecting", async () => {
    mockImportPdfIntoProject.mockRejectedValue(new Error("read failed"));

    await expect(openPdfIntoCurrentProject()).resolves.toBeUndefined();

    expect(pdfStore.status).toBe("read failed");
  });

  it("overwrites the open project PDF without a file dialog", async () => {
    mockWriteBinaryFile.mockResolvedValue(undefined);

    const saved = await saveCurrentPdf();

    expect(mockSavePdfToDisk).not.toHaveBeenCalled();
    expect(mockWriteBinaryFile).toHaveBeenCalledWith(
      "/projects/a/図面/A.pdf",
      new Uint8Array([4, 5, 6]),
    );
    expect(mockAppendPhotoPinSlides).toHaveBeenCalledTimes(1);
    expect(mockPersistCurrentAnnotations).toHaveBeenCalledTimes(1);
    expect(annotationStore.dirty).toBe(false);
    expect(pdfStore.status).toBe("");
    expect(saved).toBe(true);
  });

  it("does not write when no PDF is open", async () => {
    pdfStore.bytes = null;

    const saved = await saveCurrentPdf();

    expect(mockWriteBinaryFile).not.toHaveBeenCalled();
    expect(pdfStore.status).toBe("先にPDFを開いてください");
    expect(saved).toBe(false);
  });

  it("does not write when the open PDF has no project path", async () => {
    projectStore.currentPdf = "";

    const saved = await saveCurrentPdf();

    expect(mockWriteBinaryFile).not.toHaveBeenCalled();
    expect(pdfStore.status).toBe("上書き先のPDFがありません");
    expect(saved).toBe(false);
  });

  it("keeps dirty annotations when overwrite fails", async () => {
    mockWriteBinaryFile.mockRejectedValue(new Error("disk full"));

    const saved = await saveCurrentPdf();

    expect(mockPersistCurrentAnnotations).not.toHaveBeenCalled();
    expect(annotationStore.dirty).toBe(true);
    expect(pdfStore.status).toBe("disk full");
    expect(saved).toBe(false);
  });

  it("keeps dirty annotations and persist error when overwrite succeeds but persist fails", async () => {
    mockWriteBinaryFile.mockResolvedValue(undefined);
    mockPersistCurrentAnnotations.mockImplementation(async () => {
      pdfStore.status = "write failed";
      return false;
    });

    const saved = await saveCurrentPdf();

    expect(mockPersistCurrentAnnotations).toHaveBeenCalledTimes(1);
    expect(annotationStore.dirty).toBe(true);
    expect(pdfStore.status).toBe("write failed");
    expect(saved).toBe(false);
  });
});
