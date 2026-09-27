<script lang="ts">
  import { CAMERA_OVERLAY_CLASS } from "$lib/utils/chromeLayout";

  let {
    message,
    failed,
    onCancel,
    onPickFile,
  }: {
    message: string;
    failed: boolean;
    onCancel: () => void;
    onPickFile: () => void;
  } = $props();
</script>

<div class={CAMERA_OVERLAY_CLASS}>
  <section class="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
    <h2 class="text-base font-semibold">カメラで撮影</h2>
    <p class="mt-3 text-sm leading-6 text-slate-300">{message}</p>
    <div class="mt-4 flex flex-wrap gap-2">
      {#if failed}
        <button class="rounded bg-slate-700 px-4 py-2 text-sm" onclick={onPickFile} type="button">
          ファイルから選ぶ
        </button>
      {/if}
      <button class="rounded bg-slate-800 px-4 py-2 text-sm" onclick={onCancel} type="button">
        {failed ? "閉じる" : "キャンセル"}
      </button>
    </div>
  </section>
</div>
