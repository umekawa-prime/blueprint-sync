// テスト専用: File System Access API のディレクトリハンドルをメモリ上で再現する。

type MemFile = { kind: "file"; name: string; data: Uint8Array; lastModified: number };
type MemDir = {
  kind: "directory";
  name: string;
  children: Map<string, MemFile | MemDir>;
  permission: PermissionState;
  onRequest?: PermissionState;
};

const notFound = (name: string) => new DOMException(`${name} が見つかりません`, "NotFoundError");

function toBytes(chunk: unknown): Uint8Array {
  if (typeof chunk === "string") return new TextEncoder().encode(chunk);
  if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk.slice(0));
  if (ArrayBuffer.isView(chunk)) {
    return new Uint8Array(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength));
  }
  throw new TypeError("unsupported chunk");
}

function fileHandle(file: MemFile): FileSystemFileHandle {
  const handle = {
    kind: "file" as const,
    name: file.name,
    async getFile() {
      const copy = file.data.slice();
      return {
        name: file.name,
        size: copy.byteLength,
        lastModified: file.lastModified,
        async arrayBuffer() {
          return copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength);
        },
        async text() {
          return new TextDecoder().decode(copy);
        },
      } as unknown as File;
    },
    async createWritable() {
      let buffer: Uint8Array = new Uint8Array(0);
      return {
        async write(chunk: unknown) {
          const next = toBytes(chunk);
          const merged = new Uint8Array(buffer.length + next.length);
          merged.set(buffer);
          merged.set(next, buffer.length);
          buffer = merged;
        },
        async close() {
          file.data = buffer;
          file.lastModified = Date.now();
        },
      } as unknown as FileSystemWritableFileStream;
    },
  };
  return handle as unknown as FileSystemFileHandle;
}

function dirHandle(dir: MemDir): FileSystemDirectoryHandle {
  const handle = {
    kind: "directory" as const,
    name: dir.name,
    __dir: dir,
    async getDirectoryHandle(name: string, options?: { create?: boolean }) {
      const existing = dir.children.get(name);
      if (existing) {
        if (existing.kind !== "directory") throw new DOMException("型が一致しません", "TypeMismatchError");
        return dirHandle(existing);
      }
      if (!options?.create) throw notFound(name);
      const created: MemDir = { kind: "directory", name, children: new Map(), permission: "granted" };
      dir.children.set(name, created);
      return dirHandle(created);
    },
    async getFileHandle(name: string, options?: { create?: boolean }) {
      const existing = dir.children.get(name);
      if (existing) {
        if (existing.kind !== "file") throw new DOMException("型が一致しません", "TypeMismatchError");
        return fileHandle(existing);
      }
      if (!options?.create) throw notFound(name);
      const created: MemFile = { kind: "file", name, data: new Uint8Array(0), lastModified: Date.now() };
      dir.children.set(name, created);
      return fileHandle(created);
    },
    async removeEntry(name: string, options?: { recursive?: boolean }) {
      const existing = dir.children.get(name);
      if (!existing) throw notFound(name);
      if (existing.kind === "directory" && existing.children.size > 0 && !options?.recursive) {
        throw new DOMException("ディレクトリが空ではありません", "InvalidModificationError");
      }
      dir.children.delete(name);
    },
    async *entries() {
      for (const [name, child] of [...dir.children]) {
        yield [name, child.kind === "directory" ? dirHandle(child) : fileHandle(child)] as const;
      }
    },
    async isSameEntry(other: unknown) {
      return (other as { __dir?: MemDir } | null)?.__dir === dir;
    },
    async queryPermission() {
      return dir.permission;
    },
    async requestPermission() {
      return dir.onRequest ?? dir.permission;
    },
  };
  return handle as unknown as FileSystemDirectoryHandle;
}

export function createMemoryDirectory(name = "root"): FileSystemDirectoryHandle {
  return dirHandle({ kind: "directory", name, children: new Map(), permission: "granted" });
}

/** テストから権限状態を切り替える。requestPermission は onRequest（無ければ現在の状態）を返す。 */
export function setPermission(
  dir: FileSystemDirectoryHandle,
  state: PermissionState,
  opts?: { onRequest?: PermissionState },
): void {
  const inner = (dir as unknown as { __dir: MemDir }).__dir;
  inner.permission = state;
  inner.onRequest = opts?.onRequest;
}

/** 相対パス → UTF-8 文字列。テストの検証用。 */
export async function readMemoryTree(
  dir: FileSystemDirectoryHandle,
  prefix = "",
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const iter = (dir as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries();
  for await (const [name, child] of iter) {
    const rel = prefix ? `${prefix}/${name}` : name;
    if (child.kind === "directory") {
      Object.assign(out, await readMemoryTree(child as FileSystemDirectoryHandle, rel));
    } else {
      const file = await (child as FileSystemFileHandle).getFile();
      out[rel] = new TextDecoder().decode(await file.arrayBuffer());
    }
  }
  return out;
}
