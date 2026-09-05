# プロジェクトタブ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 複数プロジェクトをブラウザ型タブで開き、右端の `+` からフォルダを選んで追加できるようにする。

**Architecture:** タブの追加・同一フォルダ検出・閉じたあとの次タブは純粋関数 `projectTabs.ts` に置く。`projectStore` がタブ一覧を持ち、表示中タブだけ現行のライブフィールド（`folder` / `meta` / `pdfs` / `currentPdf` / `error`）と `pdfStore` / `annotationStore` / `historyStore` に載せる。切替時に注釈をディスク保存し、pdf.js ドキュメントは破棄してバイトから再ロードする。UI はウィンドウ最上段の `ProjectTabBar`。

**Tech Stack:** Svelte 5, TypeScript, Vitest, Tailwind

**Spec:** `docs/superpowers/specs/2026-09-05-project-tabs-design.md`

## Global Constraints

- 同じフォルダは1タブだけ。判定は `normalizeFsPath`
- `+` のキャンセルではタブを増やさない
- `project.json` がなければそのフォルダで作成する
- 最後のタブを閉じると起動画面。タブバーは出さない
- タブは起動中のみ。再起動後は復元しない
- LAN 接続はアプリ全体で1本。同期は表示中タブ
- `pdfRenderer.ts` と Fabric 描画本体は書き換えない
- 既存の `projectStore.folder` などへの代入は動かす。`isOpen` は `Boolean(this.folder && this.meta)` のまま
- コミットはユーザーが依頼したときだけ。計画中の commit ステップは実行しない
- Svelte 5: `$state` / `$props()` / `onclick=`。`.svelte` に `invoke` や座標計算を足さない

## File Structure

Create:

- `src/lib/utils/projectTabs.ts` — タブ配列の純粋操作とセッション型
- `src/lib/utils/projectTabs.test.ts`
- `src/lib/components/ProjectTabBar.svelte` — 最上段タブバーと右端 `+`

Modify:

- `src/lib/stores/projectStore.svelte.ts` — `tabs` / `activeTabId`、reset でクリア、タブ名同期
- `src/lib/stores/historyStore.svelte.ts` — `replace(history)` でセッション復元
- `src/lib/utils/projectActions.ts` — 開く／作成がタブを足す、切替、閉じるはアクティブタブだけ、`openProjectTab`
- `src/lib/utils/projectActions.test.ts` — タブ追加・重複・キャンセル・失敗時に他タブを残す・最後のタブ
- `src/routes/+page.svelte` — タブバーをウィンドウ最上段に置く
- `src/lib/utils/webDemo.start.test.ts` — デモ起動でタブが1つ付く

Do not modify: `src/lib/utils/pdfRenderer.ts`, Fabric 描画本体、同期プロトコル

---

### Task 1: タブ配列の純粋関数

**Files:**
- Create: `src/lib/utils/projectTabs.ts`
- Test: `src/lib/utils/projectTabs.test.ts`

**Interfaces:**
- Consumes: `normalizeFsPath` from `$lib/utils/projectMove`, `ProjectMeta` from `$lib/utils/projectFormat`, `AnnotationFile` from `$lib/utils/annotationPersist`, `EditHistory` from `$lib/utils/editHistory`
- Produces:
  - `export type TabPdfState = { name: string; bytes: Uint8Array | null; pageIndex: number; zoom: number; status: string }`
  - `export type TabSession = { folder: string; meta: ProjectMeta | null; pdfs: string[]; currentPdf: string; error: string; annotations: AnnotationFile; history: EditHistory; pdf: TabPdfState }`
  - `export type ProjectTab = { id: string; folder: string; name: string; session: TabSession | null }`
  - `export function sameProjectFolder(a: string, b: string): boolean`
  - `export function findTabByFolder(tabs: ProjectTab[], folder: string): ProjectTab | undefined`
  - `export function createProjectTab(input: { id: string; folder: string; name: string; session?: TabSession | null }): ProjectTab`
  - `export function rememberLiveTab(tabs: ProjectTab[], activeTabId: string | null, session: TabSession): ProjectTab[]`
  - `export function closeTabList(tabs: ProjectTab[], closingId: string, activeTabId: string | null): { tabs: ProjectTab[]; nextActiveId: string | null; closedLast: boolean }`

