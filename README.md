# Blueprint Sync

現場オフライン環境向けの、Windows / Android クロスプラットフォーム PDF 図面編集アプリです。

- フロントエンド: Svelte 5 + TypeScript + Tailwind CSS
- デスクトップ / モバイル: Tauri v2 (Rust)
- PDF 表示: `pdfjs-dist`
- 注釈レイヤー: Fabric.js
- PDF 書き出し: `pdf-lib`

公式の Tauri v2 `svelte-ts` テンプレートは SvelteKit (SPA / `adapter-static`) です。仕様書の `App.svelte` 相当は `src/routes/+page.svelte`、共有コードは `src/lib/` に置いています。

## 必要環境

- Node.js 22+
- Rust (rustc / cargo)
- Windows x64 / ARM64 向けビルド（`npm run build`）: WSL からは `cargo-xwin` でクロスコンパイルする。初回は NSIS / LLVM / Windows SDK を取得する
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

## Windows インストーラ

```bash
npm run build
```

x64（Intel / AMD）と ARM64 の NSIS インストーラ（`-setup.exe`）を出力します。

- `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`
- `src-tauri/target/aarch64-pc-windows-msvc/release/bundle/nsis/`

WSL から実行した場合は、見つかれば Windows の Downloads にもコピーします。
インストーラは開発用の自己署名で Authenticode 署名します。ARM 機では先に
`Install-BlueprintSync.cmd` を一度実行して証明書を信頼すると、「不明な発行元」警告を避けられます。
Microsoft の発行するコード署名証明書ではないので、未信頼の PC では SmartScreen は残ります。
フロントエンドだけビルドする場合は `npm run build:web` です。

## Linux / ChromeOS Flex

Linux x86_64 向けの Debian パッケージをビルドし、接続中の USB ドライブへコピーします。

```bash
npm run build:linux:usb
```

WSL では Windows がリムーバブルドライブとして認識している USB を自動検出します。Linux では `/media/$USER`、`/run/media/$USER`、または `/mnt/chromeos/removable` 以下にマウントされた USB を検出します。複数の USB がある場合や自動検出できない場合は、マウント先を指定できます。

```bash
LINUX_USB_MOUNT=/path/to/usb npm run build:linux:usb
```

生成した `Blueprint Sync_0.1.0_amd64.deb` を USB のルートへコピーし、コピー後に SHA-256 で一致を確認します。

## Android

```bash
npm run tauri android init
npm run tauri android dev
```

## iOS / iPadOS

有料の Apple Developer Program は不要です。CI が未署名の `.ipa` を作り、iPad では [SideStore](https://docs.sidestore.io/) が無料 Apple ID で再署名してインストールします。

Bundle ID は `com.mitra.blueprintsync`。iPhone / iPad 両対応、最低バージョンは iOS / iPadOS 15.0 です。Xcode プロジェクト（`src-tauri/gen/apple`）は gitignore 対象です。

### GitHub Actions で IPA をビルドする

ワークフロー: [`.github/workflows/build-ios.yml`](.github/workflows/build-ios.yml)

**GitHub Secrets は不要です。** 証明書もプロビジョニングプロファイルも登録しません。

- トリガー: `main` への push、および Actions タブからの手動実行（`workflow_dispatch`）
- ランナー: `macos-14`（Windows だけでは IPA を作れないため、クラウド上の Mac でビルドする）
- 成果物: Artifacts の `blueprint-sync-ios`（`BlueprintSync.ipa`、14 日保存）

1. Actions でジョブが成功したら Artifact をダウンロードする
2. Windows の iLoader で SideStore を iPad に入れる（初回のみ）
3. iPad の SideStore で `BlueprintSync.ipa` を開いてインストールする
4. 7 日以内に LocalDevVPN を接続し、SideStore で Refresh する（無料アカウントの署名期限）

## 使い方

1. PDF を開く（ファイル選択またはドラッグ＆ドロップ）
2. ペン / テキスト / カメラ写真を追加
3. 「保存」で注釈を元 PDF に合成して書き出し

## ディレクトリ

```text
blueprint-sync/
├── .github/workflows/build-ios.yml  # iOS / iPadOS IPA の CI
├── src-tauri/                 # Rust (Tauri, ファイル選択, CAD 変換)
│   ├── Info.ios.plist         # iOS / iPad 向け Info.plist（カメラ権限など）
│   └── src/
│       ├── lib.rs
│       └── main.rs
├── src/
│   ├── lib/
│   │   ├── components/        # ツールバー, PDF+Fabric, パネル類
│   │   ├── stores/            # ツール / PDF / 注釈 / プロジェクト
│   │   └── utils/             # pdfjs, pdf-lib, ファイル I/O, 画像リサイズ
│   └── routes/+page.svelte    # メインビュー
├── package.json
└── tailwind.config.js
```
