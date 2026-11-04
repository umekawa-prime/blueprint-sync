// 仮想パス `fsa://<rootId>/<rel>` を FileSystemDirectoryHandle 上の操作に対応づける。
// ネイティブ（src-tauri/src/lib.rs, sandbox.rs）の挙動をそのまま写す。

export const FSA_SCHEME = "fsa://";

export type RootResolver = (rootId: string) => Promise<FileSystemDirectoryHandle>;

export interface BrowserFs {
  readBytes(path: string): Promise<Uint8Array>;
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
  exists(path: string): Promise<boolean>;
  remove(path: string): Promise<void>;
  removeDirAll(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  copyInto(source: string, folder: string): Promise<string>;
  listProjectPdfs(folder: string): Promise<string[]>;
  listProjectFiles(folder: string): Promise<string[]>;
  initProjectDir(folder: string): Promise<void>;
  ensureDir(path: string): Promise<void>;
}

export function isBrowserFsPath(path: string): boolean {
  return path.startsWith(FSA_SCHEME);
}

export function parseBrowserFsPath(path: string): { rootId: string; segments: string[] } {
  const invalid = () => new Error(`不正なパスです: ${path}`);
  if (!path.startsWith(FSA_SCHEME)) throw invalid();
  let rest = path.slice(FSA_SCHEME.length).replace(/\\/g, "/");
  if (rest.endsWith("/")) rest = rest.slice(0, -1);
  const parts = rest.split("/");
  const [rootId, ...segments] = parts;
  if (!rootId || rootId === "." || rootId === "..") throw invalid();
  if (segments.some((s) => s === "" || s === "." || s === "..")) throw invalid();
  return { rootId, segments };
}

export function joinBrowserFsPath(rootId: string, segments: string[]): string {
  return segments.length === 0 ? `${FSA_SCHEME}${rootId}` : `${FSA_SCHEME}${rootId}/${segments.join("/")}`;
}

function isNotFound(error: unknown): boolean {
  return error instanceof DOMException && (error.name === "NotFoundError" || error.name === "TypeMismatchError");
}

function lowerEndsWith(name: string, suffixes: string[]): boolean {
  const lower = name.toLowerCase();
  return suffixes.some((s) => lower.endsWith(s));
}

function isVisiblePdfName(name: string): boolean {
  return lowerEndsWith(name, [".pdf"]) && !name.startsWith(".");
}

function isVisibleCadName(name: string): boolean {
  return !name.startsWith(".") && lowerEndsWith(name, [".jww", ".jwc", ".dxf", ".dfx"]);
}

function isPackableName(name: string): boolean {
  return name === ".blueprint-sync" || (!name.startsWith(".") && name !== "__MACOSX" && name !== "..");
}

type DirWithEntries = FileSystemDirectoryHandle & {
  entries(): AsyncIterable<[string, FileSystemHandle]>;
};

export function createBrowserFs(resolveRoot: RootResolver): BrowserFs {
  async function walk(
    rootId: string,
    segments: string[],
    create: boolean,
  ): Promise<FileSystemDirectoryHandle> {
    let dir = await resolveRoot(rootId);
    for (const seg of segments) {
      dir = await dir.getDirectoryHandle(seg, { create });
    }
    return dir;
  }

  async function parentOf(path: string, create: boolean) {
    const { rootId, segments } = parseBrowserFsPath(path);
    if (segments.length === 0) throw new Error(`不正なパスです: ${path}`);
    const name = segments[segments.length - 1];
    const dir = await walk(rootId, segments.slice(0, -1), create);
    return { rootId, segments, name, dir };
  }

  async function readBytes(path: string): Promise<Uint8Array> {
    const { name, dir } = await parentOf(path, false);
    const handle = await dir.getFileHandle(name);
    const file = await handle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  }

  async function writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    const { name, dir } = await parentOf(path, true);
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(bytes as unknown as FileSystemWriteChunkType);
    await writable.close();
  }

