<script lang="ts">
  import { connectionStore } from "$lib/stores/connectionStore.svelte";
  import { pdfStore } from "$lib/stores/pdfStore.svelte";
  import { toolStore, type Tool } from "$lib/stores/toolStore.svelte";
  import { prefersCameraCapture } from "$lib/utils/platform";
  import { broadcastPage } from "$lib/utils/connectionActions";
  import { exportCurrentPdfToDisk, openPdfIntoCurrentProject } from "$lib/utils/toolbarActions";

  let {
    onToggleConnection,
    onRequestPhoto,
  }: {
    onToggleConnection: () => void;
    onRequestPhoto: () => void;
  } = $props();

  const tools: Array<{ id: Tool; label: string }> = [
    { id: "select", label: "選択" },
    { id: "pen", label: "ペン" },
    { id: "text", label: "テキスト" },
    { id: "pan", label: "移動" },
  ];

  async function openPdf() {
    await openPdfIntoCurrentProject();
  }

  async function exportPdf() {
    await exportCurrentPdfToDisk();
  }
</script>

<header
  class="flex flex-wrap items-center gap-2 border-b border-slate-700 bg-slate-900 px-3 py-2"
>
  <div class="mr-2 text-sm font-semibold tracking-wide text-cyan-300">
    Blueprint Sync
  </div>

  <button class="toolbar-btn" onclick={openPdf}>開く</button>
  <button class="toolbar-btn" onclick={exportPdf} disabled={!pdfStore.bytes}>保存</button>

  <div class="mx-1 h-6 w-px bg-slate-700"></div>

  <button
    class="toolbar-btn"
    onclick={() => {
      pdfStore.prevPage();
      broadcastPage(Math.max(0, pdfStore.pageIndex - 1));
    }}
    disabled={pdfStore.pageIndex <= 0}
  >
    ←
  </button>
  <span class="min-w-16 text-center text-xs text-slate-300">{pdfStore.pageLabel}</span>
  <button
    class="toolbar-btn"
    onclick={() => {
      pdfStore.nextPage();
      broadcastPage(Math.min(pdfStore.pageCount - 1, pdfStore.pageIndex + 1));
    }}
    disabled={pdfStore.pageIndex >= pdfStore.pageCount - 1}
  >
    →
  </button>

  <div class="mx-1 h-6 w-px bg-slate-700"></div>

  {#each tools as tool (tool.id)}
    <button
      class="toolbar-btn"
      class:active={toolStore.current === tool.id}
      onclick={() => toolStore.setTool(tool.id)}
    >
      {tool.label}
    </button>
  {/each}

  <label class="flex items-center gap-1 text-xs text-slate-300">
    色
    <input class="h-7 w-8 rounded border-0 bg-transparent" type="color" bind:value={toolStore.penColor} />
  </label>
  <label class="flex items-center gap-1 text-xs text-slate-300">
    太さ
    <input
      class="w-20 accent-cyan-400"
      type="range"
      min="1"
      max="16"
      bind:value={toolStore.penWidth}
    />
  </label>

  {#if prefersCameraCapture() || true}
    <button class="toolbar-btn" onclick={onRequestPhoto} disabled={!pdfStore.bytes}>
      カメラ
    </button>
  {/if}

  <label class="flex items-center gap-1 text-xs text-slate-300">
    ズーム
    <input
      class="w-24 accent-cyan-400"
      type="range"
      min="0.4"
      max="3"
      step="0.1"
      value={pdfStore.zoom}
      oninput={(event) =>
        pdfStore.setZoom(Number((event.currentTarget as HTMLInputElement).value))}
    />
    <span class="w-10">{Math.round(pdfStore.zoom * 100)}%</span>
  </label>

  <button class="toolbar-btn ml-auto" class:active={connectionStore.status !== "idle"} onclick={onToggleConnection}>
    接続
  </button>
</header>

<style>
  .toolbar-btn {
    border-radius: 0.375rem;
    border: 1px solid rgb(51 65 85);
    background: rgb(30 41 59);
    color: rgb(226 232 240);
    padding: 0.35rem 0.7rem;
    font-size: 0.75rem;
  }

  .toolbar-btn:disabled {
    opacity: 0.4;
  }

  .toolbar-btn.active,
  .toolbar-btn:hover:not(:disabled) {
    border-color: rgb(34 211 238);
    color: rgb(165 243 252);
  }
</style>
