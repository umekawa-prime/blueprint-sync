<script lang="ts">
  import {
    closeAppWindow,
    minimizeAppWindow,
    toggleMaximizeAppWindow,
  } from "$lib/utils/windowActions";
</script>

<div class="flex h-full shrink-0">
  <button
    type="button"
    class="flex h-full w-11 items-center justify-center text-slate-300 hover:bg-slate-700"
    aria-label="最小化"
    onclick={() => void minimizeAppWindow()}
  >
    <svg class="h-3 w-3" viewBox="0 0 12 12" aria-hidden="true">
      <path fill="currentColor" d="M2 5.5h8v1H2z"></path>
    </svg>
  </button>
  <button
    type="button"
    class="flex h-full w-11 items-center justify-center text-slate-300 hover:bg-slate-700"
    aria-label="最大化"
    onclick={() => void toggleMaximizeAppWindow()}
  >
    <svg class="h-3 w-3" viewBox="0 0 12 12" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        stroke-width="1.1"
        d="M2.5 2.5h7v7h-7z"
      ></path>
    </svg>
  </button>
  <button
    type="button"
    class="flex h-full w-11 items-center justify-center text-slate-300 hover:bg-red-600 hover:text-white"
    aria-label="閉じる"
    onclick={() => void closeAppWindow()}
  >
    <svg class="h-3 w-3" viewBox="0 0 12 12" aria-hidden="true">
      <path
        fill="currentColor"
        d="M2.2 1.5 6 5.3 9.8 1.5 10.5 2.2 6.7 6l3.8 3.8-0.7 0.7L6 6.7 2.2 10.5 1.5 9.8 5.3 6 1.5 2.2z"
      ></path>
    </svg>
  </button>
</div>
