<script lang="ts">
  import { annotationStore } from "$lib/stores/annotationStore.svelte";
  import { autoSaveStore } from "$lib/stores/autoSaveStore.svelte";
  import { pdfStore } from "$lib/stores/pdfStore.svelte";
  import { projectStore } from "$lib/stores/projectStore.svelte";
  import { supportsBrowserFolders } from "$lib/utils/platform";

  const message = $derived(projectStore.error || pdfStore.status);
  const saveLabel = $derived(
    supportsBrowserFolders() && projectStore.isOpen
      ? autoSaveStore.state === "saving"
        ? "保存中…"
        : autoSaveStore.state === "saved"
          ? "保存済み"
          : autoSaveStore.state === "error"
            ? "保存に失敗しました"
            : ""
      : "",
  );
</script>

<footer
  class="flex items-center justify-between border-t border-slate-700 bg-slate-950 px-3 py-1 text-[11px] text-slate-400"
>
  <span class="truncate">{pdfStore.name}{annotationStore.dirty ? " ・未保存の注釈あり" : ""}</span>
  {#if message}
    <span class="truncate text-right text-rose-300">{message}</span>
  {:else if saveLabel}
    <span class="truncate text-right {autoSaveStore.state === 'error' ? 'text-rose-300' : ''}">{saveLabel}</span>
  {:else}
    <span></span>
  {/if}
</footer>
