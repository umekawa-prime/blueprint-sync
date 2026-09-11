# テキスト背景色 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** テキストに文字色・背景色を付け、選択中の文字へツールバーから反映できるようにする。

**Architecture:** 色の正規化と IText 判定は `textStyle.ts`。状態は `toolStore` の `textColor` / `textBackground`。UI は `TextPalette.svelte`。キャンバスは `PdfViewer.svelte` が選択同期と `IText` 生成・更新を行う。

**Tech Stack:** Svelte 5, Fabric IText, Vitest

## Global Constraints

- `.svelte` に座標計算を足さない
- ペンの `penColor` とは独立
- 背景初期値はなし（空文字）
- 文字色初期値は `#E81123`
- 背景ありの padding は 6、なしは 0
- コミットはユーザー依頼があるまでしない

## File Structure

Create:
- `src/lib/utils/textStyle.ts` / `textStyle.test.ts`
- `src/lib/components/TextPalette.svelte`

Modify:
- `src/lib/stores/toolStore.svelte.ts`
- `src/lib/components/Toolbar.svelte`
- `src/lib/components/PdfViewer.svelte`
- `src/routes/page.layout.test.ts`

---

### Task 1: textStyle ユーティリティ

**Files:**
- Create: `src/lib/utils/textStyle.ts`
- Test: `src/lib/utils/textStyle.test.ts`

- [ ] 失敗するテストを書く
- [ ] 実装して通す

`textStyleFromColors(fill, background)` が fill / 正規化済み background / padding を返す。なし・transparent・空は background `""` かつ padding `0`。色ありは padding `6`。`isTextAnnotation` は `i-text` / `textbox`。`textStyleFromSelection` は非テキストなら `null`。

### Task 2: toolStore と TextPalette

**Files:**
- Modify: `src/lib/stores/toolStore.svelte.ts`
- Create: `src/lib/components/TextPalette.svelte`
- Modify: `src/lib/components/Toolbar.svelte`
- Modify: `src/routes/page.layout.test.ts`

- [ ] レイアウトテスト（Toolbar が TextPalette をテキストの横に置く）
- [ ] `textColor` / `textBackground` をストアに足す
- [ ] ペンと同じ色グリッド＋背景「なし」。色選択で `setTool("pen")` しない
- [ ] Toolbar のテキストボタン横に配置

### Task 3: PdfViewer で生成・選択同期・反映

**Files:**
- Modify: `src/lib/components/PdfViewer.svelte`

- [ ] 新規 IText に `textStyleFromColors(toolStore.textColor, toolStore.textBackground)` を使う（`penColor` はやめる）
- [ ] `selection:created` / `selection:updated` でストアへ同期
- [ ] `textColor` / `textBackground` の effect で選択中 IText を更新し、変わったときだけ `emitObject("modify")`
- [ ] `npm test` と `npm run check`
