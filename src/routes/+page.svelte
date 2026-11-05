<script lang="ts">
  import { onMount } from "svelte";
  import CameraCapture from "$lib/components/CameraCapture.svelte";
  import PhotoMarkup from "$lib/components/PhotoMarkup.svelte";
  import DockPane from "$lib/components/DockPane.svelte";
  import PageSidebar from "$lib/components/PageSidebar.svelte";
  import PdfViewer from "$lib/components/PdfViewer.svelte";
  import ProjectTabBar from "$lib/components/ProjectTabBar.svelte";
  import ProjectHome from "$lib/components/ProjectHome.svelte";
  import ProjectSidebar from "$lib/components/ProjectSidebar.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import ScheduleView from "$lib/components/ScheduleView.svelte";
  import TodoPanel from "$lib/components/TodoPanel.svelte";
  import FileSearchDialog from "$lib/components/FileSearchDialog.svelte";
  import SystemCameraPrompt from "$lib/components/SystemCameraPrompt.svelte";
  import Toolbar from "$lib/components/Toolbar.svelte";
  import { chromeStore } from "$lib/stores/chromeStore.svelte";
  import { photoCaptureStore } from "$lib/stores/photoCaptureStore.svelte";
  import { toolStore } from "$lib/stores/toolStore.svelte";
  import { projectStore } from "$lib/stores/projectStore.svelte";
  import { scheduleStore } from "$lib/stores/scheduleStore.svelte";
  import { todoStore } from "$lib/stores/todoStore.svelte";
  import { viewportStore } from "$lib/stores/viewportStore.svelte";
  import { viewerApi } from "$lib/stores/viewerApi";
  import {
    captureImageWithDeviceCamera,
    imageBlobFromPicked,
    pickImagesFromDisk,
  } from "$lib/utils/fileAccess";
  import {
    shareCurrentPdf,
    shareCurrentProject,
    bootstrapOpenSession,
  } from "$lib/utils/projectActions";
  import { listenIncomingFiles } from "$lib/utils/incomingShare";
  import { drawingLayerHiddenClass, PROJECT_SIDEBAR_WIDTH, TODO_PANEL_WIDTH } from "$lib/utils/chromeLayout";
  import { toggleTodoPanel } from "$lib/utils/todoActions";
  import { registerWebServiceWorker } from "$lib/utils/pwa";
  import { startWebAutoSave } from "$lib/utils/webAutoSave.svelte";
  import { installPageZoomGuard } from "$lib/utils/pageZoomGuard";
  import { prefersCameraCapture, usesSystemCamera } from "$lib/utils/platform";
  import {
    focusAppWindow,
    launchWindowsCamera,
    listNewCameraPhotos,
    watchSystemCameraShots,
  } from "$lib/utils/systemCamera";

  let fileSearchOpen = $state(false);
  let cameraOpen = $state(false);
  let systemCamera = $state<{ message: string; failed: boolean } | null>(null);
  let systemCameraToken = 0;
  let drawerOpen = $state(false);
  let sheetOpen = $state(false);

  function cancelSystemCamera() {
    systemCameraToken += 1;
    systemCamera = null;
  }

  async function captureWithDeviceCamera() {
    // Opens the phone's own camera app; no in-app preview in between.
    const shot = await captureImageWithDeviceCamera();
    if (shot) {
      await viewerApi.acceptCapturedPhoto(imageBlobFromPicked(shot));
    }
  }

  async function requestCapture() {
    if (prefersCameraCapture()) {
      await captureWithDeviceCamera();
      return;
    }
    if (!usesSystemCamera()) {
      // Desktop browser preview only: there is no OS camera app to launch.
      cameraOpen = true;
      return;
    }
    const token = ++systemCameraToken;
    // Launch the Windows camera straight away; only a small non-blocking
    // banner remains here so the wait can be cancelled.
    systemCamera = { message: "Windows のカメラで撮影中", failed: false };
    const result = await watchSystemCameraShots({
      launch: launchWindowsCamera,
      listSince: listNewCameraPhotos,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      shouldStop: () => systemCameraToken !== token,
    });
    if (systemCameraToken !== token) {
      return;
    }
    if (result.status === "captured") {
      systemCamera = null;
      await focusAppWindow().catch(() => {});
      const shot = result.shots[0];
      if (!shot) {
        return;
      }
      try {
        await viewerApi.acceptCapturedPhoto(imageBlobFromPicked(shot));
      } catch (error) {
        systemCamera = {
          message: error instanceof Error ? error.message : "写真を追加できませんでした",
          failed: true,
        };
      }
      return;
    }
    if (result.status === "cancelled" || result.status === "timeout") {
      systemCamera = null;
      return;
    }
    systemCamera = { message: result.message, failed: true };
  }

  viewerApi.openCamera = () => {
    void requestCapture();
  };

  function requestPhoto() {
    void requestCapture();
  }

  async function onPhotoCaptured(file: Blob) {
    cameraOpen = false;
    await viewerApi.acceptCapturedPhoto(file);
  }

  function onMarkupDone(file: Blob) {
    photoCaptureStore.beginPlacement(file);
    toolStore.setTool("select");
  }

  async function pickPhotoFile() {
    cancelSystemCamera();
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
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && photoCaptureStore.phase !== "idle") {
        photoCaptureStore.clear();
      }
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "p" || event.altKey) {
        return;
      }
      if (!projectStore.isOpen) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      fileSearchOpen = true;
    };
    window.addEventListener("keydown", onKey);
    const removeZoomGuard = installPageZoomGuard();
    const unbind = viewportStore.bind();
    let unlisten: (() => void) | undefined;
    void listenIncomingFiles().then((fn) => {
      unlisten = fn;
    });
    // Start autosave first so the gate's resume() after bootstrap reschedules pending saves.
    const stopAutoSave = startWebAutoSave();
    void bootstrapOpenSession();
    void registerWebServiceWorker();
    return () => {
      window.removeEventListener("keydown", onKey);
      removeZoomGuard();
      unbind();
      stopAutoSave();
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
              onRequestPhoto={requestPhoto}
              onShareProject={onShareProject}
              onSharePdf={onSharePdf}
            />
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  {#if fileSearchOpen && projectStore.isOpen}
    <FileSearchDialog onClose={() => (fileSearchOpen = false)} />
  {/if}

  {#if cameraOpen}
    <CameraCapture
      onCaptured={onPhotoCaptured}
      onCancel={() => (cameraOpen = false)}
      onPickFile={pickPhotoFile}
    />
  {/if}

  {#if photoCaptureStore.phase === "markup" && photoCaptureStore.image}
    <PhotoMarkup image={photoCaptureStore.image} onDone={onMarkupDone} onCancel={() => photoCaptureStore.clear()} />
  {/if}

  {#if photoCaptureStore.phase === "place"}
    <div class="pointer-events-none fixed inset-x-0 bottom-12 z-[70] flex justify-center px-4">
      <div class="pointer-events-auto flex items-center gap-3 rounded-lg border border-cyan-700 bg-slate-900 px-4 py-2 text-sm">
        <span>図面上をクリックして写真のピンを置いてください</span>
        <button type="button" class="text-slate-300" onclick={() => photoCaptureStore.clear()}>キャンセル</button>
      </div>
    </div>
  {/if}

  {#if systemCamera && !systemCamera.failed}
    <div class="pointer-events-none fixed inset-x-0 bottom-12 z-[70] flex justify-center px-4">
      <div class="pointer-events-auto flex items-center gap-3 rounded-lg border border-cyan-700 bg-slate-900 px-4 py-2 text-sm">
        <span>{systemCamera.message}</span>
        <button type="button" class="text-slate-300" onclick={cancelSystemCamera}>キャンセル</button>
      </div>
    </div>
  {/if}

  {#if systemCamera?.failed}
    <SystemCameraPrompt
      message={systemCamera.message}
      failed={systemCamera.failed}
      onCancel={cancelSystemCamera}
      onPickFile={pickPhotoFile}
    />
  {/if}

  {#if sheetOpen && viewportStore.isPhone}
    <ProjectTabBar />
  {/if}
</div>
