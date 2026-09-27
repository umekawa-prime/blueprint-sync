# 電気設備スタンプ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 選択とペンの間に「図形」ツールを足し、電気設備の6記号をクリックで連続配置できるようにする。

**Architecture:** 記号のジオメトリは `stampDraw.ts` の純関数。Fabric Group の組み立ては `stampFabric.ts`。PdfViewer はクリック座標とペン色を渡して `add` するだけ。既存の矩形・楕円・矢印線は触らない。

**Tech Stack:** Svelte 5, Fabric 7, Vitest

**Spec:** `docs/superpowers/specs/2026-09-28-electrical-stamp-symbols-design.md`

## Global Constraints

- `.svelte` に円や対角の数式を書かない
- カスタム Fabric クラスは登録しない
- `annotationRole` は既存の `"shape"` を使う
- 矩形・楕円・矢印線のドラッグは残す
- コミットはユーザー依頼があるまでしない

## File Structure

Create: `src/lib/utils/stampDraw.ts`, `src/lib/utils/stampDraw.test.ts`, `src/lib/utils/stampFabric.ts`, `src/lib/utils/stampFabric.test.ts`, `src/lib/components/ShapePalette.svelte`  
Modify: `src/lib/utils/drawingTools.ts`, `src/lib/utils/drawingTools.test.ts`, `src/lib/utils/fabricPointer.ts`, `src/lib/utils/fabricPointer.test.ts`, `src/lib/stores/toolStore.svelte.ts`, `src/lib/components/Toolbar.svelte`, `src/lib/components/PdfViewer.svelte`

---

### Task 1: 記号ジオメトリ

`stampSize(pageWidth)` は `pageWidth * 0.028`、下限 16。

`stampPrimitives(kind, center, size)` は中心と外接サイズ（照明円の直径）から primitive 配列を返す。

- [ ] **Step 1: Write the failing test** in `src/lib/utils/stampDraw.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { stampPrimitives, stampSize } from "./stampDraw";

describe("stampSize", () => {
  it("uses 2.8% of the page width, with a 16px floor", () => {
    expect(stampSize(1000)).toBe(28);
    expect(stampSize(100)).toBe(16);
  });
});

describe("stampPrimitives", () => {
  const center = { x: 100, y: 50 };
  const size = 40;

  it("draws a lighting circle, concentric ceiling, and filled downlight", () => {
    expect(stampPrimitives("light", center, size)).toEqual([
      { kind: "circle", x: 100, y: 50, r: 20, fill: false },
    ]);
    expect(stampPrimitives("ceiling", center, size)).toEqual([
      { kind: "circle", x: 100, y: 50, r: 20, fill: false },
      { kind: "circle", x: 100, y: 50, r: 11, fill: false },
    ]);
    expect(stampPrimitives("downlight", center, size)).toEqual([
      { kind: "circle", x: 100, y: 50, r: 20, fill: false },
      { kind: "circle", x: 100, y: 50, r: 8, fill: true },
    ]);
  });

  it("draws outlet X, switch square, and panel rectangle with a diagonal", () => {
    expect(stampPrimitives("outlet", center, size)).toEqual([
      { kind: "circle", x: 100, y: 50, r: 20, fill: false },
      { kind: "line", x1: 86, y1: 36, x2: 114, y2: 64 },
      { kind: "line", x1: 114, y1: 36, x2: 86, y2: 64 },
    ]);
    expect(stampPrimitives("switch", center, size)).toEqual([
      { kind: "rect", left: 80, top: 30, width: 40, height: 40 },
    ]);
    expect(stampPrimitives("panel", center, size)).toEqual([
      { kind: "rect", left: 73, top: 30, width: 54, height: 40 },
      { kind: "line", x1: 73, y1: 30, x2: 127, y2: 70 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/utils/stampDraw.test.ts`

- [ ] **Step 3: Implement `stampDraw.ts`**

