<script lang="ts">
  import { onMount } from "svelte";
  import CameraCapture from "$lib/components/CameraCapture.svelte";
  import ConnectionPanel from "$lib/components/ConnectionPanel.svelte";
  import PdfViewer from "$lib/components/PdfViewer.svelte";
  import ProjectTabBar from "$lib/components/ProjectTabBar.svelte";
  import ProjectHome from "$lib/components/ProjectHome.svelte";
  import ProjectSidebar from "$lib/components/ProjectSidebar.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import Toolbar from "$lib/components/Toolbar.svelte";
  import { projectStore } from "$lib/stores/projectStore.svelte";
  import { viewportStore } from "$lib/stores/viewportStore.svelte";
  import { viewerApi } from "$lib/stores/viewerApi";
  import { imageBlobFromPicked, pickImageFromDisk } from "$lib/utils/fileAccess";
  import {
    shareCurrentPdf,
    shareCurrentProject,
  } from "$lib/utils/projectActions";
  import { listenIncomingFiles } from "$lib/utils/incomingShare";
  import { drawingLayerHiddenClass } from "$lib/utils/chromeLayout";

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
    const picked = await pickImageFromDisk();
    if (picked) {
      cameraOpen = false;
      await viewerApi.addPhoto(imageBlobFromPicked(picked));
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
    return () => {
      unbind();
      unlisten?.();
    };
  });
</script>

<div class="flex h-full flex-col bg-slate-950 text-slate-100">
  {#if !viewportStore.isPhone}
    <ProjectTabBar />
  {:else if projectStore.isOpen}
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

  {#if !projectStore.isOpen}
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
        <ProjectSidebar />
      {/if}
      <div class="flex min-w-0 flex-1 flex-col">
        {#if !viewportStore.isPhone}
          <Toolbar
            onToggleConnection={() => (connectionOpen = !connectionOpen)}
            onRequestPhoto={requestPhoto}
            onShareProject={onShareProject}
            onSharePdf={onSharePdf}
          />
        {/if}

        <div class="relative flex min-h-0 flex-1 flex-col">
          <PdfViewer />
          <ConnectionPanel bind:open={connectionOpen} />
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
