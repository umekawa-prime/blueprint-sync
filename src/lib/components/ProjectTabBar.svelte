<script lang="ts">
  import { projectStore } from "$lib/stores/projectStore.svelte";
  import { closeProjectTab, openProjectTab, switchProjectTab } from "$lib/utils/projectActions";
</script>

{#if projectStore.tabs.length > 0}
  <div class="flex shrink-0 items-stretch border-b border-slate-700 bg-slate-950">
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
  </div>
{/if}
