# Web 版ローカルフォルダ対応（計画 1：フォルダ I/O・自動保存・オフライン起動）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ブラウザ（Chrome / Edge）で、ユーザーが選んだ端末フォルダにネイティブ版と同じ形式でプロジェクトを作成・編集・自動保存でき、オフラインでも起動できるようにする。

**Architecture:** File System Access API のフォルダハンドルを IndexedDB に保存し、`fsa://<rootId>/<相対パス>` という仮想パスで既存のパス文字列ベースの I/O（`projectIo.ts`）に第 3 の実装として差し込む。呼び出し側（`projectActions.ts` など）は仮想パスをそのまま扱う。自動保存・タブ排他・Service Worker は Web 実行時だけ有効にし、Tauri の挙動は変えない。

**Tech Stack:** Svelte 5 / SvelteKit（adapter-static, SPA）/ TypeScript / Vitest（jsdom）/ File System Access API / IndexedDB / Web Locks API / SvelteKit `src/service-worker.ts`

**Spec:** `docs/superpowers/specs/2026-11-04-web-local-folder-design.md`

**範囲外（別計画）:** 計画 2＝CAD（JWW/JWC/DXF）の WebAssembly 化（§5）。計画 3＝OneDrive の Web 対応と中継（§6、AGENTS.md 追記を含む）。この計画では Web 版の CAD 取り込みは既存どおり「Tauri アプリでのみ」のエラーのまま、OneDrive も既存挙動のままでよい。

## Global Constraints

- 対象ブラウザは Chrome 系（ChromeOS Flex の Chrome、Windows の Chrome / Edge）。`showDirectoryPicker` がない環境では「Chrome または Edge で開いてください」と案内し、デモだけ使える。
- フォルダの中身はネイティブ版と同じ形式（`.blueprint-sync/project.json`、`.blueprint-sync/annotations/`、`図面/`、`工程表/`、`図面JWW/`、`TODO.md`、`NOTE.md`）。一覧・名前衝突・リネームの規則は Rust 実装（`src-tauri/src/lib.rs` の `list_project_pdfs` / `copy_file_into_folder` / `rename_file`、`sandbox.rs` の `list_project_files`）と同じにする。
- 選んだフォルダの外に書き込まない（仮想パスの `..`・空セグメント・絶対パスは拒否）。
- 同時に開くのは 1 か所だけ。ブラウザの別タブで同じフォルダを開こうとしたら開かせない。衝突検出はしない。
- Web 版のみ自動保存（変更から 1500ms でまとめて保存）＋未保存時の離脱警告。ネイティブ版の保存タイミングは変えない。
- オフラインでも起動必須。Service Worker は Web 実行時だけ登録し、Tauri では登録しない。新しい版は編集中に勝手にリロードしない。
- 図面データをサーバに置かない。サーバ処理を足さない（OneDrive 中継は計画 3）。
- AGENTS.md の規約：I/O は `src/lib/utils/`、`.svelte` に `invoke` や I/O を足さない、ストアは `*.svelte.ts` クラス＋`$state`、オブジェクトは新しいオブジェクトを代入、Tailwind ユーティリティ、テストは対象の隣に `*.test.ts`。
- 文言は日本語。

## Review Focus

1. **権限が「prompt」に戻ったフォルダ**（ブラウザ再起動後など）：自動で開こうとして失敗・最近使った一覧から消える、ではなく「アクセスを許可」ボタンで再開できること → Task 4 のテスト `keeps prompt-state recents and lists them as awaiting access`。
2. **保存中にさらに編集が来る**：書き込み中の変更が次の保存で必ず反映され、保存が並行・追い越ししないこと → Task 6 のテスト `runs one more save when changes arrive during a save`。
3. **一覧のソート順と隠しファイル**：`.` 始まりのファイルや未対応拡張子が一覧に出ず、並びがネイティブ版（バイト順 `sort()`）と同じこと → Task 1 のテスト `lists project files like the native command`。
4. **`.bpsync.zip` 取り込みで同名フォルダが既にある**：既存フォルダを消さず、別名（`名前 (2)`）で新規作成されること → Task 4 のテスト `installs a bundle into a new uniquely named subfolder`。
5. **保存失敗（権限切れ・容量不足）**：黙らずにステータスバーへ「保存に失敗しました」を出し、`dirty` を残して次の変更で再試行すること → Task 6 のテスト `reports failure and stays dirty`。

---

## File Structure

