# Chrome 型ウィンドウ枠 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** タブバーを Chrome 型のタイトルバーにし、デスクトップ Tauri でドラッグと最小化・最大化・閉じるを提供する。

**Architecture:** `decorations: false`。ウィンドウ操作は `windowActions.ts`。表示判定は `isDesktopTauriRuntime`。UI は `ProjectTabBar` + `WindowControls`。

**Tech Stack:** Svelte 5, Tauri v2, Vitest

**Spec:** `docs/superpowers/specs/2026-09-06-chrome-window-chrome-design.md`

## Global Constraints

- `.svelte` に Tauri `invoke` / `getCurrentWindow` を直接書かない
- ブラウザとモバイルではウィンドウボタンを出さない
- コミットはユーザー依頼があるまでしない
- Windows 11 スナッププラグインは入れない

## File Structure

Create: `src/lib/utils/windowActions.ts`, `src/lib/utils/windowActions.test.ts`, `src/lib/components/WindowControls.svelte`  
Modify: `src/lib/utils/platform.ts`, `src/lib/utils/platform.test.ts`, `src/lib/components/ProjectTabBar.svelte`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src/routes/page.layout.test.ts`

---

### Task 1: 表示判定と window API

`isDesktopTauriRuntime(isTauri, platform)` を `platform.ts` に追加。`usesRfdFileDialog` はそれを使う。`windowActions.ts` は `isTauriRuntime` のときだけ `getCurrentWindow` を dynamic import。

テスト: デスクトップ Tauri のみ true。minimize/toggleMaximize/close/startDragging が window メソッドを呼ぶ。非 Tauri では呼ばない。

### Task 2: 設定と UI

`decorations: false`。capability に 4 権限。`ProjectTabBar` はデスクトップ Tauri なら常時表示。`data-tauri-drag-region` は空きだけ。`WindowControls` は utils を呼ぶ。ダブルクリックで `toggleMaximizeAppWindow`。
