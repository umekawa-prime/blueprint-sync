# JWW を Jw_cad で開く Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** サイドバーの JWW/JWC クリックで Jw_cad を起動し、右クリックで `図面/` へ PDF 変換できるようにする。

**Architecture:** Windows の `open_cad_in_jwcad` がショートカット / `C:\jww` から exe を探し、プロジェクト内パスを引数に spawn する。クリックは変換表示をやめる。変換は既存 `convertCadBytesToPdf` で `図面/` に書く。

**Tech Stack:** Tauri v2 / Rust, Svelte 5, Vitest, cargo test

## Global Constraints

- `.svelte` に I/O やパス探索を足さない
- クリックではアプリ内 PDF を切り替えない
- 変換は上書きしない
- コミットはユーザー依頼があるまでしない

## File Structure

Create: `src-tauri/src/jwcad.rs`  
Modify: `src-tauri/src/lib.rs`, `src/lib/utils/cadImport.ts`, `cadImport.test.ts`, `projectActions.ts`, `projectActions.test.ts`, `ProjectSidebar.svelte`, `page.layout.test.ts`

---

### Task 1: Jw_cad 起動（Rust）

- lnk バイトから `C:\…\Jw_win.exe` を取るテスト
- 候補順（ProgramData lnk → AppData lnk → `C:\jww\Jw_win.exe` → `C:\jww\jww.exe`）
- コマンド `open_cad_in_jwcad`。非 Windows は日本語エラー
- `.jww` / `.jwc` 以外と欠けるファイルはエラー

### Task 2: クリックで起動（フロント）

- `openCadFileInJwCad(path)` が `invoke("open_cad_in_jwcad", { path })`
- `openProjectPdf` の CAD 分岐は起動のみ。`pdfStore.load` しない
- 既存「変換して開く」テストを書き換える

### Task 3: PDFに変換

- `convertCadFileToDrawingPdf(relPath)`
- サイドバー右クリックに「PDFに変換」（CAD ソースのみ）
- 同名エラーと「開いている図面は変えない」テスト
- `npm test` と `cargo test -p blueprint-sync --lib`