- [ ] **Step 1: Write the failing test**

`src/lib/utils/projectTabs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  closeTabList,
  createProjectTab,
  findTabByFolder,
  rememberLiveTab,
  sameProjectFolder,
  type ProjectTab,
  type TabSession,
} from "./projectTabs";
import { emptyHistory } from "./editHistory";

function session(folder: string): TabSession {
  return {
    folder,
    meta: null,
    pdfs: [],
    currentPdf: "",
    error: "",
    annotations: { byPage: {}, photoPins: {} },
    history: emptyHistory(),
    pdf: { name: "未読み込み", bytes: null, pageIndex: 0, zoom: 1, status: "" },
  };
}

describe("sameProjectFolder", () => {
  it("treats windows and trailing-slash variants as the same project", () => {
    expect(sameProjectFolder("C:\\work\\現場A", "C:/work/現場A/")).toBe(true);
    expect(sameProjectFolder("/a", "/b")).toBe(false);
  });
});

describe("findTabByFolder", () => {
  it("finds an open tab regardless of path separators", () => {
    const tabs = [createProjectTab({ id: "t1", folder: "C:\\work\\A", name: "A" })];
    expect(findTabByFolder(tabs, "C:/work/A")?.id).toBe("t1");
  });
});

describe("rememberLiveTab", () => {
  it("stores the live session on the active tab and leaves others untouched", () => {
    const tabs: ProjectTab[] = [
      createProjectTab({ id: "a", folder: "/a", name: "a" }),
      createProjectTab({ id: "b", folder: "/b", name: "b" }),
    ];
    const next = rememberLiveTab(tabs, "a", session("/a"));
    expect(next[0].session?.folder).toBe("/a");
    expect(next[1].session).toBeNull();
  });
});

describe("closeTabList", () => {
  it("activates the right neighbor, then the left, and reports the last tab", () => {
    const tabs = [
      createProjectTab({ id: "a", folder: "/a", name: "a" }),
      createProjectTab({ id: "b", folder: "/b", name: "b" }),
      createProjectTab({ id: "c", folder: "/c", name: "c" }),
    ];
    expect(closeTabList(tabs, "b", "b")).toEqual({
      tabs: [tabs[0], tabs[2]],
      nextActiveId: "c",
      closedLast: false,
    });
    expect(closeTabList(tabs, "c", "c").nextActiveId).toBe("b");
    expect(closeTabList([tabs[0]], "a", "a")).toEqual({
      tabs: [],
      nextActiveId: null,
      closedLast: true,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/utils/projectTabs.test.ts`
Expected: FAIL because `./projectTabs` is missing

- [ ] **Step 3: Write minimal implementation**

`src/lib/utils/projectTabs.ts` に上記の型と関数を実装する。`sameProjectFolder` は `normalizeFsPath` を使う。`closeTabList` は閉じる index の右、なければ左を `nextActiveId` にする。閉じるタブがアクティブでなければ `nextActiveId` は今の `activeTabId` のまま。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/utils/projectTabs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

実行しない（ユーザー依頼があるまで）。

---

### Task 2: ストアにタブを載せる

**Files:**
- Modify: `src/lib/stores/projectStore.svelte.ts`
- Modify: `src/lib/stores/historyStore.svelte.ts`
- Test: `src/lib/utils/projectTabs.test.ts`（ストアは projectActions の既存テストで触る。ここでは `historyStore.replace` を `src/lib/utils/editHistory.test.ts` には足さず、`src/lib/stores/historyStore.svelte.ts` の replace は Task 3 の切替テストで検証する）

