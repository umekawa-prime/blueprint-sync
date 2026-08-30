# Projects and OneDrive Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 起動時にローカルプロジェクトフォルダを必須にし、その中の複数 PDF と OneDrive リンク（ブラウザで開くだけ）と注釈データを管理できるようにする。

**Architecture:** 純粋関数で `project.json` / URL / 注釈ファイル名を検証し、Tauri の `std::fs` + `rfd` でフォルダ操作する。Svelte の `projectStore` が現在のプロジェクトを持ち、未選択なら `ProjectHome`、選択後は `ProjectSidebar` + 現行エディタを出す。PDF 描画エンジン（`pdfRenderer.ts` / Fabric 描画）は変更しない。

**Tech Stack:** Svelte 5, TypeScript, Vitest, Tauri v2, Rust (`rfd`, `tauri-plugin-opener`)

**Spec:** `docs/superpowers/specs/2026-08-30-projects-onedrive-links-design.md`

## Global Constraints

- OneDrive リンクはブラウザで開くだけ。ダウンロード・同期・認証はしない
- ファイル実体は指定したローカルフォルダだけで管理する
- 起動後はプロジェクト作成または既存フォルダを開くまで編集画面を出さない
- PDF はフォルダ直下のみ一覧する（サブフォルダなし）。`.blueprint-sync` は除外
- 管理データは `<folder>/.blueprint-sync/project.json` と `annotations/<pdf名>.json`
- リンク URL は `http` / `https` のみ
- 注釈ファイル名に `/` `\` `..` を含めない
- 最近使ったプロジェクトは新しい順で最大 8 件
- フォルダ選択・一覧・ブラウザ起動は Tauri 実行時のみ
- `pdfRenderer.ts` と `PdfViewer.svelte` の描画ロジックは書き換えない
- このワークスペースは Git 未初期化。コミットステップは `git init` 済みのときだけ実行する。未初期化ならスキップ

## File Structure

Create:

- `src/lib/utils/projectFormat.ts` — `project.json` / URL / 最近使った一覧 / PDF 名 / 注釈ファイル名
- `src/lib/utils/projectFormat.test.ts`
- `src/lib/utils/annotationPersist.ts` — 注釈 JSON の serialize / parse
- `src/lib/utils/annotationPersist.test.ts`
- `src/lib/utils/projectIo.ts` — Tauri invoke ラッパ
- `src/lib/utils/projectActions.ts` — 作成・開く・閉じる・リンク・図面切替
- `src/lib/stores/projectStore.svelte.ts`
- `src/lib/components/ProjectHome.svelte`
- `src/lib/components/ProjectSidebar.svelte`

Modify:

- `src-tauri/src/lib.rs` — フォルダ選択、PDF 一覧、スキャフォールド、コピー、recent、save の初期ディレクトリ、`PdfFile.path`
- `src/routes/+page.svelte` — 未選択なら Home、選択後はサイドバー＋現行 UI
- `src/lib/components/Toolbar.svelte` — プロジェクトへ PDF 追加、注釈ディスク保存、書き出し先
- `src/lib/utils/fileAccess.ts` — `path` 返却と `defaultDir`
- `src/lib/stores/annotationStore.svelte.ts` — serialize / load 用メソッド
- `src/lib/stores/pdfStore.svelte.ts` — `clear()` を追加

Do not modify: `src/lib/utils/pdfRenderer.ts`, Fabric 描画本体、同期プロトコル

---

### Task 1: プロジェクト形式の純粋関数

**Files:**
- Create: `src/lib/utils/projectFormat.ts`
- Test: `src/lib/utils/projectFormat.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `export type ProjectLink = { id: string; title: string; url: string }`
  - `export type ProjectMeta = { id: string; name: string; createdAt: string; links: ProjectLink[] }`
  - `export type RecentProject = { name: string; path: string }`
  - `export function isAllowedLinkUrl(url: string): boolean`
  - `export function parseProjectJson(raw: string): ProjectMeta`
  - `export function serializeProjectJson(meta: ProjectMeta): string`
  - `export function createProjectMeta(name: string, now?: Date): ProjectMeta`
  - `export function annotationFileName(pdfName: string): string`
  - `export function listPdfFileNames(names: string[]): string[]`
  - `export function rememberRecent(current: RecentProject[], next: RecentProject, max?: number): RecentProject[]`
  - `export function dropRecent(current: RecentProject[], path: string): RecentProject[]`
  - `export function displayLinkTitle(link: ProjectLink): string`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  annotationFileName,
  createProjectMeta,
  displayLinkTitle,
  dropRecent,
  isAllowedLinkUrl,
  listPdfFileNames,
  parseProjectJson,
  rememberRecent,
  serializeProjectJson,
} from "./projectFormat";

describe("isAllowedLinkUrl", () => {
  it("allows http and https only", () => {
    expect(isAllowedLinkUrl("https://1drv.ms/f/s!abc")).toBe(true);
    expect(isAllowedLinkUrl("http://example.com/x")).toBe(true);
    expect(isAllowedLinkUrl("file:///C:/tmp")).toBe(false);
    expect(isAllowedLinkUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedLinkUrl("not a url")).toBe(false);
  });
});

describe("project.json", () => {
  it("round-trips a valid document", () => {
    const meta = createProjectMeta("現場A", new Date("2026-08-30T08:00:00.000Z"));
    meta.links.push({
      id: "link-1",
      title: "共有フォルダ",
      url: "https://1drv.ms/f/s!abc",
    });
    expect(parseProjectJson(serializeProjectJson(meta))).toEqual(meta);
  });

  it("rejects missing fields", () => {
    expect(() => parseProjectJson("{}")).toThrow(/invalid project/i);
    expect(() =>
      parseProjectJson(JSON.stringify({ id: "x", name: "n", createdAt: "t", links: "nope" })),
    ).toThrow(/invalid project/i);
  });
});

