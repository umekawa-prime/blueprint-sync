<script lang="ts">
  import { onMount } from "svelte";
  import CameraCapture from "$lib/components/CameraCapture.svelte";
  import ConnectionPanel from "$lib/components/ConnectionPanel.svelte";
  import DockPane from "$lib/components/DockPane.svelte";
  import PageSidebar from "$lib/components/PageSidebar.svelte";
  import PdfViewer from "$lib/components/PdfViewer.svelte";
  import ProjectTabBar from "$lib/components/ProjectTabBar.svelte";
  import ProjectHome from "$lib/components/ProjectHome.svelte";
  import ProjectSidebar from "$lib/components/ProjectSidebar.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import ScheduleView from "$lib/components/ScheduleView.svelte";
  import TodoPanel from "$lib/components/TodoPanel.svelte";
  import Toolbar from "$lib/components/Toolbar.svelte";
  import { chromeStore } from "$lib/stores/chromeStore.svelte";
  import { projectStore } from "$lib/stores/projectStore.svelte";
  import { scheduleStore } from "$lib/stores/scheduleStore.svelte";
  import { todoStore } from "$lib/stores/todoStore.svelte";
  import { viewportStore } from "$lib/stores/viewportStore.svelte";
  import { viewerApi } from "$lib/stores/viewerApi";
  import { imageBlobFromPicked, pickImagesFromDisk } from "$lib/utils/fileAccess";
  import {
    shareCurrentPdf,
    shareCurrentProject,
    bootstrapOpenSession,
  } from "$lib/utils/projectActions";
  import { listenIncomingFiles } from "$lib/utils/incomingShare";
  import { drawingLayerHiddenClass, PROJECT_SIDEBAR_WIDTH, TODO_PANEL_WIDTH } from "$lib/utils/chromeLayout";
  import { toggleTodoPanel } from "$lib/utils/todoActions";

  let connectionOpen = $state(false);
  let cameraOpen = $state(false);
  let drawerOpen = $state(false);
  let sheetOpen = $state(false);

  viewerApi.openCamera = () => {
    cameraOpen = true;
  };

  function requestPhoto() {
    cameraOpen = true;
  }

  async function onPhotoCaptured(file: Blob) {
    cameraOpen = false;
    await viewerApi.addPhoto(file);
  }

  async function pickPhotoFile() {
    const picked = await pickImagesFromDisk();
    if (picked.length === 0) {
      return;
    }
    cameraOpen = false;
    for (const [index, item] of picked.entries()) {
      await viewerApi.addPhoto(imageBlobFromPicked(item), index);
    }
  }

  async function onShareProject() {
    await shareCurrentProject();
  }

  async function onSharePdf() {
    await shareCurrentPdf();
  }

  onMount(() => {
    const unbind = viewportStore.bind();
    let unlisten: (() => void) | undefined;
    void listenIncomingFiles().then((fn) => {
      unlisten = fn;
    });
    void bootstrapOpenSession();
    return () => {
      unbind();
      unlisten?.();
    };
  });
</script>

<div class="flex h-full flex-col bg-slate-950 text-slate-100">
  {#if !viewportStore.isPhone}
    <ProjectTabBar />
  {:else if projectStore.isOpen || projectStore.tabs.length > 0}
    <div class="flex h-10 shrink-0 items-center gap-2 border-b border-slate-700 bg-slate-950 px-2">
      <button
        class="rounded border border-slate-600 px-2 py-1 text-xs"
        onclick={() => (drawerOpen = !drawerOpen)}
      >
        メニュー
      </button>
      <button class="min-w-0 flex-1 truncate text-left text-sm text-cyan-200" onclick={() => (sheetOpen = !sheetOpen)}>
        {projectStore.meta?.name || "プロジェクト"}
      </button>
    </div>
  {/if}

  {#if !projectStore.bootstrapped}
    <div class="min-h-0 flex-1"></div>
  {:else if !projectStore.isOpen}
    <div class="min-h-0 flex-1">
      <ProjectHome />
    </div>
  {:else}
    <div class="relative flex min-h-0 flex-1 {drawingLayerHiddenClass(cameraOpen)}">
      {#if viewportStore.isPhone}
        {#if drawerOpen}
          <div class="absolute inset-0 z-30 flex">
            <button class="flex-1 bg-slate-950/70" onclick={() => (drawerOpen = false)} aria-label="閉じる"></button>
            <div class="h-full w-72 max-w-[85vw] shadow-2xl">
              <ProjectSidebar />
            </div>
          </div>
        {/if}
      {:else}
        <DockPane
          side="left"
          open={chromeStore.projectOpen}
          width={chromeStore.projectWidth}
          minWidth={PROJECT_SIDEBAR_WIDTH.min}
          maxWidth={PROJECT_SIDEBAR_WIDTH.max}
          expandLabel="プロジェクト一覧"
          onWidth={(next) => chromeStore.setProjectWidth(next)}
          onOpenChange={(next) => chromeStore.setProjectOpen(next)}
        >
          <ProjectSidebar />
        </DockPane>
      {/if}
      {#if scheduleStore.open}
        <ScheduleView />
      {:else}
        <div class="flex min-w-0 flex-1 flex-col">
          {#if !viewportStore.isPhone}
            <Toolbar
              onToggleConnection={() => (connectionOpen = !connectionOpen)}
              onRequestPhoto={requestPhoto}
              onShareProject={onShareProject}
              onSharePdf={onSharePdf}
            />
          {/if}

          <div class="relative flex min-h-0 flex-1 {viewportStore.isPhone ? 'flex-col' : ''}">
            <PageSidebar />
            <div
              class="relative flex min-h-0 min-w-0 flex-1 flex-col {viewportStore.isPhone
                ? 'order-1'
                : ''}"
            >
              <PdfViewer />
              <ConnectionPanel bind:open={connectionOpen} />
            </div>
            {#if viewportStore.isPhone}
              {#if todoStore.panelOpen}
                <TodoPanel />
              {/if}
            {:else}
              <DockPane
                side="right"
                open={todoStore.panelOpen}
                width={chromeStore.todoWidth}
                minWidth={TODO_PANEL_WIDTH.min}
                maxWidth={TODO_PANEL_WIDTH.max}
                expandLabel="課題"
                onWidth={(next) => chromeStore.setTodoWidth(next)}
                onOpenChange={(next) => toggleTodoPanel(next)}
              >
                <TodoPanel />
              </DockPane>
            {/if}
          </div>

          <StatusBar />
          {#if viewportStore.isPhone}
            <Toolbar
              compact
              onToggleConnection={() => (connectionOpen = !connectionOpen)}
              onRequestPhoto={requestPhoto}
              onShareProject={onShareProject}
              onSharePdf={onSharePdf}
            />
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  {#if cameraOpen}
    <CameraCapture
      onCaptured={onPhotoCaptured}
      onCancel={() => (cameraOpen = false)}
      onPickFile={pickPhotoFile}
    />
  {/if}

  {#if sheetOpen && viewportStore.isPhone}
    <ProjectTabBar />
  {/if}
</div>
