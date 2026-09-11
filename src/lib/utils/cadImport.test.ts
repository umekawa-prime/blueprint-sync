import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockInvoke, mockIsTauri, mockDxfToPdf } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockIsTauri: vi.fn(() => true),
  mockDxfToPdf: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("./platform", () => ({
  isTauriRuntime: () => mockIsTauri(),
}));

vi.mock("./dxfToPdf", () => ({
  dxfDocumentToPdf: mockDxfToPdf,
}));

import { cadPdfBasename, convertCadBytesToPdf, isCadDrawingBasename } from "./cadImport";

describe("isCadDrawingBasename", () => {
  it("accepts jww and jwc basenames and rejects nested or hidden names", () => {
    expect(isCadDrawingBasename("1F.jww")).toBe(true);
    expect(isCadDrawingBasename("旧図.JWC")).toBe(true);
    expect(isCadDrawingBasename("A.pdf")).toBe(false);
    expect(isCadDrawingBasename(".hidden.jww")).toBe(false);
    expect(isCadDrawingBasename("nested/a.jww")).toBe(false);
  });
});

describe("cadPdfBasename", () => {
  it("replaces the cad extension with pdf", () => {
    expect(cadPdfBasename("1F.jww")).toBe("1F.pdf");
    expect(cadPdfBasename("旧図.JWC")).toBe("旧図.pdf");
    expect(cadPdfBasename("A.pdf")).toBeNull();
  });
});

describe("convertCadBytesToPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockInvoke.mockResolvedValue({ layers: [], entities: [], blocks: [], unsupported_entities: [] });
    mockDxfToPdf.mockResolvedValue(Uint8Array.from([0x25, 0x50, 0x44, 0x46]));
  });

  it("parses cad bytes and returns a pdf named after the source file", async () => {
    const source = Uint8Array.from([1, 2, 3]);
    const converted = await convertCadBytesToPdf("1F.jww", source);

    expect(mockInvoke).toHaveBeenCalledWith("parse_cad_to_dxf", { bytes: [1, 2, 3] });
    expect(mockDxfToPdf).toHaveBeenCalledTimes(1);
    expect(converted).toEqual({
      pdfName: "1F.pdf",
      bytes: Uint8Array.from([0x25, 0x50, 0x44, 0x46]),
    });
  });

  it("refuses conversion outside the desktop runtime", async () => {
    mockIsTauri.mockReturnValue(false);

    await expect(convertCadBytesToPdf("1F.jww", Uint8Array.from([1]))).rejects.toThrow(
      "JWW/JWC の変換はデスクトップ版で行えます",
    );
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