**Interfaces:**
- Consumes: `ProjectTab` from `$lib/utils/projectTabs`
- Produces:
  - `projectStore.tabs: ProjectTab[]`
  - `projectStore.activeTabId: string | null`
  - `projectStore.reset()` が `tabs = []`, `activeTabId = null` も消す
  - `historyStore.replace(history: EditHistory): void`

- [ ] **Step 1: Write the failing test**

既存 `src/lib/utils/projectActions.test.ts` の `closes a project after attempting to persist annotations` のあとに、タブ無しの `reset` がタブも消すことを後続タスクで見る。このタスクでは `historyStore` に対する小さなテストを `src/lib/stores/historyStore.svelte.ts` の隣には作らず、`src/lib/utils/editHistory.test.ts` にストアを混ぜない。

代わりに `src/lib/utils/projectActions.test.ts` の `beforeEach` が `projectStore.reset()` したあと `expect(projectStore.tabs).toEqual([])` を既存の最初のテストに足すと、フィールドが無い時点で落ちる。

`src/lib/utils/projectActions.test.ts` の `it("loads recents and removes entries whose path no longer exists"` の直前、`beforeEach` の末尾に断言は置かない。新しい `it` を `describe` 先頭付近に足す:

```ts
it("reset clears open tabs", () => {
  projectStore.tabs = [
    { id: "t", folder: "/a", name: "a", session: null },
  ];
  projectStore.activeTabId = "t";
  projectStore.reset();
  expect(projectStore.tabs).toEqual([]);
  expect(projectStore.activeTabId).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/utils/projectActions.test.ts -t "reset clears open tabs"`
Expected: FAIL (`tabs` が無い、または reset が消さない)

- [ ] **Step 3: Write minimal implementation**

`projectStore` に `tabs` と `activeTabId` を足し、`reset()` で空にする。`historyStore.replace` は `this.apply(history)`。ライブフィールドは現状のまま代入可能。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/utils/projectActions.test.ts -t "reset clears open tabs"`
Expected: PASS

- [ ] **Step 5: Commit**

実行しない。

---

### Task 3: 開く・切替・閉じる・+ 

**Files:**
- Modify: `src/lib/utils/projectActions.ts`
- Modify: `src/lib/utils/projectActions.test.ts`
- Modify: `src/lib/utils/webDemo.start.test.ts`

**Interfaces:**
- Consumes: `createProjectTab`, `findTabByFolder`, `rememberLiveTab`, `closeTabList`, `sameProjectFolder`, `projectJsonPath`, `pathExists`, `pickFolder`
- Produces:
  - `export async function switchProjectTab(tabId: string): Promise<void>`
  - `export async function closeProjectTab(tabId: string): Promise<void>`
  - `export async function openProjectTab(): Promise<void>`
  - 既存 `openProject` / `createProject` / `closeProject` / `startWebDemo` は成功時にタブへ載せる。`closeProject` は表示中タブを閉じる（タブが無ければ現行どおり全クリア）

ヘルパー（`projectActions.ts` 内、export しなくてよい）:

- `captureLiveSession(): TabSession` — ライブの project / annotation / history / pdf フィールドをコピー
- `async applyLiveSession(session: TabSession): Promise<void>` — ライブフィールドへ戻し、`annotationStore.importByPage`、`historyStore.replace`、バイトがあれば `pdfStore.load` のあと `pageIndex` / `zoom` / `status` を戻す。バイトが無ければ `pdfStore.clear()`
- `registerLiveTab(): void` — 表示中フォルダがタブに無ければ `createProjectTab` して `tabs` に足し `activeTabId` にする。名前は `meta?.name ?? folderDisplayName(folder)`
- `async parkActiveTab(): Promise<boolean>` — タブが無ければ true。あれば `persistCurrentAnnotations`、失敗なら false。成功なら `rememberLiveTab` でセッションを退避

`openProject` / `createProject` の成功パスの最後で `registerLiveTab()`。ただし既に同じフォルダのタブがあれば `switchProjectTab` して return（新規作成しない）。2件目を開く前に `parkActiveTab()`。失敗時、`tabs.length === 0` なら現行どおり `reset()` + `error`。タブがあるならライブ状態を戻さず（まだ park したあとに壊していないこと）、`pdfStore.status` に理由。実装順は **メタ読み込みや作成の I/O を先に行い、成功してから park → ライブを上書き → register**。こうすると失敗しても表示中タブは触れない。

`openProjectTab`:

```
const folder = await pickFolder();
if (!folder) return;
const existing = findTabByFolder(projectStore.tabs, folder);
if (existing) { await switchProjectTab(existing.id); return; }
if (await pathExists(projectJsonPath(folder))) await openProject(folder);
else { /* createProject のフォルダ選択以外を folder 付きで実行 */ }
```

`createProject` は `pickFolder` のあと上記 create 本体を呼ぶ。本体は既存の `initProjectDir` / `writeProjectMeta` / リスト / `openFirstProjectPdf`。

`switchProjectTab`: 同じ ID なら return。`parkActiveTab` 失敗なら return。対象タブの `session` が無ければ return。`applyLiveSession` のあと、そのタブの `session` を `null` にし `activeTabId` を更新。

`closeProjectTab`: 閉じるのがアクティブなら `persistCurrentAnnotations`（失敗なら return）。`closeTabList` で配列更新。`closedLast` なら `reset` + pdf/annotation clear。さもなくば `nextActiveId` のセッションを `applyLiveSession`。

`closeProject` は `activeTabId` があれば `closeProjectTab(activeTabId)`、無ければ現行の persist + reset。

- [ ] **Step 1: Write the failing tests**

`projectActions.test.ts` に追加（既存 mock を使う）:

```ts
it("registers a tab when opening a project", async () => {
  mockReadProjectMeta.mockResolvedValue(sampleMeta());
  mockListProjectPdfs.mockResolvedValue(["A.pdf"]);
  await openProject("/projects/a");
  expect(projectStore.tabs).toHaveLength(1);
  expect(projectStore.tabs[0].folder).toBe("/projects/a");
  expect(projectStore.activeTabId).toBe(projectStore.tabs[0].id);
});

