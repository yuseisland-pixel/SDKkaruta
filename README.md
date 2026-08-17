# SDKかるた — 独自かるた Web アプリ（カードジェネレーター付き）

[上毛かるたオンライン](https://yg-jomokaruta.com/) と同じ仕組み（タイムアタック / サドンデス / 読み上げモード / 音声選択 / ベストタイム）で、
**自分で作った札** を遊べる Web アプリです。札データの作成・画像の自動生成・2 人対戦 / CPU 対戦までブラウザだけで完結します。

## できること

| 機能 | 内容 |
| --- | --- |
| あそぶ | ソロ（タイムアタック）/ **2 人対戦**（1 台の画面を上下分割・早押し）/ **CPU 対戦**（3 段階の強さ） |
| ルール | 全札 / 半分 / サドンデス / 読み上げモード + カスタムルール（枚数・お手つき処理・表示など） |
| 札をつくる | 頭文字・読み札の文・絵札/読み札画像・音声を札ごとに登録。画像は自作アップロード or Canvas 自動生成 |
| 頭文字バッジ | 絵札の丸バッジは画像に焼き込まず表示時に重ねる方式。エディタで **ドラッグで位置調整**・大きさ変更・表示 ON/OFF・全札に一括適用。PNG 書き出し時は合成して出力 |
| ダミー生成 | 五十音 N 枚のサンプルセットを 1 クリックで生成（動作確認・テンプレート用） |
| 入出力 | デッキ: JSON（画像埋め込み）/ ZIP（画像・音声をファイル分離）/ PNG 一括（印刷用）。札 1 枚: 絵札 PNG / 読み札 PNG / 札 JSON（別デッキへ取り込み可） |
| 読み上げ | 札に登録した音声ファイル → ブラウザ音声合成（Web Speech API）の順で自動フォールバック |
| 記録 | ベストタイム（ソロ）・対戦結果の履歴をブラウザ内（IndexedDB）に保存 |

## 起動

```bash
npm install
npm run dev        # http://localhost:5173/
npm run build      # dist/ に静的ファイルを出力（GitHub Pages 等にそのまま置ける）
npm run test       # vitest（エンジン / 対戦 / CPU / ストレージ / ジェネレーター）
```

初回はホーム画面の「ダミーかるた（44枚）を自動生成」を押すとすぐ遊べます。
`samples/sample_mini.json` を「札をつくる → インポート」で読み込むこともできます。

VS Code なら `.vscode/launch.json` の「Web: Chrome で起動」で Vite 起動 → ブラウザデバッグまで一発です。

## 対戦モードのルール

- **2 人対戦**: 画面上段がプレイヤー1、下段がプレイヤー2。同じ場が両方に表示され、自分の段の札をタップして取ります。「対面表示」を ON にすると上段が 180° 回転し、テーブルに置いたタブレットで向かい合って遊べます
- **CPU 対戦**: やさしい / ふつう / つよい。強いほど反応が速く、お手つきが少なくなります
- お手つき（ペナルティルール）: そのプレイヤーは **ペナルティ秒数の間 or その札が終わるまで** 取れなくなります（相手だけが取れる）。サドンデスルールなら即終了
- 勝敗は取った枚数。同数は引き分け。対戦結果はベストタイム対象外ですが履歴に残ります

## 札セットの JSON 形式

```jsonc
{
  "id": "set_xxx", "name": "セット名", "description": "", "version": 1,
  "createdAt": "...", "updatedAt": "...",
  "voiceConfig": { "rate": 1.0 },   // 任意
  "cards": [
    {
      "id": "card_xxx", "order": 0,
      "kana": "あ",                       // 頭文字（絵札に大きく出す）
      "yomi": "読み札の文",
      "yomiKana": "よみふだのぶん",       // 任意: 読み上げ用よみがな
      "efudaImage": "data:image/png;base64,...",   // 任意: 絵札
      "yomifudaImage": "data:image/png;base64,...",// 任意: 読み札画像
      "audio": "data:audio/wav;base64,...",        // 任意: 読み上げ音声
      "meta": { "emblem": "🌸", "note": "解説" }    // 任意
    }
  ]
}
```

札 1 枚の JSON は `{ "format": "sdkkaruta-card", "version": 1, "card": { ... } }` の形です。
`card.kanaBadge`（`{ show, x, y, size }`、座標は札サイズ比 0–1）で頭文字バッジの表示・位置を制御できます。

> 旧バージョンで自動生成した絵札はバッジが画像に焼き込まれています。エディタの「全画像を再生成」を一度実行すると、オーバーレイ方式（位置調整可能）に切り替わります。
スキーマは [src/domain/card.ts](src/domain/card.ts)（zod）で定義しています。

## 構成（将来のオンライン化を見越した層分け）

```
src/
  domain/      ゲームの中核。React/ブラウザ非依存の純粋 TS（サーバーへそのまま移植可）
    card.ts      札・札セットの型とバリデーション
    rules.ts     GameRule 型 + プリセット 4 種
    engine.ts    KarutaEngine（状態機械。複数プレイヤー対応。時刻・乱数は注入可能）
    cpu.ts       CPU プレイヤーの意思決定（純粋関数）
    score.ts     ScoreRecord（フラットな JSON。API 送信を想定）
  ports/       差し替え点となるインターフェース
    CardSetRepository / ScoreRepository / RuleRepository / SpeechProvider
  adapters/    ports の実装
    storage/     IndexedDB 実装（idb）と localStorage 設定
    speech/      WebSpeech / AudioFile / Composite（優先順フォールバック）
  generator/   カードジェネレーター（Canvas 描画・ダミー生成・JSON/ZIP 入出力）
  app/         React（画面・hooks）。di.ts が Composition Root
samples/       サンプル札セット
```

### オンラインサーバーに載せるとき

1. `src/adapters/http/HttpCardSetRepository.ts` / `HttpScoreRepository.ts` を作り、`ports/` のインターフェースを実装する
2. [src/app/di.ts](src/app/di.ts) の `createServices()` で IndexedDb 実装を Http 実装に差し替える（画面側の変更は不要）
3. `ScoreRecord` はそのまま POST できる形なので、ランキング API はこれを受けて集計するだけでよい
4. `domain/engine.ts` は複数プレイヤー対応で、サーバー側でも動くため、オンライン対戦の権威サーバーとしてそのまま使える

## 技術スタック

Vite + React 19 + TypeScript / react-router / idb / jszip / zod / vitest
