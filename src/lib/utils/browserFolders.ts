// ブラウザ版: フォルダハンドル・権限・最近使った項目を IndexedDB に保存する。

import { createBrowserFs, FSA_SCHEME, parseBrowserFsPath, type BrowserFs } from "./browserFs";

export type FolderAccess = "granted" | "prompt" | "denied" | "missing";

const DB_NAME = "blueprint-sync-web";
const HANDLES = "handles";
const KV = "kv";

type WebValueKey = "recents" | "session";

// 同一セッション内の解決用キャッシュ。IndexedDB へは構造化複製で保存する（実ブラウザ）。
const handleCache = new Map<string, FileSystemDirectoryHandle>();

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(HANDLES)) db.createObjectStore(HANDLES);
        if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

async function idbRequest<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = run(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result as T);
    tx.onerror = () => reject(tx.error ?? req.error);
    tx.onabort = () => reject(tx.error ?? req.error);
  });
}

export async function registerRootHandle(handle: FileSystemDirectoryHandle): Promise<string> {
  const rootId = crypto.randomUUID();
  handleCache.set(rootId, handle);
  try {
    await idbRequest(HANDLES, "readwrite", (s) => s.put(handle, rootId));
  } catch {
    // 構造化複製できないハンドル（テスト用など）はセッション内キャッシュのみで扱う。
  }
  return `${FSA_SCHEME}${rootId}`;
}

export async function resolveRootHandle(rootId: string): Promise<FileSystemDirectoryHandle> {
  const cached = handleCache.get(rootId);
  if (cached) return cached;
  let stored: FileSystemDirectoryHandle | undefined;
  try {
    stored = await idbRequest<FileSystemDirectoryHandle | undefined>(HANDLES, "readonly", (s) => s.get(rootId));
  } catch {
    stored = undefined;
  }
  if (!stored) throw new Error("フォルダが見つかりません。もう一度選んでください");
  handleCache.set(rootId, stored);
  return stored;
}

type PermissionHandle = FileSystemDirectoryHandle & {
  queryPermission(d: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(d: { mode: "readwrite" }): Promise<PermissionState>;
};

export async function folderAccess(path: string, request: boolean): Promise<FolderAccess> {
  let handle: PermissionHandle;
  try {
    const { rootId } = parseBrowserFsPath(path);
    handle = (await resolveRootHandle(rootId)) as PermissionHandle;
  } catch {
    return "missing";
  }
  const descriptor = { mode: "readwrite" as const };
  let state = await handle.queryPermission(descriptor);
  if (state === "prompt" && request) state = await handle.requestPermission(descriptor);
  return state;
}

export async function browserFolderName(path: string): Promise<string> {
  const { rootId, segments } = parseBrowserFsPath(path);
  if (segments.length > 0) return segments[segments.length - 1];
  return (await resolveRootHandle(rootId)).name;
}

export async function pickBrowserFolder(): Promise<string | null> {
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    return await registerRootHandle(handle);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return null;
    throw e;
  }
}

export async function loadWebValue<T>(key: WebValueKey, fallback: T): Promise<T> {
  try {
    const value = await idbRequest<T | undefined>(KV, "readonly", (s) => s.get(key));
    return value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

export async function saveWebValue(key: WebValueKey, value: unknown): Promise<void> {
  await idbRequest(KV, "readwrite", (s) => s.put(value, key));
}

export const browserFs: BrowserFs = createBrowserFs(resolveRootHandle);

export async function resetBrowserFoldersForTest(): Promise<void> {
  handleCache.clear();
  await idbRequest(HANDLES, "readwrite", (s) => s.clear());
  await idbRequest(KV, "readwrite", (s) => s.clear());
}
