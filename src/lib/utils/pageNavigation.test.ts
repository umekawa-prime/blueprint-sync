import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockBroadcastPage } = vi.hoisted(() => ({
  mockBroadcastPage: vi.fn(),
}));

vi.mock("./connectionActions", () => ({
  broadcastPage: mockBroadcastPage,
}));

import { pdfStore } from "$lib/stores/pdfStore.svelte";
import { selectPdfPage } from "./pageNavigation";

describe("selectPdfPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pdfStore.clear();
    pdfStore.document = { numPages: 4 } as never;
    pdfStore.pageCount = 4;
    pdfStore.pageIndex = 0;
  });

  it("moves to the requested page and broadcasts that index", async () => {
    await selectPdfPage(2);

    expect(pdfStore.pageIndex).toBe(2);
    expect(mockBroadcastPage).toHaveBeenCalledTimes(1);
    expect(mockBroadcastPage).toHaveBeenCalledWith(2);
  });

  it("clamps past-the-end indexes to the last page", async () => {
    await selectPdfPage(99);

    expect(pdfStore.pageIndex).toBe(3);
    expect(mockBroadcastPage).toHaveBeenCalledWith(3);
  });

  it("does nothing when no document is loaded", async () => {
    pdfStore.document = null;
    pdfStore.pageCount = 0;

    await selectPdfPage(1);

    expect(pdfStore.pageIndex).toBe(0);
    expect(mockBroadcastPage).not.toHaveBeenCalled();
  });
});
