<script lang="ts">
  import { noteStore } from "$lib/stores/noteStore.svelte";
  import {
    draftProjectNoteText,
    moveProjectNote,
    promoteNoteLine,
    removeEmptyProjectNote,
    saveProjectNotes,
    splitProjectNote,
  } from "$lib/utils/noteActions";

  let draggingFrom = $state<number | null>(null);
  let overIndex = $state<number | null>(null);
  let focusId = $state<string | null>(null);

  $effect(() => {
    const id = focusId;
    if (!id) {
      return;
    }
    const input = document.querySelector(`[data-note-input="${id}"]`);
    if (input instanceof HTMLInputElement) {
      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }
    focusId = null;
  });

  function onHandlePointerDown(event: PointerEvent, index: number) {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    draggingFrom = index;
    overIndex = index;
  }

  function onHandlePointerMove(event: PointerEvent) {
    if (draggingFrom === null) {
      return;
    }
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const row = target instanceof Element ? target.closest("[data-note-index]") : null;
    if (row) {
      overIndex = Number(row.getAttribute("data-note-index"));
    }
  }

  async function onHandlePointerUp() {
    if (draggingFrom !== null && overIndex !== null && draggingFrom !== overIndex) {
      await moveProjectNote(draggingFrom, overIndex);
    }
    draggingFrom = null;
    overIndex = null;
  }

  async function onKeydown(event: KeyboardEvent, id: string, input: HTMLInputElement) {
    if (event.key === "Enter") {
      event.preventDefault();
      const caret = input.selectionStart ?? input.value.length;
      focusId = (await splitProjectNote(id, caret)) ?? null;
      return;
    }
    if (event.key === "Backspace" && input.value === "" && (input.selectionStart ?? 0) === 0) {
      event.preventDefault();
      focusId = (await removeEmptyProjectNote(id)) ?? null;
    }
  }
</script>

<ul class="min-h-0 flex-1 overflow-auto py-1" aria-label="メモ">
  {#each noteStore.lines as line, index (line.id)}
    <li
      data-note-index={index}
      class="flex items-center gap-1 border-b border-slate-800 px-2 py-1 {overIndex === index && draggingFrom !== null
        ? 'bg-slate-800/80'
        : ''}"
    >
      <button
        type="button"
        class="shrink-0 cursor-grab px-1 text-slate-500 hover:text-slate-300"
        aria-label="行を移動"
        onpointerdown={(event) => onHandlePointerDown(event, index)}
        onpointermove={onHandlePointerMove}
        onpointerup={() => void onHandlePointerUp()}
      >
        ⋮⋮
      </button>
      <input
        data-note-input={line.id}
        class="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-1 text-sm text-slate-100 outline-none focus:border-slate-600"
        value={line.text}
        placeholder="メモ"
        oninput={(event) => draftProjectNoteText(line.id, (event.currentTarget as HTMLInputElement).value)}
        onblur={() => void saveProjectNotes()}
        onkeydown={(event) => void onKeydown(event, line.id, event.currentTarget as HTMLInputElement)}
      />
      {#if line.todoKey}
        <button
          type="button"
          class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-[#4488c5] hover:bg-slate-800"
          onclick={() => void promoteNoteLine(line.id)}
        >
          {line.todoKey}
        </button>
      {:else}
        <button
          type="button"
          class="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"
          disabled={!line.text.trim()}
          onclick={() => void promoteNoteLine(line.id)}
        >
          課題化
        </button>
      {/if}
    </li>
  {/each}
</ul>
