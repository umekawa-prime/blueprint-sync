import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockInvoke, mockIsTauri } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockIsTauri: vi.fn(() => true),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("./platform", () => ({
  isTauriRuntime: () => mockIsTauri(),
}));

import {
  bytesForStandaloneViewer,
  cadPdfBasename,
  convertCadBytesToPdf,
  isCadDrawingBasename,
  openCadFileInJwCad,
} from "./cadImport";

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
    mockInvoke.mockResolvedValue([0x25, 0x50, 0x44, 0x46]);
  });

  it("asks rust to convert cad bytes and names the pdf after the source file", async () => {
    const source = Uint8Array.from([1, 2, 3]);
    const converted = await convertCadBytesToPdf("1F.jww", source);

    expect(mockInvoke).toHaveBeenCalledWith("convert_cad_to_pdf", { bytes: [1, 2, 3] });
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

describe("bytesForStandaloneViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockInvoke.mockResolvedValue([0x25, 0x50, 0x44, 0x46]);
  });

  it("converts a dropped jww to pdf bytes instead of loading the cad file as a pdf", async () => {
    const loaded = await bytesForStandaloneViewer("03_平面図0829_配布用.jww", Uint8Array.from([1, 2]));
    expect(mockInvoke).toHaveBeenCalledWith("convert_cad_to_pdf", { bytes: [1, 2] });
    expect(loaded).toEqual({
      name: "03_平面図0829_配布用.pdf",
      bytes: Uint8Array.from([0x25, 0x50, 0x44, 0x46]),
    });
  });

  it("passes a regular pdf through unchanged", async () => {
    const source = Uint8Array.from([0x25, 0x50, 0x44, 0x46]);
    await expect(bytesForStandaloneViewer("A.pdf", source)).resolves.toEqual({
      name: "A.pdf",
      bytes: source,
    });
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

describe("openCadFileInJwCad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockInvoke.mockResolvedValue(undefined);
  });

  it("asks rust to open the project cad file in Jw_cad", async () => {
    await openCadFileInJwCad("C:/projects/a/図面JWW/1F.jww");
    expect(mockInvoke).toHaveBeenCalledWith("open_cad_in_jwcad", {
      path: "C:/projects/a/図面JWW/1F.jww",
    });
  });

  it("refuses to launch Jw_cad outside the desktop runtime", async () => {
    mockIsTauri.mockReturnValue(false);
    await expect(openCadFileInJwCad("C:/projects/a/図面JWW/1F.jww")).rejects.toThrow(
      "Jw_cad は Windows のデスクトップ版で開けます",
    );
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
