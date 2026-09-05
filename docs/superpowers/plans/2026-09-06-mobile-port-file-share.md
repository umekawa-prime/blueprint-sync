# モバイル移管（ファイル共有）Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. コミットはユーザー依頼があるまでしない。

**Goal:** Android / iOS でも同じアプリとして起動し、サンドボックスにプロジェクトを置き、`.bpsync.zip` で出し入れできるようにする。

**Architecture:** 描画エンジンは触らない。I/O は `src/lib/utils/`、ネイティブは `src-tauri`。モバイルの正本は `{appDataDir}/projects/{id}/`。共有の正はプロジェクト一式 ZIP。chrome だけ幅と OS で分ける。

**Tech Stack:** Svelte 5, SvelteKit SPA, Tauri v2, fflate, Vitest

**Spec:** `docs/superpowers/specs/2026-09-06-mobile-port-file-share-design.md`

## Global Constraints

- `.svelte` に Tauri `invoke` や座標計算を足さない
- `pdfRenderer.ts` / Fabric 本体 / `pdfCoords.ts` は変更しない
- データ形式（`project.json` / 注釈 JSON / PDF 配置 / ピン data URL）は変えない
- ZIP 直下は `図面/` `工程表/` `.blueprint-sync/`（根ディレクトリ名なし）
- 同じ `id` は黙ってマージしない
- 注釈 persist 失敗時は共有しない
- `usesRfdFileDialog()` が false のときフォルダ選択 UI を出さない
- コミットはユーザー依頼があるまでしない
- ウィンドウボタンと `data-tauri-drag-region` はモバイルに出さない

## File Structure

Create:
- `src/lib/utils/projectPackage.ts` / `projectPackage.test.ts`
- `src/lib/utils/shareFile.ts` / `shareFile.test.ts`
- `src/lib/utils/chromeLayout.ts` / `chromeLayout.test.ts`
- `src/lib/stores/viewportStore.svelte.ts`
- `src/lib/components/ProjectDrawer.svelte`
- `src/lib/components/ToolbarOverflow.svelte`
- `src/lib/components/ProjectSheet.svelte`
- `src-tauri/capabilities/mobile.json`
- `src-tauri/src/share.rs`
- `src-tauri/src/sandbox.rs`

Modify:
- `src/lib/utils/platform.ts`, `cameraCapture.ts`, `photoPinUi.ts`, `fileAccess.ts`, `projectIo.ts`, `projectActions.ts`
- `src/lib/components/ProjectHome.svelte`, `Toolbar.svelte`, `ProjectSidebar.svelte`, `ProjectTabBar.svelte`, `PhotoPinLayer.svelte`, `ConnectionPanel.svelte`, `CameraCapture.svelte`
- `src/routes/+page.svelte`
- `src-tauri/src/lib.rs`, `tauri.conf.json`, `Info.ios.plist`, `capabilities/default.json`

---

### Task 1: 一式 ZIP pack / unpack

単体テストで `.blueprint-sync/project.json`・図面・注釈（ピン含む）の往復、`project.json` 無しは一式扱いしない、`..` / `__MACOSX` / 他のドットセグメント拒否、`.blueprint-sync` は許可。ファイル名は `{sanitizedName}.bpsync.zip`。

### Task 2: プラットフォーム分岐

`usesSandboxProjects()` = Tauri かつ `!usesRfdFileDialog()`。電話幅 `< 768`。カメラはモバイルで `environment` 先、デスクトップの USB 優先は維持。ピンは電話幅で tap-preview、タブレット以上は hover。

### Task 3: Tauri サンドボックス / 共有 / 権限

`sandbox_projects_dir` / `list_project_files` / `remove_dir_all` / `share_file` / `list_sandbox_projects`。モバイルの `pick_*` は `Ok(None)`。capability を desktop / mobile に分ける。iOS UTI、Android CAMERA と SEND/VIEW。WebView getUserMedia 許可。

### Task 4: 作成・開く・取り込む・共有

サンドボックス新規は名前入力。一覧から開く。取り込みは PDF / 通常 ZIP / 一式 ZIP。同一 id は上書き確認。共有前に persist。

### Task 5: モバイル chrome

ホームからフォルダ選択を外す。電話幅はハンバーガー＋下ツールバー。タブはシート。接続ラベルはホスト／クライアント。共有ボタン。
