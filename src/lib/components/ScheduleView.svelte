<script lang="ts">
  import { scheduleStore } from "$lib/stores/scheduleStore.svelte";
  import { closeScheduleView } from "$lib/utils/scheduleActions";
  import {
    SCHEDULE_DAY_WIDTH_PX,
    SCHEDULE_LABEL_WIDTH_PX,
    buildScheduleViewModel,
    todayIso,
  } from "$lib/utils/scheduleLayout";

  const model = $derived(
    scheduleStore.chart ? buildScheduleViewModel(scheduleStore.chart, todayIso()) : null,
  );
  const weekendSet = $derived(new Set(model?.weekends ?? []));
  const chartWidth = $derived((model?.days.length ?? 0) * SCHEDULE_DAY_WIDTH_PX);
  const todayLeft = $derived(
    model?.todayIndex === null || model?.todayIndex === undefined
      ? null
      : model.todayIndex * SCHEDULE_DAY_WIDTH_PX + SCHEDULE_DAY_WIDTH_PX / 2,
  );
</script>

<section class="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-950 text-slate-100">
  <header class="flex shrink-0 items-center gap-3 border-b border-slate-700 bg-slate-900 px-3 py-2">
    <button type="button" class="toolbar-btn" onclick={() => closeScheduleView()}>図面へ</button>
    {#if model}
      <h1 class="truncate text-sm font-semibold text-cyan-200">{model.title}</h1>
      <span class="shrink-0 text-xs text-slate-400">{model.start} 〜 {model.end}</span>
    {:else if scheduleStore.error}
      <p class="text-sm text-red-300">{scheduleStore.error}</p>
    {/if}
  </header>

  {#if model}
    <div class="min-h-0 flex-1 overflow-auto">
      <div class="min-w-max">
        <div class="sticky top-0 z-20 flex border-b border-slate-700 bg-slate-900">
          <div
            class="sticky left-0 z-30 flex items-end border-r border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-400"
            style={`width:${SCHEDULE_LABEL_WIDTH_PX}px`}
          >
            工種
          </div>
          <div>
            <div class="flex border-b border-slate-800 text-xs text-slate-300">
              {#each model.months as month (month.key)}
                <div
                  class="border-r border-slate-800 px-1 py-1"
                  style={`width:${month.dayCount * SCHEDULE_DAY_WIDTH_PX}px`}
                >
                  {month.label}
                </div>
              {/each}
            </div>
            <div class="flex text-[11px] leading-4 text-slate-400">
              {#each model.days as day (day)}
                <div
                  class={`flex h-6 items-center justify-center border-r border-slate-800 ${weekendSet.has(day) ? "bg-slate-800/80 text-slate-500" : ""}`}
                  style={`width:${SCHEDULE_DAY_WIDTH_PX}px`}
                >
                  {Number(day.slice(8))}
                </div>
              {/each}
            </div>
          </div>
        </div>

        {#each model.rows as row (row.kind + row.id)}
          {#if row.kind === "group"}
            <div class="flex border-b border-slate-800 bg-slate-900/80">
              <div
                class="sticky left-0 z-10 flex items-center gap-2 border-r border-slate-700 bg-slate-900 px-2 py-1 text-xs font-semibold"
                style={`width:${SCHEDULE_LABEL_WIDTH_PX}px; border-left: 3px solid ${row.color}`}
              >
                {row.name}
              </div>
              <div class="flex" style={`width:${chartWidth}px`}>
                {#each model.days as day (day)}
                  <div
                    class={`h-7 border-r border-slate-800/80 ${weekendSet.has(day) ? "bg-slate-900" : ""}`}
                    style={`width:${SCHEDULE_DAY_WIDTH_PX}px`}
                  ></div>
                {/each}
              </div>
            </div>
          {:else}
            <div class="flex border-b border-slate-800">
              <div
                class="sticky left-0 z-10 flex items-center border-r border-slate-700 bg-slate-950 px-2 py-1 pl-4 text-xs text-slate-300"
                style={`width:${SCHEDULE_LABEL_WIDTH_PX}px`}
              >
                {row.name}
              </div>
              <div class="relative" style={`width:${chartWidth}px; height:36px`}>
                <div class="absolute inset-0 flex">
                  {#each model.days as day (day)}
                    <div
                      class={`h-full border-r border-slate-800/60 ${weekendSet.has(day) ? "bg-slate-900/70" : ""}`}
                      style={`width:${SCHEDULE_DAY_WIDTH_PX}px`}
                    ></div>
                  {/each}
                </div>
                {#if todayLeft !== null}
                  <div
                    class="pointer-events-none absolute top-0 z-10 h-full w-px bg-cyan-300"
                    style={`left:${todayLeft}px`}
                    aria-hidden="true"
                  ></div>
                {/if}
                {#if row.planned}
                  <div
                    class="absolute top-1.5 h-2.5 rounded-sm"
                    style={`left:${row.planned.left}px; width:${row.planned.width}px; background:${row.color}; opacity:0.7`}
                    title={`予定 ${row.name}`}
                  ></div>
                {/if}
                {#if row.actual}
                  <div
                    class={`absolute bottom-1.5 h-2.5 rounded-sm ${row.actual.ongoing ? "opacity-90" : ""}`}
                    style={`left:${row.actual.left}px; width:${row.actual.width}px; background:${row.actual.ongoing ? `repeating-linear-gradient(45deg, ${row.color}, ${row.color} 4px, transparent 4px, transparent 8px)` : row.color}; filter:brightness(0.75)`}
                    title={`実績 ${row.name}`}
                  ></div>
                {/if}
              </div>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}
</section>

<style>
  .toolbar-btn {
    border-radius: 0.375rem;
    border: 1px solid rgb(51 65 85);
    background: rgb(30 41 59);
    color: rgb(226 232 240);
    padding: 0.35rem 0.7rem;
    font-size: 0.75rem;
    touch-action: manipulation;
  }

  .toolbar-btn:hover {
    border-color: rgb(34 211 238);
    color: rgb(165 243 252);
  }
</style>
