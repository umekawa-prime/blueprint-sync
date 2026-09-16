<script lang="ts">
  import type { Snippet } from "svelte";
  import {
    sidebarFrameStyle,
    sidebarLayoutAfterDrag,
    type SidebarSide,
  } from "$lib/utils/chromeLayout";

  let {
    side,
    open,
    width,
    minWidth,
    maxWidth,
    expandLabel,
    onWidth,
    onOpenChange,
    children,
  }: {
    side: SidebarSide;
    open: boolean;
    width: number;
    minWidth: number;
    maxWidth: number;
    expandLabel: string;
    onWidth: (width: number) => void;
    onOpenChange: (open: boolean) => void;
    children: Snippet;
  } = $props();

  let dragging = $state(false);
  let startX = 0;
  let startWidth = 0;

  function applyDrag(clientX: number) {
    const next = sidebarLayoutAfterDrag(
      startWidth,
      startX,
      clientX,
      side,
      minWidth,
      maxWidth,
    );
    if (next.open !== open) {
      onOpenChange(next.open);
    }
    if (next.width !== width) {
      onWidth(next.width);
    }
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    dragging = true;
    startX = event.clientX;
    startWidth = width;

    const onMove = (move: PointerEvent) => {
      applyDrag(move.clientX);
    };
    const onUp = () => {
      dragging = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
</script>

<div
  class="relative flex h-full shrink-0 flex-col {open
    ? ''
    : `${side === 'left' ? 'border-r' : 'border-l'} border-slate-700 bg-slate-900`} {dragging
    ? 'select-none'
    : ''}"
  style={sidebarFrameStyle(open, width)}
>
  {#if open}
    <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {@render children()}
    </div>
    <button
      type="button"
      class="absolute top-1 z-20 flex h-6 w-4 items-center justify-center rounded-sm text-slate-400 hover:bg-slate-700 hover:text-cyan-200 {side ===
      'left'
        ? 'right-0'
        : 'left-0'}"
      title={`${expandLabel}を隠す`}
      aria-label={`${expandLabel}を隠す`}
      onclick={() => onOpenChange(false)}
    >
      <svg class="h-3 w-3" viewBox="0 0 12 12" aria-hidden="true">
        {#if side === "left"}
          <path fill="currentColor" d="M8.2 1.6 3.8 6l4.4 4.4.9-.9L5.6 6l3.5-3.5z" />
        {:else}
          <path fill="currentColor" d="M3.8 1.6 8.2 6l-4.4 4.4-.9-.9L6.4 6 3 2.5z" />
        {/if}
      </svg>
    </button>
    <div
      role="separator"
      tabindex="0"
      aria-orientation="vertical"
      aria-label={`${expandLabel}の幅を変更`}
      title="ドラッグして幅を変更"
      class="absolute inset-y-0 z-10 w-1.5 cursor-col-resize touch-none hover:bg-cyan-500/40 {side ===
      'left'
        ? 'right-0'
        : 'left-0'} {dragging ? 'bg-cyan-500/40' : ''}"
      onpointerdown={onPointerDown}
      ondblclick={() => onOpenChange(false)}
    ></div>
  {:else}
    <button
      type="button"
      class="flex h-full w-full items-start justify-center pt-2 text-slate-400 hover:bg-slate-800 hover:text-cyan-200"
      title={`${expandLabel}を表示`}
      aria-label={`${expandLabel}を表示`}
      onclick={() => onOpenChange(true)}
    >
      <svg class="h-3 w-3" viewBox="0 0 12 12" aria-hidden="true">
        {#if side === "left"}
          <path fill="currentColor" d="M3.8 1.6 8.2 6l-4.4 4.4-.9-.9L6.4 6 3 2.5z" />
        {:else}
          <path fill="currentColor" d="M8.2 1.6 3.8 6l4.4 4.4.9-.9L5.6 6l3.5-3.5z" />
        {/if}
      </svg>
    </button>
  {/if}
</div>
