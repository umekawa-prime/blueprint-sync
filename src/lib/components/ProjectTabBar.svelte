<script lang="ts">
  import WindowControls from "$lib/components/WindowControls.svelte";
  import { projectStore } from "$lib/stores/projectStore.svelte";
  import { isDesktopTauriRuntime } from "$lib/utils/platform";
  import { closeProjectTab, showProjectHome, switchProjectTab } from "$lib/utils/projectActions";
  import { toggleMaximizeAppWindow } from "$lib/utils/windowActions";

  const desktopChrome = isDesktopTauriRuntime();
  const homeActive = $derived(projectStore.activeTabId === null);

  function onTitleBarDoubleClick() {
    void toggleMaximizeAppWindow();
  }
</script>

{#if desktopChrome || projectStore.tabs.length > 0}
  <div
    class="flex h-8 shrink-0 select-none items-stretch border-b border-slate-700 bg-slate-950"
  >
    {#if projectStore.tabs.length > 0}
      <div class="project-tabs flex w-max min-w-0 shrink overflow-x-auto">
        {#each projectStore.tabs as tab (tab.id)}
          {@const active = projectStore.activeTabId === tab.id}
          <div
            class="flex min-w-32 max-w-56 shrink items-stretch border-r border-slate-800 {active
              ? 'bg-slate-800'
              : ''}"
          >
            <button
              type="button"
              class="min-w-0 flex-1 truncate border-t-2 px-3 py-1.5 text-left text-xs {active
                ? 'border-t-cyan-400 text-cyan-100'
                : 'border-t-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-200'}"
              onclick={() => void switchProjectTab(tab.id)}
            >
              {tab.name}
            </button>
            <button
              type="button"
              class="shrink-0 border-t-2 px-2 text-xs text-slate-500 hover:text-rose-300 {active
                ? 'border-t-cyan-400'
                : 'border-t-transparent'}"
              aria-label="{tab.name}を閉じる"
              onclick={() => void closeProjectTab(tab.id)}
            >
              ×
            </button>
          </div>
        {/each}
      </div>
      <button
        type="button"
        class="shrink-0 border-l border-slate-800 px-3 text-sm {homeActive
          ? 'border-t-2 border-t-cyan-400 bg-slate-800 text-cyan-100'
          : 'border-t-2 border-t-transparent text-cyan-300 hover:bg-slate-900'}"
        aria-label="プロジェクトを開く"
        onclick={() => void showProjectHome()}
      >
        +
      </button>
    {:else}
      <div
        class="flex min-w-0 items-center px-3 text-xs font-semibold tracking-wide text-cyan-300"
        data-tauri-drag-region
        ondblclick={onTitleBarDoubleClick}
      >
        Blueprint Sync
      </div>
    {/if}

    {#if desktopChrome}
      <div
        class="min-w-8 flex-1"
        data-tauri-drag-region
        ondblclick={onTitleBarDoubleClick}
      ></div>
      <WindowControls />
    {/if}
  </div>
{/if}

<style>
  :global([data-tauri-drag-region]) {
    -webkit-app-region: drag;
    app-region: drag;
  }

  .project-tabs {
    scrollbar-width: none;
  }

  .project-tabs::-webkit-scrollbar {
    display: none;
  }
</style>
