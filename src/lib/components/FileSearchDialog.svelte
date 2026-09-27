<script lang="ts">
  import { projectStore } from "$lib/stores/projectStore.svelte";
  import { openCadFileInJwCad } from "$lib/utils/cadImport";
  import { fileSearchLabel, fileSearchOpenPlan, filterProjectFileNames, projectFileAbsolutePath } from "$lib/utils/fileSearch";
  import { listProjectFiles } from "$lib/utils/projectIo";
  import { openProjectPdf } from "$lib/utils/projectActions";

  let { onClose }: { onClose: () => void } = $props();

  let query = $state("");
  let files = $state<string[]>([]);
  let loading = $state(true);
  let error = $state("");
  let activeIndex = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);

  const results = $derived(filterProjectFileNames(files, query));

  $effect(() => {
    inputEl?.focus();
  });

  $effect(() => {
    void query;
    activeIndex = 0;
  });

  $effect(() => {
    const folder = projectStore.folder;
    loading = true;
    error = "";
    void listProjectFiles(folder)
      .then((listed) => {
        files = listed;
      })
      .catch((cause: unknown) => {
        error = cause instanceof Error ? cause.message : "ファイル一覧を読めませんでした";
      })
      .finally(() => {
        loading = false;
      });
  });

  $effect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function openResult(relPath: string) {
    const plan = fileSearchOpenPlan(relPath);
    if (!plan) {
      error = "ファイル名が不正です";
      return;
    }
    try {
      if (plan.kind === "project") {
        await openProjectPdf(plan.relPath);
      } else if (plan.kind === "cad") {
        const absolute = projectFileAbsolutePath(projectStore.folder, plan.relPath);
        if (!absolute) {
          error = "ファイル名が不正です";
          return;
        }
        await openCadFileInJwCad(absolute);
      } else {
        const absolute = projectFileAbsolutePath(projectStore.folder, plan.relPath);
        if (!absolute) {
          error = "ファイル名が不正です";
          return;
        }
        const { openPath } = await import("@tauri-apps/plugin-opener");
        await openPath(absolute);
      }
      onClose();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "ファイルを開けませんでした";
    }
  }

  function onInputKeydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      activeIndex = results.length === 0 ? 0 : (activeIndex + 1) % results.length;
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = results.length === 0 ? 0 : (activeIndex - 1 + results.length) % results.length;
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = results[activeIndex];
      if (selected) {
        void openResult(selected);
      }
    }
  }
</script>

<div
  class="fixed inset-0 z-[80] flex items-start justify-center bg-slate-950/70 p-4 pt-[12vh]"
  role="dialog"
  aria-modal="true"
  aria-labelledby="file-search-title"
  tabindex="-1"
  onclick={onClose}
  onkeydown={(event) => {
    if (event.key === "Escape") {
      onClose();
    }
  }}
>
  <article
    class="flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900"
    role="presentation"
    onclick={(event) => event.stopPropagation()}
  >
    <div class="border-b border-slate-800 px-4 py-3">
      <h2 id="file-search-title" class="text-sm font-semibold text-cyan-200">ファイルを検索</h2>
      <p class="mt-0.5 text-[11px] text-slate-500">このプロジェクトに紐づいているフォルダ内</p>
      <input
        bind:this={inputEl}
        bind:value={query}
        class="mt-2 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
        placeholder="ファイル名"
        aria-label="ファイル名"
        onkeydown={onInputKeydown}
      />
    </div>
    <div class="min-h-0 flex-1 overflow-auto px-2 py-2">
      {#if error}
        <p class="px-2 py-1 text-xs text-rose-300">{error}</p>
      {/if}
      {#if loading}
        <p class="px-2 py-1 text-xs text-slate-500">読み込み中</p>
      {:else if results.length === 0}
        <p class="px-2 py-1 text-xs text-slate-500">一致するファイルがありません</p>
      {:else}
        <ul class="space-y-0.5">
          {#each results as file, index (file)}
            {@const label = fileSearchLabel(file)}
            <li>
              <button
                type="button"
                class="flex w-full min-w-0 items-baseline gap-2 rounded px-2 py-1.5 text-left {index === activeIndex
                  ? 'bg-cyan-900 text-cyan-100'
                  : 'hover:bg-slate-800'}"
                onclick={() => void openResult(file)}
                onmouseenter={() => (activeIndex = index)}
              >
                <span class="min-w-0 flex-1 truncate text-sm">{label.name}</span>
                {#if label.folder}
                  <span class="shrink-0 text-[11px] text-slate-500">{label.folder}</span>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </article>
</div>
