<script lang="ts">
  import DatePicker from "$lib/components/DatePicker.svelte";
  import { todoStore } from "$lib/stores/todoStore.svelte";
  import { viewportStore } from "$lib/stores/viewportStore.svelte";
  import { todoPanelClass } from "$lib/utils/chromeLayout";
  import {
    addProjectTodo,
    removeProjectTodo,
    toggleTodoPanel,
    updateProjectTodo,
  } from "$lib/utils/todoActions";
  import {
    TODO_FILTERS,
    TODO_STATUSES,
    formatTodoDue,
    isTodoDraftDirty,
    isTodoOverdue,
    statusLabel,
    todoRowAccentClass,
    todoStatusBadgeClass,
    type TodoStatus,
  } from "$lib/utils/todoMarkdown";

  let newTitle = $state("");
  let adding = $state(false);
  let saving = $state(false);
  let draftKey = $state<string | null>(null);
  let draftTitle = $state("");
  let draftStatus = $state<TodoStatus>("open");
  let draftDue = $state<string | null>(null);
  let draftDescription = $state("");

  const selected = $derived(todoStore.selected);
  const visible = $derived(todoStore.visible);
  const dirty = $derived(
    selected
      ? isTodoDraftDirty(selected, {
          title: draftTitle,
          status: draftStatus,
          due: draftDue,
          description: draftDescription,
        })
      : false,
  );

  $effect(() => {
    const item = todoStore.selected;
    const key = item?.key ?? null;
    if (key === draftKey) {
      return;
    }
    draftKey = key;
    if (!item) {
      return;
    }
    draftTitle = item.title;
    draftStatus = item.status;
    draftDue = item.due;
    draftDescription = item.description;
  });

  async function onAdd() {
    if (adding) {
      return;
    }
    adding = true;
    try {
      await addProjectTodo(newTitle);
      newTitle = "";
    } finally {
      adding = false;
    }
  }

  async function onSave() {
    const key = todoStore.selectedKey;
    if (!key || saving || !dirty) {
      return;
    }
    saving = true;
    try {
      await updateProjectTodo(key, {
        title: draftTitle,
        status: draftStatus,
        due: draftDue,
        description: draftDescription,
      });
    } finally {
      saving = false;
    }
  }

  function backToList() {
    if (dirty && !window.confirm("保存していない変更があります。一覧へ戻りますか？")) {
      return;
    }
    todoStore.selectedKey = null;
  }

  async function onDelete() {
    const key = todoStore.selectedKey;
    if (!key) {
      return;
    }
    if (!window.confirm("この課題を削除しますか？")) {
      return;
    }
    await removeProjectTodo(key);
  }
</script>

<aside class={todoPanelClass(viewportStore.isPhone)} aria-label="課題">
  <div class="flex items-center gap-2 border-b border-slate-700 px-3 py-2">
    {#if selected}
      <button class="text-xs text-cyan-300" onclick={backToList}>一覧へ</button>
    {:else}
      <h2 class="text-sm font-semibold">課題</h2>
      <span class="rounded-full bg-slate-700 px-2 py-0.5 text-[11px] text-slate-200">{todoStore.activeCount}</span>
    {/if}
    <button class="ml-auto text-xs text-slate-400" onclick={() => toggleTodoPanel(false)}>閉じる</button>
  </div>

  {#if selected}
    <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-3 py-3">
      <p class="text-xs font-semibold text-[#4488c5]">{selected.key}</p>
      <label class="block text-[11px] text-slate-400">
        件名
        <input
          class="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          bind:value={draftTitle}
        />
      </label>
      <label class="block text-[11px] text-slate-400">
        状態
        <select
          class="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          bind:value={draftStatus}
        >
          {#each TODO_STATUSES as status (status)}
            <option value={status}>{statusLabel(status)}</option>
          {/each}
        </select>
      </label>
      <div class="block text-[11px] text-slate-400">
        期限日
        <DatePicker value={draftDue} onChange={(next) => (draftDue = next)} />
      </div>
      <label class="block text-[11px] text-slate-400">
        詳細
        <textarea
          class="mt-1 min-h-28 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          bind:value={draftDescription}
        ></textarea>
      </label>
      <div class="mt-auto flex gap-2">
        <button
          class="flex-1 rounded bg-[#4488c5] px-2 py-1.5 text-xs text-white disabled:opacity-40"
          type="button"
          disabled={!dirty || saving}
          onclick={() => void onSave()}
        >
          保存
        </button>
        <button class="rounded border border-rose-800 px-2 py-1.5 text-xs text-rose-300" type="button" onclick={() => void onDelete()}>
          削除
        </button>
      </div>
    </div>
  {:else}
    <form
      class="flex gap-2 border-b border-slate-800 px-3 py-2"
      onsubmit={(event) => {
        event.preventDefault();
        void onAdd();
      }}
    >
      <input
        class="min-w-0 flex-1 rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
        placeholder="課題の件名を入力して追加"
        bind:value={newTitle}
      />
      <button class="shrink-0 rounded bg-[#4488c5] px-2 py-1 text-xs text-white" type="submit" disabled={adding}>
        追加
      </button>
    </form>
    <div class="border-b border-slate-800 px-3 py-2">
      <input
        class="mb-2 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-100"
        placeholder="検索"
        bind:value={todoStore.query}
      />
      <div class="flex flex-wrap gap-1">
        {#each TODO_FILTERS as filter (filter.id)}
          <button
            type="button"
            class="rounded px-2 py-0.5 text-[11px] {todoStore.filter === filter.id
              ? 'bg-[#4488c5] text-white'
              : 'bg-slate-800 text-slate-300'}"
            onclick={() => (todoStore.filter = filter.id)}
          >
            {filter.label}
          </button>
        {/each}
      </div>
    </div>
    <ul class="min-h-0 flex-1 overflow-auto">
      {#if visible.length === 0}
        <li class="px-3 py-6 text-center text-xs text-slate-500">該当する課題はありません</li>
      {:else}
        {#each visible as item (item.key)}
          <li>
            <button
              type="button"
              class="flex w-full items-start gap-2 border-b border-slate-800 border-l-4 px-3 py-2 text-left hover:bg-slate-800/70 {todoRowAccentClass(
                item.status,
              )}"
              onclick={() => (todoStore.selectedKey = item.key)}
            >
              <span class="min-w-0 flex-1">
                <span class="block text-[11px] font-semibold text-[#4488c5]">{item.key}</span>
                <span class="block truncate text-sm text-slate-100">{item.title}</span>
              </span>
              <span class="flex shrink-0 flex-col items-end gap-1">
                <span class="rounded px-1.5 py-0.5 text-[10px] {todoStatusBadgeClass(item.status)}">
                  {statusLabel(item.status)}
                </span>
                {#if item.due}
                  <span class="text-[10px] {isTodoOverdue(item) ? 'text-[#ed8077]' : 'text-slate-400'}">
                    {formatTodoDue(item.due)}
                  </span>
                {/if}
              </span>
            </button>
          </li>
        {/each}
      {/if}
    </ul>
  {/if}
</aside>
