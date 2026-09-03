<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { toolStore } from "$lib/stores/toolStore.svelte";
  import {
    PEN_COLORS,
    PEN_WIDTHS,
    thicknessDotSize,
  } from "$lib/utils/penPalette";
  import { toolbarToolClass } from "$lib/utils/toolbarUi";

  let open = $state(false);
  let rootEl: HTMLDivElement | undefined = $state();

  function selectColor(color: string) {
    toolStore.penColor = color;
    toolStore.setTool("pen");
  }

  function selectWidth(width: number) {
    toolStore.penWidth = width;
    toolStore.setTool("pen");
  }

  function onDocumentPointerDown(event: PointerEvent) {
    if (rootEl && !rootEl.contains(event.target as Node)) {
      open = false;
    }
  }

  onMount(() => {
    window.addEventListener("pointerdown", onDocumentPointerDown);
  });

  onDestroy(() => {
    window.removeEventListener("pointerdown", onDocumentPointerDown);
  });
</script>

<div bind:this={rootEl} class="relative">
  <button
    type="button"
    class="{toolbarToolClass(open || toolStore.current === 'pen')} flex h-[1.9rem] items-center gap-1 px-2"
    aria-expanded={open}
    aria-label="ペンの色と太さ"
    onpointerdowncapture={(event) => {
      event.preventDefault();
      open = !open;
      toolStore.setTool("pen");
    }}
  >
    <span
      class="block w-9 rounded-full"
      style="height: {Math.max(2, toolStore.penWidth)}px; background: {toolStore.penColor}; box-shadow: 0 0 0 1px rgb(51 65 85);"
    ></span>
  </button>

  {#if open}
    <div
      class="absolute top-full left-0 z-30 mt-1 w-56 rounded-lg border border-slate-600 bg-slate-900 p-3 shadow-2xl"
    >
      <p class="mb-2 text-[11px] tracking-wide text-slate-400">太さ</p>
      <div class="mb-3 flex items-end justify-between gap-1 px-1">
        {#each PEN_WIDTHS as width (width)}
          <button
            type="button"
            class="flex h-9 w-8 items-center justify-center rounded-md border border-transparent"
            class:ring-selected={toolStore.penWidth === width}
            aria-label="太さ {width}"
            aria-pressed={toolStore.penWidth === width}
            onclick={() => selectWidth(width)}
          >
            <span
              class="rounded-full"
              style="width: {thicknessDotSize(width)}px; height: {thicknessDotSize(width)}px; background: {toolStore.penColor}; box-shadow: 0 0 0 1px rgb(71 85 105);"
            ></span>
          </button>
        {/each}
      </div>

      <p class="mb-2 text-[11px] tracking-wide text-slate-400">色</p>
      <div class="grid grid-cols-8 gap-1.5">
        {#each PEN_COLORS as color (color)}
          <button
            type="button"
            class="h-6 w-6 rounded-sm border border-slate-500"
            class:ring-selected={toolStore.penColor.toLowerCase() === color.toLowerCase()}
            style="background: {color};"
            aria-label="色 {color}"
            aria-pressed={toolStore.penColor.toLowerCase() === color.toLowerCase()}
            onclick={() => selectColor(color)}
          ></button>
        {/each}
      </div>

      <label class="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-400">
        その他の色
        <input
          class="h-7 w-10 cursor-pointer rounded border-0 bg-transparent"
          type="color"
          value={toolStore.penColor}
          oninput={(event) =>
            selectColor((event.currentTarget as HTMLInputElement).value)}
        />
      </label>
    </div>
  {/if}
</div>

<style>
  .ring-selected {
    box-shadow: 0 0 0 2px rgb(34 211 238);
  }
</style>
