<script lang="ts">
  import type { MemoPinRecord } from "$lib/utils/annotationPersist";
  import {
    PIN_DRAG_HOLD_MS,
    PIN_DRAG_MOVE_PX,
    pinPositionFromPointer,
    shouldArmPinDrag,
  } from "$lib/utils/photoPinUi";
  import { wrapMemoLines } from "$lib/utils/memoPinLayout";

  let {
    pins,
    editingId,
    onEdit,
    onTextChange,
    onMove,
    onRemove,
  }: {
    pins: MemoPinRecord[];
    editingId: string | null;
    onEdit: (id: string | null) => void;
    onTextChange: (id: string, text: string) => void;
    onMove: (id: string, nx: number, ny: number) => void;
    onRemove: (id: string) => void;
  } = $props();

  let layerEl: HTMLDivElement | undefined = $state();
  let editorEl: HTMLTextAreaElement | undefined = $state();
  let draggingId = $state<string | null>(null);
  let menu = $state<{ id: string; x: number; y: number } | null>(null);
  let ignoreClick = $state(false);
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let pointerStart = { x: 0, y: 0, at: 0 };

  const menuPin = $derived(pins.find((pin) => pin.id === menu?.id));

  $effect(() => {
    if (!editingId || !editorEl) {
      return;
    }
    editorEl.focus();
    editorEl.select();
  });

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
        draggingId = id;
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
    if (!draggingId && shouldArmPinDrag(event.pointerType, held, moved)) {
      clearHold();
      draggingId = id;
      ignoreClick = true;
    }
    if (draggingId !== id) {
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
    draggingId = null;
  }

  function onPinClick(id: string) {
    if (ignoreClick) {
      ignoreClick = false;
      return;
    }
    menu = null;
    onEdit(id);
  }

  function onPinContextMenu(event: MouseEvent, id: string) {
    event.preventDefault();
    event.stopPropagation();
    menu = { id, x: event.clientX, y: event.clientY };
  }

  function commitEdit(pin: MemoPinRecord) {
    if (!pin.text.trim()) {
      onRemove(pin.id);
      return;
    }
    if (editingId === pin.id) {
      onEdit(null);
    }
  }

  $effect(() => {
    if (!menu) {
      return;
    }
    const onDismiss = () => {
      menu = null;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        menu = null;
      }
    };
    window.addEventListener("pointerdown", onDismiss);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDismiss);
      window.removeEventListener("keydown", onKey);
    };
  });
</script>

<div bind:this={layerEl} class="pointer-events-none absolute inset-0 z-[3]">
  {#each pins as pin (pin.id)}
    <div
      class="pointer-events-auto absolute -translate-x-1/2 {draggingId === pin.id ? 'z-10 scale-110' : ''}"
      style="left: {pin.nx * 100}%; top: {pin.ny * 100}%"
      role="group"
    >
      <button
        type="button"
        class="relative flex touch-none flex-col items-center"
        aria-label={pin.text.trim() ? `メモ ${pin.text}` : "メモ"}
        onpointerdown={(event) => onPinPointerDown(event, pin.id)}
        onpointermove={(event) => onPinPointerMove(event, pin.id)}
        onpointerup={onPinPointerUp}
        onpointercancel={onPinPointerUp}
        oncontextmenu={(event) => onPinContextMenu(event, pin.id)}
        onclick={() => onPinClick(pin.id)}
      >
        <span class="absolute bottom-full left-1/2 flex -translate-x-1/2 flex-col items-center">
          <span
            class="block h-4 w-4 rounded-full border-2 border-white shadow"
            style="background:{pin.color}"
          ></span>
          <span
            class="-mt-px h-0 w-0 border-x-[5px] border-t-[8px] border-x-transparent"
            style="border-top-color:{pin.color}"
          ></span>
        </span>
      </button>
      <div
        class="absolute left-4 bottom-2 min-w-16 max-w-44 rounded-md border bg-white px-2 py-1 text-xs shadow-lg {pin.nx > 0.7
          ? 'right-4 left-auto'
          : ''}"
        style="border-color:{pin.color}; color:{pin.color}"
        onpointerdown={(event) => event.stopPropagation()}
      >
        {#if editingId === pin.id}
          <textarea
            bind:this={editorEl}
            class="block h-16 w-36 resize-none bg-transparent text-xs outline-none"
            value={pin.text}
            aria-label="メモ本文"
            oninput={(event) => onTextChange(pin.id, event.currentTarget.value)}
            onblur={() => commitEdit(pin)}
            onkeydown={(event) => {
              if (event.key === "Escape") {
                event.currentTarget.blur();
              }
            }}
          ></textarea>
        {:else}
          <button
            type="button"
            class="block w-full whitespace-pre-wrap text-left"
            onclick={() => onPinClick(pin.id)}
          >
            {#each wrapMemoLines(pin.text || "メモ") as line, index (index)}
              <span class="block">{line || " "}</span>
            {/each}
          </button>
        {/if}
      </div>
    </div>
  {/each}
</div>

{#if menu && menuPin}
  <div
    class="fixed z-[70] min-w-32 rounded-md border border-slate-600 bg-slate-900 py-1 shadow-2xl"
    style="left: {menu.x}px; top: {menu.y}px"
    role="menu"
    tabindex="-1"
    onpointerdown={(event) => event.stopPropagation()}
  >
    <button
      type="button"
      class="block w-full px-3 py-2 text-left text-sm text-rose-300 hover:bg-slate-700"
      onclick={() => {
        const id = menuPin.id;
        menu = null;
        onRemove(id);
      }}
    >
      メモを削除
    </button>
  </div>
{/if}
