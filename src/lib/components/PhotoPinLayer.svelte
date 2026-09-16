<script lang="ts">
  import type { PhotoPinRecord } from "$lib/utils/annotationPersist";
  import {
    PIN_DRAG_HOLD_MS,
    PIN_DRAG_MOVE_PX,
    clampImageIndex,
    clickPhotoPin,
    closePhotoPinModal,
    closePinMenu,
    hoverPhotoPin,
    idlePhotoPinView,
    leavePhotoPin,
    openPinMenu,
    pinPositionFromPointer,
    shouldArmPinDrag,
    showPinImage,
    startPinDrag,
    stepPinImage,
    tapPhotoPin,
  } from "$lib/utils/photoPinUi";
  import { numberedPins } from "$lib/utils/pinNumbers";
  import { viewportStore } from "$lib/stores/viewportStore.svelte";

  let {
    pins,
    onTitleChange,
    onMove,
    onAddImages,
    onCaptureImage,
    onRemoveImage,
    onRemovePin,
  }: {
    pins: PhotoPinRecord[];
    onTitleChange: (id: string, title: string) => void;
    onMove: (id: string, nx: number, ny: number) => void;
    onAddImages: (id: string) => void;
    onCaptureImage: (id: string) => void;
    onRemoveImage: (id: string, imageId: string) => void;
    onRemovePin: (id: string) => void;
  } = $props();

  let view = $state(idlePhotoPinView());
  let layerEl: HTMLDivElement | undefined = $state();
  let ignoreClick = $state(false);
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let pointerStart = { x: 0, y: 0, at: 0 };

  const hover = $derived(pins.find((pin) => pin.id === view.hoverId));
  const modal = $derived(pins.find((pin) => pin.id === view.modalId));
  const menuPin = $derived(pins.find((pin) => pin.id === view.menu?.id));
  const numbered = $derived(numberedPins(pins));
  const modalImages = $derived(modal?.images ?? []);
  const activeIndex = $derived(clampImageIndex(view.imageIndex, modalImages.length));
  const activeImage = $derived(modalImages[activeIndex]);

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

  function onPinContextMenu(event: MouseEvent, id: string) {
    event.preventDefault();
    event.stopPropagation();
    clearHold();
    view = openPinMenu(view, id, event.clientX, event.clientY);
  }

  function requestRemoveImage(pin: PhotoPinRecord, imageId: string) {
    if (pin.images.length <= 1) {
      requestRemovePin(pin);
      return;
    }
    if (!window.confirm("この画像を削除しますか？")) {
      return;
    }
    onRemoveImage(pin.id, imageId);
    view = showPinImage(view, activeIndex, pin.images.length - 1);
  }

  function requestRemovePin(pin: PhotoPinRecord) {
    const count = pin.images.length;
    const message =
      count > 1
        ? `このピンと画像 ${count} 枚を削除しますか？`
        : "このピンを削除しますか？";
    if (!window.confirm(message)) {
      return;
    }
    onRemovePin(pin.id);
    view = closePhotoPinModal(view);
  }

  $effect(() => {
    if (view.modalId && !pins.some((pin) => pin.id === view.modalId)) {
      view = closePhotoPinModal(view);
    }
    const menuId = view.menu?.id;
    if (menuId && !pins.some((pin) => pin.id === menuId)) {
      view = closePinMenu(view);
    }
  });

  $effect(() => {
    if (!view.menu) {
      return;
    }
    const onDismiss = () => {
      view = closePinMenu(view);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        view = closePinMenu(view);
      }
    };
    window.addEventListener("pointerdown", onDismiss);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDismiss);
      window.removeEventListener("keydown", onKey);
    };
  });

  $effect(() => {
    if (!view.modalId) {
      return;
    }
    const count = modalImages.length;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        view = closePhotoPinModal(view);
        return;
      }
      if (count < 2) {
        return;
      }
      if (event.key === "ArrowRight") {
        view = stepPinImage(view, 1, count);
      }
      if (event.key === "ArrowLeft") {
        view = stepPinImage(view, -1, count);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
</script>

<div bind:this={layerEl} class="pointer-events-none absolute inset-0 z-[2]">
  {#each numbered as item (item.pin.id)}
    {@const pin = item.pin}
    {@const cover = pin.images[0]}
    <div
      class="pointer-events-auto absolute -translate-x-1/2 {view.draggingId === pin.id
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
        class="relative flex touch-none flex-col items-center"
        aria-label={pin.title?.trim() ? `写真ピン ${item.label} ${pin.title}` : `写真ピン ${item.label}`}
        onpointerdown={(event) => onPinPointerDown(event, pin.id)}
        onpointermove={(event) => onPinPointerMove(event, pin.id)}
        onpointerup={onPinPointerUp}
        onpointercancel={onPinPointerUp}
        oncontextmenu={(event) => onPinContextMenu(event, pin.id)}
        onclick={() => onPinClick(pin.id)}
      >
        <span class="absolute bottom-full left-1/2 flex -translate-x-1/2 flex-col items-center">
          <span
            class="relative block h-11 w-11 overflow-hidden rounded-full border-2 border-white shadow-lg ring-1 ring-slate-900"
          >
            <img src={cover?.thumbnailDataUrl} alt="" draggable="false" class="h-full w-full object-cover" />
          </span>
          {#if pin.images.length > 1}
            <span
              class="absolute -top-1 -right-1 rounded-full bg-cyan-500 px-1 text-[10px] font-bold leading-4 text-slate-950"
            >
              {pin.images.length}
            </span>
          {/if}
          <span
            class="-mt-px h-0 w-0 border-x-[6px] border-t-[10px] border-x-transparent border-t-white"
          ></span>
        </span>
        <span class="mt-0.5 rounded-full bg-slate-950 px-1.5 text-[12px] font-bold leading-5 text-white">
          {item.label}
        </span>
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
          <img src={cover?.imageDataUrl} alt="" class="max-h-40 w-full object-contain" />
          {#if pin.images.length > 1}
            <span class="block bg-slate-950/80 py-0.5 text-[10px] text-cyan-100">
              画像 {pin.images.length} 枚
            </span>
          {/if}
        </button>
      {/if}
    </div>
  {/each}
</div>

{#if view.menu && menuPin}
  {@const pin = menuPin}
  <div
    class="fixed z-[70] min-w-44 rounded-md border border-slate-600 bg-slate-900 py-1 shadow-2xl"
    style="left: {view.menu.x}px; top: {view.menu.y}px"
    role="menu"
    tabindex="-1"
    onpointerdown={(event) => event.stopPropagation()}
  >
    <button
      type="button"
      class="block w-full px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-700"
      onclick={() => {
        view = closePinMenu(view);
        onAddImages(pin.id);
      }}
    >
      画像を追加
    </button>
    <button
      type="button"
      class="block w-full px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-700"
      onclick={() => {
        view = closePinMenu(view);
        onCaptureImage(pin.id);
      }}
    >
      撮影して追加
    </button>
    <button
      type="button"
      class="block w-full px-3 py-2 text-left text-sm text-rose-300 hover:bg-slate-700"
      onclick={() => {
        view = closePinMenu(view);
        requestRemovePin(pin);
      }}
    >
      ピンを削除
    </button>
  </div>
{/if}

{#if modal}
  {@const pin = modal}
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
      <div class="relative">
        <img
          src={activeImage?.imageDataUrl}
          alt={pin.title?.trim() || "挿入した画像"}
          class="max-h-[60vh] max-w-[80vw] rounded-lg object-contain shadow-2xl"
        />
        {#if modalImages.length > 1}
          <button
            type="button"
            class="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-slate-950/70 px-3 py-2 text-lg leading-none text-white hover:bg-slate-800"
            aria-label="前の画像"
            onclick={() => {
              view = stepPinImage(view, -1, modalImages.length);
            }}
          >
            ‹
          </button>
          <button
            type="button"
            class="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-slate-950/70 px-3 py-2 text-lg leading-none text-white hover:bg-slate-800"
            aria-label="次の画像"
            onclick={() => {
              view = stepPinImage(view, 1, modalImages.length);
            }}
          >
            ›
          </button>
          <span
            class="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/80 px-2 py-0.5 text-xs text-slate-100"
          >
            {activeIndex + 1} / {modalImages.length}
          </span>
        {/if}
      </div>

      {#if modalImages.length > 1}
        <div class="mt-2 flex flex-wrap gap-1.5">
          {#each modalImages as image, index (image.id)}
            <button
              type="button"
              class="h-12 w-12 overflow-hidden rounded border-2 {index === activeIndex
                ? 'border-cyan-400'
                : 'border-slate-600'}"
              aria-label="画像 {index + 1} を表示"
              onclick={() => {
                view = showPinImage(view, index, modalImages.length);
              }}
            >
              <img src={image.thumbnailDataUrl} alt="" class="h-full w-full object-cover" />
            </button>
          {/each}
        </div>
      {/if}

      <label class="mt-3 block text-xs text-slate-300">
        タイトル
        <input
          class="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          value={pin.title ?? ""}
          oninput={(event) => {
            onTitleChange(pin.id, (event.currentTarget as HTMLInputElement).value);
          }}
        />
      </label>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700"
          onclick={() => onAddImages(pin.id)}
        >
          画像を追加
        </button>
        <button
          type="button"
          class="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700"
          onclick={() => onCaptureImage(pin.id)}
        >
          撮影して追加
        </button>
        <button
          type="button"
          class="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-rose-300 hover:bg-slate-700"
          disabled={!activeImage}
          onclick={() => {
            if (activeImage) {
              requestRemoveImage(pin, activeImage.id);
            }
          }}
        >
          この画像を削除
        </button>
        <button
          type="button"
          class="ml-auto rounded border border-rose-500 bg-rose-950/60 px-3 py-2 text-sm text-rose-200 hover:bg-rose-900/60"
          onclick={() => requestRemovePin(pin)}
        >
          ピンを削除
        </button>
      </div>
    </div>
  </div>
{/if}
