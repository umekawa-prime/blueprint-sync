<script lang="ts">
  import { pdfStore } from "$lib/stores/pdfStore.svelte";
  import { viewportStore } from "$lib/stores/viewportStore.svelte";
  import { pageSidebarClass } from "$lib/utils/chromeLayout";
  import { selectPdfPage } from "$lib/utils/pageNavigation";
  import { renderPdfThumbnails } from "$lib/utils/pdfThumbnails";

  let thumbnails = $state<string[]>([]);
  let navEl = $state<HTMLElement | null>(null);

  const pages = $derived(Array.from({ length: pdfStore.pageCount }, (_, pageIndex) => pageIndex));

  $effect(() => {
    const document = pdfStore.document;
    const pageCount = pdfStore.pageCount;
    if (!document || pageCount === 0) {
      thumbnails = [];
      return;
    }
    let cancelled = false;
    void renderPdfThumbnails(document, pageCount).then((urls) => {
      if (!cancelled) {
        thumbnails = urls;
      }
    });
    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    const pageIndex = pdfStore.pageIndex;
    navEl
      ?.querySelector(`[data-page-index="${pageIndex}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
</script>

{#if pdfStore.pageCount > 0}
  <nav
    bind:this={navEl}
    class={pageSidebarClass(viewportStore.isPhone)}
    class:order-2={viewportStore.isPhone}
    aria-label="ページ一覧"
  >
    {#each pages as pageIndex (pageIndex)}
      {@const selected = pageIndex === pdfStore.pageIndex}
      <button
        type="button"
        data-page-index={pageIndex}
        class="flex shrink-0 flex-col items-center gap-1 rounded-md p-1 {viewportStore.isPhone
          ? 'w-16'
          : 'w-full'} {selected
          ? 'bg-cyan-950 ring-1 ring-cyan-400'
          : 'hover:bg-slate-800'}"
        aria-current={selected ? "page" : undefined}
        aria-label={`ページ ${pageIndex + 1}`}
        onclick={() => void selectPdfPage(pageIndex)}
      >
        <div class="w-full overflow-hidden rounded bg-white shadow">
          {#if thumbnails[pageIndex]}
            <img src={thumbnails[pageIndex]} alt="" class="block w-full" />
          {:else}
            <div class="aspect-[3/4] w-full bg-slate-200"></div>
          {/if}
        </div>
        <span class="text-[11px] {selected ? 'text-cyan-200' : 'text-slate-400'}">{pageIndex + 1}</span>
      </button>
    {/each}
  </nav>
{/if}
