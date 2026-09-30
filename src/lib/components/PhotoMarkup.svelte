<script lang="ts">
  import { Canvas, PencilBrush } from "fabric";
  import { onDestroy } from "svelte";
  import { toolStore } from "$lib/stores/toolStore.svelte";
  import { CAMERA_OVERLAY_CLASS } from "$lib/utils/chromeLayout";

  let { image, onDone, onCancel }: { image: Blob; onDone: (file: Blob) => void; onCancel: () => void } =
    $props();

  let imageEl = $state<HTMLImageElement | null>(null);
  let hostEl = $state<HTMLDivElement | null>(null);
  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let previewUrl = $state("");
  let saving = $state(false);
  let fabricCanvas: Canvas | undefined;

  $effect(() => {
    const url = URL.createObjectURL(image);
    previewUrl = url;
    return () => URL.revokeObjectURL(url);
  });

  function mountPen() {
    if (!imageEl || !canvasEl || !hostEl || fabricCanvas) {
      return;
    }
    const width = imageEl.clientWidth;
    const height = imageEl.clientHeight;
    if (width <= 0 || height <= 0) {
      return;
    }
    hostEl.style.width = `${width}px`;
    hostEl.style.height = `${height}px`;
    fabricCanvas = new Canvas(canvasEl, {
      width,
      height,
      selection: false,
      enableRetinaScaling: true,
    });
    fabricCanvas.freeDrawingBrush = new PencilBrush(fabricCanvas);
    fabricCanvas.freeDrawingBrush.color = toolStore.penColor;
    fabricCanvas.freeDrawingBrush.width = toolStore.penWidth;
    fabricCanvas.isDrawingMode = true;
  }

  async function finish() {
    if (!imageEl || !fabricCanvas || saving) {
      return;
    }
    saving = true;
    try {
      const output = document.createElement("canvas");
      output.width = imageEl.naturalWidth || imageEl.clientWidth;
      output.height = imageEl.naturalHeight || imageEl.clientHeight;
      const context = output.getContext("2d");
      if (!context) {
        return;
      }
      context.drawImage(imageEl, 0, 0, output.width, output.height);
      const overlay = new Image();
      const url = fabricCanvas.toDataURL({
        format: "png",
        multiplier: output.width / Math.max(fabricCanvas.getWidth(), 1),
      });
      await new Promise<void>((resolve, reject) => {
        overlay.onload = () => resolve();
        overlay.onerror = () => reject(new Error("書き込みを合成できませんでした"));
        overlay.src = url;
      });
      context.drawImage(overlay, 0, 0, output.width, output.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        output.toBlob((next) => {
          if (next) {
            resolve(next);
          } else {
            reject(new Error("写真を保存できませんでした"));
          }
        }, "image/jpeg", 0.92);
      });
      onDone(blob);
    } finally {
      saving = false;
    }
  }

  onDestroy(() => {
    fabricCanvas?.dispose();
    fabricCanvas = undefined;
  });
</script>

<div class={CAMERA_OVERLAY_CLASS}>
  <section class="flex w-full max-w-4xl flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
    <div class="flex items-center justify-between">
      <h2 class="text-base font-semibold">写真にペンで書き込む</h2>
      <button type="button" class="text-slate-400" onclick={onCancel}>キャンセル</button>
    </div>
    <div class="relative mx-auto max-h-[70vh]">
      <img
        bind:this={imageEl}
        src={previewUrl}
        alt="撮影した写真"
        class="max-h-[70vh] w-auto"
        onload={mountPen}
      />
      <div bind:this={hostEl} class="absolute top-0 left-0">
        <canvas bind:this={canvasEl}></canvas>
      </div>
    </div>
    <div class="flex justify-end gap-2">
      <button
        type="button"
        class="rounded bg-cyan-700 px-4 py-2 text-sm disabled:opacity-40"
        disabled={saving}
        onclick={() => void finish()}
      >
        完了
      </button>
    </div>
  </section>
</div>
