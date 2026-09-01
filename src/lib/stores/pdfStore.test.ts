import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockLoadPdfDocument } = vi.hoisted(() => ({
  mockLoadPdfDocument: vi.fn(),
}));

vi.mock("$lib/utils/pdfRenderer", () => ({
  loadPdfDocument: mockLoadPdfDocument,
}));

import { pdfStore } from "$lib/stores/pdfStore.svelte";

describe("pdfStore.load", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pdfStore.clear();
  });

  it("destroys the previous document and resets the page before opening the next pdf", async () => {
    const order: string[] = [];
    const first = {
      numPages: 5,
      destroy: vi.fn(async () => {
        order.push("destroy");
      }),
    };
    const second = {
      numPages: 1,
      destroy: vi.fn(),
    };

    mockLoadPdfDocument.mockImplementation(async () => {
      order.push("load");
      if (mockLoadPdfDocument.mock.calls.length === 2) {
        expect(pdfStore.document).toBeNull();
        expect(pdfStore.pageIndex).toBe(0);
        return second;
      }
      return first;
    });

    await pdfStore.load("図面/A.pdf", new Uint8Array([1]));
    pdfStore.pageIndex = 4;

    await pdfStore.load("工程表/週間工程.pdf", new Uint8Array([2]));

    expect(first.destroy).toHaveBeenCalled();
    expect(order).toEqual(["load", "destroy", "load"]);
    expect(pdfStore.name).toBe("工程表/週間工程.pdf");
    expect(pdfStore.pageCount).toBe(1);
    expect(pdfStore.pageIndex).toBe(0);
    expect(pdfStore.document).toEqual(second);
  });
});