| ファイル | 役割 |
|---|---|
| `src/lib/utils/browserFs.ts`（新規） | 仮想パスの解析と、フォルダハンドル上の読み書き・一覧・削除・リネーム・初期化。DOM の型だけに依存し、ハンドルの取得は `browserFolders.ts` に任せる |
| `src/lib/utils/browserFolders.ts`（新規） | フォルダハンドルの登録・取得・権限確認（IndexedDB）、最近使った／セッションの保存（IndexedDB）、フォルダ選択ダイアログ |
| `src/lib/utils/testing/memoryDirectoryHandle.ts`（新規） | テスト用のメモリ上の `FileSystemDirectoryHandle` 実装 |
| `src/lib/utils/folderLock.ts`（新規） | Web Locks によるフォルダ単位の排他 |
| `src/lib/utils/autoSave.ts`（新規） | 遅延・直列化された保存スケジューラ（純粋ロジック） |
| `src/lib/utils/webAutoSave.svelte.ts`（新規） | 自動保存を `annotationStore` と `beforeunload` / `visibilitychange` に結線（Web のみ） |
| `src/lib/stores/autoSaveStore.svelte.ts`（新規） | 保存状態（`idle` / `saving` / `saved` / `error`） |
| `src/lib/utils/pwa.ts`（新規） | Service Worker の登録（Web のみ）とオフライン準備完了の通知 |
| `src/service-worker.ts`（新規） | 事前キャッシュとオフライン応答 |
| `static/manifest.webmanifest`、`static/icons/icon-192.png`、`static/icons/icon-512.png`（新規） | インストール用マニフェストとアイコン |
| `src/lib/utils/platform.ts` | `supportsBrowserFolders()` 追加 |
| `src/lib/utils/projectIo.ts` | 各関数に仮想パス分岐を追加、`ensureFolderAccess` / `browserFolderName` 追加 |
| `src/lib/utils/projectActions.ts` | Web でのプロジェクト作成・オープン・最近使った・セッション復元・一式取り込み・ロック |
| `src/lib/stores/projectStore.svelte.ts` | `awaitingAccess` 追加 |
| `src/lib/stores/annotationStore.svelte.ts` | `editSeq` 追加 |
| `src/lib/components/ProjectHome.svelte`、`ProjectSidebar.svelte`、`StatusBar.svelte` | Web 用 UI |
| `src/routes/+layout.svelte`（無ければ新規）・`src/app.html`・`svelte.config.js` | PWA 結線 |

---

### Task 1: 仮想パスとフォルダ上のファイル操作（`browserFs.ts`）

**Files:**
- Create: `src/lib/utils/testing/memoryDirectoryHandle.ts`
- Create: `src/lib/utils/browserFs.ts`
- Test: `src/lib/utils/browserFs.test.ts`

**Interfaces:**
- Produces（`browserFs.ts`）:
  - `export const FSA_SCHEME = "fsa://";`
  - `export function isBrowserFsPath(path: string): boolean`
  - `export function parseBrowserFsPath(path: string): { rootId: string; segments: string[] }` — `\` は `/` に正規化。`..`・`.`・空セグメント（連続スラッシュ、末尾スラッシュは除去後に判定）を含む、または `fsa://` で始まらない場合は `Error("不正なパスです: <path>")`。
  - `export function joinBrowserFsPath(rootId: string, segments: string[]): string` → `fsa://<rootId>/<seg/...>`（segments 空なら `fsa://<rootId>`）
  - `export type RootResolver = (rootId: string) => Promise<FileSystemDirectoryHandle>;`
  - `export function createBrowserFs(resolveRoot: RootResolver): BrowserFs`
  - `BrowserFs` のメソッド（すべて仮想パスを受け取る）:
    `readBytes(path): Promise<Uint8Array>`、`writeBytes(path, bytes): Promise<void>`（途中のディレクトリを作成）、`exists(path): Promise<boolean>`、`remove(path): Promise<void>`（無ければ何もしない）、`removeDirAll(path): Promise<void>`、`rename(from, to): Promise<void>`、`copyInto(source, folder): Promise<string>`、`listProjectPdfs(folder): Promise<string[]>`、`listProjectFiles(folder): Promise<string[]>`、`initProjectDir(folder): Promise<void>`、`ensureDir(path): Promise<void>`
- Produces（`testing/memoryDirectoryHandle.ts`）: `export function createMemoryDirectory(name = "root"): FileSystemDirectoryHandle` と `export function readMemoryTree(dir): Promise<Record<string, string>>`（相対パス → UTF-8 文字列。テストの検証用）。`getDirectoryHandle` / `getFileHandle`（`{create}`）、`removeEntry`（`{recursive}`）、`entries()`、`getFile()`（`arrayBuffer()` と `lastModified`）、`createWritable()`（`write` / `close`）、`queryPermission` / `requestPermission`（既定 `"granted"`、テストから切替可能な `setPermission(state)` を持つ）を実装。存在しないものは `DOMException("…", "NotFoundError")`。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// browserFs.test.ts（抜粋。各テストは createMemoryDirectory() を root にした createBrowserFs(async () => root) を使う）
it("rejects paths that escape the chosen folder", () => {
  expect(() => parseBrowserFsPath("fsa://r1/図面/../x.pdf")).toThrow("不正なパスです");
  expect(() => parseBrowserFsPath("fsa://r1//x.pdf")).toThrow("不正なパスです");
  expect(() => parseBrowserFsPath("/home/a/x.pdf")).toThrow("不正なパスです");
  expect(parseBrowserFsPath("fsa://r1/図面\\A.pdf")).toEqual({ rootId: "r1", segments: ["図面", "A.pdf"] });
  expect(parseBrowserFsPath("fsa://r1/")).toEqual({ rootId: "r1", segments: [] });
});

