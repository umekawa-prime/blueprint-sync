<script lang="ts">
  import WindowControls from "$lib/components/WindowControls.svelte";
  import { projectStore } from "$lib/stores/projectStore.svelte";
  import { isDesktopTauriRuntime } from "$lib/utils/platform";
  import { closeProjectTab, openProjectTab, switchProjectTab } from "$lib/utils/projectActions";
  import { toggleMaximizeAppWindow } from "$lib/utils/windowActions";

  const desktopChrome = isDesktopTauriRuntime();

  function onTitleBarDoubleClick() {
    void toggleMaximizeAppWindow();
  }
</script>

{#if desktopChrome || projectStore.tabs.length > 0}
  <div
    class="flex h-8 shrink-0 select-none items-stretch border-b border-slate-700 bg-slate-950"
  >
    {#if projectStore.tabs.length > 0}
      <div class="flex min-w-0 flex-1 overflow-x-auto">
        {#each projectStore.tabs as tab (tab.id)}
          {@const active = projectStore.activeTabId === tab.id}
          <div
            class="flex max-w-56 shrink-0 items-stretch border-r border-slate-800 {active
              ? 'border-t-2 border-t-cyan-400 bg-slate-800'
              : 'border-t-2 border-t-transparent'}"
          >
            <button
              type="button"
              class="min-w-0 flex-1 truncate px-3 py-1.5 text-left text-xs {active
                ? 'text-cyan-100'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}"
              onclick={() => void switchProjectTab(tab.id)}
            >
              {tab.name}
            </button>
            <button
              type="button"
              class="px-2 text-xs text-slate-500 hover:text-rose-300"
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
        class="shrink-0 border-l border-slate-800 px-3 text-sm text-cyan-300 hover:bg-slate-900"
        aria-label="プロジェクトを開く"
        onclick={() => void openProjectTab()}
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
</style>