it("does not add a tab when folder picker is cancelled", async () => {
  mockPickFolder.mockResolvedValue(null);
  await openProjectTab();
  expect(projectStore.tabs).toEqual([]);
  expect(mockReadProjectMeta).not.toHaveBeenCalled();
});

it("switches to an existing tab instead of opening a duplicate", async () => {
  mockReadProjectMeta.mockResolvedValue(sampleMeta());
  mockListProjectPdfs.mockResolvedValue(["A.pdf"]);
  await openProject("/projects/a");
  const id = projectStore.activeTabId;
  mockPickFolder.mockResolvedValue("/projects/a");
  await openProjectTab();
  expect(projectStore.tabs).toHaveLength(1);
  expect(projectStore.activeTabId).toBe(id);
});

it("creates a project in a new tab when the folder has no project.json", async () => {
  mockReadProjectMeta.mockResolvedValue(sampleMeta());
  mockListProjectPdfs.mockResolvedValue(["A.pdf"]);
  await openProject("/projects/a");
  mockPickFolder.mockResolvedValue("/projects/b");
  mockPathExists.mockImplementation(async (path: string) => !String(path).includes("project.json"));
  mockListProjectPdfs.mockResolvedValue([]);
  await openProjectTab();
  expect(projectStore.tabs).toHaveLength(2);
  expect(projectStore.folder).toBe("/projects/b");
  expect(mockInitProjectDir).toHaveBeenCalledWith("/projects/b");
  expect(mockWriteProjectMeta).toHaveBeenCalled();
});

it("keeps other tabs when a second open fails", async () => {
  mockReadProjectMeta.mockResolvedValue(sampleMeta());
  mockListProjectPdfs.mockResolvedValue(["A.pdf"]);
  await openProject("/projects/a");
  mockReadProjectMeta.mockRejectedValue(new Error("Invalid project"));
  await expect(openProject("/broken")).rejects.toThrow("project.json");
  expect(projectStore.folder).toBe("/projects/a");
  expect(projectStore.tabs).toHaveLength(1);
});

