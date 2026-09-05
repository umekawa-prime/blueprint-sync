<script lang="ts">
  import CameraCapture from "$lib/components/CameraCapture.svelte";
  import ConnectionPanel from "$lib/components/ConnectionPanel.svelte";
  import PdfViewer from "$lib/components/PdfViewer.svelte";
  import ProjectTabBar from "$lib/components/ProjectTabBar.svelte";
  import ProjectHome from "$lib/components/ProjectHome.svelte";
  import ProjectSidebar from "$lib/components/ProjectSidebar.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import Toolbar from "$lib/components/Toolbar.svelte";
  import { projectStore } from "$lib/stores/projectStore.svelte";
  import { viewerApi } from "$lib/stores/viewerApi";
  import { imageBlobFromPicked, pickImageFromDisk } from "$lib/utils/fileAccess";

  let connectionOpen = $state(false);
  let cameraOpen = $state(false);

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
</script>

<div class="flex h-full flex-col bg-slate-950 text-slate-100">
  <ProjectTabBar />

  {#if !projectStore.isOpen}
    <div class="min-h-0 flex-1">
      <ProjectHome />
    </div>
  {:else}
    <div class="flex min-h-0 flex-1">
      <ProjectSidebar />
      <div class="flex min-w-0 flex-1 flex-col">
        <Toolbar
          onToggleConnection={() => (connectionOpen = !connectionOpen)}
          onRequestPhoto={requestPhoto}
        />

        <div class="relative flex min-h-0 flex-1 flex-col">
          <PdfViewer />
          <ConnectionPanel bind:open={connectionOpen} />
          {#if cameraOpen}
            <CameraCapture
              onCaptured={onPhotoCaptured}
              onCancel={() => (cameraOpen = false)}
              onPickFile={pickPhotoFile}
            />
          {/if}
        </div>

        <StatusBar />
      </div>
    </div>
  {/if}
</div>
