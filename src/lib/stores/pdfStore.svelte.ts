import type { PDFDocumentProxy } from "pdfjs-dist";

function destroyDocument(document: PDFDocumentProxy | null) {
  (document as PDFDocumentProxy & { destroy?: () => void } | null)?.destroy?.();
}

class PdfStore {
  name = $state("未読み込み");
  bytes = $state<Uint8Array | null>(null);
  document = $state<PDFDocumentProxy | null>(null);
  pageCount = $state(0);
  pageIndex = $state(0);
  zoom = $state(1);
  status = $state("");
  muteSync = $state(false);

  get pageLabel() {
    if (this.pageCount === 0) {
      return "—";
    }
    return `${this.pageIndex + 1} / ${this.pageCount}`;
  }

  async load(name: string, bytes: Uint8Array) {
    const { loadPdfDocument } = await import("$lib/utils/pdfRenderer");
    destroyDocument(this.document);
    this.name = name;
    this.bytes = bytes;
    this.document = await loadPdfDocument(bytes);
    this.pageCount = this.document.numPages;
    this.pageIndex = 0;
    this.status = "";
  }

  clear() {
    destroyDocument(this.document);
    this.name = "未読み込み";
    this.bytes = null;
    this.document = null;
    this.pageCount = 0;
    this.pageIndex = 0;
    this.status = "";
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
    this.zoom = Math.min(4, Math.max(0.4, Number(zoom.toFixed(2))));
  }
}

export const pdfStore = new PdfStore();
