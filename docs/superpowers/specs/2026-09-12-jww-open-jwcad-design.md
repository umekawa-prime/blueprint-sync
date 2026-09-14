# JWW を Jw_cad で開き、必要なら PDF に変換する

日付: 2026-09-12  
対象: Blueprint Sync（図面 JWW）

## 背景

図面の編集は自前の CAD ではなく Jw_cad で行う。プロジェクトに入れた `.jww` / `.jwc` をクリックすると、今はアプリ内で PDF 変換して表示している。

## ゴール

- サイドバーで JWW / JWC をクリックしたら、プロジェクトフォルダ内のそのファイルを Jw_cad で開く
- アプリ内の PDF は切り替えない
- 右クリック「PDFに変換」で既存の ezjww 変換を使い、`図面/{名前}.pdf` に書く。今開いている図面はそのまま
- 同名 PDF があるときは「同じ名前のPDFが既にあります」

## やらないこと

- Jw_cad の印刷機能での PDF 出力
- 変換後に PDF を自動で開く
- インストール場所の設定 UI
- モバイル / ブラウザで Jw_cad を起動する

## 起動

実行ファイルの探索順:

1. `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Jw_cad\Jw_cad.lnk`
2. `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Jw_cad\Jw_cad.lnk`
3. `C:\jww\Jw_win.exe`
4. `C:\jww\jww.exe`

ショートカットは中の `C:\…\*.exe` パスを読む。`Jw_win.exe` にプロジェクト内ファイルの絶対パスを渡す。作業フォルダは exe の親。Windows 以外とブラウザは「Jw_cad は Windows のデスクトップ版で開けます」。

## PDF 変換

右クリック（JWW / JWC のみ）→「PDFに変換」。`pairedDrawingPdfRelPath` の先へ書き出す。上書きしない。

## 配置

- Rust: `src-tauri/src/jwcad.rs` とコマンド `open_cad_in_jwcad`
- フロント: `cadImport.ts` の起動、`projectActions.ts` のクリックと変換、`ProjectSidebar.svelte` のメニュー

## テスト

- lnk バイトから exe パスを拾う
- クリックは Jw_cad 起動だけで `pdfStore.load` しない
- 変換は `図面/` に書き、同名ならエラー、開いている PDF は変えない
- サイドバーメニューに「PDFに変換」
