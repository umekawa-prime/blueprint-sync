# ペン直線と先端形状 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** ペンの Shift＋クリックで直線／折れ線を書き、始点・終点の形をペンパネルから選べるようにする。

**Architecture:** 頂点セッションと先端ジオメトリは `src/lib/utils/` の純関数。PdfViewer は Fabric の Polyline / Path / Group を組み立てるだけ。設定は `toolStore` の次ストローク用。

**Tech Stack:** Svelte 5, Fabric 7, Vitest

**Spec:** `docs/superpowers/specs/2026-09-08-pen-straight-stroke-design.md`

## Global Constraints

- `.svelte` に座標計算や先端三角形の数式を書かない
- カスタム Fabric クラスは登録しない。標準の Polyline / Path / Circle / Polygon / Group
- 書いた注釈の再スタイルはしない
- タッチ／スタイラスでは直線モードに入らない
- コミットはユーザー依頼があるまでしない

## File Structure

Create: `src/lib/utils/straightStroke.ts`, `src/lib/utils/straightStroke.test.ts`, `src/lib/utils/strokeCaps.ts`, `src/lib/utils/strokeCaps.test.ts`  
Modify: `src/lib/utils/penPalette.ts`, `src/lib/utils/penPalette.test.ts`, `src/lib/stores/toolStore.svelte.ts`, `src/lib/components/PenPalette.svelte`, `src/lib/components/PdfViewer.svelte`

---

### Task 1: 直線セッションと入力判定

`shouldUseStraightStroke({ tool, shiftKey, pointerType, ctrlOrMeta })` はペン＋Shift＋mouse のみ true。ctrl/meta 付きは false。

セッションは immutable。`addStraightPoint` は連続同一点を無視。`commitStraightPoints` は 2 点未満なら null。`rubberBandPoints` は既存頂点＋ポインタ。

### Task 2: 先端ジオメトリ

`strokeCaps({ points, startCap, endCap, color, width })` が primitive 配列を返す。黒丸 fill は常に `#000000`。矢印 fill は線色。方向は外側（始点は第2点から始点へ、終点は最後から2点目から終点へ）。

`pointsFromPathCommands` は path コマンド末尾の x,y を頂点にする。

### Task 3: ストアとペンパネル

`toolStore.penStartCap` / `penEndCap` の初期値は `"none"`。パネルに始点・終点の3ボタン。選択で cap を更新しペンツールにする。

### Task 4: PdfViewer 配線

Shift 中は `isDrawingMode = false`。クリックで頂点、移動でプレビュー（id なし、persist しない）。keyup Shift で確定。Esc でキャンセル。`path:created` 後に先端があれば Group に包む。
