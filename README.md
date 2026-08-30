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

## iOS / iPadOS

macOS と Xcode、CocoaPods、Apple Developer アカウントが必要です。Xcode プロジェクト（`src-tauri/gen/apple`）は gitignore 対象なので、初回は初期化します。

```bash
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
brew install cocoapods
npm run tauri ios init
npm run tauri ios build
```

Team ID は `APPLE_DEVELOPMENT_TEAM` 環境変数、または `src-tauri/tauri.conf.json` の `bundle.iOS.developmentTeam` で指定します。Bundle ID は `identifier`（`com.mitra.blueprintsync`）です。iPhone / iPad 両対応（`UIDeviceFamily` 1,2）で、最低バージョンは iOS / iPadOS 14.0 です。

生成された `.ipa` は `src-tauri/gen/apple/build/arm64/` 以下に出力されます。

### GitHub Actions で IPA をビルドする

ワークフロー: [`.github/workflows/build-ios.yml`](.github/workflows/build-ios.yml)

- トリガー: `main` への push、および Actions タブからの手動実行（`workflow_dispatch`）
- ランナー: `macos-14`
- 成果物: Actions の Artifacts に `blueprint-sync-ios`（`.ipa`）が保存される（14 日）

手動実行時は export method を選べます。

| 値 | 用途 |
| --- | --- |
| `app-store-connect`（既定） | App Store / TestFlight |
| `release-testing` | Ad Hoc（登録済み端末へ直接インストール） |
| `debugging` | Development |

#### 必要な GitHub Secrets

リポジトリの **Settings → Secrets and variables → Actions** に登録します。

| Secret | 内容 |
| --- | --- |
| `BUILD_CERTIFICATE_BASE64` | Keychain Access から書き出した署名証明書（`.p12`）の Base64 |
| `P12_PASSWORD` | 上記 `.p12` のパスワード |
| `PROVISION_PROFILE_BASE64` | プロビジョニングプロファイル（`.mobileprovision`）の Base64 |
| `APPLE_DEVELOPMENT_TEAM` | Apple Developer Team ID（10 文字） |
| `KEYCHAIN_PASSWORD` | （任意）CI 用一時キーチェーンのパスワード。未設定ならジョブ内で生成 |

macOS での Base64 化:

```bash
base64 -i Certificates.p12 | pbcopy
base64 -i BlueprintSync.mobileprovision | pbcopy
```

証明書は Apple Developer の Certificates から発行し、Keychain Access で秘密鍵ごと `.p12` として書き出します。プロファイルの App ID は `com.mitra.blueprintsync` と一致させてください。App Store 配布なら Apple Distribution + App Store Connect プロファイル、登録 iPad 向けなら Ad Hoc プロファイルを使います。

Tauri の手動署名用環境変数（`IOS_CERTIFICATE` / `IOS_CERTIFICATE_PASSWORD` / `IOS_MOBILE_PROVISION`）は、ワークフローが上記 Secrets から自動でセットします。

## 使い方

1. Windows で PDF を開く（ファイル選択またはドラッグ＆ドロップ）
2. 「接続」→ Windows ホストで待機開始。QR と `ws://IP:7840` を表示
3. Android で QR を読むか IP を入力して接続
4. ペン / テキスト / カメラ写真を追加。差分は WebSocket で相互同期
5. 「保存」で注釈を元 PDF に合成して書き出し

## ディレクトリ

```text
blueprint-sync/
├── .github/workflows/build-ios.yml  # iOS / iPadOS IPA の CI
├── src-tauri/                 # Rust (Tauri, WebSocket サーバー, ファイル選択)
│   ├── Info.ios.plist         # iOS / iPad 向け Info.plist（カメラ権限など）
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
