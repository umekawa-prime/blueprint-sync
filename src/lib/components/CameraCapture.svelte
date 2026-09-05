<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import {
    capturePhotoFromVideo,
    currentVideoDeviceId,
    defaultEnumerateDevices,
    defaultGetUserMedia,
    listVideoCameras,
    pickPreferredCamera,
    startCameraStream,
    stopMediaStream,
    type CameraDevice,
  } from "$lib/utils/cameraCapture";
  import { prefersCameraCapture } from "$lib/utils/platform";

  const STORAGE_KEY = "blueprint-sync.cameraDeviceId";

  let {
    onCaptured,
    onCancel,
    onPickFile,
  }: {
    onCaptured: (file: Blob) => Promise<void> | void;
    onCancel: () => void;
    onPickFile: () => void;
  } = $props();

  let videoEl: HTMLVideoElement | undefined = $state();
  let stream: MediaStream | null = null;
  let error = $state("");
  let ready = $state(false);
  let capturing = $state(false);
  let cameras = $state<CameraDevice[]>([]);
  let selectedId = $state("");

  async function attachStream(next: MediaStream) {
    stopMediaStream(stream);
    stream = next;
    if (!videoEl) {
      stopMediaStream(stream);
      stream = null;
      return;
    }
    videoEl.srcObject = stream;
    await videoEl.play();
  }

  async function refreshCameras() {
    cameras = await listVideoCameras(defaultEnumerateDevices);
    selectedId = currentVideoDeviceId(stream) ?? cameras[0]?.deviceId ?? "";
  }

  async function start(deviceId?: string, autoPrefer = false) {
    error = "";
    ready = false;
    try {
      const next = await startCameraStream(defaultGetUserMedia, deviceId, prefersCameraCapture());
      await attachStream(next);
      await refreshCameras();
      if (autoPrefer) {
        const preferred = pickPreferredCamera(cameras, deviceId);
        const current = currentVideoDeviceId(stream);
        if (preferred && preferred !== current) {
          await start(preferred, false);
          return;
        }
      }
      if (selectedId) {
        localStorage.setItem(STORAGE_KEY, selectedId);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "カメラを起動できませんでした";
    }
  }

  async function onCameraChange() {
    if (!selectedId) {
      return;
    }
    localStorage.setItem(STORAGE_KEY, selectedId);
    await start(selectedId, false);
  }

  function markReady() {
    ready = (videoEl?.videoWidth ?? 0) > 0;
  }

  async function capture() {
    if (!videoEl || capturing) {
      return;
    }
    capturing = true;
    try {
      const blob = await capturePhotoFromVideo(videoEl);
      stopMediaStream(stream);
      stream = null;
      await onCaptured(blob);
    } catch (err) {
      error = err instanceof Error ? err.message : "撮影に失敗しました";
      capturing = false;
    }
  }

  function close() {
    stopMediaStream(stream);
    stream = null;
    onCancel();
  }

  onMount(() => {
    const stored = localStorage.getItem(STORAGE_KEY) ?? undefined;
    void start(stored, !stored && !prefersCameraCapture());
  });

  onDestroy(() => {
    stopMediaStream(stream);
    stream = null;
  });
</script>

<div class="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4">
  <section class="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-base font-semibold">カメラ撮影</h2>
      <button class="text-slate-400" onclick={close}>閉じる</button>
    </div>

    <label class="mb-3 flex items-center gap-2 text-sm text-slate-300">
      カメラ
      <select
        class="min-w-0 flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1"
        bind:value={selectedId}
        onchange={() => void onCameraChange()}
        disabled={cameras.length === 0}
      >
        {#each cameras as camera (camera.deviceId)}
          <option value={camera.deviceId}>{camera.label}</option>
        {/each}
      </select>
    </label>

    <video
      bind:this={videoEl}
      class="max-h-[60vh] w-full rounded-lg bg-black object-contain"
      autoplay
      playsinline
      muted
      onloadeddata={markReady}
      onplaying={markReady}
    ></video>

    {#if error}
      <p class="mt-3 text-sm text-rose-300">{error}</p>
    {/if}

    <div class="mt-4 flex flex-wrap gap-2">
      <button
        class="rounded bg-cyan-700 px-4 py-2 text-sm disabled:opacity-40"
        onclick={capture}
        disabled={!ready || capturing}
      >
        撮影
      </button>
      <button class="rounded bg-slate-700 px-4 py-2 text-sm" onclick={onPickFile}>
        ファイルから選ぶ
      </button>
      <button class="rounded bg-slate-800 px-4 py-2 text-sm" onclick={close}>
        キャンセル
      </button>
    </div>
  </section>
</div>
