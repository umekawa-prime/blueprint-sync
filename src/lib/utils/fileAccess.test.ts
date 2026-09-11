import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockInvoke, mockUsesRfd } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockUsesRfd: vi.fn(() => false),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("./platform", () => ({
  usesRfdFileDialog: () => mockUsesRfd(),
}));

import {
  imageBlobFromPicked,
  imageMimeFromName,
  openPdfsFromDisk,
  pickImageFromDisk,
  pickImagesFromDisk,
} from "./fileAccess";

describe("pickImagesFromDisk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsesRfd.mockReturnValue(false);
  });

  it("asks the native explorer dialog for multiple images", async () => {
    mockUsesRfd.mockReturnValue(true);
    mockInvoke.mockResolvedValueOnce([
      { name: "現場.jpg", path: "/mnt/c/Users/me/現場.jpg", bytes: [255, 216, 255] },
      { name: "配管.png", path: "/mnt/c/Users/me/配管.png", bytes: [137, 80, 78] },
    ]);

    const picked = await pickImagesFromDisk();

    expect(mockInvoke).toHaveBeenCalledWith("pick_image_files");
    expect(picked).toEqual([
      {
        name: "現場.jpg",
        path: "/mnt/c/Users/me/現場.jpg",
        bytes: Uint8Array.from([255, 216, 255]),
      },
      {
        name: "配管.png",
        path: "/mnt/c/Users/me/配管.png",
        bytes: Uint8Array.from([137, 80, 78]),
      },
    ]);
  });

  it("returns an empty list when the explorer dialog is cancelled", async () => {
    mockUsesRfd.mockReturnValue(true);
    mockInvoke.mockResolvedValueOnce([]);

    await expect(pickImagesFromDisk()).resolves.toEqual([]);
  });
});

describe("pickImageFromDisk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsesRfd.mockReturnValue(false);
  });

  it("uses the native explorer command on desktop Tauri instead of HTML file input", async () => {
    mockUsesRfd.mockReturnValue(true);
    mockInvoke.mockResolvedValueOnce([
      {
        name: "現場.jpg",
        path: "/mnt/c/Users/me/現場.jpg",
        bytes: [255, 216, 255],
      },
    ]);

    const picked = await pickImageFromDisk();

    expect(mockInvoke).toHaveBeenCalledWith("pick_image_files");
    expect(picked).toEqual({
      name: "現場.jpg",
      path: "/mnt/c/Users/me/現場.jpg",
      bytes: Uint8Array.from([255, 216, 255]),
    });
  });

  it("returns null when the explorer dialog is cancelled", async () => {
    mockUsesRfd.mockReturnValue(true);
    mockInvoke.mockResolvedValueOnce([]);

    await expect(pickImageFromDisk()).resolves.toBeNull();
  });
});

describe("openPdfsFromDisk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsesRfd.mockReturnValue(false);
  });

  it("asks the native explorer dialog for multiple pdfs and zips", async () => {
    mockUsesRfd.mockReturnValue(true);
    mockInvoke.mockResolvedValueOnce([
      { name: "1F.pdf", path: "/mnt/c/Users/me/1F.pdf" },
      { name: "2F.pdf", path: "/mnt/c/Users/me/2F.pdf" },
    ]);

    const picked = await openPdfsFromDisk();

    expect(mockInvoke).toHaveBeenCalledWith("pick_pdf_files");
    expect(picked).toEqual([
      { name: "1F.pdf", path: "/mnt/c/Users/me/1F.pdf", bytes: new Uint8Array() },
      { name: "2F.pdf", path: "/mnt/c/Users/me/2F.pdf", bytes: new Uint8Array() },
    ]);
  });

  it("returns an empty list when the explorer dialog is cancelled", async () => {
    mockUsesRfd.mockReturnValue(true);
    mockInvoke.mockResolvedValueOnce([]);

    await expect(openPdfsFromDisk()).resolves.toEqual([]);
  });
});

describe("imageMimeFromName", () => {
  it("maps common image extensions so the canvas can decode the bytes", () => {
    expect(imageMimeFromName("a.PNG")).toBe("image/png");
    expect(imageMimeFromName("a.jpg")).toBe("image/jpeg");
    expect(imageMimeFromName("a.jpeg")).toBe("image/jpeg");
    expect(imageMimeFromName("a.webp")).toBe("image/webp");
    expect(imageMimeFromName("a.gif")).toBe("image/gif");
    expect(imageMimeFromName("a.bmp")).toBe("image/bmp");
  });
});

describe("imageBlobFromPicked", () => {
  it("wraps picked bytes with the mime inferred from the file name", () => {
    const blob = imageBlobFromPicked({
      name: "pin.png",
      bytes: Uint8Array.from([1, 2, 3]),
    });
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(3);
  });
});
