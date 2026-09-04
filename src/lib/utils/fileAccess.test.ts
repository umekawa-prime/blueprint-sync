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

import { imageBlobFromPicked, imageMimeFromName, pickImageFromDisk } from "./fileAccess";

describe("pickImageFromDisk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsesRfd.mockReturnValue(false);
  });

  it("uses the native explorer command on desktop Tauri instead of HTML file input", async () => {
    mockUsesRfd.mockReturnValue(true);
    mockInvoke.mockResolvedValueOnce({
      name: "現場.jpg",
      path: "/mnt/c/Users/me/現場.jpg",
      bytes: [255, 216, 255],
    });

    const picked = await pickImageFromDisk();

    expect(mockInvoke).toHaveBeenCalledWith("pick_image_file");
    expect(picked).toEqual({
      name: "現場.jpg",
      path: "/mnt/c/Users/me/現場.jpg",
      bytes: Uint8Array.from([255, 216, 255]),
    });
  });

  it("returns null when the explorer dialog is cancelled", async () => {
    mockUsesRfd.mockReturnValue(true);
    mockInvoke.mockResolvedValueOnce(null);

    await expect(pickImageFromDisk()).resolves.toBeNull();
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
