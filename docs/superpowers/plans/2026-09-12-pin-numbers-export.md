# ピン番号と写真スライド出力 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 図面ピンに置いた順の①番号を編集画面と保存 PDF の両方に出し、直後の写真スライド見出しも同じ番号にする。

**Architecture:** 番号計算は `pinNumbers.ts`。マーカー幾何は `pinMarkers.ts`。保存時は Fabric オーバーレイにピン PNG を重ね、既存の `appendPhotoPinSlides` が見出しに番号を付ける。`createdAt` は注釈 JSON に載せる。

**Tech Stack:** Svelte 5, pdf-lib, Vitest, Canvas 2D（オーバーレイ PNG）

## Global Constraints

- `.svelte` に座標計算を新たに足さない
- 番号は保存せず `createdAt` から都度計算する
- 置いた順。削除後は詰め直す。ページごとに ① から
- ピン見た目はサムネ＋下に番号（案 C）
- コミットはユーザー依頼があるまでしない

## File Structure

Create:
- `src/lib/utils/pinNumbers.ts` / `pinNumbers.test.ts`
- `src/lib/utils/pinMarkers.ts` / `pinMarkers.test.ts`

Modify:
- `src/lib/utils/annotationPersist.ts` / `annotationPersist.test.ts`
- `src/lib/stores/annotationStore.svelte.ts` / `annotationStore.test.ts`
- `src/lib/utils/pinSlides.ts` / `pinSlides.test.ts`
- `src/lib/components/PhotoPinLayer.svelte`
- `src/lib/components/PdfViewer.svelte`
- `src/lib/utils/toolbarActions.test.ts`（壊れている上書きテストを直す）

---

### Task 1: 番号ユーティリティ

**Files:**
- Create: `src/lib/utils/pinNumbers.ts`
- Test: `src/lib/utils/pinNumbers.test.ts`

**Produces:**
- `circledPinLabel(n: number): string`
- `nextPinCreatedAt(pins: Iterable<{ createdAt?: number }>, now?: number): number`
- `backfillPinCreatedAt(pins: Record<string, PhotoPinRecord>): Record<string, PhotoPinRecord>`
- `numberedPins(pins: PhotoPinRecord[]): Array<{ pin: PhotoPinRecord; number: number; label: string }>`
- `pinSlideCaption(number: number, title?: string): string`

- [ ] **Step 1: 失敗するテストを書く**

`circledPinLabel(1) === "①"`、`20 === "⑳"`、`21 === "㉑"`、`36 === "㊱"`、`51 === "(51)"`。  
`numberedPins` は `createdAt` 昇順で 1 から振り、削除後の残りが詰め直される。同着は `id`。  
`nextPinCreatedAt` は `now` と既存 max+1 の大きい方。  
`backfillPinCreatedAt` は欠けるピンにオブジェクト順で 1,2,3。  
`pinSlideCaption(1, "基礎") === "① 基礎"`、空タイトルは `"①"`。

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- src/lib/utils/pinNumbers.test.ts`

- [ ] **Step 3: 実装して通す**

- [ ] **Step 4: 再実行して PASS**

---

### Task 2: createdAt の永続化と付与

**Files:**
- Modify: `src/lib/utils/annotationPersist.ts`
- Modify: `src/lib/utils/annotationPersist.test.ts`
- Modify: `src/lib/stores/annotationStore.svelte.ts`
- Modify: `src/lib/stores/annotationStore.test.ts`

**Consumes:** `backfillPinCreatedAt`, `nextPinCreatedAt`  
**Produces:** `PhotoPinRecord.createdAt: number`

- [ ] parse は `createdAt` を通し、無いピンは backfill する
- [ ] `addPhotoPin` は未指定なら `nextPinCreatedAt` を入れる
- [ ] `pinsFor` は `numberedPins` と同じ順（createdAt 昇順）
- [ ] 既存ストアテストは `createdAt` を `expect.objectContaining` または具体値で合わせる

---

### Task 3: スライド順と見出し

**Files:**
- Modify: `src/lib/utils/pinSlides.ts`
- Modify: `src/lib/utils/pinSlides.test.ts`

**Consumes:** `numberedPins`, `pinSlideCaption`

- [ ] `pinSlidePlan` は番号順。step に `number` と `caption` を載せる
- [ ] `appendPhotoPinSlides` は `caption` をタイトル帯に描く（常に番号があるので帯は出す）
- [ ] 既存 plan テストを番号順・caption 付きに更新

---

### Task 4: マーカー幾何とオーバーレイ PNG

**Files:**
- Create: `src/lib/utils/pinMarkers.ts`
- Test: `src/lib/utils/pinMarkers.test.ts`

**Produces:**
- `pinMarkerLayout(nx, ny, canvasWidth, canvasHeight)` — 三角の先が `(nx * w, ny * h)`
- `renderPinMarkerOverlay(pins, canvasWidth, canvasHeight): Promise<Uint8Array | null>` — ピンが無ければ `null`

- [ ] レイアウトテスト（先端座標、円が先端より上、番号が先端より下）
- [ ] ピン無しは `null`。ピンありは PNG バイト（jsdom で getContext が取れない場合はレイアウトのみ必須、描画は getContext があるときだけ）

---

### Task 5: 編集画面と保存パイプライン

**Files:**
- Modify: `src/lib/components/PhotoPinLayer.svelte`
- Modify: `src/lib/components/PdfViewer.svelte`
- Modify: `src/lib/utils/toolbarActions.test.ts`

- [ ] PhotoPinLayer は番号ピルを三角の下に出す。先端を `(nx, ny)` に固定
- [ ] PdfViewer は `pinsFor` を渡し、`exportVisibleOverlays` でピン PNG を同じ pageIndex の overlay として追加
- [ ] toolbarActions の PDF 上書きテストを修復（JWW テストの後に落ちている orphan コード）
- [ ] `npm test` と `npm run check`
