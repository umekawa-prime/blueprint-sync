# Android 共有の完成とペンモードの消しゴム

日付: 2026-09-17  
対象: Blueprint Sync  
前提: モバイル移管仕様（`2026-09-06-mobile-port-file-share-design.md`）の共有の出入り口が未完成。ペン使用中は現場で線を消したい。

## 背景

Android ではサンドボックスのプロジェクト作成・アプリ内取り込み・電話幅 chrome・LAN ホスト／クライアントは動く。一方、他アプリからの `SEND` / `VIEW` で開くことと、OS の共有シートで出すことは仕様にあるのに未完成である。`share_file` はスタブ、`incoming-files` は CLI 引数だけ、マニフェスト overlay は `MainActivity` 以外に当たらない。

現場タブレットでは、ペンで書いた線をストローク単位で消したい。ペン使用中に選択／テキスト／移動が並んでいると誤操作になる。

## ゴール

- Android で PDF / ZIP / `.bpsync.zip` を他アプリから受け取り、既存の `importIncomingFile` で取り込む
- Android で「プロジェクトを共有」「この図面を共有」が `ACTION_SEND` の chooser を出す
- 戻るキーは overlay を順に閉じ、ホスト中は画面を消灯しない
- Android では Cursor 起動と Jw_cad 起動を出さない
- ペンまたは消しゴムのとき、描画ツールはペンと消しゴムだけ。消しゴムはペンのストロークを1本ずつ丸ごと消す

モバイル移管仕様の「消しゴム新設はやらない」は、この仕様で上書きする。共有の出入り口の未完成分も、この仕様が実装対象である。

## やらないこと

- iOS のネイティブ共有シート実装（Web Share / ダウンロードのまま）
- JWW / DXF の共有受け取り
- バックグラウンド常時ホスト、Foreground Service、通知
- ピクセル消しゴム、線の途中だけ消すこと、テキストや写真ピンの削除
- ペンの色・太さ・先端パレットの作り直し
- `pdfRenderer.ts` / Fabric 描画本体 / `pdfCoords.ts` の再発明
- デスクトップのフォルダ選択、Jw_cad タップ起動、Cursor ボタン

## 受け取り（SEND / VIEW）

対象 MIME は `application/pdf`、`application/zip`、`application/octet-stream`、`application/x-zip-compressed` だけ。`*/*` は使わない。

`MainActivity` が `ACTION_SEND` / `SEND_MULTIPLE` / `VIEW` を処理する。`content://` はアプリのキャッシュへコピーしてから読む。コピーしたパスを既存イベント `incoming-files` に載せる。判定は現行 `importIncomingFile` のまま。

- 一式 ZIP（中に `.blueprint-sync/project.json`）→ サンドボックスへ新規。同じ `id` なら上書き確認
- 通常 ZIP → 開いているプロジェクトへ PDF 取り込み。未オープンなら「先にプロジェクトを開くか、一式を共有してください」
- 単体 PDF → 開いていれば追加。未オープンなら新規プロジェクトを作るか確認

冷起動で WebView が未準備でも落とさない。パスは pending キューに残し、フロントは `projectStore.bootstrapped` のあと `take_pending_incoming_files` で吸い上げる。セッション復元と同時に取り込まない。

ファイル名は ContentResolver の表示名を使う。PDF / ZIP / `.bpsync.zip` 以外（拡張子も中身も該当しない octet-stream）は取り込まず、ステータスだけ出す。

## 出し（共有シート）

「プロジェクトを共有」は注釈 persist 成功後の `{sanitizedName}.bpsync.zip`。「この図面を共有」はディスク上の保存済み PDF バイト。未保存の Fabric 注釈は、先に保存しない限り PDF に入れない（現行どおり）。

Android の Tauri では一時ファイルを書いて `share_file` を呼び、Kotlin が `FileProvider` + `ACTION_SEND` の chooser を出す。`navigator.share` には頼らない。iOS とブラウザは現行の Web Share / ダウンロードのまま。

`applyAndroidOverlays` は `MainActivity` に加え、intent-filter、FileProvider、LAN 用 `usesCleartextTraffic` を生成プロジェクトへコピーする。

## 戻るキーと画面消灯

システム戻るは、開いている overlay をこの順で閉じる。どれも無ければ OS の既定（アプリ終了）に任せる。

