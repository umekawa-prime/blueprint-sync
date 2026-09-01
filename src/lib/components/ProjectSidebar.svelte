<script lang="ts">
  import { pdfStore } from "$lib/stores/pdfStore.svelte";
  import { projectStore } from "$lib/stores/projectStore.svelte";
  import {
    addProjectLink,
    closeProject,
    importPdfIntoProject,
    openProjectLink,
    openProjectPdf,
    removeProjectLink,
  } from "$lib/utils/projectActions";
  import {
    displayLinkTitle,
    folderDisplayName,
    listPdfsOfKind,
    projectPdfDisplayName,
    type ProjectPdfKind,
  } from "$lib/utils/projectFormat";

  let url = $state("");
  let title = $state("");

  function message(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }

  async function onAddPdf(kind: ProjectPdfKind) {
    try {
      await importPdfIntoProject(kind);
    } catch (error) {
      pdfStore.status = message(error, "PDF の取り込みに失敗しました");
    }
  }

  async function onOpenPdf(file: string) {
    try {
      await openProjectPdf(file);
    } catch (error) {
      pdfStore.status = message(error, "PDF を開けませんでした");
    }
  }

  async function onAddLink() {
    try {
      await addProjectLink(url, title);
      if (!projectStore.error) {
        url = "";
        title = "";
      }
    } catch (error) {
      projectStore.error = message(error, "リンクの保存に失敗しました");
    }
  }

  async function onOpenLink(url: string) {
    try {
      await openProjectLink(url);
    } catch (error) {
      projectStore.error = message(error, "リンクを開けませんでした");
    }
  }

  async function onRemoveLink(id: string) {
    try {
      await removeProjectLink(id);
    } catch (error) {
      projectStore.error = message(error, "リンクの削除に失敗しました");
    }
  }

  async function onCloseProject() {
    try {
      await closeProject();
    } catch (error) {
      projectStore.error = message(error, "プロジェクトを閉じられませんでした");
    }
  }
</script>

<aside class="flex w-72 shrink-0 flex-col border-r border-slate-700 bg-slate-900">
  <div class="border-b border-slate-800 px-3 py-3">
    <div class="text-sm font-semibold text-cyan-300">{folderDisplayName(projectStore.folder)}</div>
    <div class="truncate text-[11px] text-slate-500">{projectStore.folder}</div>
  </div>

  <section class="min-h-0 flex-1 overflow-auto px-3 py-3">
    <h2 class="mb-2 text-xs text-slate-500">図面 PDF</h2>
    <button
      class="mb-2 w-full rounded bg-slate-800 px-2 py-1 text-xs"
      onclick={() => onAddPdf("drawing")}
    >
      図面を追加
    </button>
    {#if listPdfsOfKind(projectStore.pdfs, "drawing").length === 0}
      <p class="text-xs text-slate-500">フォルダまたは「図面を追加」から PDF を入れてください</p>
    {:else}
      <ul class="space-y-1">
        {#each listPdfsOfKind(projectStore.pdfs, "drawing") as file (file)}
          <li>
            <button
              class="w-full truncate rounded px-2 py-1 text-left text-sm {projectStore.currentPdf === file
                ? 'bg-cyan-900 text-cyan-100'
                : 'hover:bg-slate-800'}"
              onclick={() => onOpenPdf(file)}
            >
              {projectPdfDisplayName(file)}
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    <h2 class="mb-2 mt-5 text-xs text-slate-500">工程表 PDF</h2>
    <button
      class="mb-2 w-full rounded bg-slate-800 px-2 py-1 text-xs"
      onclick={() => onAddPdf("schedule")}
    >
      工程表を追加
    </button>
    {#if listPdfsOfKind(projectStore.pdfs, "schedule").length === 0}
      <p class="text-xs text-slate-500">「工程表を追加」から PDF を入れてください</p>
    {:else}
      <ul class="space-y-1">
        {#each listPdfsOfKind(projectStore.pdfs, "schedule") as file (file)}
          <li>
            <button
              class="w-full truncate rounded px-2 py-1 text-left text-sm {projectStore.currentPdf === file
                ? 'bg-cyan-900 text-cyan-100'
                : 'hover:bg-slate-800'}"
              onclick={() => onOpenPdf(file)}
            >
              {projectPdfDisplayName(file)}
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    <h2 class="mb-2 mt-5 text-xs text-slate-500">OneDrive リンク</h2>
    <input
      class="mb-2 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs"
      placeholder="https://1drv.ms/..."
      bind:value={url}
    />
    <input
      class="mb-2 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs"
      placeholder="表示名（任意）"
      bind:value={title}
    />
    <button
      class="mb-3 w-full rounded bg-slate-800 px-2 py-1 text-xs"
      onclick={onAddLink}
    >
      リンクを追加
    </button>
    {#if projectStore.error}
      <p class="mb-3 text-sm text-rose-300">{projectStore.error}</p>
    {/if}
    <ul class="space-y-1">
      {#each projectStore.meta?.links ?? [] as link (link.id)}
        <li class="flex items-center gap-1">
          <button
            class="min-w-0 flex-1 truncate text-left text-xs text-cyan-300 underline"
            onclick={() => onOpenLink(link.url)}
          >
            {displayLinkTitle(link)}
          </button>
          <button class="text-[11px] text-slate-500" onclick={() => onRemoveLink(link.id)}>
            削除
          </button>
        </li>
      {/each}
    </ul>
  </section>

  <button class="border-t border-slate-800 px-3 py-2 text-xs text-slate-400" onclick={onCloseProject}>
    プロジェクトを閉じる
  </button>
</aside>
