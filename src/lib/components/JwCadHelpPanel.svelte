<script lang="ts">
  let { onClose }: { onClose: () => void } = $props();

  $effect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
</script>

<div
  class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4"
  role="dialog"
  aria-modal="true"
  aria-labelledby="jwcad-help-title"
  tabindex="-1"
  onclick={onClose}
  onkeydown={(event) => {
    if (event.key === "Escape") {
      onClose();
    }
  }}
>
  <article
    class="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
    role="presentation"
    onclick={(event) => event.stopPropagation()}
  >
    <div class="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
      <h2 id="jwcad-help-title" class="text-base font-semibold text-cyan-200">操作方法</h2>
      <button type="button" class="text-sm text-slate-400 hover:text-slate-200" onclick={onClose}>
        閉じる
      </button>
    </div>
    <div class="min-h-0 flex-1 space-y-4 overflow-auto px-4 py-3 text-sm leading-6 text-slate-200">
      <section>
        <h3 class="mb-1 text-xs font-semibold tracking-wide text-slate-400">このアプリと Jw_cad</h3>
        <ol class="list-decimal space-y-1 pl-5 text-xs leading-5 text-slate-300">
          <li>「JWW / DXFを追加」でプロジェクトの <span class="text-slate-100">図面JWW</span> にファイルを入れます。</li>
          <li>サイドバーの JWW / JWC / DXF をクリックすると、プロジェクト内のそのファイルを Jw_cad で開きます。</li>
          <li>Jw_cad で編集したら、Jw_cad 側で上書き保存してください。</li>
          <li>保存したファイルを右クリックし、<span class="text-slate-100">PDFに変換</span> すると <span class="text-slate-100">図面</span> に PDF が追加されます。</li>
          <li>注釈（ペン・写真ピン）は、変換後の PDF を開いて行います。</li>
        </ol>
      </section>
      <section>
        <h3 class="mb-1 text-xs font-semibold tracking-wide text-slate-400">Jw_cad の基本</h3>
        <ul class="list-disc space-y-1 pl-5 text-xs leading-5 text-slate-300">
          <li>左クリックで点を指示します（線の始点・終点など）。</li>
          <li>右クリックでコマンドを確定、またはキャンセルします。</li>
          <li>マウスホイールで拡大・縮小します。</li>
          <li>画面をつかんで動かすときは、ホイール押し込みドラッグかパン操作を使います。</li>
          <li>線・円・文字・寸法は、上部または左のコマンドから選びます。</li>
          <li>範囲を囲んでから、移動・複写・消去を実行します。</li>
          <li>レイヤの表示／非表示はレイヤ一覧から切り替えます。</li>
          <li>終わったら「ファイル」→「上書き保存」です。このアプリの出力ボタンではありません。</li>
        </ul>
      </section>
      <section>
        <h3 class="mb-1 text-xs font-semibold tracking-wide text-slate-400">うまく開かないとき</h3>
        <ul class="list-disc space-y-1 pl-5 text-xs leading-5 text-slate-300">
          <li>Jw_cad がインストールされているか確認してください（スタートメニューの Jw_cad）。</li>
          <li>この操作は Windows のデスクトップ版のみです。</li>
          <li>同じ名前の PDF が既にあると変換できません。名前を変えるか、既存 PDF を削除してから変換します。</li>
        </ul>
      </section>
    </div>
  </article>
</div>
