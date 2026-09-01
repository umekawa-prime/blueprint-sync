<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import {
    capturePhotoFromVideo,
    startCameraStream,
    stopMediaStream,
  } from "$lib/utils/cameraCapture";

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

  async function start() {
    error = "";
    ready = false;
    try {
      stream = await startCameraStream();
      if (!videoEl) {
        stopMediaStream(stream);
        stream = null;
        return;
      }
      videoEl.srcObject = stream;
      await videoEl.play();
    } catch (err) {
      error = err instanceof Error ? err.message : "カメラを起動できませんでした";
    }
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
    void start();
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
