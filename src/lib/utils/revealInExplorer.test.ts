import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockReveal, mockDesktop } = vi.hoisted(() => ({
  mockReveal: vi.fn(),
  mockDesktop: vi.fn(() => true),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  revealItemInDir: mockReveal,
}));

vi.mock("./platform", () => ({
  isDesktopTauriRuntime: () => mockDesktop(),
}));

import { revealProjectFileInExplorer } from "./revealInExplorer";

describe("revealProjectFileInExplorer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDesktop.mockReturnValue(true);
    mockReveal.mockResolvedValue(undefined);
  });

  it("reveals the project file in the desktop file explorer", async () => {
    await revealProjectFileInExplorer("C:/projects/現場A", "図面/1F.pdf");
    expect(mockReveal).toHaveBeenCalledWith("C:/projects/現場A/図面/1F.pdf");
  });

  it("refuses to reveal a file outside the desktop runtime", async () => {
    mockDesktop.mockReturnValue(false);
    await expect(revealProjectFileInExplorer("C:/projects/現場A", "図面/1F.pdf")).rejects.toThrow(
      "エクスプローラーで表示はデスクトップ版で使えます",
    );
    expect(mockReveal).not.toHaveBeenCalled();
  });

  it("refuses a path that is not a project file", async () => {
    await expect(revealProjectFileInExplorer("C:/projects/現場A", "../secret.pdf")).rejects.toThrow(
      "ファイルパスが不正です",
    );
    expect(mockReveal).not.toHaveBeenCalled();
  });
});
