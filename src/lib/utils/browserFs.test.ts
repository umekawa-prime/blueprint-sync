import { beforeEach, describe, expect, it } from "vitest";
import { createBrowserFs, parseBrowserFsPath, joinBrowserFsPath, isBrowserFsPath, type BrowserFs } from "./browserFs";
import { createMemoryDirectory, readMemoryTree } from "./testing/memoryDirectoryHandle";

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

describe("browserFs", () => {
  let fs: BrowserFs;
  let root: FileSystemDirectoryHandle;
  beforeEach(() => {
    root = createMemoryDirectory();
    fs = createBrowserFs(async () => root);
  });

  it("rejects paths that escape the chosen folder", () => {
    expect(() => parseBrowserFsPath("fsa://r1/図面/../x.pdf")).toThrow("不正なパスです");
    expect(() => parseBrowserFsPath("fsa://r1//x.pdf")).toThrow("不正なパスです");
    expect(() => parseBrowserFsPath("/home/a/x.pdf")).toThrow("不正なパスです");
    expect(parseBrowserFsPath("fsa://r1/図面\\A.pdf")).toEqual({ rootId: "r1", segments: ["図面", "A.pdf"] });
    expect(parseBrowserFsPath("fsa://r1/")).toEqual({ rootId: "r1", segments: [] });
  });

  it("joins and detects virtual paths", () => {
    expect(joinBrowserFsPath("r1", [])).toBe("fsa://r1");
    expect(joinBrowserFsPath("r1", ["a", "b.pdf"])).toBe("fsa://r1/a/b.pdf");
    expect(isBrowserFsPath("fsa://r1/a")).toBe(true);
    expect(isBrowserFsPath("/a")).toBe(false);
  });

  it("writes nested files and reads them back", async () => {
    await fs.writeBytes("fsa://r1/.blueprint-sync/annotations/a.json", enc("{}"));
    expect(dec(await fs.readBytes("fsa://r1/.blueprint-sync/annotations/a.json"))).toBe("{}");
    expect(await fs.exists("fsa://r1/.blueprint-sync/annotations/a.json")).toBe(true);
    expect(await fs.exists("fsa://r1/missing.pdf")).toBe(false);
    expect(await readMemoryTree(root)).toEqual({ ".blueprint-sync/annotations/a.json": "{}" });
  });

  it("removes files and directories, ignoring missing ones", async () => {
    await fs.writeBytes("fsa://r1/d/a.txt", enc("x"));
    await fs.remove("fsa://r1/d/a.txt");
    await fs.remove("fsa://r1/d/a.txt");
    expect(await fs.exists("fsa://r1/d/a.txt")).toBe(false);
    await fs.writeBytes("fsa://r1/d/b.txt", enc("x"));
    await fs.removeDirAll("fsa://r1/d");
    await fs.removeDirAll("fsa://r1/d");
    expect(await fs.exists("fsa://r1/d")).toBe(false);
  });

  it("lists project files like the native command", async () => {
    for (const p of ["b.pdf", ".hidden.pdf", "note.txt", "図面/Z.pdf", "図面/a.PDF", "図面/.x.pdf",
                     "工程表/週.pdf", "図面JWW/p.jww", "図面JWW/q.pdf", "図面JWW/.r.dxf", "その他/c.pdf"]) {
      await fs.writeBytes(`fsa://r1/${p}`, enc("x"));
    }
    expect(await fs.listProjectPdfs("fsa://r1")).toEqual(
      ["b.pdf", "図面/Z.pdf", "図面/a.PDF", "図面JWW/p.jww", "図面JWW/q.pdf", "工程表/週.pdf"],
    );
  });

  it("lists packable files recursively, keeping .blueprint-sync", async () => {
    for (const p of [".blueprint-sync/project.json", ".git/HEAD", "__MACOSX/x", "図面/A.pdf", "TODO.md"]) {
      await fs.writeBytes(`fsa://r1/${p}`, enc("x"));
    }
    expect(await fs.listProjectFiles("fsa://r1")).toEqual([".blueprint-sync/project.json", "TODO.md", "図面/A.pdf"]);
  });

  it("creates the native project skeleton", async () => {
    await fs.initProjectDir("fsa://r1");
    for (const dir of [".blueprint-sync/annotations", "図面", "工程表", "図面JWW"]) {
      expect(await fs.exists(`fsa://r1/${dir}`)).toBe(true);
    }
  });

  it("renames only within the same folder and refuses collisions", async () => {
    await fs.writeBytes("fsa://r1/図面/A.pdf", enc("a"));
    await fs.writeBytes("fsa://r1/図面/B.pdf", enc("b"));
    await expect(fs.rename("fsa://r1/図面/A.pdf", "fsa://r1/工程表/A.pdf")).rejects.toThrow("同じフォルダ内でのみ名前を変更できます");
    await expect(fs.rename("fsa://r1/図面/A.pdf", "fsa://r1/図面/B.pdf")).rejects.toThrow("同じ名前のファイルが既にあります");
    await fs.rename("fsa://r1/図面/A.pdf", "fsa://r1/図面/C.pdf");
    expect(await fs.exists("fsa://r1/図面/A.pdf")).toBe(false);
    expect(dec(await fs.readBytes("fsa://r1/図面/C.pdf"))).toBe("a");
  });

  it("copies into a folder and refuses name collisions", async () => {
    await fs.writeBytes("fsa://r1/in/A.pdf", enc("a"));
    expect(await fs.copyInto("fsa://r1/in/A.pdf", "fsa://r1/図面")).toBe("fsa://r1/図面/A.pdf");
    await expect(fs.copyInto("fsa://r1/in/A.pdf", "fsa://r1/図面")).rejects.toThrow("同じ名前のPDFが既にあります");
    expect(await fs.copyInto("fsa://r1/図面/A.pdf", "fsa://r1/図面")).toBe("fsa://r1/図面/A.pdf");
  });
});
