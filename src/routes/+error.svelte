<script lang="ts">
  import { page } from "$app/state";
</script>

<div class="flex h-full flex-col items-center justify-center bg-slate-950 px-6 text-slate-100">
  <div class="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6">
    <h1 class="mb-2 text-xl font-semibold text-rose-300">{page.status} エラー</h1>
    <p class="text-sm text-slate-300">{page.error?.message ?? "画面の表示に失敗しました"}</p>
  </div>
</div>
