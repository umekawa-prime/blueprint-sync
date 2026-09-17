# 工程表バーチャート（サンプル JSON 描画）

日付: 2026-09-18  
対象: Blueprint Sync  
前提: 既存の「工程表 PDF」取り込みはそのまま。この仕様は **アプリ内で JSON からバーチャートを描く** 最初の一歩。

## 背景

プロジェクトの `工程表/` は外部 PDF を置く場所である。現場の全体工程をアプリ側で持ち、CSV / JSON から描きたい。まずは同梱の基準 JSON と全画面レンダリングだけを入れる。

## ゴール

- 基準 JSON（グループ + 予定／実績、日単位）をリポジトリに置く
- プロジェクトを開いた状態でツールバー「工程表」から全画面バーチャートを出す
- 「図面へ」で PDF ビューに戻る
- 日付からバー位置を計算する純関数をテストする

## やらないこと

- `工程表/*.json` の読み書き、CSV インポート
- 工程表の編集 UI
- PDF / 印刷への書き出し
- 週・月単位の軸切替、祝日、依存矢印、進捗パーセント
- 作業ごとの色、ネットワーク工程表
- 同期プロトコルの追加（同梱 JSON はアプリ資産。プロジェクトファイルではない）

## データ

正本: `src/lib/data/sampleSchedule.json`

```json
{
  "version": 1,
  "title": "サンプル新築工事 工程表",
  "start": "2026-09-01",
  "end": "2026-10-31",
  "groups": [
    {
      "id": "foundation",
      "name": "基礎",
      "color": "#38bdf8",
      "tasks": [
        {
          "id": "found-1",
          "name": "掘削",
          "planned": { "start": "2026-09-01", "end": "2026-09-10" },
          "actual": { "start": "2026-09-02", "end": "2026-09-09" }
        }
      ]
    }
  ]
}
```

ルール:

- 日付は `YYYY-MM-DD`。終了日はその日を含む
- チャートの `start` / `end` が横軸。作業が範囲外ならバーだけ切る（軸は伸ばさない）
- `planned` は必須。`actual` は省略可
- `actual.end` が `null` なら着手済み・未完了。バーは `actual.start` から `min(今日, chart.end)`。斜線
- 色はグループの `#RRGGBB` のみ
- 週末は JSON に持たない。描画側で土日を塗る
- パース失敗は画面にメッセージ。例外でアプリを落とさない

日付の解釈は既存の `parseIsoDate` / `formatIsoDate`（`calendarMonth.ts`）を使う。軸の加算は UTC 暦日で、DST で日が飛ばないようにする。

## 画面と操作

プロジェクトが開いているとき、ツールバーに「工程表」を置く（デスクトップ本体・スマホの「その他」）。押すと同梱サンプルを読み、図面ビューアを置き換える。

工程表モード:

- プロジェクトタブと左のプロジェクト一覧は残す
- ページサムネ、PDF キャンバス、描画ツール、課題ドック、ステータスバーは隠す
- 上バー: 「図面へ」、タイトル、`start 〜 end`
- 左列（約 200px）は工種名で横スクロール時も固定
- 右は 1 日 28px。上段に月、下段に日
- グループ行は見出しのみ（左に色）
- 作業行は二段。上が予定、下が実績（同色を少し暗く）
- 土日列は背景を落とす。期間内の「今日」に縦線
- 編集・ドラッグはしない（表示のみ）

「図面へ」は `scheduleStore.open = false`。サンプルの再読込は「工程表」を押し直したとき。

プロジェクトを閉じる／切替えるときは工程表モードも閉じる（`resetProjectLists` と同じタイミング）。

## 構成

- `src/lib/data/sampleSchedule.json` — 基準データ
- `src/lib/utils/scheduleSchema.ts` — 型と `parseScheduleChart(unknown)`
- `src/lib/utils/scheduleLayout.ts` — 日列・月バンド・バー矩形・今日線。コンポーネントに座標計算を置かない
- `src/lib/utils/scheduleActions.ts` — 開く／閉じる／リセット。コンポーネントから JSON を直接パースしない
- `src/lib/stores/scheduleStore.svelte.ts` — `open` / `chart` / `error`
- `src/lib/components/ScheduleView.svelte` — HTML/CSS で描画
- `src/routes/+page.svelte` / `Toolbar.svelte` — モード切替
- `src/lib/utils/projectActions.ts` — プロジェクト切替時に `resetScheduleState()`

## データの流れ

1. 「工程表」→ `openSampleSchedule()` → 同梱 JSON を `parseScheduleChart` → ストアへ
2. `ScheduleView` は `buildScheduleViewModel(chart, todayIso())` の結果だけ描く
3. 「図面へ」→ `closeScheduleView()`
4. プロジェクト閉じる／切替 → `resetScheduleState()`

## エラー

- JSON が schema に合わない: `scheduleStore.error` に日本語。チャートは出さない
- プロジェクト未オープンではツールバーに「工程表」は出ない（既存どおりプロジェクト内ツールバー）

## テスト

- パース: 正常系、終了日含む、`actual.end` null、不正日付、`start > end`、色不正、version 不正
- サンプル JSON 自身がパースできる
- レイアウト: 日数、土日、月バンド、範囲外クリップ、未完了実績、今日線
- アクション: 開くと `open` と chart、閉じると `open` だけ false、リセットでクリア
- レイアウトテスト: ツールバー「工程表」、`ScheduleView`、「図面へ」、図面モードでは `PdfViewer`
