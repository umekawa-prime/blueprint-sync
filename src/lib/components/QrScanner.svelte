<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { Html5Qrcode } from "html5-qrcode";

  let {
    onDetected,
    onCancel,
  }: {
    onDetected: (value: string) => void;
    onCancel: () => void;
  } = $props();

  let scanner: Html5Qrcode | undefined;
  let error = $state("");

  onMount(async () => {
    scanner = new Html5Qrcode("qr-reader");
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          onDetected(text);
        },
        () => undefined,
      );
    } catch (err) {
      error = err instanceof Error ? err.message : "カメラを起動できませんでした";
    }
  });

  onDestroy(() => {
    void scanner?.stop().catch(() => undefined);
    scanner?.clear();
  });
</script>

<div class="space-y-3">
  <div id="qr-reader" class="overflow-hidden rounded-lg bg-black"></div>
  {#if error}
    <p class="text-sm text-rose-300">{error}</p>
  {/if}
  <button
    class="w-full rounded bg-slate-700 px-3 py-2 text-sm"
    onclick={onCancel}
  >
    キャンセル
  </button>
</div>
