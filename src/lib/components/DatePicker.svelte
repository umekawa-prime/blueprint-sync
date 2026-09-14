<script lang="ts">
  import {
    calendarMonthGrid,
    parseIsoDate,
    shiftCalendarMonth,
  } from "$lib/utils/calendarMonth";
  import { formatTodoDue, todayIsoDate } from "$lib/utils/todoMarkdown";

  let {
    value,
    onChange,
  }: {
    value: string | null;
    onChange: (next: string | null) => void;
  } = $props();

  const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

  let open = $state(false);
  let viewYear = $state(new Date().getFullYear());
  let viewMonth = $state(new Date().getMonth() + 1);

  const cells = $derived(calendarMonthGrid(viewYear, viewMonth));
  const today = $derived(todayIsoDate());

  function syncView() {
    const parsed = parseIsoDate(value ?? todayIsoDate());
    if (!parsed) {
      return;
    }
    viewYear = parsed.year;
    viewMonth = parsed.month;
  }

  function toggle() {
    if (!open) {
      syncView();
    }
    open = !open;
  }

  function shift(delta: number) {
    const next = shiftCalendarMonth(viewYear, viewMonth, delta);
    viewYear = next.year;
    viewMonth = next.month;
  }

  function selectDay(iso: string) {
    onChange(iso);
    open = false;
  }

  function clearDue() {
    onChange(null);
    open = false;
  }

  function selectToday() {
    onChange(todayIsoDate());
    open = false;
  }
</script>

<div class="relative">
  <button
    type="button"
    class="mt-1 flex w-full items-center justify-between rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-left text-sm text-slate-100"
    aria-expanded={open}
    aria-haspopup="dialog"
    onclick={toggle}
  >
    <span class={value ? "text-slate-100" : "text-slate-500"}>{value ? formatTodoDue(value) : "日付を選択"}</span>
    <span class="text-[11px] text-slate-400">カレンダー</span>
  </button>
  {#if open}
    <div class="mt-2 rounded border border-slate-600 bg-slate-900 p-2" role="dialog" aria-label="期限日カレンダー">
      <div class="mb-2 flex items-center gap-2">
        <button type="button" class="rounded px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800" onclick={() => shift(-1)}>
          前へ
        </button>
        <p class="flex-1 text-center text-xs font-semibold text-slate-100">{viewYear}年{viewMonth}月</p>
        <button type="button" class="rounded px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800" onclick={() => shift(1)}>
          次へ
        </button>
      </div>
      <div class="grid grid-cols-7 gap-0.5 text-center">
        {#each WEEKDAYS as weekday (weekday)}
          <span class="text-[10px] text-slate-400">{weekday}</span>
        {/each}
        {#each cells as cell (cell.iso)}
          <button
            type="button"
            class="rounded py-1 text-[11px] {cell.iso === value
              ? 'bg-[#4488c5] text-white'
              : cell.iso === today
                ? 'bg-slate-700 text-cyan-200'
                : cell.inMonth
                  ? 'text-slate-100 hover:bg-slate-800'
                  : 'text-slate-500 hover:bg-slate-800'}"
            onclick={() => selectDay(cell.iso)}
          >
            {cell.day}
          </button>
        {/each}
      </div>
      <div class="mt-2 flex gap-2">
        <button type="button" class="rounded px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800" onclick={selectToday}>
          今日
        </button>
        <button type="button" class="ml-auto rounded px-2 py-0.5 text-[11px] text-slate-400 hover:bg-slate-800" onclick={clearDue}>
          クリア
        </button>
      </div>
    </div>
  {/if}
</div>
