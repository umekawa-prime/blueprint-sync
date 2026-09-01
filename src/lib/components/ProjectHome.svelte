<script lang="ts">
  import { onMount } from "svelte";
  import { projectStore } from "$lib/stores/projectStore.svelte";
  import { createProject, loadRecentsIntoStore, openProject } from "$lib/utils/projectActions";
  import { isTauriRuntime } from "$lib/utils/platform";
  import { folderDisplayName } from "$lib/utils/projectFormat";

  let busy = $state(false);

  onMount(() => {
    void loadRecentsIntoStore();
  });

  async function run(action: () => Promise<void>) {
    busy = true;
    try {
      await action();
    } catch (error) {
      projectStore.error = error instanceof Error ? error.message : "操作に失敗しました";
    } finally {
      busy = false;
    }
  }
</script>

<div class="flex h-full flex-col items-center justify-center bg-slate-950 px-6 text-slate-100">
  <div class="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6">
    <h1 class="mb-1 text-xl font-semibold text-cyan-300">Blueprint Sync</h1>
    <p class="mb-6 text-sm text-slate-400">先にローカルのプロジェクトフォルダを開いてください</p>

    {#if !isTauriRuntime()}
      <p class="text-sm text-amber-300">プロジェクト機能は Tauri アプリ上でのみ利用できます。</p>
    {:else}
      <button
        class="mb-3 w-full rounded bg-cyan-700 px-3 py-2 text-sm"
        disabled={busy}
        onclick={() => run(() => createProject())}
      >
        フォルダを選んで作成
      </button>
      <button
        class="mb-6 w-full rounded bg-slate-800 px-3 py-2 text-sm"
        disabled={busy}
        onclick={() => run(() => openProject())}
      >
        既存プロジェクトを開く
      </button>

      {#if projectStore.recents.length > 0}
        <h2 class="mb-2 text-xs text-slate-500">最近使ったプロジェクト</h2>
        <ul class="space-y-1">
          {#each projectStore.recents as recent (recent.path)}
            <li>
              <button
                class="w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-800"
                disabled={busy}
                onclick={() => run(() => openProject(recent.path))}
              >
                <div>{folderDisplayName(recent.path)}</div>
                <div class="truncate text-[11px] text-slate-500">{recent.path}</div>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}

    {#if projectStore.error}
      <p class="mt-4 text-sm text-rose-300">{projectStore.error}</p>
    {/if}
  </div>
</div>