describe("annotationFileName", () => {
  it("appends .json to a pdf basename", () => {
    expect(annotationFileName("1F平面図.pdf")).toBe("1F平面図.pdf.json");
  });

  it("rejects path separators and parent segments", () => {
    expect(() => annotationFileName("../x.pdf")).toThrow(/invalid/i);
    expect(() => annotationFileName("a/b.pdf")).toThrow(/invalid/i);
    expect(() => annotationFileName("a\\b.pdf")).toThrow(/invalid/i);
  });
});

describe("listPdfFileNames", () => {
  it("keeps only pdf files and excludes dot entries", () => {
    expect(
      listPdfFileNames([".blueprint-sync", "a.pdf", "notes.txt", "B.PDF", ".hidden.pdf"]),
    ).toEqual(["a.pdf", "B.PDF"]);
  });
});

describe("rememberRecent", () => {
  it("moves an existing path to the front and caps at 8", () => {
    const current = Array.from({ length: 8 }, (_, i) => ({
      name: `p${i}`,
      path: `/p${i}`,
    }));
    const next = rememberRecent(current, { name: "p3", path: "/p3" }, 8);
    expect(next).toHaveLength(8);
    expect(next[0]).toEqual({ name: "p3", path: "/p3" });
    expect(next.filter((item) => item.path === "/p3")).toHaveLength(1);
  });

  it("drops a missing path", () => {
    expect(dropRecent([{ name: "a", path: "/a" }], "/a")).toEqual([]);
  });
});

