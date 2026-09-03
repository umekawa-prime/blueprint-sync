import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectMeta } from "./projectFormat";

const { mockInvoke, mockIsTauriRuntime } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockIsTauriRuntime: vi.fn(() => false),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("./platform", () => ({
  isTauriRuntime: () => mockIsTauriRuntime(),
  usesRfdFileDialog: () => mockIsTauriRuntime(),
}));

import {
  annotationPath,
  copyFileIntoFolder,
  deleteFile,
  initProjectDir,
  listProjectPdfs,
  loadRecentProjects,
  moveFileIntoFolder,
  pathExists,
  pickFolder,
  projectJsonPath,
  readAnnotationFile,
  readBinaryFile,
  readProjectMeta,
  readTextFile,
  saveRecentProjects,
  writeAnnotationFile,
  writeProjectMeta,
  writeTextFile,
} from "./projectIo";
import { enableWebDemo, resetWebDemo } from "./webDemoFs";

function sampleMeta(): ProjectMeta {
  return {
    id: "project-1",
    name: "現場A",
    createdAt: "2026-08-30T08:00:00.000Z",
    links: [{ id: "link-1", title: "共有", url: "https://example.com" }],
  };
}

describe("projectIo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTauriRuntime.mockReturnValue(false);
    resetWebDemo();
  });

  it("keeps using Tauri file commands even if the web demo flag was left on", async () => {
    mockIsTauriRuntime.mockReturnValue(true);
    enableWebDemo();
    mockInvoke.mockResolvedValueOnce("/picked");

    await expect(pickFolder()).resolves.toBe("/picked");
    expect(mockInvoke).toHaveBeenCalledWith("pick_folder");
  });

  it("uses the documented project paths", () => {
    expect(projectJsonPath("C:\\work\\proj")).toBe("C:\\work\\proj/.blueprint-sync/project.json");
    expect(annotationPath("/work/proj", "A.pdf")).toBe(
      "/work/proj/.blueprint-sync/annotations/A.pdf.json",
    );
    expect(annotationPath("/work/proj", "図面/A.pdf")).toBe(
      "/work/proj/.blueprint-sync/annotations/図面__A.pdf.json",
    );
  });

  it("forwards simple tauri commands", async () => {
    mockInvoke
      .mockResolvedValueOnce("/picked")
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(["A.pdf"])
      .mockResolvedValueOnce("A.pdf")
      .mockResolvedValueOnce([{ name: "現場A", path: "/picked" }])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(true);

    await expect(pickFolder()).resolves.toBe("/picked");
    await expect(initProjectDir("/picked")).resolves.toBeUndefined();
    await expect(listProjectPdfs("/picked")).resolves.toEqual(["A.pdf"]);
    await expect(copyFileIntoFolder("/src/A.pdf", "/picked")).resolves.toBe("A.pdf");
    await expect(loadRecentProjects()).resolves.toEqual([{ name: "現場A", path: "/picked" }]);
    await expect(saveRecentProjects([{ name: "現場A", path: "/picked" }])).resolves.toBeUndefined();
    await expect(pathExists("/picked")).resolves.toBe(true);
  });

  it("reads and writes UTF-8 text through byte commands", async () => {
    mockInvoke
      .mockResolvedValueOnce(Array.from(new TextEncoder().encode("現場A")))
      .mockResolvedValueOnce(undefined);

    await expect(readTextFile("/tmp/project.json")).resolves.toBe("現場A");
    await expect(writeTextFile("/tmp/project.json", "現場A")).resolves.toBeUndefined();

    expect(mockInvoke).toHaveBeenNthCalledWith(1, "read_file_bytes", { path: "/tmp/project.json" });
    expect(mockInvoke).toHaveBeenNthCalledWith(2, "write_file_bytes", {
      path: "/tmp/project.json",
      bytes: Array.from(new TextEncoder().encode("現場A")),
    });
  });

  it("moves a file by copying first and deleting the source only after copy succeeds", async () => {
    mockInvoke
      .mockResolvedValueOnce("/projects/a/工程表/工程.pdf")
      .mockResolvedValueOnce(undefined);

    await expect(
      moveFileIntoFolder("/downloads/工程.pdf", "/projects/a/工程表"),
    ).resolves.toBe("/projects/a/工程表/工程.pdf");

    expect(mockInvoke).toHaveBeenNthCalledWith(1, "copy_file_into_folder", {
      source: "/downloads/工程.pdf",
      folder: "/projects/a/工程表",
    });
    expect(mockInvoke).toHaveBeenNthCalledWith(2, "delete_file", {
      path: "/downloads/工程.pdf",
    });
  });

  it("does not delete the source when copy reports the same path", async () => {
    mockInvoke.mockResolvedValueOnce("/projects/a/図面/A.pdf");

    await expect(
      moveFileIntoFolder("/projects/a/図面/A.pdf", "/projects/a/図面"),
    ).resolves.toBe("/projects/a/図面/A.pdf");

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith("copy_file_into_folder", {
      source: "/projects/a/図面/A.pdf",
      folder: "/projects/a/図面",
    });
  });

  it("does not delete the source when copy fails", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("同じ名前のPDFが既にあります"));

    await expect(
      moveFileIntoFolder("/downloads/A.pdf", "/projects/a/図面"),
    ).rejects.toThrow("同じ名前のPDFが既にあります");

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith("copy_file_into_folder", {
      source: "/downloads/A.pdf",
      folder: "/projects/a/図面",
    });
  });

  it("forwards delete_file", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await expect(deleteFile("/tmp/A.pdf")).resolves.toBeUndefined();
    expect(mockInvoke).toHaveBeenCalledWith("delete_file", { path: "/tmp/A.pdf" });
  });

  it("reads binary bytes without decoding", async () => {
    mockInvoke.mockResolvedValueOnce([0, 255, 1]);

    await expect(readBinaryFile("/tmp/A.pdf")).resolves.toEqual(new Uint8Array([0, 255, 1]));
  });

  it("round-trips project metadata through project.json", async () => {
    const meta = sampleMeta();
    mockInvoke
      .mockResolvedValueOnce(Array.from(new TextEncoder().encode(JSON.stringify(meta))))
      .mockResolvedValueOnce(undefined);

    await expect(readProjectMeta("/work/proj")).resolves.toEqual(meta);
    await expect(writeProjectMeta("/work/proj", meta)).resolves.toBeUndefined();

    expect(mockInvoke).toHaveBeenNthCalledWith(1, "read_file_bytes", {
      path: "/work/proj/.blueprint-sync/project.json",
    });
    expect(mockInvoke).toHaveBeenNthCalledWith(2, "write_file_bytes", {
      path: "/work/proj/.blueprint-sync/project.json",
      bytes: Array.from(new TextEncoder().encode(JSON.stringify(meta, null, 2))),
    });
  });

  it("returns empty annotations when the persisted file is missing", async () => {
    mockInvoke.mockResolvedValueOnce(false);

    await expect(readAnnotationFile("/work/proj", "A.pdf")).resolves.toEqual({});
  });

  it("parses and writes annotation payloads", async () => {
    mockInvoke
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(
        Array.from(
          new TextEncoder().encode(
            JSON.stringify({
              byPage: { 1: { a: { id: "a", type: "path" } } },
            }),
          ),
        ),
      )
      .mockResolvedValueOnce(undefined);

    await expect(readAnnotationFile("/work/proj", "A.pdf")).resolves.toEqual({
      1: { a: { id: "a", type: "path" } },
    });

    await expect(
      writeAnnotationFile("/work/proj", "A.pdf", {
        2: { b: { id: "b", type: "i-text" } },
      }),
    ).resolves.toBeUndefined();

    expect(mockInvoke).toHaveBeenNthCalledWith(1, "path_exists", {
      path: "/work/proj/.blueprint-sync/annotations/A.pdf.json",
    });
    expect(mockInvoke).toHaveBeenNthCalledWith(2, "read_file_bytes", {
      path: "/work/proj/.blueprint-sync/annotations/A.pdf.json",
    });
    expect(mockInvoke).toHaveBeenNthCalledWith(3, "write_file_bytes", {
      path: "/work/proj/.blueprint-sync/annotations/A.pdf.json",
      bytes: Array.from(
        new TextEncoder().encode(
          JSON.stringify({
            byPage: { 2: { b: { id: "b", type: "i-text" } } },
          }),
        ),
      ),
    });
  });
});
