# 工程表バーチャート Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 同梱の基準 JSON から、日単位の予定／実績バーチャートを全画面で描く。

**Architecture:** JSON は `parseScheduleChart` で検証し、バー位置は `scheduleLayout.ts` の純関数だけが計算する。`scheduleStore` が開閉状態を持ち、`ScheduleView` はビューモデルを描く。プロジェクトファイルへの読み書きはしない。

**Tech Stack:** Svelte 5, TypeScript, Tailwind, Vitest。Gantt ライブラリは使わない。

## Global Constraints

- Svelte 5: `$props()` / `onclick=`。Svelte 4 の `$:` / `on:click` は使わない
- ストアは `*.svelte.ts` クラス + `$state`、import は拡張子なし
- 座標計算はコンポーネントに置かない（`scheduleLayout.ts`）
- I/O / パースは `src/lib/utils/`。コンポーネントから JSON を直接パースしない
- 終了日はinclusive。日付は `calendarMonth.ts` の `parseIsoDate` / `formatIsoDate`
- 軸の日加算は UTC 暦日（DST で日を飛ばさない）
- 依存ライブラリを増やさない
- このタスクでは git commit しない（ユーザー未依頼）

---

## File map

- Create: `src/lib/data/sampleSchedule.json`
- Create: `src/lib/utils/scheduleSchema.ts` / `scheduleSchema.test.ts`
- Create: `src/lib/utils/scheduleLayout.ts` / `scheduleLayout.test.ts`
- Create: `src/lib/utils/scheduleActions.ts` / `scheduleActions.test.ts`
- Create: `src/lib/stores/scheduleStore.svelte.ts`
- Create: `src/lib/components/ScheduleView.svelte`
- Modify: `src/lib/utils/projectActions.ts` (`resetProjectLists`)
- Modify: `src/lib/components/Toolbar.svelte`
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/page.layout.test.ts`

### Task 1: parseScheduleChart

**Files:**
- Create: `src/lib/utils/scheduleSchema.ts`
- Test: `src/lib/utils/scheduleSchema.test.ts`

**Produces:**
- `parseScheduleChart(input: unknown): { ok: true; chart: ScheduleChart } | { ok: false; error: string }`
- types: `ScheduleChart`, `ScheduleGroup`, `ScheduleTask`, `ScheduleDateRange`

- [x] Write failing tests then implement parse rules from the spec (version 1, inclusive dates, optional actual, `#RRGGBB`)

### Task 2: scheduleLayout

**Files:**
- Create: `src/lib/utils/scheduleLayout.ts`
- Test: `src/lib/utils/scheduleLayout.test.ts`

**Produces:**
- `SCHEDULE_DAY_WIDTH_PX = 28`
- `SCHEDULE_LABEL_WIDTH_PX = 200`
- `buildScheduleViewModel(chart, today): ScheduleViewModel`
- `todayIso(now?: Date): string`

- [x] Write failing tests for day list, weekends, month bands, clipping, ongoing actual, today index; then implement

### Task 3: sample JSON + store/actions

**Files:**
- Create: `src/lib/data/sampleSchedule.json`
- Create: `src/lib/stores/scheduleStore.svelte.ts`
- Create: `src/lib/utils/scheduleActions.ts`
- Test: `src/lib/utils/scheduleActions.test.ts` (sample parse included)
- Modify: `src/lib/utils/projectActions.ts` — `resetProjectLists` で `resetScheduleState()`

- [x] Sample must parse. openSampleSchedule / closeScheduleView / resetScheduleState. Project list reset closes the view.

### Task 4: ScheduleView + chrome

**Files:**
- Create: `src/lib/components/ScheduleView.svelte`
- Modify: `src/lib/components/Toolbar.svelte`
- Modify: `src/routes/+page.svelte`
- Test: `src/routes/page.layout.test.ts`

- [x] Toolbar 「工程表」, page shows ScheduleView when open, 「図面へ」, drawing chrome hidden in schedule mode

### Task 5: verify

- [x] `npx vitest run src/lib/utils/scheduleSchema.test.ts src/lib/utils/scheduleLayout.test.ts src/lib/utils/scheduleActions.test.ts src/routes/page.layout.test.ts` (33 passed)
- [x] Browser: demo project → 工程表 → gantt → 図面へ