Kinds: `light` | `ceiling` | `downlight` | `outlet` | `switch` | `panel`.  
Ceiling inner radius is `round(r * 0.55)` → 11 when r=20. Downlight fill radius is `round(r * 0.4)` → 8. Outlet X inset is `round(r * 0.7)` from center (14 when r=20). Panel width is `round(size * 1.35)` → 54.

Also export `STAMP_OPTIONS` with labels 照明 / シーリング / ダウンライト / コンセント / スイッチ / 分電盤.

- [ ] **Step 4: Run test to verify it passes**

---

### Task 2: Fabric 生成

`createStampObject(kind, center, pageWidth, { color, width })` は primitive を Circle / Rect / Line にして Group に包み、`annotationRole: "shape"` を付ける。子は中心 (0,0) 相対。Group は `originX/Y: "center"`、`left/top` がクリック位置。

- [ ] **Step 1: Write the failing test** in `src/lib/utils/stampFabric.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { createStampObject } from "./stampFabric";
import { SHAPE_ROLE } from "./shapeDraw";
import { findErasableStroke } from "./strokeEraser";

it("marks every stamp as a shape Group centered on the click", () => {
  const object = createStampObject("light", { x: 80, y: 40 }, 1000, {
    color: "#E81123",
    width: 3,
  });
  expect(object.type).toBe("group");
  expect(object.left).toBe(80);
  expect(object.top).toBe(40);
  expect((object as { annotationRole?: string }).annotationRole).toBe(SHAPE_ROLE);
  expect(object.toObject(["annotationRole"]).annotationRole).toBe(SHAPE_ROLE);
  expect(findErasableStroke([object], { x: 80, y: 40 })).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**
- [ ] **Step 3: Implement `stampFabric.ts`**
- [ ] **Step 4: Run to verify it passes**

---

### Task 3: ツールとスタイラス

`Tool` に `"stamp"` を追加。`toolStore.stampKind` 初期値 `"light"`。

`drawingTools("select")` の id 順は  
`select, stamp, pen, text, pan, rect, ellipse, arrow`。ラベル「図形」。

`isStampTool(tool)` は `tool === "stamp"`。`isShapeTool` はドラッグ3種のまま。

`toolForPointerType("pen", "stamp")` は `"stamp"`。

- [ ] **Step 1: Extend `drawingTools.test.ts` and `fabricPointer.test.ts` (failing)**
- [ ] **Step 2: Run those tests, confirm fail**
- [ ] **Step 3: Update `drawingTools.ts`, `toolStore.svelte.ts`, `fabricPointer.ts`**
- [ ] **Step 4: Run tests, confirm pass**

---

### Task 4: パレットとクリック配置

`ShapePalette.svelte` は PenPalette と同じ開閉。記号ボタンは `STAMP_OPTIONS`。選ぶと `stampKind` を更新して `setTool("stamp")`。

`Toolbar.svelte` は `stamp` のときパレットを隣に出す。

`PdfViewer.svelte`:

- `skipTargetFind` に `isStampTool`
- `mouse:down` で stamp なら `createStampObject(toolStore.stampKind, pointer, fabricCanvas.getWidth(), currentShapeStyle())` して `assignId` / `add` / `emitObject("add")`。選択には戻さない
- ドラッグ図形の `isShapeTool` 分岐より先に stamp を処理しない（stamp は `isShapeTool` ではないので down の stamp 分岐を shape の前に置く）

- [ ] **Step 1: Add `ShapePalette.svelte` and wire Toolbar + PdfViewer**
- [ ] **Step 2: Run `npx vitest run src/lib/utils/stampDraw.test.ts src/lib/utils/stampFabric.test.ts src/lib/utils/drawingTools.test.ts src/lib/utils/fabricPointer.test.ts src/lib/utils/shapeFabric.test.ts`**
- [ ] **Step 3: Run `npm test`**
