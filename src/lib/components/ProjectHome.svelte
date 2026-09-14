<script lang="ts">
  import { onMount } from "svelte";
  import { projectStore } from "$lib/stores/projectStore.svelte";
  import {
    createProject,
    importIncomingFile,
    loadRecentsIntoStore,
    openProject,
    setProjectWorkflowStatus,
    startWebDemo,
  } from "$lib/utils/projectActions";
  import { pickImportFiles } from "$lib/utils/fileAccess";
  import { openFolderInCursor } from "$lib/utils/cursorOpen";
  import {
    isTauriRuntime,
    shouldAutoStartWebDemo,
    shouldOfferBrowserDemo,
    usesSandboxProjects,
  } from "$lib/utils/platform";
  import {
    folderDisplayName,
    parseProjectWorkflowStatus,
    PROJECT_WORKFLOW_STATUSES,
    projectWorkflowLabel,
    splitProjectsByWorkflow,
    type RecentProject,
  } from "$lib/utils/projectFormat";

  let busy = $state(false);
  let ready = $state(false);
  let tauri = $state(false);
  let sandbox = $state(false);
  let newName = $state("");

  onMount(() => {
    tauri = isTauriRuntime();
    sandbox = usesSandboxProjects();
    ready = true;
    void loadRecentsIntoStore();
    if (shouldAutoStartWebDemo(window.location.search, tauri)) {
      void run(() => startWebDemo());
    }
  });

  function uniqueProjects(items: RecentProject[]): RecentProject[] {
    const seen = new Set<string>();
    const result: RecentProject[] = [];
    for (const item of items) {
      if (seen.has(item.path)) {
        continue;
      }
      seen.add(item.path);
      result.push(item);
    }
    return result;
  }

  const openable = $derived(
    uniqueProjects([...projectStore.sandboxProjects, ...projectStore.recents]),
  );

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

  async function onCreate() {
    await run(() => createProject(sandbox ? newName : undefined));
  }

  async function onImport() {
    await run(async () => {
      const files = await pickImportFiles();
      for (const file of files) {
        const result = await importIncomingFile(file.name, file.bytes);
        if (result === "confirm-overwrite") {
          if (window.confirm("同じプロジェクトが既にあります。上書きしますか？")) {
            await importIncomingFile(file.name, file.bytes, true);
          }
          continue;
        }
        if (result === "ask-new-from-pdf") {
          if (window.confirm("プロジェクトが開いていません。この PDF で新規プロジェクトを作りますか？")) {
            await importIncomingFile(file.name, file.bytes, false, true);
          }
        }
      }
    });
  }

  function onStatusChange(path: string, event: Event) {
    const status = parseProjectWorkflowStatus((event.currentTarget as HTMLSelectElement).value);
    void run(() => setProjectWorkflowStatus(path, status));
  }
</script>

{#snippet projectRow(recent: RecentProject, title: string)}
  <li class="flex items-center gap-2 rounded hover:bg-slate-800">
    <button
      class="min-w-0 flex-1 px-3 py-2 text-left text-sm"
      disabled={busy}
      onclick={() => run(() => openProject(recent.path))}
    >
      <div>{title}</div>
      <div class="truncate text-[11px] text-slate-500">{recent.path}</div>
    </button>
    <select
      class="shrink-0 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
      disabled={busy}
      aria-label={`${title} の状態`}
      value={parseProjectWorkflowStatus(recent.status)}
      onchange={(event) => onStatusChange(recent.path, event)}
      onclick={(event) => event.stopPropagation()}
    >
      {#each PROJECT_WORKFLOW_STATUSES as status (status)}
        <option value={status}>{projectWorkflowLabel(status)}</option>
      {/each}
    </select>
    {#if tauri && !sandbox}
      <button
        type="button"
        class="mr-2 inline-flex shrink-0 items-center gap-1 rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        disabled={busy}
        title="Cursorで開く"
        aria-label={`${title} を Cursorで開く`}
        onclick={(event) => {
          event.stopPropagation();
          void run(() => openFolderInCursor(recent.path));
        }}
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M4.2 2.1 20 12 11.4 13.7 7.3 22z" />
        </svg>
        Cursor
      </button>
    {/if}
  </li>
{/snippet}

{#snippet projectGroups(items: RecentProject[], titleOf: (item: RecentProject) => string)}
  {@const grouped = splitProjectsByWorkflow(items)}
  {#if grouped.active.length > 0}
    <ul class="space-y-1">
      {#each grouped.active as recent (recent.path)}
        {@render projectRow(recent, titleOf(recent))}
      {/each}
    </ul>
  {/if}
  {#if grouped.completed.length > 0}
    <h2 class="mb-2 {grouped.active.length > 0 ? 'mt-4' : ''} text-xs text-slate-500">完了</h2>
    <ul class="space-y-1">
      {#each grouped.completed as recent (recent.path)}
        {@render projectRow(recent, titleOf(recent))}
      {/each}
    </ul>
  {/if}
{/snippet}

<div class="flex h-full flex-col items-center justify-center bg-slate-950 px-6 text-slate-100">
  <div class="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 p-6">
    <h1 class="mb-1 text-xl font-semibold text-cyan-300">Blueprint Sync</h1>
    <p class="mb-6 text-sm text-slate-400">
      {sandbox
        ? "プロジェクトを作成するか、共有された一式を取り込んでください"
        : "先にローカルのプロジェクトフォルダを開いてください"}
    </p>

    {#if !ready}
      <p class="mb-3 text-sm text-slate-400">起動しています…</p>
    {:else if shouldOfferBrowserDemo(tauri)}
      <p class="mb-3 text-sm text-amber-300">
        フォルダ選択は Tauri アプリ上のみです。ブラウザではデモで操作確認できます。
      </p>
      <button
        class="mb-3 w-full rounded bg-cyan-700 px-3 py-2 text-sm"
        disabled={busy}
        onclick={() => run(() => startWebDemo())}
      >
        ブラウザで操作確認
      </button>
    {:else if sandbox}
      <label class="mb-3 block text-xs text-slate-400">
        プロジェクト名
        <input
          class="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          placeholder="現場名"
          bind:value={newName}
        />
      </label>
      <button
        class="mb-3 w-full rounded bg-cyan-700 px-3 py-2 text-sm"
        disabled={busy || !newName.trim()}
        onclick={() => void onCreate()}
      >
        新規作成
      </button>
      <button
        class="mb-6 w-full rounded bg-slate-800 px-3 py-2 text-sm"
        disabled={busy}
        onclick={() => void onImport()}
      >
        取り込む
      </button>

      {#if openable.length > 0}
        {@render projectGroups(openable, (recent) => recent.name || folderDisplayName(recent.path))}
      {/if}
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
        {@render projectGroups(projectStore.recents, (recent) => folderDisplayName(recent.path))}
      {/if}
    {/if}

    {#if projectStore.error}
      <p class="mt-4 text-sm text-rose-300">{projectStore.error}</p>
    {/if}
  </div>
</div>
