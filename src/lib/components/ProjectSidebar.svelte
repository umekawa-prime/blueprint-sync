<script lang="ts">
  import { pdfStore } from "$lib/stores/pdfStore.svelte";
  import { projectStore } from "$lib/stores/projectStore.svelte";
  import {
    addProjectLink,
    convertCadFileToDrawingPdf,
    importPdfIntoProject,
    importOneDriveLinkIntoProject,
    openProjectLink,
    openProjectPdf,
    removeProjectLink,
    removeProjectPdf,
    renameProjectFile,
    updateProjectLink,
  } from "$lib/utils/projectActions";
  import { openCurrentProjectInCursor } from "$lib/utils/cursorOpen";
  import { revealProjectFileInExplorer } from "$lib/utils/revealInExplorer";
  import { isTauriRuntime } from "$lib/utils/platform";
  import { openTodoPanel } from "$lib/utils/todoActions";
  import { todoStore } from "$lib/stores/todoStore.svelte";
  import {
    displayLinkTitle,
    folderDisplayName,
    isProjectCadRelPath,
    listPdfsOfKind,
    listSidebarCadFiles,
    projectPdfDisplayName,
    projectRenameStem,
    type ProjectLink,
    type ProjectPdfKind,
  } from "$lib/utils/projectFormat";
  import FileSearchDialog from "$lib/components/FileSearchDialog.svelte";
  import JwCadHelpPanel from "$lib/components/JwCadHelpPanel.svelte";

  let url = $state("");
  let title = $state("");
  let editingLinkId = $state("");
  let editUrl = $state("");
  let editTitle = $state("");
  let editUrlInputEl = $state<HTMLInputElement | null>(null);
  let importingLinkId = $state("");
  let contextMenu = $state<{ file: string; x: number; y: number } | null>(null);
  let renamingFile = $state("");
  let renameValue = $state("");
  let renameInputEl = $state<HTMLInputElement | null>(null);
  let helpOpen = $state(false);
  let searchOpen = $state(false);
  let openTimer = 0;

  $effect(() => {
    if (!renamingFile || !renameInputEl) {
      return;
    }
    renameInputEl.focus();
    renameInputEl.select();
  });

  $effect(() => {
    if (!editingLinkId || !editUrlInputEl) {
      return;
    }
    editUrlInputEl.focus();
    editUrlInputEl.select();
  });

  $effect(() => {
    if (!contextMenu) {
      return;
    }
    const close = () => {
      contextMenu = null;
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  });

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

  async function onImportLink(linkUrl: string, kind: ProjectPdfKind, linkId: string, linkTitle: string) {
    importingLinkId = `${linkId}:${kind}`;
    try {
      await importOneDriveLinkIntoProject(linkUrl, kind, linkTitle);
    } catch (error) {
      projectStore.error = message(error, "OneDriveからの取り込みに失敗しました");
    } finally {
      importingLinkId = "";
    }
  }

  async function onOpenLink(linkUrl: string) {
    try {
      await openProjectLink(linkUrl);
    } catch (error) {
      projectStore.error = message(error, "リンクを開けませんでした");
    }
  }

  function startEditLink(link: ProjectLink) {
    editingLinkId = link.id;
    editUrl = link.url;
    editTitle = link.title;
  }

  function cancelEditLink() {
    editingLinkId = "";
    editUrl = "";
    editTitle = "";
  }

  function onEditLinkKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditLink();
    }
  }

  async function commitEditLink() {
    const id = editingLinkId;
    if (!id) {
      return;
    }
    try {
      await updateProjectLink(id, editUrl, editTitle);
      if (!projectStore.error) {
        cancelEditLink();
      }
    } catch (error) {
      projectStore.error = message(error, "リンクの保存に失敗しました");
    }
  }

  async function onRemoveLink(id: string) {
    try {
      await removeProjectLink(id);
    } catch (error) {
      projectStore.error = message(error, "リンクの削除に失敗しました");
    }
  }

  async function onRemovePdf(file: string) {
    const name = projectPdfDisplayName(file);
    if (!window.confirm(`${name} を削除しますか？`)) {
      return;
    }
    try {
      await removeProjectPdf(file);
    } catch (error) {
      pdfStore.status = message(error, "PDF の削除に失敗しました");
    }
  }

  function onFileContextMenu(event: MouseEvent, file: string) {
    event.preventDefault();
    event.stopPropagation();
    contextMenu = { file, x: event.clientX, y: event.clientY };
  }

  async function onConvertCad(file: string) {
    contextMenu = null;
    try {
      await convertCadFileToDrawingPdf(file);
    } catch (error) {
      pdfStore.status = message(error, "PDF の変換に失敗しました");
    }
  }

  function startRename(file: string) {
    contextMenu = null;
    renamingFile = file;
    renameValue = projectRenameStem(file);
  }

  function onNameClick(file: string) {
    window.clearTimeout(openTimer);
    openTimer = window.setTimeout(() => {
      openTimer = 0;
      void onOpenPdf(file);
    }, 250);
  }

  function onNameDoubleClick(event: MouseEvent, file: string) {
    event.preventDefault();
    event.stopPropagation();
    window.clearTimeout(openTimer);
    openTimer = 0;
    startRename(file);
  }

  const nativeShell = isTauriRuntime();

  async function onRevealInExplorer(file: string) {
    contextMenu = null;
    try {
      await revealProjectFileInExplorer(projectStore.folder, file);
    } catch (error) {
      pdfStore.status = message(error, "エクスプローラーで表示できませんでした");
    }
  }

  function cancelRename() {
    renamingFile = "";
    renameValue = "";
  }

  async function commitRename() {
    const file = renamingFile;
    const nextName = renameValue;
    if (!file) {
      return;
    }
    renamingFile = "";
    try {
      await renameProjectFile(file, nextName);
    } catch (error) {
      pdfStore.status = message(error, "名前の変更に失敗しました");
    }
  }

  async function onOpenInCursor() {
    try {
      await openCurrentProjectInCursor();
    } catch (error) {
      pdfStore.status = message(error, "Cursor を起動できませんでした");
    }
  }
