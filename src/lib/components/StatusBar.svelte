<script lang="ts">
  import { annotationStore } from "$lib/stores/annotationStore.svelte";
  import { pdfStore } from "$lib/stores/pdfStore.svelte";
  import { projectStore } from "$lib/stores/projectStore.svelte";
</script>

<footer
  class="flex items-center justify-between border-t border-slate-700 bg-slate-950 px-3 py-1 text-[11px] text-slate-400"
>
  <span class="truncate">{pdfStore.name}{annotationStore.dirty ? " ・未保存の注釈あり" : ""}</span>
  <span class="truncate text-right {projectStore.error || pdfStore.status ? 'text-rose-300' : ''}">{projectStore.error || pdfStore.status}</span>
</footer>
