# Agent notes — Blueprint Sync

現場オフライン向けの PDF 図面編集アプリ（LAN 同期機能は削除済み）。スタックは **Svelte 5 + SvelteKit SPA + Tauri v2 (Rust)**。Next.js / React / Svelte 4 の慣習は持ち込まない。

## 先に読む

変更する層に応じて、コードを書く前に該当箇所を開く。

| 触るもの | 先に見る |
|---|---|
| 画面・コンポーネント | 既存の `src/lib/components/*.svelte`、`$props()` / `onclick=` |
| 状態 | `src/lib/stores/*.svelte.ts`（クラス + `$state`、シングルトン export） |
| ファイル I/O・ダイアログ | `src/lib/utils/fileAccess.ts`、`projectIo.ts`、`platform.ts` |
| Tauri コマンド | `src-tauri/src/lib.rs` の `#[tauri::command]` と `src-tauri/capabilities/default.json` |
| PDF ↔ キャンバス座標 | `src/lib/utils/pdfCoords.ts`（ここ以外で座標変換を再発明しない） |

仕様がある作業は `docs/superpowers/` の該当 spec / plan に従う。

## 禁止（学習データから出やすい誤り）

- Svelte 4: `$:`、`writable` / `readable`、`on:click`、`createEventDispatcher`、`<slot>`、`export let`
- React / Next: JSX、hooks、`useState`、Server Components、`app/` ディレクトリ、`fetch('/api/...')` でバックエンドを足す
- Tauri 1 API、Node `fs`、ブラウザ前提のパス操作をデスクトップ本体にする
- SvelteKit を SSR 前提で書く。`src/routes/+layout.ts` は `ssr = false`（Tauri に Node サーバはない）
- `.svelte` に Tauri `invoke` や座標計算を新たに足す。I/O は `src/lib/utils/`、座標は `pdfCoords.ts`

## Svelte 5

- コンポーネントは `<script lang="ts">` + `$props()` + `onclick={...}`。
- ストアは `*.svelte.ts` のクラス。フィールドは `$state`。モジュールから `export const fooStore = new FooStore()`。
- オブジェクト更新は既存ストアと同じく **新しいオブジェクトを代入**する（`this.byPage = { ...this.byPage, [page]: current }`）。
- ストアの import は拡張子なし（`$lib/stores/annotationStore.svelte`）。
- 子へ渡すコールバックは props。カスタムイベントを新設しない。
- スタイリングは既存どおり Tailwind ユーティリティ。グローバル CSS を増やさない。

```svelte
<!-- NG -->
<script>
  export let title;
  function handle() {}
</script>
<button on:click={handle}>{title}</button>

<!-- OK -->
<script lang="ts">
  let { title, onOpen }: { title: string; onOpen: () => void } = $props();
</script>
<button type="button" onclick={onOpen}>{title}</button>
```

## 配置

- UI: `src/lib/components/`。ルートは `src/routes/+page.svelte` が組み立てるだけ。
- ロジック: `src/lib/utils/`。コンポーネントから呼ぶ。
- 状態: `src/lib/stores/`。
- ネイティブ: `src-tauri/src/`。コマンド追加時は `invoke` 側の TS 型と **両方**直す。
- 単体テスト: 対象の隣に `*.test.ts`（Vitest）。Tauri / DOM / キャンバスは mock する。既存の `vi.mock("@tauri-apps/api/core")` に合わせる。

## Tauri

- コマンド名と引数は `lib.rs` が正。TS から `invoke("write_file_bytes", { path, bytes })` のように **camelCase のキー**で渡す。
- 新しいコマンド・プラグイン・権限は `capabilities/default.json`（必要なら OS 別 capability）を先に更新する。権限なしの `fs` / dialog は実行時に落ちる。
- ブラウザでも触る処理は `isTauriRuntime()` / `usesRfdFileDialog()` / `detectPlatform()` で分岐する。Windows デスクトップと Android / iOS でダイアログ実装が違う。
- `@tauri-apps/api` は、ブラウザ `npm run dev` でも壊れないよう、既存どおり動的 import するか `fileAccess` / `projectIo` 経由にする。
- フロントだけ直して Rust 側のシグネチャを放置しない。逆も禁止。

## PDF / Fabric

- 表示: `pdfjs-dist`（`pdfRenderer.ts`）。注釈: Fabric。書き出し: `pdf-lib`。役割を混ぜない。
- 座標変換は `pdfCoords.ts` の `fabricToPdfRect` / 逆変換を使う。コンポーネント内で scale を再計算しない。
- ポインタとツール切替は `fabricPointer.ts`。履歴は `editHistory.ts` / `historyStore`。
- 「描画エンジン」と「どのバイトをいつ読むか」は別問題。ファイル I/O を直すときに viewport 計算を触らない。

## プラットフォーム

- デスクトップ（Windows）: ネイティブファイルダイアログ（rfd / カスタムコマンド）。
- Android / iOS: HTML のファイル選択・カメラ。`pick_pdf_file` などはモバイルで意図的にエラーを返す。

## 検証

UI を触ったら `npm test`。型が絡む変更は `npm run check`。Tauri コマンドや capability を変えたら `npm run tauri dev` で実際のダイアログ / ファイル書き込みまで確認する（ヘッドレスだけでは足りない）。

Rust を変えたのにフロントの mock / 型だけ通して完了にしない。