  async function exists(path: string): Promise<boolean> {
    const { rootId, segments } = parseBrowserFsPath(path);
    try {
      if (segments.length === 0) {
        await resolveRoot(rootId);
        return true;
      }
      const dir = await walk(rootId, segments.slice(0, -1), false);
      const name = segments[segments.length - 1];
      try {
        await dir.getFileHandle(name);
        return true;
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
      await dir.getDirectoryHandle(name);
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }

  async function removeEntry(path: string, recursive: boolean): Promise<void> {
    try {
      const { name, dir } = await parentOf(path, false);
      await dir.removeEntry(name, { recursive });
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }

  async function ensureDir(path: string): Promise<void> {
    const { rootId, segments } = parseBrowserFsPath(path);
    await walk(rootId, segments, true);
  }

  async function rename(from: string, to: string): Promise<void> {
    const a = parseBrowserFsPath(from);
    const b = parseBrowserFsPath(to);
    if (joinBrowserFsPath(a.rootId, a.segments) === joinBrowserFsPath(b.rootId, b.segments)) return;
    const sameParent =
      a.rootId === b.rootId &&
      a.segments.length === b.segments.length &&
      a.segments.slice(0, -1).every((s, i) => s === b.segments[i]);
    if (!sameParent || a.segments.length === 0) {
      throw new Error("同じフォルダ内でのみ名前を変更できます");
    }
    if (await exists(to)) throw new Error("同じ名前のファイルが既にあります");
    const bytes = await readBytes(from);
    await writeBytes(to, bytes);
    await removeEntry(from, false);
  }

  async function copyInto(source: string, folder: string): Promise<string> {
    const src = parseBrowserFsPath(source);
    const dst = parseBrowserFsPath(folder);
    if (src.segments.length === 0) throw new Error("ファイル名を取得できません");
    const name = src.segments[src.segments.length - 1];
    const dest = joinBrowserFsPath(dst.rootId, [...dst.segments, name]);
    if (dest === joinBrowserFsPath(src.rootId, src.segments)) return dest;
    if (await exists(dest)) throw new Error("同じ名前のPDFが既にあります");
    await writeBytes(dest, await readBytes(source));
    return dest;
  }

  async function listFilesIn(dir: FileSystemDirectoryHandle): Promise<string[]> {
    const names: string[] = [];
    for await (const [name, handle] of (dir as DirWithEntries).entries()) {
      if (handle.kind === "file") names.push(name);
    }
    return names;
  }

  async function listProjectPdfs(folder: string): Promise<string[]> {
    const { rootId, segments } = parseBrowserFsPath(folder);
    const out: string[] = [];
    const sections: Array<string | null> = [null, "図面", "工程表", "図面JWW"];
    for (const prefix of sections) {
      let dir: FileSystemDirectoryHandle;
      try {
        dir = await walk(rootId, prefix ? [...segments, prefix] : segments, false);
      } catch (error) {
        if (isNotFound(error)) continue;
        throw error;
      }
      for (const name of await listFilesIn(dir)) {
        const visible = isVisiblePdfName(name) || (prefix === "図面JWW" && isVisibleCadName(name));
        if (!visible) continue;
        out.push(prefix ? `${prefix}/${name}` : name);
      }
    }
    return out.sort();
  }

  async function listProjectFiles(folder: string): Promise<string[]> {
    const { rootId, segments } = parseBrowserFsPath(folder);
    const out: string[] = [];
    async function collect(dir: FileSystemDirectoryHandle, prefix: string): Promise<void> {
      for await (const [name, handle] of (dir as DirWithEntries).entries()) {
        if (!isPackableName(name)) continue;
        const rel = prefix ? `${prefix}/${name}` : name;
        if (handle.kind === "directory") {
          await collect(handle as FileSystemDirectoryHandle, rel);
        } else {
          out.push(rel);
        }
      }
    }
    let root: FileSystemDirectoryHandle;
    try {
      root = await walk(rootId, segments, false);
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
    await collect(root, "");
    return out.sort();
  }

  async function initProjectDir(folder: string): Promise<void> {
    const { rootId, segments } = parseBrowserFsPath(folder);
    await walk(rootId, [...segments, ".blueprint-sync", "annotations"], true);
    for (const dir of ["図面", "工程表", "図面JWW"]) {
      await walk(rootId, [...segments, dir], true);
    }
  }

  return {
    readBytes,
    writeBytes,
    exists,
    remove: (path) => removeEntry(path, false),
    removeDirAll: (path) => removeEntry(path, true),
    rename,
    copyInto,
    listProjectPdfs,
    listProjectFiles,
    initProjectDir,
    ensureDir,
  };
}
