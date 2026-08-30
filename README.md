# Blueprint Sync

現場オフライン環境向けの、Windows / Android クロスプラットフォーム PDF 図面編集・同期アプリです。

- フロントエンド: Svelte 5 + TypeScript + Tailwind CSS
- デスクトップ / モバイル: Tauri v2 (Rust)
- PDF 表示: `pdfjs-dist`
- 注釈レイヤー: Fabric.js
- PDF 書き出し: `pdf-lib`
- 同期: Rust 実装のローカル WebSocket リレー

公式の Tauri v2 `svelte-ts` テンプレートは SvelteKit (SPA / `adapter-static`) です。仕様書の `App.svelte` 相当は `src/routes/+page.svelte`、共有コードは `src/lib/` に置いています。

## 必要環境

- Node.js 22+
- Rust (rustc / cargo)
- Windows 向けビルド: Visual Studio C++ ビルドツール
- Android 向けビルド: Android SDK / NDK / JDK（`npm run tauri android init` 後）

## 開発

```bash
cd blueprint-sync
npm install
npm test
npm run tauri dev
```

ブラウザのみで UI を確認する場合:

```bash
npm run dev
```

ホスト（WebSocket サーバー起動・QR 表示）は Tauri 実行時のみ使えます。

## Android

```bash
npm run tauri android init
npm run tauri android dev
```

同じ Wi-Fi / テザリング網で、Windows 側の「接続待機」QR を Android から読み取って同期します。

## 使い方

1. Windows で PDF を開く（ファイル選択またはドラッグ＆ドロップ）
2. 「接続」→ Windows ホストで待機開始。QR と `ws://IP:7840` を表示
3. Android で QR を読むか IP を入力して接続
4. ペン / テキスト / カメラ写真を追加。差分は WebSocket で相互同期
5. 「保存」で注釈を元 PDF に合成して書き出し

## ディレクトリ

```text
blueprint-sync/
├── src-tauri/                 # Rust (Tauri, WebSocket サーバー, ファイル選択)
│   └── src/
│       ├── lib.rs
│       ├── main.rs
│       └── sync_server.rs
├── src/
│   ├── lib/
│   │   ├── components/        # ツールバー, PDF+Fabric, QR, 接続パネル
│   │   ├── stores/            # ツール / PDF / 接続 / 注釈
│   │   └── utils/             # pdfjs, pdf-lib, 同期プロトコル, 画像リサイズ
│   └── routes/+page.svelte    # メインビュー
├── package.json
└── tailwind.config.js
```