describe("displayLinkTitle", () => {
  it("falls back to the url", () => {
    expect(displayLinkTitle({ id: "1", title: "", url: "https://1drv.ms/x" })).toBe(
      "https://1drv.ms/x",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/utils/projectFormat.test.ts`

Expected: FAIL with cannot find module `./projectFormat`

- [ ] **Step 3: Write minimal implementation**

```ts
export type ProjectLink = {
  id: string;
  title: string;
  url: string;
};

export type ProjectMeta = {
  id: string;
  name: string;
  createdAt: string;
  links: ProjectLink[];
};

export type RecentProject = {
  name: string;
  path: string;
};

export function isAllowedLinkUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseLink(value: unknown): ProjectLink {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.url !== "string"
  ) {
    throw new Error("Invalid project.json");
  }
  return { id: value.id, title: value.title, url: value.url };
}

export function parseProjectJson(raw: string): ProjectMeta {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid project.json");
  }
  if (
    !isRecord(parsed) ||
    typeof parsed.id !== "string" ||
    typeof parsed.name !== "string" ||
    typeof parsed.createdAt !== "string" ||
    !Array.isArray(parsed.links)
  ) {
    throw new Error("Invalid project.json");
  }
  return {
    id: parsed.id,
    name: parsed.name,
    createdAt: parsed.createdAt,
    links: parsed.links.map(parseLink),
  };
}

export function serializeProjectJson(meta: ProjectMeta): string {
  return JSON.stringify(meta, null, 2);
}

export function createProjectMeta(name: string, now = new Date()): ProjectMeta {
  return {
    id: crypto.randomUUID(),
    name: name.trim() || "無題プロジェクト",
    createdAt: now.toISOString(),
    links: [],
  };
}

export function annotationFileName(pdfName: string): string {
  if (
    !pdfName ||
    pdfName.includes("/") ||
    pdfName.includes("\\") ||
    pdfName.includes("..") ||
    !pdfName.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("Invalid annotation file name");
  }
  return `${pdfName}.json`;
}

export function listPdfFileNames(names: string[]): string[] {
  return names
    .filter((name) => name.toLowerCase().endsWith(".pdf") && !name.startsWith("."))
    .sort((a, b) => a.localeCompare(b, "ja"));
}

export function rememberRecent(
  current: RecentProject[],
  next: RecentProject,
  max = 8,
): RecentProject[] {
  return [next, ...current.filter((item) => item.path !== next.path)].slice(0, max);
}

export function dropRecent(current: RecentProject[], path: string): RecentProject[] {
  return current.filter((item) => item.path !== path);
}

export function displayLinkTitle(link: ProjectLink): string {
  return link.title.trim() || link.url;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/utils/projectFormat.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/projectFormat.ts src/lib/utils/projectFormat.test.ts
git commit -m "feat: add project.json and link validation helpers"
```

---

### Task 2: 注釈 JSON の persist ヘルパー

**Files:**
- Create: `src/lib/utils/annotationPersist.ts`
- Test: `src/lib/utils/annotationPersist.test.ts`
- Modify: `src/lib/stores/annotationStore.svelte.ts`

**Interfaces:**
- Consumes: `annotationStore.byPage` の形（`Record<number, Record<string, Record<string, unknown>>>`）
- Produces:
  - `export type PageObjects = Record<string, Record<string, unknown>>`
  - `export function serializeAnnotations(byPage: Record<number, PageObjects>): string`
  - `export function parseAnnotations(raw: string): Record<number, PageObjects>`
  - `annotationStore.exportByPage(): Record<number, PageObjects>`
  - `annotationStore.importByPage(byPage: Record<number, PageObjects>): void`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { parseAnnotations, serializeAnnotations } from "./annotationPersist";

describe("annotationPersist", () => {
  it("round-trips page objects", () => {
    const byPage = {
      0: { a: { id: "a", type: "path" } },
      2: { b: { id: "b", type: "i-text" } },
    };
    expect(parseAnnotations(serializeAnnotations(byPage))).toEqual(byPage);
  });

  it("rejects non-objects", () => {
    expect(() => parseAnnotations("[]")).toThrow(/invalid annotation/i);
    expect(() => parseAnnotations("{")).toThrow(/invalid annotation/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/utils/annotationPersist.test.ts`

Expected: FAIL with cannot find module `./annotationPersist`

- [ ] **Step 3: Write minimal implementation**

`src/lib/utils/annotationPersist.ts`:

```ts
export type PageObjects = Record<string, Record<string, unknown>>;

export function serializeAnnotations(byPage: Record<number, PageObjects>): string {
  return JSON.stringify({ byPage });
}

export function parseAnnotations(raw: string): Record<number, PageObjects> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid annotation file");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Invalid annotation file");
  }
  const byPage = (parsed as { byPage?: unknown }).byPage;
  if (typeof byPage !== "object" || byPage === null || Array.isArray(byPage)) {
    throw new Error("Invalid annotation file");
  }
  const output: Record<number, PageObjects> = {};
  for (const [key, value] of Object.entries(byPage)) {
    const page = Number(key);
    if (!Number.isInteger(page) || typeof value !== "object" || value === null) {
      throw new Error("Invalid annotation file");
    }
    output[page] = value as PageObjects;
  }
  return output;
}
```

`src/lib/stores/annotationStore.svelte.ts` にメソッドを追加する（既存メソッドは残す）:

```ts
  exportByPage(): Record<number, PageObjects> {
    return this.byPage;
  }

  importByPage(byPage: Record<number, PageObjects>) {
    this.byPage = byPage;
    this.dirty = false;
    this.remoteRevision += 1;
  }
```

ファイル先頭の `type PageObjects` を残し、`annotationPersist` の型と形を揃える。store 側はローカル型のままでよい。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/utils/annotationPersist.test.ts src/lib/utils/projectFormat.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/annotationPersist.ts src/lib/utils/annotationPersist.test.ts src/lib/stores/annotationStore.svelte.ts
git commit -m "feat: persist annotation maps as JSON"
```

---

### Task 3: Tauri コマンド（フォルダ・一覧・recent）

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/utils/fileAccess.ts`

**Interfaces:**
- Consumes: 既存の `read_file_bytes` / `write_file_bytes`
- Produces（フロントは camelCase で invoke）:
  - `pick_folder() -> Result<Option<String>, String>`
  - `init_project_dir(folder: String) -> Result<(), String>`
  - `list_project_pdfs(folder: String) -> Result<Vec<String>, String>`
  - `copy_file_into_folder(source: String, folder: String) -> Result<String, String>`
  - `load_recent_projects() -> Result<Vec<RecentProject>, String>`
  - `save_recent_projects(items: Vec<RecentProject>) -> Result<(), String>`
  - `path_exists(path: String) -> Result<bool, String>`
  - `PdfFile` に `path: String` を追加
  - `save_pdf_file(default_name, bytes, default_dir: Option<String>)`

- [ ] **Step 1: Add Rust unit tests for PDF name filtering**

`src-tauri/src/lib.rs` の末尾（または `sync_server.rs` と同じファイル内の helpers の隣）にテスト可能な関数を置く:

```rust
fn is_visible_pdf_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.ends_with(".pdf") && !name.starts_with('.')
}

#[cfg(test)]
mod tests {
    use super::is_visible_pdf_name;

    #[test]
    fn accepts_pdf_and_rejects_hidden_and_other_types() {
        assert!(is_visible_pdf_name("a.pdf"));
        assert!(is_visible_pdf_name("B.PDF"));
        assert!(!is_visible_pdf_name(".hidden.pdf"));
        assert!(!is_visible_pdf_name("notes.txt"));
        assert!(!is_visible_pdf_name(".blueprint-sync"));
    }
}
```

- [ ] **Step 2: Run Rust test to verify the helper works after implementation**

Run: `cargo test --manifest-path src-tauri/Cargo.toml is_visible_pdf_name -- --nocapture`

Expected: PASS after Step 3（未実装なら compile fail）

- [ ] **Step 3: Implement commands in `src-tauri/src/lib.rs`**

`PdfFile` を次に変更する:

```rust
#[derive(Serialize)]
struct PdfFile {
    name: String,
    path: String,
    bytes: Vec<u8>,
}
```

`pick_pdf_file` の返却に `path: path.to_string_lossy().into_owned()` を入れる。

追加:

```rust
use serde::Deserialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Clone)]
struct RecentProject {
    name: String,
    path: String,
}

#[tauri::command]
fn pick_folder() -> Result<Option<String>, String> {
    Ok(rfd::FileDialog::new().pick_folder().map(|path| path.to_string_lossy().into_owned()))
}

#[tauri::command]
fn init_project_dir(folder: String) -> Result<(), String> {
    let annotations = Path::new(&folder).join(".blueprint-sync").join("annotations");
    std::fs::create_dir_all(annotations).map_err(|error| error.to_string())
}

#[tauri::command]
fn list_project_pdfs(folder: String) -> Result<Vec<String>, String> {
    let mut names = Vec::new();
    let entries = std::fs::read_dir(&folder).map_err(|error| error.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if !file_type.is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if is_visible_pdf_name(&name) {
            names.push(name);
        }
    }
    names.sort();
    Ok(names)
}

#[tauri::command]
fn copy_file_into_folder(source: String, folder: String) -> Result<String, String> {
    let source_path = PathBuf::from(&source);
    let name = source_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "ファイル名を取得できません".to_string())?;
    let dest = Path::new(&folder).join(name);
    let source_canon = source_path.canonicalize().unwrap_or(source_path.clone());
    let dest_canon = dest.canonicalize().unwrap_or(dest.clone());
    if source_canon == dest_canon {
        return Ok(dest.to_string_lossy().into_owned());
    }
    std::fs::copy(&source_path, &dest).map_err(|error| error.to_string())?;
    Ok(dest.to_string_lossy().into_owned())
}

fn recent_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.join("recent-projects.json"))
}

#[tauri::command]
fn load_recent_projects(app: AppHandle) -> Result<Vec<RecentProject>, String> {
    let path = recent_path(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = std::fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_recent_projects(app: AppHandle, items: Vec<RecentProject>) -> Result<(), String> {
    let path = recent_path(&app)?;
    let raw = serde_json::to_string_pretty(&items).map_err(|error| error.to_string())?;
    std::fs::write(path, raw).map_err(|error| error.to_string())
}

#[tauri::command]
fn path_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).exists())
}
```

`save_pdf_file` を次に変更する:

```rust
#[tauri::command]
fn save_pdf_file(
    default_name: String,
    bytes: Vec<u8>,
    default_dir: Option<String>,
) -> Result<bool, String> {
    let mut dialog = rfd::FileDialog::new()
        .add_filter("PDF", &["pdf"])
        .set_file_name(&default_name);
    if let Some(dir) = default_dir {
        dialog = dialog.set_directory(dir);
    }
    let Some(path) = dialog.save_file() else {
        return Ok(false);
    };
    std::fs::write(path, bytes).map_err(|error| error.to_string())?;
    Ok(true)
}
```

`invoke_handler` に新コマンドをすべて登録する。既存コマンドは残す。

- [ ] **Step 4: Update `fileAccess.ts`**

```ts
export async function openPdfFromDisk(): Promise<{
  name: string;
  bytes: Uint8Array;
  path?: string;
} | null> {
  if (isTauriRuntime()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const selected = await invoke<{
      name: string;
      path: string;
      bytes: number[];
    } | null>("pick_pdf_file");
    if (!selected) {
      return null;
    }
    return {
      name: selected.name,
      path: selected.path,
      bytes: Uint8Array.from(selected.bytes),
    };
  }

  return pickFileInBrowser("application/pdf");
}

export async function savePdfToDisk(
  bytes: Uint8Array,
  defaultName: string,
  defaultDir?: string,
): Promise<boolean> {
  if (isTauriRuntime()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<boolean>("save_pdf_file", {
      defaultName,
      bytes,
      defaultDir: defaultDir ?? null,
    });
  }
  // 既存のブラウザダウンロード実装を残す
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: 既存 JS テスト PASS。Rust は `is_visible_pdf_name` と `connection_url` が PASS。

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/lib.rs src/lib/utils/fileAccess.ts
git commit -m "feat: add project folder and recent-project Tauri commands"
```

---

### Task 4: projectStore / projectIo / projectActions

**Files:**
- Create: `src/lib/stores/projectStore.svelte.ts`
- Create: `src/lib/utils/projectIo.ts`
- Create: `src/lib/utils/projectActions.ts`

**Interfaces:**
- Consumes: Task 1 の型と関数、Task 2 の persist、Task 3 の invoke 名、既存 `pdfStore` / `annotationStore`
- Produces:
  - `projectStore` のフィールド: `folder`, `meta`, `pdfs`, `currentPdf`, `error`, `recents`
  - `createProject(name: string): Promise<void>`
  - `openProject(folder?: string): Promise<void>`
  - `closeProject(): Promise<void>`
  - `addProjectLink(url: string, title: string): Promise<void>`
  - `removeProjectLink(id: string): Promise<void>`
  - `openProjectLink(url: string): Promise<void>`
  - `importPdfIntoProject(): Promise<void>`
  - `openProjectPdf(fileName: string): Promise<void>`
  - `persistCurrentAnnotations(): Promise<void>`
  - `refreshProjectPdfs(): Promise<void>`

- [ ] **Step 1: Implement `projectStore.svelte.ts`**

```ts
import type { ProjectMeta, RecentProject } from "$lib/utils/projectFormat";

class ProjectStore {
  folder = $state("");
  meta = $state<ProjectMeta | null>(null);
  pdfs = $state<string[]>([]);
  currentPdf = $state("");
  error = $state("");
  recents = $state<RecentProject[]>([]);

  get isOpen() {
    return Boolean(this.folder && this.meta);
  }

  reset() {
    this.folder = "";
    this.meta = null;
    this.pdfs = [];
    this.currentPdf = "";
    this.error = "";
  }
}

export const projectStore = new ProjectStore();
```

- [ ] **Step 2: Implement `projectIo.ts`**

```ts
import { invoke } from "@tauri-apps/api/core";
import {
  annotationFileName,
  parseProjectJson,
  serializeProjectJson,
  type ProjectMeta,
  type RecentProject,
} from "./projectFormat";
import { parseAnnotations, serializeAnnotations } from "./annotationPersist";
import type { PageObjects } from "./annotationPersist";

export async function pickFolder(): Promise<string | null> {
  return invoke<string | null>("pick_folder");
}

export async function initProjectDir(folder: string): Promise<void> {
  await invoke("init_project_dir", { folder });
}

export async function listProjectPdfs(folder: string): Promise<string[]> {
  return invoke<string[]>("list_project_pdfs", { folder });
}

export async function copyFileIntoFolder(source: string, folder: string): Promise<string> {
  return invoke<string>("copy_file_into_folder", { source, folder });
}

export async function loadRecentProjects(): Promise<RecentProject[]> {
  return invoke<RecentProject[]>("load_recent_projects");
}

export async function saveRecentProjects(items: RecentProject[]): Promise<void> {
  await invoke("save_recent_projects", { items });
}

export async function pathExists(path: string): Promise<boolean> {
  return invoke<boolean>("path_exists", { path });
}

export async function readTextFile(path: string): Promise<string> {
  const bytes = await invoke<number[]>("read_file_bytes", { path });
  return new TextDecoder().decode(Uint8Array.from(bytes));
}

export async function writeTextFile(path: string, text: string): Promise<void> {
  await invoke("write_file_bytes", { path, bytes: Array.from(new TextEncoder().encode(text)) });
}

export async function readBinaryFile(path: string): Promise<Uint8Array> {
  const bytes = await invoke<number[]>("read_file_bytes", { path });
  return Uint8Array.from(bytes);
}

export function projectJsonPath(folder: string): string {
  return `${folder}/.blueprint-sync/project.json`;
}

export function annotationPath(folder: string, pdfName: string): string {
  return `${folder}/.blueprint-sync/annotations/${annotationFileName(pdfName)}`;
}

export async function readProjectMeta(folder: string): Promise<ProjectMeta> {
  return parseProjectJson(await readTextFile(projectJsonPath(folder)));
}

export async function writeProjectMeta(folder: string, meta: ProjectMeta): Promise<void> {
  await writeTextFile(projectJsonPath(folder), serializeProjectJson(meta));
}

export async function readAnnotationFile(
  folder: string,
  pdfName: string,
): Promise<Record<number, PageObjects>> {
  const path = annotationPath(folder, pdfName);
  if (!(await pathExists(path))) {
    return {};
  }
  return parseAnnotations(await readTextFile(path));
}

export async function writeAnnotationFile(
  folder: string,
  pdfName: string,
  byPage: Record<number, PageObjects>,
): Promise<void> {
  await writeTextFile(annotationPath(folder, pdfName), serializeAnnotations(byPage));
}
```

Windows でも Tauri の `read_file_bytes` は `\` 混在パスを受け付ける。join は `` `${folder}/.blueprint-sync/...` `` でよい（Rust 側 `Path` が正規化する）。

- [ ] **Step 3: Implement `projectActions.ts`**

```ts
import { annotationStore } from "$lib/stores/annotationStore.svelte";
import { pdfStore } from "$lib/stores/pdfStore.svelte";
import { projectStore } from "$lib/stores/projectStore.svelte";
import { openPdfFromDisk } from "./fileAccess";
import { isTauriRuntime } from "./platform";
import {
  createProjectMeta,
  dropRecent,
  isAllowedLinkUrl,
  rememberRecent,
} from "./projectFormat";
import {
  annotationPath,
  copyFileIntoFolder,
  initProjectDir,
  listProjectPdfs,
  loadRecentProjects,
  pathExists,
  pickFolder,
  readAnnotationFile,
  readBinaryFile,
  readProjectMeta,
  saveRecentProjects,
  writeAnnotationFile,
  writeProjectMeta,
} from "./projectIo";

function requireTauri() {
  if (!isTauriRuntime()) {
    throw new Error("プロジェクト機能は Tauri アプリ上でのみ利用できます");
  }
}

async function remember(name: string, path: string) {
  const next = rememberRecent(projectStore.recents, { name, path });
  projectStore.recents = next;
  await saveRecentProjects(next);
}

export async function loadRecentsIntoStore(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  const items = await loadRecentProjects();
  const kept = [];
  for (const item of items) {
    if (await pathExists(item.path)) {
      kept.push(item);
    }
  }
  projectStore.recents = kept;
  if (kept.length !== items.length) {
    await saveRecentProjects(kept);
  }
}

export async function createProject(name: string): Promise<void> {
  requireTauri();
  const folder = await pickFolder();
  if (!folder) {
    return;
  }
  await initProjectDir(folder);
  const meta = createProjectMeta(name);
  await writeProjectMeta(folder, meta);
  projectStore.folder = folder;
  projectStore.meta = meta;
  projectStore.pdfs = await listProjectPdfs(folder);
  projectStore.currentPdf = "";
  projectStore.error = "";
  await remember(meta.name, folder);
}

export async function openProject(folder?: string): Promise<void> {
  requireTauri();
  const selected = folder ?? (await pickFolder());
  if (!selected) {
    return;
  }
  try {
    const meta = await readProjectMeta(selected);
    projectStore.folder = selected;
    projectStore.meta = meta;
    projectStore.pdfs = await listProjectPdfs(selected);
    projectStore.currentPdf = "";
    projectStore.error = "";
    pdfStore.clear();
    annotationStore.clear();
    await remember(meta.name, selected);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "プロジェクトを開けませんでした";
    projectStore.error = message.includes("Invalid project")
      ? "project.json が見つからないか、内容が不正です"
      : message;
    projectStore.reset();
    projectStore.error = projectStore.error || message;
    if (folder) {
      projectStore.recents = dropRecent(projectStore.recents, selected);
      await saveRecentProjects(projectStore.recents);
    }
    throw new Error(projectStore.error);
  }
}

export async function closeProject(): Promise<void> {
  await persistCurrentAnnotations().catch(() => undefined);
  projectStore.reset();
  pdfStore.clear();
  annotationStore.clear();
}

export async function addProjectLink(url: string, title: string): Promise<void> {
  if (!projectStore.meta || !projectStore.folder) {
    return;
  }
  if (!isAllowedLinkUrl(url.trim())) {
    projectStore.error = "http または https の URL だけ追加できます";
    return;
  }
  projectStore.error = "";
  projectStore.meta = {
    ...projectStore.meta,
    links: [
      ...projectStore.meta.links,
      { id: crypto.randomUUID(), title: title.trim(), url: url.trim() },
    ],
  };
  await writeProjectMeta(projectStore.folder, projectStore.meta);
}

export async function removeProjectLink(id: string): Promise<void> {
  if (!projectStore.meta || !projectStore.folder) {
    return;
  }
  projectStore.meta = {
    ...projectStore.meta,
    links: projectStore.meta.links.filter((link) => link.id !== id),
  };
  await writeProjectMeta(projectStore.folder, projectStore.meta);
}

export async function openProjectLink(url: string): Promise<void> {
  if (!isAllowedLinkUrl(url)) {
    return;
  }
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(url);
}

export async function persistCurrentAnnotations(): Promise<void> {
  if (!projectStore.folder || !projectStore.currentPdf) {
    return;
  }
  try {
    await writeAnnotationFile(
      projectStore.folder,
      projectStore.currentPdf,
      annotationStore.exportByPage(),
    );
  } catch (error) {
    pdfStore.status =
      error instanceof Error ? error.message : "注釈の保存に失敗しました";
  }
}

export async function openProjectPdf(fileName: string): Promise<void> {
  if (!projectStore.folder) {
    return;
  }
  await persistCurrentAnnotations();
  const bytes = await readBinaryFile(`${projectStore.folder}/${fileName}`);
  annotationStore.importByPage(await readAnnotationFile(projectStore.folder, fileName));
  await pdfStore.load(fileName, bytes);
  projectStore.currentPdf = fileName;
}

export async function importPdfIntoProject(): Promise<void> {
  if (!projectStore.folder) {
    return;
  }
  const file = await openPdfFromDisk();
  if (!file) {
    return;
  }
  await persistCurrentAnnotations();
  let name = file.name;
  if (file.path) {
    const dest = await copyFileIntoFolder(file.path, projectStore.folder);
    name = dest.split(/[/\\]/).pop() ?? file.name;
  } else {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("write_file_bytes", {
      path: `${projectStore.folder}/${file.name}`,
      bytes: Array.from(file.bytes),
    });
  }
  projectStore.pdfs = await listProjectPdfs(projectStore.folder);
  await openProjectPdf(name);
}

export async function refreshProjectPdfs(): Promise<void> {
  if (!projectStore.folder) {
    return;
  }
  projectStore.pdfs = await listProjectPdfs(projectStore.folder);
}
```

`openProject` の error 代入が二重になっている。実装時は次に直す:

```ts
    const friendly = message.includes("Invalid project")
      ? "project.json が見つからないか、内容が不正です"
      : message;
    if (folder) {
      projectStore.recents = dropRecent(projectStore.recents, selected);
      await saveRecentProjects(projectStore.recents);
    }
    projectStore.reset();
    projectStore.error = friendly;
    throw new Error(friendly);
```

- [ ] **Step 4: Add `pdfStore.clear()`**

`src/lib/stores/pdfStore.svelte.ts` に追加:

```ts
  clear() {
    this.document?.destroy();
    this.name = "未読み込み";
    this.bytes = null;
    this.document = null;
    this.pageCount = 0;
    this.pageIndex = 0;
    this.status = "";
  }
```

- [ ] **Step 5: Run JS tests**

Run: `npm test`

Expected: PASS（このタスクは UI なし。既存テストが壊れないこと）

- [ ] **Step 6: Commit**

```bash
git add src/lib/stores/projectStore.svelte.ts src/lib/utils/projectIo.ts src/lib/utils/projectActions.ts src/lib/stores/pdfStore.svelte.ts
git commit -m "feat: add project store and folder actions"
```

---

### Task 5: 起動画面とメイン画面の接続

**Files:**
- Create: `src/lib/components/ProjectHome.svelte`
- Create: `src/lib/components/ProjectSidebar.svelte`
- Modify: `src/routes/+page.svelte`

**Interfaces:**
- Consumes: `projectStore`, `createProject`, `openProject`, `closeProject`, `loadRecentsIntoStore`, `addProjectLink`, `removeProjectLink`, `openProjectLink`, `openProjectPdf`, `displayLinkTitle`
- Produces: 未選択時は Home、選択時は左サイドバー＋現行エディタ

- [ ] **Step 1: Implement `ProjectHome.svelte`**

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { projectStore } from "$lib/stores/projectStore.svelte";
  import { createProject, loadRecentsIntoStore, openProject } from "$lib/utils/projectActions";
  import { isTauriRuntime } from "$lib/utils/platform";

  let name = $state("");
  let busy = $state(false);

  onMount(() => {
    void loadRecentsIntoStore();
  });

  async function run(action: () => Promise<void>) {
    busy = true;
    try {
      await action();
    } catch (error) {
      projectStore.error = error instanceof Error ? error.message : "操作に失敗しました";
    } finally {
      busy = false;
    }
  }
</script>

<div class="flex h-full flex-col items-center justify-center bg-slate-950 px-6 text-slate-100">
  <div class="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6">
    <h1 class="mb-1 text-xl font-semibold text-cyan-300">Blueprint Sync</h1>
    <p class="mb-6 text-sm text-slate-400">先にローカルのプロジェクトフォルダを開いてください</p>

    {#if !isTauriRuntime()}
      <p class="text-sm text-amber-300">プロジェクト機能は Tauri アプリ上でのみ利用できます。</p>
    {:else}
      <label class="mb-3 block text-xs text-slate-400">
        新しいプロジェクト名
        <input
          class="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
          bind:value={name}
          placeholder="現場A"
        />
      </label>
      <button
        class="mb-3 w-full rounded bg-cyan-700 px-3 py-2 text-sm"
        disabled={busy}
        onclick={() => run(() => createProject(name))}
      >
        フォルダを選んで作成
      </button>
      <button
        class="mb-6 w-full rounded bg-slate-800 px-3 py-2 text-sm"
        disabled={busy}
        onclick={() => run(() => openProject())}
      >
        既存プロジェクトを開く
      </button>

      {#if projectStore.recents.length > 0}
        <h2 class="mb-2 text-xs text-slate-500">最近使ったプロジェクト</h2>
        <ul class="space-y-1">
          {#each projectStore.recents as recent (recent.path)}
            <li>
              <button
                class="w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-800"
                disabled={busy}
                onclick={() => run(() => openProject(recent.path))}
              >
                <div>{recent.name}</div>
                <div class="truncate text-[11px] text-slate-500">{recent.path}</div>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}

    {#if projectStore.error}
      <p class="mt-4 text-sm text-rose-300">{projectStore.error}</p>
    {/if}
  </div>
</div>
```

- [ ] **Step 2: Implement `ProjectSidebar.svelte`**

```svelte
<script lang="ts">
  import { projectStore } from "$lib/stores/projectStore.svelte";
  import {
    addProjectLink,
    closeProject,
    openProjectLink,
    openProjectPdf,
    removeProjectLink,
  } from "$lib/utils/projectActions";
  import { displayLinkTitle } from "$lib/utils/projectFormat";

  let url = $state("");
  let title = $state("");
</script>

<aside class="flex w-72 shrink-0 flex-col border-r border-slate-700 bg-slate-900">
  <div class="border-b border-slate-800 px-3 py-3">
    <div class="text-sm font-semibold text-cyan-300">{projectStore.meta?.name}</div>
    <div class="truncate text-[11px] text-slate-500">{projectStore.folder}</div>
  </div>

  <section class="min-h-0 flex-1 overflow-auto px-3 py-3">
    <h2 class="mb-2 text-xs text-slate-500">図面 PDF</h2>
    {#if projectStore.pdfs.length === 0}
      <p class="text-xs text-slate-500">「開く」で PDF をこのフォルダに追加してください</p>
    {:else}
      <ul class="space-y-1">
        {#each projectStore.pdfs as file (file)}
          <li>
            <button
              class="w-full truncate rounded px-2 py-1 text-left text-sm {projectStore.currentPdf === file
                ? 'bg-cyan-900 text-cyan-100'
                : 'hover:bg-slate-800'}"
              onclick={() => openProjectPdf(file)}
            >
              {file}
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    <h2 class="mb-2 mt-5 text-xs text-slate-500">OneDrive リンク</h2>
    <input
      class="mb-2 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs"
      placeholder="https://1drv.ms/..."
      bind:value={url}
    />
    <input
      class="mb-2 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs"
      placeholder="表示名（任意）"
      bind:value={title}
    />
    <button
      class="mb-3 w-full rounded bg-slate-800 px-2 py-1 text-xs"
      onclick={async () => {
        await addProjectLink(url, title);
        if (!projectStore.error) {
          url = "";
          title = "";
        }
      }}
    >
      リンクを追加
    </button>
    <ul class="space-y-1">
      {#each projectStore.meta?.links ?? [] as link (link.id)}
        <li class="flex items-center gap-1">
          <button
            class="min-w-0 flex-1 truncate text-left text-xs text-cyan-300 underline"
            onclick={() => openProjectLink(link.url)}
          >
            {displayLinkTitle(link)}
          </button>
          <button class="text-[11px] text-slate-500" onclick={() => removeProjectLink(link.id)}>
            削除
          </button>
        </li>
      {/each}
    </ul>
  </section>

  <button class="border-t border-slate-800 px-3 py-2 text-xs text-slate-400" onclick={closeProject}>
    プロジェクトを閉じる
  </button>
</aside>
```

- [ ] **Step 3: Update `+page.svelte`**

既存の編集 UI を `projectStore.isOpen` のときにだけ出す。

```svelte
<script lang="ts">
  import ConnectionPanel from "$lib/components/ConnectionPanel.svelte";
  import PdfViewer from "$lib/components/PdfViewer.svelte";
  import ProjectHome from "$lib/components/ProjectHome.svelte";
  import ProjectSidebar from "$lib/components/ProjectSidebar.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import Toolbar from "$lib/components/Toolbar.svelte";
  import { projectStore } from "$lib/stores/projectStore.svelte";
  import { viewerApi } from "$lib/stores/viewerApi";

  let connectionOpen = $state(false);
  let cameraInput: HTMLInputElement | undefined = $state();

  function requestPhoto() {
    cameraInput?.click();
  }

  async function onPhotoSelected(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      await viewerApi.addPhoto(file);
    }
    input.value = "";
  }
</script>

{#if !projectStore.isOpen}
  <ProjectHome />
{:else}
  <div class="flex h-full bg-slate-950 text-slate-100">
    <ProjectSidebar />
    <div class="flex min-w-0 flex-1 flex-col">
      <Toolbar
        onToggleConnection={() => (connectionOpen = !connectionOpen)}
        onRequestPhoto={requestPhoto}
      />
      <div class="relative flex min-h-0 flex-1 flex-col">
        <PdfViewer />
        <ConnectionPanel bind:open={connectionOpen} />
      </div>
      <StatusBar />
    </div>
  </div>
{/if}

<input
  bind:this={cameraInput}
  class="hidden"
  type="file"
  accept="image/*"
  capture="environment"
  onchange={onPhotoSelected}
/>
```

- [ ] **Step 4: Manual check in browser (`npm run dev`)**

Expected: 起動画面が出て、「Tauri アプリ上でのみ利用できます」と表示される。キャンバスは出ない。

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ProjectHome.svelte src/lib/components/ProjectSidebar.svelte src/routes/+page.svelte
git commit -m "feat: gate the editor behind a project home screen"
```

---

### Task 6: ツールバーと注釈のディスク保存

**Files:**
- Modify: `src/lib/components/Toolbar.svelte`
- Modify: `src/lib/components/PdfViewer.svelte`（描画ロジックは触らず、ドロップ時の読み込み先だけ）

**Interfaces:**
- Consumes: `importPdfIntoProject`, `persistCurrentAnnotations`, `projectStore.folder`
- Produces: 「開く」はプロジェクトフォルダへ PDF を追加。「保存」は注釈 JSON も書き、書き出しダイアログの初期フォルダはプロジェクト

- [ ] **Step 1: Change Toolbar open / save**

`openPdf` を `importPdfIntoProject` に置き換える。

`exportPdf` の末尾で `await persistCurrentAnnotations()` を呼ぶ。`annotationStore.dirty = false` は persist 成功後でも、合成 PDF 保存成功時は現行どおり false にする。

`savePdfToDisk` に `projectStore.folder || undefined` を渡す。

```ts
import { importPdfIntoProject, persistCurrentAnnotations } from "$lib/utils/projectActions";
import { projectStore } from "$lib/stores/projectStore.svelte";

async function openPdf() {
  await importPdfIntoProject();
}

async function exportPdf() {
  if (!pdfStore.bytes) {
    pdfStore.status = "先にPDFを開いてください";
    return;
  }
  const overlays = await viewerApi.exportOverlays();
  const output = await embedAnnotationPngOnPdf(pdfStore.bytes, overlays);
  const saved = await savePdfToDisk(
    output,
    suggestedExportName(pdfStore.name),
    projectStore.folder || undefined,
  );
  await persistCurrentAnnotations();
  pdfStore.status = saved ? "PDFを保存しました" : "保存をキャンセルしました";
  if (saved) {
    annotationStore.dirty = false;
  }
}
```

- [ ] **Step 2: Keep drag-and-drop inside the project**

`PdfViewer.svelte` のドロップ処理で `annotationStore.clear(); await pdfStore.load(...); sendCurrentPdf()` している箇所を、プロジェクトが開いているときは次にする。描画関数（`renderPdfPage` / Fabric イベント）は変更しない。

```ts
import { importPdfIntoProject } from "$lib/utils/projectActions";
import { projectStore } from "$lib/stores/projectStore.svelte";

// HTML drop と Tauri drop の両方:
if (projectStore.isOpen) {
  // ドロップされたファイルをプロジェクトに入れるため、
  // ブラウザ File しか無い場合は write_file_bytes でフォルダへ書いて refresh + open。
  // Tauri path がある場合は copyFileIntoFolder して openProjectPdf。
}
```

HTML drop（`File` のみ）:

```ts
if (file?.type === "application/pdf" && projectStore.folder) {
  await persistCurrentAnnotations();
  const { invoke } = await import("@tauri-apps/api/core");
  const bytes = await readFileAsBytes(file);
  await invoke("write_file_bytes", {
    path: `${projectStore.folder}/${file.name}`,
    bytes: Array.from(bytes),
  });
  projectStore.pdfs = await listProjectPdfs(projectStore.folder);
  await openProjectPdf(file.name);
  sendCurrentPdf();
}
```

Tauri drop（`path` あり）:

```ts
if (projectStore.folder) {
  await persistCurrentAnnotations();
  const dest = await copyFileIntoFolder(path, projectStore.folder);
  const name = dest.split(/[/\\]/).pop() ?? "document.pdf";
  projectStore.pdfs = await listProjectPdfs(projectStore.folder);
  await openProjectPdf(name);
  sendCurrentPdf();
}
```

`copyFileIntoFolder` と `listProjectPdfs` は `projectIo.ts` から import する。`persistCurrentAnnotations` と `openProjectPdf` は `projectActions.ts` から import する。

- [ ] **Step 3: Run tests**

Run: `npm test`

Expected: PASS

- [ ] **Step 4: Manual verification in Tauri**

Run: `npm run tauri dev`

確認:

1. 起動画面だけが出る
2. 空フォルダを選んで作成すると `.blueprint-sync/project.json` ができる
3. 「開く」で PDF を追加するとフォルダ直下にコピーされ、サイドバーに出る
4. ペンで書いて別 PDF に切り替えると `annotations/<name>.pdf.json` ができる。戻すと線が残る
5. OneDrive URL を追加し、クリックでブラウザが開く。`file://` は追加できない
6. 「保存」で注釈 JSON が更新され、書き出しダイアログの初期位置がプロジェクトフォルダになる
7. 「プロジェクトを閉じる」で起動画面に戻る
8. 最近使った項目から同じフォルダを再開できる
9. `project.json` の無いフォルダを「既存を開く」するとエラーになり、編集画面に入らない

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/Toolbar.svelte src/lib/components/PdfViewer.svelte
git commit -m "feat: store drawings and annotations in the project folder"
```

---

## Self-Review

**Spec coverage:**

| Spec | Task |
|---|---|
| 起動はプロジェクト必須 | 5 |
| 新規作成（名前＋フォルダ、`.blueprint-sync/`） | 3, 4, 5 |
| 既存は `project.json` 必須。無ければエラー | 4, 5 |
| フォルダ直下 PDF 一覧、`.blueprint-sync` 除外 | 1, 3, 5 |
| PDF 追加はフォルダへコピー | 3, 4, 6 |
| OneDrive リンク追加、クリックでブラウザ、http(s) のみ | 1, 4, 5 |
| 注釈を切替時と「保存」時に書く | 2, 4, 6 |
| 注釈ファイル名の安全性 | 1 |
| 最近使った最大 8、消滅したら除外 | 1, 3, 4 |
| 書き出し初期フォルダ | 3, 6 |
| 閉じると Home | 4, 5 |
| Tauri のみ | 4, 5 |
| PDF 描画エンジンは触らない | 全タスク |

**Placeholder scan:** なし。

**Type consistency:** `ProjectMeta` / `ProjectLink` / `RecentProject` / `PageObjects` / invoke 名は Task 1–4 で固定。
