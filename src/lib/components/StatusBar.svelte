<script lang="ts">
  import { annotationStore } from "$lib/stores/annotationStore.svelte";
  import { connectionStore } from "$lib/stores/connectionStore.svelte";
  import { pdfStore } from "$lib/stores/pdfStore.svelte";
  import { projectStore } from "$lib/stores/projectStore.svelte";

  const statusLabel = $derived.by(() => {
    switch (connectionStore.status) {
      case "hosting":
        return `ホスト待機中 ${connectionStore.url}`;
      case "connecting":
        return "接続中...";
      case "connected":
        return `同期中 ${connectionStore.url}`;
      case "error":
        return connectionStore.error || "接続エラー";
      default:
        return "オフライン（ローカル編集）";
    }
  });
</script>

<footer
  class="flex items-center justify-between border-t border-slate-700 bg-slate-950 px-3 py-1 text-[11px] text-slate-400"
>
  <span class="truncate">{pdfStore.name}{annotationStore.dirty ? " ・未保存の注釈あり" : ""}</span>
  <span class="truncate text-right {projectStore.error || pdfStore.status ? 'text-rose-300' : ''}">{projectStore.error || pdfStore.status || statusLabel}</span>
</footer>