</script>

{#snippet pdfRow(file: string)}
  <li
    class="flex items-center gap-0.5 rounded {projectStore.currentPdf === file
      ? 'bg-cyan-900 text-cyan-100'
      : 'hover:bg-slate-800'}"
    oncontextmenu={(event) => onFileContextMenu(event, file)}
  >
    {#if renamingFile === file}
      <form
        class="min-w-0 flex-1 px-1 py-0.5"
        onsubmit={(event) => {
          event.preventDefault();
          void commitRename();
        }}
      >
        <input
          bind:this={renameInputEl}
          bind:value={renameValue}
          class="w-full rounded border border-cyan-700 bg-slate-950 px-1 py-0.5 text-sm text-slate-100"
          aria-label="ファイル名"
          onblur={() => void commitRename()}
          onkeydown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancelRename();
            }
          }}
        />
      </form>
    {:else}
      <button
        type="button"
        class="min-w-0 flex-1 truncate px-2 py-1 text-left text-sm"
        title={projectPdfDisplayName(file)}
        onclick={() => onNameClick(file)}
        ondblclick={(event) => onNameDoubleClick(event, file)}
        oncontextmenu={(event) => onFileContextMenu(event, file)}
      >
        {projectPdfDisplayName(file)}
      </button>
    {/if}
    <button
      type="button"
      class="mr-1 shrink-0 rounded p-1 text-slate-500 hover:bg-slate-700 hover:text-rose-300"
      title="削除"
      aria-label={`${projectPdfDisplayName(file)} を削除`}
      onclick={() => void onRemovePdf(file)}
    >
      <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 7h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        <path
          d="M10 7V5h4v2"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M8 7l.8 12h6.4L16 7"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </li>
{/snippet}

