<script lang="ts">
  import ConnectionPanel from "$lib/components/ConnectionPanel.svelte";
  import PdfViewer from "$lib/components/PdfViewer.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import Toolbar from "$lib/components/Toolbar.svelte";
  import { viewerApi } from "$lib/stores/viewerApi";

  let connectionOpen = $state(false);
  let cameraInput: HTMLInputElement | undefined = $state();

  function requestPhoto() {
    cameraInput?.click();
  }

  async function onPhotoSelected(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      await viewerApi.addPhoto(file);
    }
    input.value = "";
  }
</script>

<div class="flex h-full flex-col bg-slate-950 text-slate-100">
  <Toolbar
    onToggleConnection={() => (connectionOpen = !connectionOpen)}
    onRequestPhoto={requestPhoto}
  />

  <div class="relative flex min-h-0 flex-1 flex-col">
    <PdfViewer />
    <ConnectionPanel bind:open={connectionOpen} />
  </div>

  <StatusBar />
</div>

<input
  bind:this={cameraInput}
  class="hidden"
  type="file"
  accept="image/*"
  capture="environment"
  onchange={onPhotoSelected}
/>
