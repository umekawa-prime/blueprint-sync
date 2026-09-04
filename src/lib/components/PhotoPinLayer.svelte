<script lang="ts">
  import type { PhotoPinRecord } from "$lib/utils/annotationPersist";

  let { pins }: { pins: PhotoPinRecord[] } = $props();

  let previewId = $state<string | null>(null);
  const preview = $derived(pins.find((pin) => pin.id === previewId));

  function open(id: string) {
    previewId = id;
  }

  function close() {
    previewId = null;
  }

  $effect(() => {
    if (!previewId) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
</script>

<div class="pointer-events-none absolute inset-0 z-[2]">
  {#each pins as pin (pin.id)}
    <button
      type="button"
      class="pointer-events-auto absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
      style="left: {pin.nx * 100}%; top: {pin.ny * 100}%"
      aria-label="写真ピン"
      onmouseenter={() => open(pin.id)}
      onclick={() => open(pin.id)}
    >
      <span
        class="block h-11 w-11 overflow-hidden rounded-full border-2 border-white shadow-lg ring-1 ring-slate-900"
      >
        <img src={pin.thumbnailDataUrl} alt="" class="h-full w-full object-cover" />
      </span>
      <span
        class="-mt-px h-0 w-0 border-x-[6px] border-t-[10px] border-x-transparent border-t-white"
      ></span>
    </button>
  {/each}
</div>

{#if preview}
  <div
    class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-6"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={close}
    onkeydown={(event) => {
      if (event.key === "Escape") {
        close();
      }
    }}
  >
    <div
      class="max-h-[80vh] max-w-[80vw]"
      role="presentation"
      onclick={(event) => event.stopPropagation()}
    >
      <img
        src={preview.imageDataUrl}
        alt="挿入した画像"
        class="max-h-[80vh] max-w-[80vw] rounded-lg object-contain shadow-2xl"
      />
    </div>
  </div>
{/if}