<aside class="flex h-full min-h-0 w-full flex-col border-r border-slate-700 bg-slate-900">
  <div class="border-b border-slate-800 py-3 pr-5 pl-3">
    <div class="text-sm font-semibold text-cyan-300">{folderDisplayName(projectStore.folder)}</div>
    <div class="truncate text-[11px] text-slate-500" title={projectStore.folder}>{projectStore.folder}</div>
  </div>

  <section class="min-h-0 flex-1 overflow-auto px-3 py-3">
    <button
      type="button"
      class="mb-3 w-full rounded bg-slate-800 px-2 py-1 text-xs"
      onclick={() => (searchOpen = true)}
    >
      ファイルを検索
    </button>
    {#if projectStore.error}
      <p class="mb-3 text-xs text-rose-300">{projectStore.error}</p>
    {/if}
    <h2 class="mb-2 text-xs text-slate-500">図面 PDF</h2>
    <button
      class="mb-2 w-full rounded bg-slate-800 px-2 py-1 text-xs"
      onclick={() => onAddPdf("drawing")}
    >
      図面を追加
    </button>
    {#if listPdfsOfKind(projectStore.pdfs, "drawing").length === 0}
      <p class="text-xs text-slate-500">フォルダまたは「図面を追加」から PDF / ZIP を入れてください</p>
    {:else}
      <ul class="space-y-1">
        {#each listPdfsOfKind(projectStore.pdfs, "drawing") as file (file)}
          {@render pdfRow(file)}
        {/each}
      </ul>
    {/if}

    <h2 class="mb-2 mt-5 text-xs text-slate-500">図面 JWW / DXF</h2>
    <button
      class="mb-2 w-full rounded bg-slate-800 px-2 py-1 text-xs"
      onclick={() => onAddPdf("cad")}
    >
      JWW / DXFを追加
    </button>
    {#if listSidebarCadFiles(projectStore.pdfs).length === 0}
      <p class="text-xs text-slate-500">「JWW / DXFを追加」またはドロップで JWW / JWC / DXF を入れてください</p>
    {:else}
      <ul class="space-y-1">
        {#each listSidebarCadFiles(projectStore.pdfs) as file (file)}
          {@render pdfRow(file)}
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
      <p class="text-xs text-slate-500">「工程表を追加」から PDF / ZIP を入れてください</p>
    {:else}
      <ul class="space-y-1">
        {#each listPdfsOfKind(projectStore.pdfs, "schedule") as file (file)}
          {@render pdfRow(file)}
        {/each}
      </ul>
    {/if}

    <h2 class="mb-2 mt-5 text-xs text-slate-500">OneDrive リンク</h2>
    <p class="mb-2 text-[11px] leading-4 text-slate-500">
      公開リンクを追加し、「図面へ」「工程表へ」でプロジェクトにダウンロードします
    </p>
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
    <ul class="space-y-2">
      {#each projectStore.meta?.links ?? [] as link (link.id)}
        <li class="rounded border border-slate-800 px-2 py-1.5">
          {#if editingLinkId === link.id}
            <form
              onsubmit={(event) => {
                event.preventDefault();
                void commitEditLink();
              }}
            >
              <input
                bind:this={editUrlInputEl}
                bind:value={editUrl}
                class="mb-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs"
                placeholder="https://1drv.ms/..."
                aria-label="リンクURL"
                onkeydown={onEditLinkKeydown}
              />
              <input
                bind:value={editTitle}
                class="mb-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs"
                placeholder="表示名（任意）"
                aria-label="表示名"
                onkeydown={onEditLinkKeydown}
              />
              <div class="flex items-center gap-1">
                <button
                  type="submit"
                  class="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-200"
                >
                  保存
                </button>
                <button type="button" class="text-[11px] text-slate-500" onclick={cancelEditLink}>
                  キャンセル
                </button>
              </div>
            </form>
          {:else}
            <button
              class="w-full truncate text-left text-xs text-cyan-300 underline"
              title={link.url}
              onclick={() => onOpenLink(link.url)}
            >
              {displayLinkTitle(link)}
            </button>
            <div class="mt-1 flex items-center gap-1">
              <button
                class="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-200"
                onclick={() => startEditLink(link)}
              >
                編集
              </button>
              <button
                class="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-200 disabled:opacity-40"
                disabled={importingLinkId !== ""}
                onclick={() => onImportLink(link.url, "drawing", link.id, link.title)}
              >
                {importingLinkId === `${link.id}:drawing` ? "取得中..." : "図面へ"}
              </button>
              <button
                class="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-200 disabled:opacity-40"
                disabled={importingLinkId !== ""}
                onclick={() => onImportLink(link.url, "schedule", link.id, link.title)}
              >
                {importingLinkId === `${link.id}:schedule` ? "取得中..." : "工程表へ"}
              </button>
              <button class="ml-auto text-[11px] text-slate-500" onclick={() => onRemoveLink(link.id)}>
                削除
              </button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  </section>

  <button
    type="button"
    class="border-t border-slate-800 px-3 py-2 text-xs text-cyan-300"
    onclick={() => openTodoPanel("todo")}
  >
    課題{todoStore.activeCount > 0 ? `（${todoStore.activeCount}）` : ""}
  </button>
  <button
    type="button"
    class="border-t border-slate-800 px-3 py-2 text-xs text-cyan-300"
    onclick={() => openTodoPanel("note")}
  >
    メモ
  </button>
  <button
    type="button"
    class="border-t border-slate-800 px-3 py-2 text-xs text-cyan-300"
    onclick={() => void onOpenInCursor()}
  >
    Cursorで開く
  </button>
  <button
    type="button"
    class="border-t border-slate-800 px-3 py-2 text-xs text-cyan-300"
    onclick={() => {
      helpOpen = true;
    }}
  >
    操作方法
  </button>
</aside>

{#if contextMenu}
  {@const menuFile = contextMenu.file}
  <div
    class="fixed z-50 min-w-[8rem] rounded border border-slate-700 bg-slate-800 py-1 text-xs shadow-lg"
    style="left: {contextMenu.x}px; top: {contextMenu.y}px"
    role="menu"
  >
    {#if nativeShell}
      <button
        type="button"
        class="block w-full px-3 py-1.5 text-left text-slate-100 hover:bg-slate-700"
        role="menuitem"
        onclick={(event) => {
          event.stopPropagation();
          void onRevealInExplorer(menuFile);
        }}
      >
        エクスプローラーで表示
      </button>
    {/if}
    {#if isProjectCadRelPath(menuFile)}
      <button
        type="button"
        class="block w-full px-3 py-1.5 text-left text-slate-100 hover:bg-slate-700"
        role="menuitem"
        onclick={(event) => {
          event.stopPropagation();
          void onConvertCad(menuFile);
        }}
      >
        PDFに変換
      </button>
    {/if}
  </div>
{/if}

{#if searchOpen}
  <FileSearchDialog onClose={() => (searchOpen = false)} />
{/if}

{#if helpOpen}
  <JwCadHelpPanel onClose={() => (helpOpen = false)} />
{/if}
