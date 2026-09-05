import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockLoadPdfDocument, mockIsTauriRuntime } = vi.hoisted(() => ({
  mockLoadPdfDocument: vi.fn(async () => ({ numPages: 1, destroy: vi.fn() })),
  mockIsTauriRuntime: vi.fn(() => false),
}));

vi.mock("$lib/utils/pdfRenderer", () => ({
  loadPdfDocument: mockLoadPdfDocument,
}));

vi.mock("./platform", () => ({
  isTauriRuntime: () => mockIsTauriRuntime(),
}));

vi.mock("./connectionActions", () => ({
  sendCurrentPdf: vi.fn(),
}));

import { projectStore } from "$lib/stores/projectStore.svelte";
import { pdfStore } from "$lib/stores/pdfStore.svelte";
import { startWebDemo } from "./projectActions";
import { isWebDemo, resetWebDemo } from "./webDemoFs";

describe("startWebDemo", () => {
  beforeEach(() => {
    mockIsTauriRuntime.mockReturnValue(false);
    resetWebDemo();
    projectStore.reset();
    pdfStore.clear();
    mockLoadPdfDocument.mockClear();
  });

  it("opens a demo project and can switch to the added drawing", async () => {
    await startWebDemo();

    expect(isWebDemo()).toBe(true);
    expect(projectStore.isOpen).toBe(true);
    expect(projectStore.tabs).toHaveLength(1);
    expect(projectStore.pdfs).toEqual(["工程表/週間工程.pdf", "図面/既存図.pdf", "図面/追加図.pdf"]);
    expect(projectStore.currentPdf).toBe("図面/既存図.pdf");
    expect(pdfStore.name).toBe("図面/既存図.pdf");

    const { openProjectPdf } = await import("./projectActions");
    await openProjectPdf("図面/追加図.pdf");

    expect(projectStore.currentPdf).toBe("図面/追加図.pdf");
    expect(pdfStore.name).toBe("図面/追加図.pdf");
    expect(mockLoadPdfDocument).toHaveBeenCalledTimes(2);
  });

  it("does not enable in-memory demo when running inside Tauri", async () => {
    mockIsTauriRuntime.mockReturnValue(true);

    await expect(startWebDemo()).rejects.toThrow("デモモードはブラウザ専用です");
    expect(isWebDemo()).toBe(false);
    expect(projectStore.isOpen).toBe(false);
  });
});
