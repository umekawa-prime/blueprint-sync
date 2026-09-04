<script lang="ts">
  import { connectionStore } from "$lib/stores/connectionStore.svelte";
  import { historyStore } from "$lib/stores/historyStore.svelte";
  import { pdfStore } from "$lib/stores/pdfStore.svelte";
  import { toolStore, type Tool } from "$lib/stores/toolStore.svelte";
  import { viewerApi } from "$lib/stores/viewerApi";
  import { shouldCommitToolOnPointerDown } from "$lib/utils/fabricPointer";
  import { broadcastPage } from "$lib/utils/connectionActions";
  import { saveCurrentPdf, openPdfIntoCurrentProject } from "$lib/utils/toolbarActions";
  import { toolbarToolClass } from "$lib/utils/toolbarUi";
  import { zoomStep } from "$lib/utils/viewerMenu";
  import { toast } from "svelte-sonner";
  import PenPalette from "$lib/components/PenPalette.svelte";

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

  const currentTool = $derived(toolStore.current);

  let saving = $state(false);

  async function openPdf() {
    await openPdfIntoCurrentProject();
  }

  async function savePdf() {
    if (saving) {
      return;
    }
    saving = true;
    try {
      const saved = await saveCurrentPdf();
      if (saved) {
        toast.success("保存しました");
      }
    } finally {
      saving = false;
    }
  }
</script>

<header
  class="flex flex-wrap items-center gap-2 border-b border-slate-700 bg-slate-900 px-3 py-2"
>
  <div class="mr-2 text-sm font-semibold tracking-wide text-cyan-300">
    Blueprint Sync
  </div>

  <button class="toolbar-btn" onclick={openPdf}>開く</button>
  <button
    class="toolbar-btn"
    onclick={savePdf}
    disabled={!pdfStore.bytes || saving}
    aria-busy={saving}
  >
    保存
  </button>
  {#if saving}
    <span
      class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-cyan-300"
      aria-label="保存中"
    ></span>
  {/if}

  <div class="mx-1 h-6 w-px bg-slate-700"></div>

  <button
    type="button"
    class="toolbar-btn"
    title="戻る (Ctrl+Z)"
    onclick={() => viewerApi.undo()}
    disabled={!historyStore.canUndo}
  >
    戻る
  </button>
  <button
    type="button"
    class="toolbar-btn"
    title="やり直す (Ctrl+Y)"
    onclick={() => viewerApi.redo()}
    disabled={!historyStore.canRedo}
  >
    やり直す
  </button>

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
    {@const active = currentTool === tool.id}
    <div
      class={tool.id === "pen"
        ? `flex items-center gap-0.5 rounded-md ${active ? "bg-cyan-950/70 ring-1 ring-cyan-400" : ""}`
        : "contents"}
    >
      <button
        type="button"
        class={toolbarToolClass(active)}
        aria-pressed={active}
        onpointerdowncapture={(event) => {
          if (shouldCommitToolOnPointerDown(event.pointerType)) {
            event.preventDefault();
            toolStore.setTool(tool.id);
          }
        }}
        onclick={() => toolStore.setTool(tool.id)}
      >
        {tool.label}
      </button>
      {#if tool.id === "pen"}
        <PenPalette />
      {/if}
    </div>
  {/each}

  <button class="toolbar-btn" onclick={onRequestPhoto} disabled={!pdfStore.bytes}>
    カメラ
  </button>

  <label class="flex items-center gap-1 text-xs text-slate-300">
    ズーム
    <button
      type="button"
      class="toolbar-btn"
      disabled={!pdfStore.bytes}
      onclick={() => pdfStore.setZoom(zoomStep(pdfStore.zoom, -1))}
    >
      −
    </button>
    <input
      class="w-24 accent-cyan-400"
      type="range"
      min="0.4"
      max="3"
      step="0.1"
      value={pdfStore.zoom}
      disabled={!pdfStore.bytes}
      oninput={(event) =>
        pdfStore.setZoom(Number((event.currentTarget as HTMLInputElement).value))}
    />
    <button
      type="button"
      class="toolbar-btn"
      disabled={!pdfStore.bytes}
      onclick={() => pdfStore.setZoom(zoomStep(pdfStore.zoom, 1))}
    >
      ＋
    </button>
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
    touch-action: manipulation;
  }

  .toolbar-btn:disabled {
    opacity: 0.4;
  }

  .toolbar-btn:hover:not(:disabled) {
    border-color: rgb(34 211 238);
    color: rgb(165 243 252);
  }

  .toolbar-btn.active {
    border-color: rgb(34 211 238);
    background: rgb(8 51 68);
    color: rgb(165 243 252);
  }
</style>