1. カメラ
2. 接続パネル
3. プロジェクトドロワー
4. 課題パネル（電話幅の全面）
5. ツールバー「その他」
6. タブシート

判定と閉じる処理は `src/lib/utils/`。`.svelte` に `invoke` を足さない。Kotlin の戻るコールバックが JS ハンドラを呼ぶ。

接続待機の開始で `FLAG_KEEP_SCREEN_ON` を付け、停止・エラー・切断で外す。

## Cursor / Jw_cad（Android）

「Cursorで開く」は `isDesktopTauriRuntime()` のときだけ出す。Android ではボタンも呼び出しもしない。

JWW / DXF のタップは Android では Jw_cad を起動しない。同じ名前の `図面/{名前}.pdf` があればそれを開く。まだ無ければ「長押しから PDF に変換」と出す。変換は既存のコンテキストメニューのまま。Windows のタップで Jw_cad を開く動作は変えない。

## ペンモード

ペンまたは消しゴムのとき、描画ツールは次だけにする。Windows も Android も同じ。

- **ペン**: 現行のフリーハンド。色・太さ・先端パレットはそのまま
- **消しゴム**: 下の規則でストロークを消す

選択 / テキスト / 移動はこのあいだ出さない。**完了** で選択ツールに戻す。保存・カメラ・その他（電話幅）は残す。ピンチや既存のジェスチャ移動は変えない。

スタイラスの消しゴム端（`pointerType === "eraser"`）は、ペンモード中は消しゴムと同じヒット判定にする。ツール表示も消しゴムにする。

## 消しゴム（ストローク単位）

1 ストロークは、ペンの1回の描画でできた Fabric オブジェクト1つである。

- フリーハンド: `path:created` でできた Path。先端があるときはそれを包む Group ごと1ストローク
- Shift＋クリックの直線／折れ線: `createStraightStrokeObject` が返したオブジェクト1つ

消しゴムは当たったストロークを**分割せず丸ごと** `canvas.remove` する。線の途中だけ消さない。ピクセル消しゴムや Fabric の EraserBrush は使わない。

ヒット: ポインタがストロークの描画（線幅を含む）に当たったらそのオブジェクトを消す。ドラッグで複数に当たったら、当たった順にそれぞれ丸ごと消す。同じストロークは一度だけ消す。

消さないもの: テキスト（IText）、写真ピン、PDF 本体。注釈キャンバス上のテキスト以外の Path / Polyline / Group をペンストロークとみなす。

履歴は既存の `object:removed`（`op: "remove"`）に載せる。消した線は「戻る」で戻る。LAN 同期の remove も現行と同じ。

## 配置

- I/O・共有: `shareFile.ts`、`incomingShare.ts`、`src-tauri/src/share.rs`、Android overlay（`MainActivity` / FileProvider / マニフェスト）
- 戻る・消灯: `src/lib/utils/` のハンドラと Kotlin。ホスト開始／停止から `set_keep_awake` を呼ぶ（コンポーネントから `invoke` しない）
- ペン／消しゴム: `toolStore` に `eraser`、`Toolbar.svelte` の表示切替、ヒット判定は `src/lib/utils/`（`.svelte` で座標計算しない）

## 失敗時

- 共有 ZIP 作成失敗: 共有シートを出さない。理由を出す（現行）
- Intent のコピー失敗 / 壊れた ZIP: 取り込まない。ステータスを出す
- `share_file` が chooser を出せない: 「共有シートを開けませんでした」
- カメラ拒否: 既存 `mapCameraError`

## テスト

- 一式 ZIP / 通常 ZIP / PDF の取り込み判定は現行テストを維持し、pending キューの吸い上げを足す
- `shareFileBytes` は Android Tauri で一時ファイル＋`share_file` を呼ぶ
- `usesRfdFileDialog()` が false のときフォルダ選択を出さない（現行）
- ペンモード中のツールバーはペン・消しゴム・完了だけで、選択／テキスト／移動を含まない
- 消しゴムは Path 全体を消し、同じ Path の一部だけを残さない
- テキストとピンは消しゴムで消えない
- 消したストロークは undo で戻る
- Android 以外で Jw_cad / Cursor の既存テストは壊さない
