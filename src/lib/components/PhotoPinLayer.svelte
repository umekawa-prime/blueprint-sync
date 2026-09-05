<script lang="ts">
  import type { PhotoPinRecord } from "$lib/utils/annotationPersist";
  import {
    clickPhotoPin,
    closePhotoPinModal,
    hoverPhotoPin,
    idlePhotoPinView,
    leavePhotoPin,
    tapPhotoPin,
  } from "$lib/utils/photoPinUi";
  import { viewportStore } from "$lib/stores/viewportStore.svelte";

  let { pins }: { pins: PhotoPinRecord[] } = $props();

  let view = $state(idlePhotoPinView());
  const hover = $derived(pins.find((pin) => pin.id === view.hoverId));
  const modal = $derived(pins.find((pin) => pin.id === view.modalId));

  $effect(() => {
    if (!view.modalId) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        view = closePhotoPinModal(view);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
</script>

<div class="pointer-events-none absolute inset-0 z-[2]">
  {#each pins as pin (pin.id)}
    <div
      class="pointer-events-auto absolute -translate-x-1/2 -translate-y-full"
      style="left: {pin.nx * 100}%; top: {pin.ny * 100}%"
      role="group"
      onmouseenter={() => {
        if (!viewportStore.isPhone) {
          view = hoverPhotoPin(view, pin.id);
        }
      }}
      onmouseleave={() => {
        if (!viewportStore.isPhone) {
          view = leavePhotoPin(view, pin.id);
        }
      }}
    >
      <button
        type="button"
        class="flex flex-col items-center"
        aria-label="写真ピン"
        onclick={() => {
          view = viewportStore.isPhone ? tapPhotoPin(view, pin.id) : clickPhotoPin(view, pin.id);
        }}
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
      {#if hover?.id === pin.id && !modal}
        <button
          type="button"
          class="absolute left-12 top-0 z-10 w-44 overflow-hidden rounded-md border border-slate-500 bg-slate-900 shadow-2xl"
          aria-label="画像プレビュー"
          onclick={() => {
            view = clickPhotoPin(view, pin.id);
          }}
        >
          <img src={pin.imageDataUrl} alt="" class="max-h-40 w-full object-contain" />
        </button>
      {/if}
    </div>
  {/each}
</div>

{#if modal}
  <div
    class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-6"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={() => {
      view = closePhotoPinModal(view);
    }}
    onkeydown={(event) => {
      if (event.key === "Escape") {
        view = closePhotoPinModal(view);
      }
    }}
  >
    <div
      class="max-h-[80vh] max-w-[80vw]"
      role="presentation"
      onclick={(event) => event.stopPropagation()}
    >
      <img
        src={modal.imageDataUrl}
        alt="挿入した画像"
        class="max-h-[80vh] max-w-[80vw] rounded-lg object-contain shadow-2xl"
      />
    </div>
  </div>
{/if}
