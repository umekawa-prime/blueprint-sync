import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockMinimize, mockToggleMaximize, mockClose, mockStartDragging, mockIsTauriRuntime } =
  vi.hoisted(() => ({
    mockMinimize: vi.fn(),
    mockToggleMaximize: vi.fn(),
    mockClose: vi.fn(),
    mockStartDragging: vi.fn(),
    mockIsTauriRuntime: vi.fn(() => true),
  }));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    minimize: mockMinimize,
    toggleMaximize: mockToggleMaximize,
    close: mockClose,
    startDragging: mockStartDragging,
  }),
}));

vi.mock("./platform", () => ({
  isTauriRuntime: () => mockIsTauriRuntime(),
}));

import {
  closeAppWindow,
  minimizeAppWindow,
  startDraggingAppWindow,
  toggleMaximizeAppWindow,
} from "./windowActions";

describe("windowActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTauriRuntime.mockReturnValue(true);
  });

  it("forwards chrome actions to the current Tauri window", async () => {
    await minimizeAppWindow();
    await toggleMaximizeAppWindow();
    await closeAppWindow();
    await startDraggingAppWindow();

    expect(mockMinimize).toHaveBeenCalledOnce();
    expect(mockToggleMaximize).toHaveBeenCalledOnce();
    expect(mockClose).toHaveBeenCalledOnce();
    expect(mockStartDragging).toHaveBeenCalledOnce();
  });

  it("does nothing in the browser", async () => {
    mockIsTauriRuntime.mockReturnValue(false);

    await minimizeAppWindow();
    await toggleMaximizeAppWindow();
    await closeAppWindow();
    await startDraggingAppWindow();

    expect(mockMinimize).not.toHaveBeenCalled();
    expect(mockToggleMaximize).not.toHaveBeenCalled();
    expect(mockClose).not.toHaveBeenCalled();
    expect(mockStartDragging).not.toHaveBeenCalled();
  });
});