it("writes nested files and reads them back", async () => {
  await fs.writeBytes("fsa://r1/.blueprint-sync/annotations/a.json", enc("{}"));
  expect(dec(await fs.readBytes("fsa://r1/.blueprint-sync/annotations/a.json"))).toBe("{}");
  expect(await fs.exists("fsa://r1/.blueprint-sync/annotations/a.json")).toBe(true);
  expect(await fs.exists("fsa://r1/missing.pdf")).toBe(false);
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
```

- [ ] **Step 2: 失敗を確認** — Run: `npx vitest run src/lib/utils/browserFs.test.ts` / Expected: FAIL（モジュールが無い）

- [ ] **Step 3: `memoryDirectoryHandle.ts` と `browserFs.ts` を実装**

  一覧のフィルタは `projectFormat.ts` の既存判定ではなく Rust と同じ規則（ルート直下と `図面`・`工程表` は `.pdf`（大小無視）かつ `.` 始まりでない、`図面JWW` はそれに加えて `.jww/.jwc/.dxf/.dfx`）で書き、最後に `Array.prototype.sort()`（引数なし）で並べる。`listProjectFiles` は Rust `is_packable_name` と同じ（`.blueprint-sync` は含め、他の `.` 始まり・`__MACOSX` は除外）。`rename` は同一親でなければ／宛先が存在すれば上記メッセージで拒否し、新しい名前へ書き込み完了後に元を削除する。`copyInto` は同一パスならそのまま返す。

- [ ] **Step 4: 成功を確認** — Run: `npx vitest run src/lib/utils/browserFs.test.ts` / Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/browserFs.ts src/lib/utils/browserFs.test.ts src/lib/utils/testing/memoryDirectoryHandle.ts
git commit -m "feat(web): add virtual-path file operations over directory handles"
```

---

### Task 2: フォルダハンドルの保存・権限・最近使った（`browserFolders.ts`）

**Files:**
- Modify: `package.json`（devDependencies に `fake-indexeddb`）
- Create: `src/lib/utils/browserFolders.ts`
- Test: `src/lib/utils/browserFolders.test.ts`（先頭で `import "fake-indexeddb/auto";`）

**Interfaces:**
- Consumes: Task 1 の `joinBrowserFsPath`、`parseBrowserFsPath`、`createBrowserFs`
- Produces:
  - `export type FolderAccess = "granted" | "prompt" | "denied" | "missing";`
  - `export async function registerRootHandle(handle: FileSystemDirectoryHandle): Promise<string>` — 新しい `rootId`（`crypto.randomUUID()`）で IndexedDB（DB 名 `blueprint-sync-web`、store `handles`）に保存し、仮想ルートパス `fsa://<rootId>` を返す。
  - `export async function resolveRootHandle(rootId: string): Promise<FileSystemDirectoryHandle>` — 無ければ `Error("フォルダが見つかりません。もう一度選んでください")`。
  - `export async function folderAccess(path: string, request: boolean): Promise<FolderAccess>` — ルートハンドルに `queryPermission({mode:"readwrite"})`、`request` が true かつ `prompt` なら `requestPermission`。ハンドルが無ければ `"missing"`。
  - `export async function browserFolderName(path: string): Promise<string>` — セグメントがあれば最後のセグメント、無ければハンドルの `name`。
  - `export async function pickBrowserFolder(): Promise<string | null>` — `window.showDirectoryPicker({ mode: "readwrite" })`、キャンセル（`AbortError`）は `null`、得たハンドルを `registerRootHandle`。
  - `export async function loadWebValue<T>(key: "recents" | "session", fallback: T): Promise<T>` / `export async function saveWebValue(key, value): Promise<void>`（store `kv`）
  - `export const browserFs: BrowserFs` — `createBrowserFs(resolveRootHandle)`
  - `export function resetBrowserFoldersForTest(): Promise<void>`

- [ ] **Step 1: 失敗するテストを書く**

```ts
it("registers a handle and resolves it by its virtual path", async () => {
  const root = createMemoryDirectory("現場A");
  const path = await registerRootHandle(root);
  expect(path).toMatch(/^fsa:\/\/[0-9a-f-]{36}$/);
  expect(await browserFolderName(path)).toBe("現場A");
  expect(await browserFolderName(`${path}/子`)).toBe("子");
  await browserFs.writeBytes(`${path}/x.txt`, new TextEncoder().encode("x"));
  expect(await readMemoryTree(root)).toEqual({ "x.txt": "x" });
});

it("reports prompt without requesting, and requests when asked", async () => {
  const root = createMemoryDirectory();
  const path = await registerRootHandle(root);
  setPermission(root, "prompt");
  expect(await folderAccess(path, false)).toBe("prompt");
  setPermission(root, "prompt", { onRequest: "granted" });
  expect(await folderAccess(path, true)).toBe("granted");
  expect(await folderAccess("fsa://00000000-0000-0000-0000-000000000000", false)).toBe("missing");
});

it("round-trips recents and session", async () => {
  expect(await loadWebValue("recents", [])).toEqual([]);
  await saveWebValue("recents", [{ name: "A", path: "fsa://x" }]);
  expect(await loadWebValue("recents", [])).toEqual([{ name: "A", path: "fsa://x" }]);
});

it("returns null when the folder dialog is cancelled", async () => {
  window.showDirectoryPicker = vi.fn().mockRejectedValue(new DOMException("x", "AbortError"));
  expect(await pickBrowserFolder()).toBeNull();
});
```

- [ ] **Step 2: 失敗を確認** — Run: `npx vitest run src/lib/utils/browserFolders.test.ts` / Expected: FAIL
- [ ] **Step 3: `npm i -D fake-indexeddb` し、`browserFolders.ts` を実装**（IndexedDB は素の API の小さなラッパで書く。`window.showDirectoryPicker` の型は `src/app.d.ts` に宣言を足す）
- [ ] **Step 4: 成功を確認** — Run: `npx vitest run src/lib/utils/browserFolders.test.ts` / Expected: PASS
- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/app.d.ts src/lib/utils/browserFolders.ts src/lib/utils/browserFolders.test.ts
git commit -m "feat(web): persist folder handles, permissions and recents in IndexedDB"
```

---

### Task 3: `projectIo.ts` に Web 実装を差し込む

**Files:**
- Modify: `src/lib/utils/platform.ts`、`src/lib/utils/projectIo.ts`、`src/lib/utils/projectActions.ts:1067-1097`（`importPickedPdfIntoOpenProject`）
- Test: `src/lib/utils/platform.test.ts`、`src/lib/utils/projectIo.test.ts`

**Interfaces:**
- Consumes: Task 2 の `browserFs`、`pickBrowserFolder`、`folderAccess`、`browserFolderName`、`loadWebValue`、`saveWebValue`
- Produces:
  - `platform.ts`: `export function supportsBrowserFolders(isTauri = isTauriRuntime()): boolean` — `!isTauri && typeof window !== "undefined" && "showDirectoryPicker" in window`
  - `projectIo.ts`: `export async function ensureFolderAccess(folder: string, request: boolean): Promise<FolderAccess>`（仮想パス以外は常に `"granted"`）、`export { browserFolderName }` の再 export
  - 既存関数のシグネチャは変えない。分岐順は「デモ（`useWebDemoFs()`）→ 仮想パス（`isBrowserFsPath(path)`）→ Tauri `invoke`」。
    - `pickFolder()`: デモでなく `supportsBrowserFolders()` なら `pickBrowserFolder()`。
    - `loadRecentProjects` / `saveRecentProjects` / `loadOpenSession` / `saveOpenSession`: Tauri でなくデモでもなければ `loadWebValue` / `saveWebValue`（session は `parseOpenSession` を通す）。
    - `sandboxProjectsDir` / `listSandboxProjects`: Web では使わない（呼ばれたら既存デモ分岐以外は `invoke` のまま。Task 4 で呼ばない）。
- `importPickedPdfIntoOpenProject` の `invoke("write_file_bytes")` 直書きを `writeBinaryFile(destPath, file.bytes)` に置き換える（AGENTS.md 違反の解消。Web でも動く）。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// platform.test.ts
it("offers browser folders only outside Tauri when the picker exists", () => {
  (window as any).showDirectoryPicker = () => {};
  expect(supportsBrowserFolders(false)).toBe(true);
  expect(supportsBrowserFolders(true)).toBe(false);
  delete (window as any).showDirectoryPicker;
  expect(supportsBrowserFolders(false)).toBe(false);
});

// projectIo.test.ts（browserFolders を vi.mock し、browserFs は createMemoryDirectory 上の createBrowserFs を返す）
it("routes fsa paths to the browser folder without calling invoke", async () => {
  await writeProjectMeta("fsa://r1", sampleMeta());
  expect(await readProjectMeta("fsa://r1")).toEqual(sampleMeta());
  expect(await listProjectPdfs("fsa://r1")).toEqual([]);
  expect(mockInvoke).not.toHaveBeenCalled();
});

it("stores recents and session in IndexedDB outside Tauri", async () => {
  await saveRecentProjects([{ name: "A", path: "fsa://r1" }]);
  expect(mockSaveWebValue).toHaveBeenCalledWith("recents", [{ name: "A", path: "fsa://r1" }]);
  mockLoadWebValue.mockResolvedValueOnce({ folders: ["fsa://r1"], activeFolder: "fsa://r1" });
  expect(await loadOpenSession()).toEqual({ folders: ["fsa://r1"], activeFolder: "fsa://r1" });
});

it("treats native paths as always accessible", async () => {
  expect(await ensureFolderAccess("C:/x", true)).toBe("granted");
});
```

- [ ] **Step 2: 失敗を確認** — Run: `npx vitest run src/lib/utils/platform.test.ts src/lib/utils/projectIo.test.ts` / Expected: FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 成功を確認** — Run: `npx vitest run src/lib/utils/platform.test.ts src/lib/utils/projectIo.test.ts src/lib/utils/projectActions.test.ts` / Expected: PASS（既存テストも通る）
- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/platform.ts src/lib/utils/platform.test.ts src/lib/utils/projectIo.ts src/lib/utils/projectIo.test.ts src/lib/utils/projectActions.ts
git commit -m "feat(web): route fsa:// paths in projectIo to browser folders"
```

---

### Task 4: プロジェクトの作成・オープン・復元・一式取り込み・タブ排他（`projectActions.ts`）

**Files:**
- Create: `src/lib/utils/folderLock.ts`、`src/lib/utils/folderLock.test.ts`
- Modify: `src/lib/stores/projectStore.svelte.ts`、`src/lib/utils/projectActions.ts`
- Test: `src/lib/utils/projectActions.test.ts`

**Interfaces:**
- Consumes: Task 3 の `supportsBrowserFolders`、`ensureFolderAccess`、`browserFolderName`
- Produces:
  - `folderLock.ts`: `export async function acquireFolderLock(folder: string): Promise<{ release(): void } | null>` — `navigator.locks.request("blueprint-sync:" + normalizeFsPath(folder), { ifAvailable: true }, cb)`。取れなければ `null`。`navigator.locks` が無い環境では常に成功（何もしないロック）。`export function releaseFolderLock(folder: string): void`（保持中のものを解放）。
  - `projectStore.awaitingAccess = $state<string[]>([])`（権限待ちで再開できていないフォルダ）
  - `projectActions.ts`: `export async function resumeAwaitingProjects(): Promise<void>`（ボタン操作から呼ぶ。各フォルダに `ensureFolderAccess(f, true)`、`granted` なら `openProject(f)`、それ以外は残す）
- 変更点（すべて Web 実行時＝`supportsBrowserFolders()` のときだけ。Tauri 分岐は不変）:
  - `requireTauri()`: `supportsBrowserFolders()` でも許可。メッセージはそのまま。
  - `persistOpenSession()` / `loadRecentsIntoStore()` / `bootstrapOpenSession()`: 早期 return 条件を `!isTauriRuntime() && !supportsBrowserFolders()` に。
  - `loadRecentsIntoStore()`: Web では `pathExists` による削除をしない（権限が無いと確認できないため）。開けなかった時の削除は既存の `openProject` の catch に任せる。
  - `bootstrapOpenSession()`: Web では各フォルダに `ensureFolderAccess(f, false)`。`granted` は従来どおり開く、`prompt` は `projectStore.awaitingAccess` に積む、`denied` / `missing` は飛ばす。
  - `openProject(folder?)`: 冒頭（フォルダ確定後）に `ensureFolderAccess(selected, true)`。`granted` 以外は `Error("フォルダへのアクセスが許可されませんでした")`。続けて `acquireFolderLock(selected)`、`null` なら `Error("このプロジェクトは別のタブで開いています")`（最近使った一覧からは消さない）。
  - `createProject()`: Web では `pickFolder()` の後 `createProjectAt(folder, createProjectMeta(await browserFolderName(folder)))`。ロックも取る。
  - `closeProjectTab()` / `closeProject()`: そのフォルダのロックを解放。
  - `installBundle(meta, files, overwrite)`: Web では `pickFolder()` で親を選ばせ、`<親>/<meta.name>`、存在すれば `<meta.name> (2)`、`(3)`… の最初の空き名に展開する。`overwrite` でも削除しない。`importIncomingFile` の `existingIds` は Web では `[]`（＝常に新規扱い）。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// folderLock.test.ts（navigator.locks をメモリ実装でモック）
it("lets only one holder lock a folder until released", async () => {
  const first = await acquireFolderLock("fsa://r1");
  expect(first).not.toBeNull();
  expect(await acquireFolderLock("fsa://r1/")).toBeNull();
  first!.release();
  expect(await acquireFolderLock("fsa://r1")).not.toBeNull();
});

// projectActions.test.ts（既存のモック群に supportsBrowserFolders / ensureFolderAccess / browserFolderName / acquireFolderLock を追加）
it("keeps prompt-state recents and lists them as awaiting access", async () => {
  mockSupportsBrowserFolders.mockReturnValue(true);
  mockLoadRecentProjects.mockResolvedValue([{ name: "A", path: "fsa://a" }]);
  mockLoadOpenSession.mockResolvedValue({ folders: ["fsa://a"], activeFolder: "fsa://a" });
  mockEnsureFolderAccess.mockResolvedValue("prompt");
  await bootstrapOpenSession();
  expect(projectStore.recents.map((r) => r.path)).toEqual(["fsa://a"]);
  expect(projectStore.awaitingAccess).toEqual(["fsa://a"]);
  expect(projectStore.tabs).toEqual([]);
  expect(mockPathExists).not.toHaveBeenCalled();
});

it("opens awaiting projects after the user grants access", async () => {
  projectStore.awaitingAccess = ["fsa://a"];
  mockEnsureFolderAccess.mockResolvedValue("granted");
  mockReadProjectMeta.mockResolvedValue(sampleMeta());
  await resumeAwaitingProjects();
  expect(mockEnsureFolderAccess).toHaveBeenCalledWith("fsa://a", true);
  expect(projectStore.folder).toBe("fsa://a");
  expect(projectStore.awaitingAccess).toEqual([]);
});

it("refuses to open a folder another tab holds", async () => {
  mockSupportsBrowserFolders.mockReturnValue(true);
  mockEnsureFolderAccess.mockResolvedValue("granted");
  mockAcquireFolderLock.mockResolvedValue(null);
  projectStore.recents = [{ name: "A", path: "fsa://a" }];
  await expect(openProject("fsa://a")).rejects.toThrow("このプロジェクトは別のタブで開いています");
  expect(projectStore.recents.map((r) => r.path)).toEqual(["fsa://a"]);
});

it("names a new web project after the chosen folder", async () => {
  mockSupportsBrowserFolders.mockReturnValue(true);
  mockPickFolder.mockResolvedValue("fsa://new");
  mockBrowserFolderName.mockResolvedValue("現場B");
  await createProject();
  expect(mockWriteProjectMeta).toHaveBeenCalledWith("fsa://new", expect.objectContaining({ name: "現場B" }));
});

it("installs a bundle into a new uniquely named subfolder", async () => {
  mockSupportsBrowserFolders.mockReturnValue(true);
  mockPickFolder.mockResolvedValue("fsa://parent");
  mockPathExists.mockImplementation(async (p: string) => p === "fsa://parent/現場A");
  // planIncoming が install-project を返す .bpsync.zip を渡す（既存テストのバンドル作成ヘルパを使う）
  await importIncomingFile("現場A.bpsync.zip", bundleBytes({ name: "現場A" }), true);
  expect(mockRemoveDirAll).not.toHaveBeenCalled();
  expect(mockInitProjectDir).toHaveBeenCalledWith("fsa://parent/現場A (2)");
});
```

- [ ] **Step 2: 失敗を確認** — Run: `npx vitest run src/lib/utils/folderLock.test.ts src/lib/utils/projectActions.test.ts` / Expected: FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 成功を確認** — Run: `npx vitest run src/lib/utils/folderLock.test.ts src/lib/utils/projectActions.test.ts` / Expected: PASS
- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/folderLock.ts src/lib/utils/folderLock.test.ts src/lib/stores/projectStore.svelte.ts src/lib/utils/projectActions.ts src/lib/utils/projectActions.test.ts
git commit -m "feat(web): open, create, restore and import projects in browser folders"
```

---

### Task 5: ホーム画面とネイティブ専用 UI の出し分け

**Files:**
- Modify: `src/lib/components/ProjectHome.svelte`、`src/lib/components/ProjectSidebar.svelte`
- Test: `src/routes/page.layout.test.ts`（既存の「ソースを読んで文字列を確認する」流儀）

**Interfaces:**
- Consumes: `supportsBrowserFolders`（Task 3）、`resumeAwaitingProjects`、`projectStore.awaitingAccess`（Task 4）、既存 `createProject` / `openProject` / `startWebDemo`

ホーム画面の分岐（上から評価）:
1. `!ready` → 既存「起動しています…」
2. `supportsBrowserFolders()` → ネイティブ（rfd）版と同じ「フォルダを開く」「新規プロジェクト（フォルダを選ぶ）」「一式を取り込む」ボタン群と最近使った一覧。`projectStore.awaitingAccess.length > 0` のとき一番上に「前回のプロジェクトを再開（フォルダへのアクセスを許可）」ボタン（`resumeAwaitingProjects`）。その下に小さく「ブラウザで操作確認（デモ）」ボタン。
3. `shouldOfferBrowserDemo(tauri)`（＝フォルダ非対応ブラウザ）→ 文言を「このブラウザではフォルダを開けません。Chrome または Edge で開いてください。」に変え、デモボタンだけ出す。
4. 以降は既存（sandbox / rfd）。

ネイティブ専用：最近使った一覧の「Cursor で開く」（`ProjectHome.svelte:134` 付近）と、サイドバーの「エクスプローラーで表示」（`revealProjectFileInExplorer`）を `isTauriRuntime()` のときだけ表示する。

- [ ] **Step 1: 失敗するテストを書く**

```ts
it("offers folder actions and an access prompt in supporting browsers", () => {
  const home = readFileSync(path.resolve("src/lib/components/ProjectHome.svelte"), "utf8");
  expect(home).toContain("supportsBrowserFolders");
  expect(home).toContain("resumeAwaitingProjects");
  expect(home).toContain("前回のプロジェクトを再開（フォルダへのアクセスを許可）");
  expect(home).toContain("このブラウザではフォルダを開けません。Chrome または Edge で開いてください。");
  expect(home).not.toContain("フォルダ選択は Tauri アプリ上のみです");
});

it("hides native-only actions outside Tauri", () => {
  const home = readFileSync(path.resolve("src/lib/components/ProjectHome.svelte"), "utf8");
  const sidebar = readFileSync(path.resolve("src/lib/components/ProjectSidebar.svelte"), "utf8");
  expect(home).toMatch(/\{#if tauri\}[\s\S]*openFolderInCursor/);
  expect(sidebar).toMatch(/isTauriRuntime\(\)[\s\S]*revealProjectFileInExplorer/);
});
```

- [ ] **Step 2: 失敗を確認** — Run: `npx vitest run src/routes/page.layout.test.ts` / Expected: FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 成功を確認** — Run: `npx vitest run src/routes/page.layout.test.ts && npm run check` / Expected: PASS、`npm run check` のエラー数が作業前（47）から増えていない
- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ProjectHome.svelte src/lib/components/ProjectSidebar.svelte src/routes/page.layout.test.ts
git commit -m "feat(web): folder-based home screen and hide native-only actions"
```

---

### Task 6: 自動保存（Web のみ）

**Files:**
- Create: `src/lib/utils/autoSave.ts`、`src/lib/utils/autoSave.test.ts`
- Create: `src/lib/stores/autoSaveStore.svelte.ts`
- Create: `src/lib/utils/webAutoSave.svelte.ts`
- Modify: `src/lib/stores/annotationStore.svelte.ts`（`editSeq`）、`src/lib/components/StatusBar.svelte`、`src/routes/+page.svelte`（起動時に `startWebAutoSave()` を 1 回呼ぶだけ）
- Test: `src/lib/stores/annotationStore.test.ts`

**Interfaces:**
- Consumes: 既存 `persistCurrentAnnotations(): Promise<boolean>`、`supportsBrowserFolders()`
- Produces:
  - `autoSave.ts`: `export const AUTO_SAVE_DELAY_MS = 1500;` と `export function createAutoSaver(opts: { save: () => Promise<boolean>; delayMs?: number; onState?: (s: AutoSaveState) => void }): { schedule(): void; flush(): Promise<void>; get pending(): boolean; dispose(): void }`、`export type AutoSaveState = "idle" | "saving" | "saved" | "error";`
    - `schedule()` は最後の呼び出しから `delayMs` 後に 1 回 `save`。保存中に `schedule()` が来たら、終わった直後にもう 1 回（遅延なしで）保存する。同時に 2 つの `save` を走らせない。
    - `save` が `false` を返す／例外なら `onState("error")`。次の `schedule()` で再試行。
    - `flush()` は待機中のタイマーを即実行し、進行中の保存の完了まで待つ。
  - `annotationStore.editSeq = $state(0)` — 既存の `this.dirty = true` の箇所すべてで `editSeq += 1`（private `markDirty()` にまとめる）。
  - `autoSaveStore`: `state = $state<AutoSaveState>("idle")`
  - `webAutoSave.svelte.ts`: `export function startWebAutoSave(): () => void` — `supportsBrowserFolders()` でなければ何もしない。`$effect.root` で `annotationStore.editSeq` を監視し、`dirty` かつ `projectStore.folder` が仮想パスなら `schedule()`。`beforeunload` で `annotationStore.dirty || saver.pending` なら `event.preventDefault()`。`visibilitychange` が `hidden` になったら `flush()`。
  - `StatusBar.svelte`: Web かつプロジェクトを開いている時、右側に `保存中…` / `保存済み` / `保存に失敗しました`（`autoSaveStore.state`）。既存のエラー表示（`projectStore.error || pdfStore.status`）がある時はそちらを優先。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// autoSave.test.ts（vi.useFakeTimers()）
it("coalesces rapid changes into one save after the delay", async () => {
  const save = vi.fn().mockResolvedValue(true);
  const saver = createAutoSaver({ save });
  saver.schedule(); vi.advanceTimersByTime(1000); saver.schedule();
  vi.advanceTimersByTime(1499); expect(save).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); expect(save).toHaveBeenCalledTimes(1);
});

it("runs one more save when changes arrive during a save", async () => {
  let finish!: (v: boolean) => void;
  const save = vi.fn().mockImplementationOnce(() => new Promise<boolean>((r) => (finish = r))).mockResolvedValue(true);
  const saver = createAutoSaver({ save });
  saver.schedule(); await vi.advanceTimersByTimeAsync(1500);
  saver.schedule(); await vi.advanceTimersByTimeAsync(1500);
  expect(save).toHaveBeenCalledTimes(1);
  finish(true); await vi.runAllTimersAsync();
  expect(save).toHaveBeenCalledTimes(2);
});

it("reports failure and stays dirty", async () => {
  const states: string[] = [];
  const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
  const saver = createAutoSaver({ save, onState: (s) => states.push(s) });
  saver.schedule(); await vi.advanceTimersByTimeAsync(1500);
  expect(states).toEqual(["saving", "error"]);
  saver.schedule(); await vi.advanceTimersByTimeAsync(1500);
  expect(states.at(-1)).toBe("saved");
});

it("flush saves immediately and waits for completion", async () => {
  const save = vi.fn().mockResolvedValue(true);
  const saver = createAutoSaver({ save });
  saver.schedule(); await saver.flush();
  expect(save).toHaveBeenCalledTimes(1); expect(saver.pending).toBe(false);
});

// annotationStore.test.ts
it("bumps editSeq on every dirtying edit", () => {
  const before = annotationStore.editSeq;
  annotationStore.upsert(0, "a", { id: "a", type: "path" });
  annotationStore.remove(0, "a");
  expect(annotationStore.editSeq).toBe(before + 2);
});
```

- [ ] **Step 2: 失敗を確認** — Run: `npx vitest run src/lib/utils/autoSave.test.ts src/lib/stores/annotationStore.test.ts` / Expected: FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 成功を確認** — Run: `npx vitest run src/lib/utils/autoSave.test.ts src/lib/stores/annotationStore.test.ts && npm run check` / Expected: PASS、check のエラー数が増えていない
- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/autoSave.ts src/lib/utils/autoSave.test.ts src/lib/stores/autoSaveStore.svelte.ts src/lib/utils/webAutoSave.svelte.ts src/lib/stores/annotationStore.svelte.ts src/lib/stores/annotationStore.test.ts src/lib/components/StatusBar.svelte src/routes/+page.svelte
git commit -m "feat(web): autosave annotations and warn before leaving with unsaved edits"
```

---

### Task 7: オフライン起動（PWA）

**Files:**
- Create: `src/service-worker.ts`、`src/lib/utils/pwa.ts`、`src/lib/utils/pwa.test.ts`
- Create: `static/manifest.webmanifest`、`static/icons/icon-192.png`、`static/icons/icon-512.png`（`src-tauri/icons/icon.png` から縮小して作る）
- Modify: `svelte.config.js`（`kit.serviceWorker.register: false`）、`src/app.html`（`<link rel="manifest" href="%sveltekit.assets%/manifest.webmanifest">`、`<meta name="theme-color" content="#020617">`）、`src/routes/+page.svelte`（起動時に `registerWebServiceWorker()` を 1 回）、`src/lib/components/ProjectHome.svelte`（準備完了表示）

**Interfaces:**
- Produces:
  - `pwa.ts`: `export function shouldRegisterServiceWorker(isTauri = isTauriRuntime(), hasSw = typeof navigator !== "undefined" && "serviceWorker" in navigator, isDev = import.meta.env.DEV): boolean`（`!isTauri && hasSw && !isDev`）、`export async function registerWebServiceWorker(): Promise<void>`（`navigator.serviceWorker.register("/service-worker.js", { type: "module" })`、完了後 `navigator.serviceWorker.ready` を待って `pwaStore.offlineReady = true`）。
  - `src/lib/stores/pwaStore.svelte.ts`: `class PwaStore { offlineReady = $state(false) }`、`export const pwaStore = new PwaStore()`。
  - `service-worker.ts`: SvelteKit の `$service-worker`（`build`、`files`、`version`）で `CACHE = "bpsync-" + version` に事前キャッシュ。`install` で `addAll([...build, ...files])`（`skipWaiting` は呼ばない＝編集中に切り替えない）、`activate` で古いキャッシュを削除し `clients.claim()`。`fetch` は同一オリジンの GET のみ：キャッシュ優先、ナビゲーション要求でオフラインなら `/index.html`（＝ `adapter-static` の fallback）を返す。他オリジン（計画 3 の中継など）は触らない。
  - ホーム画面：`pwaStore.offlineReady` が true なら小さく「オフラインで使えます」。

- [ ] **Step 1: 失敗するテストを書く**

```ts
it("registers the service worker only in production browsers", () => {
  expect(shouldRegisterServiceWorker(false, true, false)).toBe(true);
  expect(shouldRegisterServiceWorker(true, true, false)).toBe(false);
  expect(shouldRegisterServiceWorker(false, false, false)).toBe(false);
  expect(shouldRegisterServiceWorker(false, true, true)).toBe(false);
});
```

- [ ] **Step 2: 失敗を確認** — Run: `npx vitest run src/lib/utils/pwa.test.ts` / Expected: FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 成功を確認** — Run: `npx vitest run src/lib/utils/pwa.test.ts && npm run build:web && ls build/service-worker.js build/manifest.webmanifest` / Expected: テスト PASS、両ファイルが存在
- [ ] **Step 5: 手動確認** — `npx vite preview --port 4173` を Chrome で開く → DevTools > Application で Service Worker が activated、Manifest がインストール可能 → Network を Offline にしてリロードしてもホーム画面が出る
- [ ] **Step 6: Commit**

```bash
git add src/service-worker.ts src/lib/utils/pwa.ts src/lib/utils/pwa.test.ts src/lib/stores/pwaStore.svelte.ts static/manifest.webmanifest static/icons svelte.config.js src/app.html src/routes/+page.svelte src/lib/components/ProjectHome.svelte
git commit -m "feat(web): installable PWA with offline startup"
```

---

### Task 8: 全体確認と実機確認

**Files:** なし（確認のみ。見つかった不具合は該当タスクのファイルを直して別コミット）

- [ ] **Step 1: 自動テストと型** — Run: `npm test && npm run check` / Expected: 失敗は作業前から落ちている 6 件（`pinSlides` 4、`pinMarkers` 1、`windowsMsvcEnv` 1）のみ。check のエラー数が 47 以下。
- [ ] **Step 2: ネイティブ回帰** — Run: `cd src-tauri && cargo check`、`npm run tauri dev` で既存プロジェクトを開いて編集・保存・タブ切替ができ、Service Worker が登録されていない（DevTools > Application）こと。
- [ ] **Step 3: Web 実機（Windows の Chrome / Edge、ChromeOS Flex の Chrome）** — `npm run build:web` を HTTPS 配信（Vercel プレビュー等）して、次を通す：
  1. 新規プロジェクト（フォルダ選択）→ PDF 取り込み → ペン・画像貼り付け・写真ピン（カメラ）・メモピン・課題・ノート
  2. 編集直後に F5 → 直前の編集が残っている
  3. ブラウザを完全に終了して再起動 → 「前回のプロジェクトを再開」→ 許可 → 続きが開く
  4. 同じプロジェクトを 2 つ目のタブで開く → 「別のタブで開いています」
  5. `.bpsync.zip` を取り込み → 親フォルダ内に新しいフォルダができる（同名があれば `(2)`）
  6. ネットを切ってアプリを起動 → プロジェクトを開いて編集・保存できる
- [ ] **Step 4: 互換性** — 手順 3 で作ったフォルダを Windows ネイティブ版で開き、図面・注釈・写真ピン・メモピン・課題が同じに見える。ネイティブ版で作ったフォルダを Web 版で開いても同じ。
- [ ] **Step 5: README 更新とコミット** — README の「ブラウザのみで UI を確認する場合」節に、Web 版（`npm run build:web`、対応ブラウザ、フォルダの許可、オフライン）の説明を追記。

```bash
git add README.md
git commit -m "docs: describe the web version with local folders"
```
