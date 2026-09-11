<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { toolStore } from "$lib/stores/toolStore.svelte";
  import { PEN_COLORS } from "$lib/utils/penPalette";
  import { isNoneBackground } from "$lib/utils/textStyle";
  import { toolbarToolClass } from "$lib/utils/toolbarUi";

  let { compact = false }: { compact?: boolean } = $props();

  let open = $state(false);
  let rootEl: HTMLDivElement | undefined = $state();

  function selectFill(color: string) {
    toolStore.textColor = color;
  }

  function selectBackground(color: string) {
    toolStore.textBackground = color;
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
    class="{toolbarToolClass(open || toolStore.current === 'text')} flex h-[1.9rem] items-center px-1.5"
    aria-expanded={open}
    aria-label="テキストの文字色・背景色"
    onpointerdowncapture={(event) => {
      event.preventDefault();
      open = !open;
      toolStore.setTool("text");
    }}
  >
    <span
      class="flex h-5 w-6 items-center justify-center rounded-[2px] border border-slate-500 text-[11px] font-semibold leading-none"
      style="color: {toolStore.textColor}; background: {toolStore.textBackground || 'transparent'};"
    >
      A
    </span>
  </button>

  {#if open}
    <div
      class="absolute left-0 z-30 w-56 rounded-lg border border-slate-600 bg-slate-900 p-3 shadow-2xl {compact
        ? 'bottom-full mb-1'
        : 'top-full mt-1'}"
    >
      <p class="mb-2 text-[11px] tracking-wide text-slate-400">文字色</p>
      <div class="mb-3 grid grid-cols-8 gap-1.5">
        {#each PEN_COLORS as color (color)}
          <button
            type="button"
            class="h-6 w-6 rounded-sm border border-slate-500"
            class:ring-selected={toolStore.textColor.toLowerCase() === color.toLowerCase()}
            style="background: {color};"
            aria-label="文字色 {color}"
            aria-pressed={toolStore.textColor.toLowerCase() === color.toLowerCase()}
            onclick={() => selectFill(color)}
          ></button>
        {/each}
      </div>
      <label class="mb-3 flex items-center justify-between gap-2 text-[11px] text-slate-400">
        その他の文字色
        <input
          class="h-7 w-10 cursor-pointer rounded border-0 bg-transparent"
          type="color"
          value={toolStore.textColor}
          oninput={(event) => selectFill((event.currentTarget as HTMLInputElement).value)}
        />
      </label>

      <p class="mb-2 text-[11px] tracking-wide text-slate-400">背景色</p>
      <div class="grid grid-cols-8 gap-1.5">
        <button
          type="button"
          class="relative h-6 w-6 overflow-hidden rounded-sm border border-slate-500 bg-white"
          class:ring-selected={isNoneBackground(toolStore.textBackground)}
          aria-label="背景なし"
          aria-pressed={isNoneBackground(toolStore.textBackground)}
          onclick={() => selectBackground("")}
        >
          <span
            class="absolute inset-[-20%] block rotate-45 border-t-2 border-rose-500"
            aria-hidden="true"
          ></span>
        </button>
        {#each PEN_COLORS as color (color)}
          <button
            type="button"
            class="h-6 w-6 rounded-sm border border-slate-500"
            class:ring-selected={toolStore.textBackground.toLowerCase() === color.toLowerCase()}
            style="background: {color};"
            aria-label="背景色 {color}"
            aria-pressed={toolStore.textBackground.toLowerCase() === color.toLowerCase()}
            onclick={() => selectBackground(color)}
          ></button>
        {/each}
      </div>
      <label class="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-400">
        その他の背景色
        <input
          class="h-7 w-10 cursor-pointer rounded border-0 bg-transparent"
          type="color"
          value={toolStore.textBackground || "#FFFFFF"}
          oninput={(event) =>
            selectBackground((event.currentTarget as HTMLInputElement).value)}
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
