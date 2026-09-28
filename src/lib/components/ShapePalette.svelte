<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { toolStore } from "$lib/stores/toolStore.svelte";
  import { STAMP_OPTIONS, type StampKind } from "$lib/utils/stampDraw";
  import { toolbarToolClass } from "$lib/utils/toolbarUi";
  import ToolGlyph from "$lib/components/ToolGlyph.svelte";

  let { compact = false }: { compact?: boolean } = $props();

  let open = $state(false);
  let rootEl: HTMLDivElement | undefined = $state();

  function selectKind(kind: StampKind) {
    toolStore.stampKind = kind;
    toolStore.setTool("stamp");
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
    class="{toolbarToolClass(open || toolStore.current === 'stamp')} inline-flex items-center justify-center"
    aria-expanded={open}
    aria-pressed={toolStore.current === "stamp"}
    aria-label="図形"
    title="図形"
    onpointerdowncapture={(event) => {
      event.preventDefault();
      open = !open;
      toolStore.setTool("stamp");
    }}
  >
    <ToolGlyph tool="stamp" />
  </button>

  {#if open}
    <div
      class="absolute z-30 w-52 rounded-lg border border-slate-600 bg-slate-900 p-2 shadow-2xl {compact
        ? 'bottom-full mb-1 left-0'
        : 'top-full mt-1 left-0'}"
    >
      <div class="grid grid-cols-3 gap-1">
        {#each STAMP_OPTIONS as option (option.id)}
          <button
            type="button"
            class="flex flex-col items-center gap-1 rounded-md border px-1 py-1.5 text-[10px] text-slate-200"
            class:ring-selected={toolStore.stampKind === option.id}
            class:border-slate-600={toolStore.stampKind !== option.id}
            class:border-cyan-400={toolStore.stampKind === option.id}
            aria-label={option.label}
            aria-pressed={toolStore.stampKind === option.id}
            onclick={() => selectKind(option.id)}
          >
            <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              {#if option.id === "light"}
                <circle cx="12" cy="12" r="7"></circle>
              {:else if option.id === "ceiling"}
                <circle cx="12" cy="12" r="7"></circle>
                <circle cx="12" cy="12" r="4"></circle>
              {:else if option.id === "downlight"}
                <circle cx="12" cy="12" r="7"></circle>
                <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"></circle>
              {:else if option.id === "outlet"}
                <circle cx="12" cy="12" r="7"></circle>
                <path d="M8 8l8 8M16 8l-8 8"></path>
              {:else if option.id === "switch"}
                <rect x="5" y="5" width="14" height="14"></rect>
              {:else}
                <rect x="4" y="6" width="16" height="12"></rect>
                <path d="M4 6l16 12"></path>
              {/if}
            </svg>
            {option.label}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .ring-selected {
    box-shadow: 0 0 0 2px rgb(34 211 238);
  }
</style>
