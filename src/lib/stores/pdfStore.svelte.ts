import type { PDFDocumentProxy } from "pdfjs-dist";
import { clampZoom } from "$lib/utils/mapViewport";

async function destroyDocument(document: PDFDocumentProxy | null) {
  try {
    await (document as PDFDocumentProxy & { destroy?: () => Promise<void> } | null)?.destroy?.();
  } catch {
    // Ignore worker teardown races when switching PDFs.
  }
}

class PdfStore {
  name = $state("未読み込み");
  bytes = $state<Uint8Array | null>(null);
  document = $state<PDFDocumentProxy | null>(null);
  pageCount = $state(0);
  pageIndex = $state(0);
  zoom = $state(1);
  status = $state("");

  get pageLabel() {
    if (this.pageCount === 0) {
      return "—";
    }
    return `${this.pageIndex + 1} / ${this.pageCount}`;
  }

  async load(name: string, bytes: Uint8Array) {
    const { loadPdfDocument } = await import("$lib/utils/pdfRenderer");
    const previous = this.document;
    this.document = null;
    this.pageIndex = 0;
    this.pageCount = 0;
    await destroyDocument(previous);
    this.name = name;
    this.bytes = bytes;
    this.document = await loadPdfDocument(bytes);
    this.pageCount = this.document.numPages;
    this.pageIndex = 0;
    this.status = "";
  }

  clear() {
    const previous = this.document;
    this.document = null;
    this.name = "未読み込み";
    this.bytes = null;
    this.pageCount = 0;
    this.pageIndex = 0;
    this.status = "";
    void destroyDocument(previous);
  }

  async setPage(index: number) {
    if (!this.document) {
      return;
    }
    this.pageIndex = Math.min(Math.max(index, 0), this.pageCount - 1);
  }

  nextPage() {
    void this.setPage(this.pageIndex + 1);
  }

  prevPage() {
    void this.setPage(this.pageIndex - 1);
  }

  setZoom(zoom: number) {
    this.zoom = clampZoom(zoom);
  }
}

export const pdfStore = new PdfStore();
