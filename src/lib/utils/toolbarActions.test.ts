import { beforeEach, describe, expect, it, vi } from "vitest";
import { annotationStore } from "$lib/stores/annotationStore.svelte";
import { pdfStore } from "$lib/stores/pdfStore.svelte";
import { projectStore } from "$lib/stores/projectStore.svelte";
import { viewerApi } from "$lib/stores/viewerApi";

const {
  mockImportPdfIntoProject,
  mockPersistCurrentAnnotations,
  mockSavePdfToDisk,
  mockEmbedAnnotationPngOnPdf,
  mockSuggestedExportName,
} = vi.hoisted(() => ({
  mockImportPdfIntoProject: vi.fn(),
  mockPersistCurrentAnnotations: vi.fn(),
  mockSavePdfToDisk: vi.fn(),
  mockEmbedAnnotationPngOnPdf: vi.fn(),
  mockSuggestedExportName: vi.fn(),
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

vi.mock("./pdfExport", () => ({
  embedAnnotationPngOnPdf: mockEmbedAnnotationPngOnPdf,
  suggestedExportName: mockSuggestedExportName,
}));

import { exportCurrentPdfToDisk, openPdfIntoCurrentProject } from "./toolbarActions";

describe("toolbarActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectStore.reset();
    annotationStore.clear();
    pdfStore.clear();
    projectStore.folder = "/projects/a";
    pdfStore.name = "A.pdf";
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
    mockSuggestedExportName.mockReturnValue("A-annotated.pdf");
    mockEmbedAnnotationPngOnPdf.mockResolvedValue(new Uint8Array([4, 5, 6]));
  });

  it("opens PDFs by importing them into the current project", async () => {
    await openPdfIntoCurrentProject();

    expect(mockImportPdfIntoProject).toHaveBeenCalledTimes(1);
  });

  it("saves exported PDFs into the project folder and persists annotations", async () => {
    mockSavePdfToDisk.mockResolvedValue(true);
    mockPersistCurrentAnnotations.mockResolvedValue(true);

    await exportCurrentPdfToDisk();

    expect(mockSavePdfToDisk).toHaveBeenCalledWith(
      new Uint8Array([4, 5, 6]),
      "A-annotated.pdf",
      "/projects/a",
    );
    expect(mockPersistCurrentAnnotations).toHaveBeenCalledTimes(1);
    expect(annotationStore.dirty).toBe(false);
    expect(pdfStore.status).toBe("PDFを保存しました");
  });

  it("keeps dirty annotations when PDF export is canceled", async () => {
    mockSavePdfToDisk.mockResolvedValue(false);
    mockPersistCurrentAnnotations.mockResolvedValue(true);

    await exportCurrentPdfToDisk();

    expect(mockPersistCurrentAnnotations).toHaveBeenCalledTimes(1);
    expect(annotationStore.dirty).toBe(true);
    expect(pdfStore.status).toBe("保存をキャンセルしました");
  });

  it("keeps dirty annotations and persist error when export succeeds but persist fails", async () => {
    mockSavePdfToDisk.mockResolvedValue(true);
    mockPersistCurrentAnnotations.mockImplementation(async () => {
      pdfStore.status = "write failed";
      return false;
    });

    await exportCurrentPdfToDisk();

    expect(mockPersistCurrentAnnotations).toHaveBeenCalledTimes(1);
    expect(annotationStore.dirty).toBe(true);
    expect(pdfStore.status).toBe("write failed");
  });

  it("keeps persist error when export is canceled and persist fails", async () => {
    mockSavePdfToDisk.mockResolvedValue(false);
    mockPersistCurrentAnnotations.mockImplementation(async () => {
      pdfStore.status = "write failed";
      return false;
    });

    await exportCurrentPdfToDisk();

    expect(mockPersistCurrentAnnotations).toHaveBeenCalledTimes(1);
    expect(annotationStore.dirty).toBe(true);
    expect(pdfStore.status).toBe("write failed");
  });
});