it("returns to the home screen after closing the last tab", async () => {
  mockReadProjectMeta.mockResolvedValue(sampleMeta());
  mockListProjectPdfs.mockResolvedValue(["A.pdf"]);
  await openProject("/projects/a");
  await closeProject();
  expect(projectStore.tabs).toEqual([]);
  expect(projectStore.isOpen).toBe(false);
});
```

`webDemo.start.test.ts` に `expect(projectStore.tabs).toHaveLength(1)` を追加。

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/utils/projectActions.test.ts src/lib/utils/webDemo.start.test.ts`
Expected: FAIL on missing `openProjectTab` / tabs not registered

- [ ] **Step 3: Write implementation**

`projectActions.ts` に上記ヘルパーと export を追加。`openProject` 失敗時は `tabs.length === 0` のときだけ `reset()`。`pathExists` の mock は既存 `beforeEach` を壊さないよう、テスト内で上書きする。既存の `loadRecentsIntoStore` が `pathExists` を使うテストがあるので、`openProjectTab` の作成テストでは `mockPathExists.mockImplementation` をそのテストだけに閉じる。

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS（既存含む）

- [ ] **Step 5: Commit**

実行しない。

---

### Task 4: タブバー UI

**Files:**
- Create: `src/lib/components/ProjectTabBar.svelte`
- Modify: `src/routes/+page.svelte`

**Interfaces:**
- Consumes: `projectStore.tabs`, `projectStore.activeTabId`, `switchProjectTab`, `closeProjectTab`, `openProjectTab`
- Produces: ウィンドウ最上段のタブバー。`tabs.length === 0` のときは描画しない

- [ ] **Step 1: Write the failing test**

UI はコンポーネントテストが無いので、`src/app.css.test.ts` のやり方に合わせ、レイアウトがタブバーを組むことをファイル内容で固定する。`src/routes/+page.svelte` を読む既存パターンがあればそれに合わせ、無ければ `src/lib/components/ProjectTabBar.svelte` が `openProjectTab` を呼ぶことと `+page.svelte` がタブバーを `ProjectHome` より前に置くことを `src/app.css.test.ts` に足すのではなく、新しい `src/routes/page.layout.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("editor shell layout", () => {
  it("puts the project tab bar at the top of the window", () => {
    const page = readFileSync(path.resolve("src/routes/+page.svelte"), "utf8");
    expect(page.indexOf("ProjectTabBar")).toBeGreaterThan(-1);
    expect(page.indexOf("ProjectTabBar")).toBeLessThan(page.indexOf("ProjectHome"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/routes/page.layout.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement the bar and page shell**

`ProjectTabBar.svelte`:

- `tabs.length === 0` なら何も出さない
- `flex` 行。タブ部分は `min-w-0 flex-1 overflow-x-auto`、`+` は `shrink-0`
- 各タブはボタン。アクティブは cyan の上線。ラベルは `tab.name`。`×` は `onclick` で `closeProjectTab(tab.id)`、親タブの切替と分離するため `×` 側で `event.stopPropagation()`
- タブ本体は `switchProjectTab(tab.id)`
- `+` は `aria-label="プロジェクトを開く"`、`onclick={() => void openProjectTab()}`
- Tailwind のみ。既存の slate / cyan

`+page.svelte`:

```svelte
<div class="flex h-full flex-col bg-slate-950 text-slate-100">
  <ProjectTabBar />
  {#if !projectStore.isOpen}
    <ProjectHome />
  {:else}
    <div class="flex min-h-0 flex-1">
      <ProjectSidebar />
      ...現行のメイン列...
    </div>
  {/if}
</div>
```

起動画面もタブバーコンポーネントを置くが、タブ 0 件なら空。背景は `bg-slate-950` で統一。

- [ ] **Step 4: Run tests and check**

Run: `npm test && npm run check`
Expected: PASS

- [ ] **Step 5: Commit**

実行しない。
