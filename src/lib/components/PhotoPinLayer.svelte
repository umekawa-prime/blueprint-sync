<script lang="ts">
  import type { PhotoPinRecord } from "$lib/utils/annotationPersist";
  import {
    PIN_DRAG_HOLD_MS,
    PIN_DRAG_MOVE_PX,
    clickPhotoPin,
    closePhotoPinModal,
    hoverPhotoPin,
    idlePhotoPinView,
    leavePhotoPin,
    pinPositionFromPointer,
    shouldArmPinDrag,
    startPinDrag,
    tapPhotoPin,
  } from "$lib/utils/photoPinUi";
  import { viewportStore } from "$lib/stores/viewportStore.svelte";

  let {
    pins,
    onTitleChange,
    onMove,
  }: {
    pins: PhotoPinRecord[];
    onTitleChange: (id: string, title: string) => void;
    onMove: (id: string, nx: number, ny: number) => void;
  } = $props();

  let view = $state(idlePhotoPinView());
  let layerEl: HTMLDivElement | undefined = $state();
  let ignoreClick = $state(false);
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let pointerStart = { x: 0, y: 0, at: 0 };

  const hover = $derived(pins.find((pin) => pin.id === view.hoverId));
  const modal = $derived(pins.find((pin) => pin.id === view.modalId));

  function clearHold() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = undefined;
    }
  }

  function onPinPointerDown(event: PointerEvent, id: string) {
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    pointerStart = { x: event.clientX, y: event.clientY, at: Date.now() };
    ignoreClick = false;
    clearHold();
    if (event.pointerType !== "mouse") {
      holdTimer = setTimeout(() => {
        view = startPinDrag(view, id);
        ignoreClick = true;
      }, PIN_DRAG_HOLD_MS);
    }
  }

  function onPinPointerMove(event: PointerEvent, id: string) {
    if (event.buttons === 0) {
      return;
    }
    event.stopPropagation();
    const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
    const held = Date.now() - pointerStart.at;
    if (!view.draggingId && shouldArmPinDrag(event.pointerType, held, moved)) {
      clearHold();
      view = startPinDrag(view, id);
      ignoreClick = true;
    }
    if (view.draggingId !== id) {
      if (moved > PIN_DRAG_MOVE_PX) {
        clearHold();
      }
      return;
    }
    if (!layerEl) {
      return;
    }
    const pos = pinPositionFromPointer(event.clientX, event.clientY, layerEl.getBoundingClientRect());
    onMove(id, pos.nx, pos.ny);
  }

  function onPinPointerUp(event: PointerEvent) {
    event.stopPropagation();
    clearHold();
    if (view.draggingId) {
      view = { ...view, draggingId: null };
    }
  }

  function onPinClick(id: string) {
    if (ignoreClick) {
      ignoreClick = false;
      return;
    }
    view = viewportStore.isPhone ? tapPhotoPin(view, id) : clickPhotoPin(view, id);
  }

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

<div bind:this={layerEl} class="pointer-events-none absolute inset-0 z-[2]">
  {#each pins as pin (pin.id)}
    <div
      class="pointer-events-auto absolute -translate-x-1/2 -translate-y-full {view.draggingId === pin.id
        ? 'z-10 scale-110'
        : ''}"
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
        class="flex touch-none flex-col items-center"
        aria-label={pin.title?.trim() ? `写真ピン ${pin.title}` : "写真ピン"}
        onpointerdown={(event) => onPinPointerDown(event, pin.id)}
        onpointermove={(event) => onPinPointerMove(event, pin.id)}
        onpointerup={onPinPointerUp}
        onpointercancel={onPinPointerUp}
        oncontextmenu={(event) => event.preventDefault()}
        onclick={() => onPinClick(pin.id)}
      >
        <span
          class="block h-11 w-11 overflow-hidden rounded-full border-2 border-white shadow-lg ring-1 ring-slate-900"
        >
          <img src={pin.thumbnailDataUrl} alt="" draggable="false" class="h-full w-full object-cover" />
        </span>
        <span
          class="-mt-px h-0 w-0 border-x-[6px] border-t-[10px] border-x-transparent border-t-white"
        ></span>
        {#if pin.title?.trim()}
          <span class="mt-1 max-w-24 truncate rounded bg-slate-950/80 px-1 text-[10px] text-cyan-100">
            {pin.title}
          </span>
        {/if}
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
      class="flex max-h-[90vh] max-w-[80vw] flex-col"
      role="presentation"
      onclick={(event) => event.stopPropagation()}
    >
      <img
        src={modal.imageDataUrl}
        alt={modal.title?.trim() || "挿入した画像"}
        class="max-h-[70vh] max-w-[80vw] rounded-lg object-contain shadow-2xl"
      />
      <label class="mt-3 block text-xs text-slate-300">
        タイトル
        <input
          class="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          value={modal.title ?? ""}
          oninput={(event) => {
            onTitleChange(modal.id, (event.currentTarget as HTMLInputElement).value);
          }}
        />
      </label>
    </div>
  </div>
{/if}
