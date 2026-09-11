# JWW/JWC を開いて PDF 図面として表示する

日付: 2026-09-11  
対象: Blueprint Sync（図面取り込み）

## 背景

現場の図面は PDF だけでなく Jw_cad の `.jww` / `.jwc` で渡ることがある。今の「開く」は PDF と ZIP だけなので、CAD ファイルを一度 PDF に直さないとこのアプリでは見られない。

## ゴール

- 今の「開く」ダイアログで `.jww` と `.jwc` を選べる
- ezjww-core でパースし、線をベクターのまま 1 ページ PDF にする
- 変換後 PDF を `図面/{元の名前}.pdf`（工程表から開いたときは `工程表/`）に置き、既存の注釈・保存・同期をそのまま使う
- 元の CAD ファイルはプロジェクトにコピーしない（ユーザーの手元に残す）

## やらないこと

- JWW/JWC のままのベクタービューア、レイヤ ON/OFF
- 元ファイルをプロジェクトへ保存する
- ブラウザデモでの CAD 変換（デスクトップ Tauri のみ）
- JWC の未対応プロファイルを無理に読む
- DXF の書き出し UI
- 複数用紙を複数 PDF ページにする（1 ファイル = 1 ページ。範囲は図形の bbox）

## 操作

1. プロジェクトを開く
2. 「開く」で PDF / ZIP / JWW / JWC を選ぶ（複数可）
3. CAD は変換して PDF として取り込む。PDF/ZIP は今どおり
4. 先頭の取り込み図面を開く
5. 壊れたファイル・未対応 JWC はステータスに出し、他のファイルの取り込みは続ける
6. 同じ名前の PDF が既にあるときは今と同じ「同じ名前のPDFが既にあります」

ドラッグ＆ドロップも同じ変換を通す。元の `.jww` / `.jwc` は移動・削除しない。

## 変換

1. バイト列を読む（ダイアログはパスだけ返すので `read_file_bytes`）
2. Tauri コマンド `parse_cad_to_dxf` が ezjww-core でパースする
   - 内容のシグネチャで JWW / JWC を判定（拡張子だけに頼らない）
   - JWW: INSERT を展開（`explode_inserts: true`, `max_block_nesting: 32`）
   - JWC: `paper_millimeters`。ezjww が読めるプロファイル以外はエラー
3. フロントの pdf-lib が DXF 図形 JSON をベクター PDF にする
   - 座標は mm、Y 上向きのまま PDF ポイントへ
   - ページは bbox + 10mm 余白。空なら A4
   - 非表示（frozen）レイヤは描かない
   - LINE / CIRCLE / ARC / ELLIPSE / TEXT / POINT / SOLID / FILLED_POLYGON
   - INSERT は展開済み前提で描かない
   - ACI 7（白）は紙の上では黒にする
   - 日本語テキストは埋め込みフォントがあれば描く。無ければ ASCII のみ

## エラー

| 状況 | 表示 |
|---|---|
| シグネチャが JWW/JWC でない | `JWW/JWCファイルではありません` |
| パース失敗・未対応 JWC | ezjww のメッセージ、または `図面を読み込めませんでした` |
| ブラウザから変換 | `JWW/JWC の変換はデスクトップ版で行えます` |
| 同名 PDF | 既存どおり `同じ名前のPDFが既にあります` |
| 拡張子が対象外 | 既存どおり `PDFファイル名が不正です` |

## 配置

- ダイアログ: `src-tauri/src/explorer_dialog.rs`
- パーサ: `src-tauri/src/cad_dxf.rs` + `parse_cad_to_dxf`（ezjww-core v0.3.2 git）
- 名前判定: `src/lib/utils/cadImport.ts`
- PDF 描画: `src/lib/utils/dxfToPdf.ts`
- 取り込み: `projectActions.ts` / `projectDrop.ts` / `fileAccess.ts`

## テスト

- 拡張子 → PDF 名、不正名の拒否
- 合成 DXF JSON から `%PDF` が出て、線の座標がページ内に収まる
- 不正バイトは Tauri 側でエラー
- 「開く」とドロップが CAD を変換して `図面/*.pdf` を書き、元パスを消さない
- ダイアログフィルタに jww/jwc が含まれる
