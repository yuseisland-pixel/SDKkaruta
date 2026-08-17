# SDKかるた 引継ぎ文書（AI 向け）

> この文書は、本プロジェクトを他プロジェクトへ統合する作業者（AI エージェントを想定）向けの引継ぎ資料である。
> 2026-08 時点の実装（コミット `68bf59b` 前後）に基づく。

## 1. プロジェクト概要

- **何か**: 独自かるたを「作って」「遊べる」完全クライアントサイドの Web アプリ。
  [上毛かるたオンライン](https://yg-jomokaruta.com/) 相当の機能（タイムアタック / サドンデス / 読み上げモード / ベストタイム）＋カードジェネレーター＋2人対戦＋CPU対戦。
- **公開 URL**: https://yuseisland-pixel.github.io/SDKkaruta/
- **リポジトリ**: https://github.com/yuseisland-pixel/SDKkaruta （public、default branch: `main`）
- **サーバー無し**: 全データ（札セット・記録・設定）は各ユーザーのブラウザ内
  （IndexedDB `sdkkaruta` / localStorage `sdkkaruta.settings`）に保存。共有は JSON/ZIP の手動エクスポート/インポートのみ。

## 2. 技術スタック / コマンド

| 項目 | 内容 |
| --- | --- |
| ビルド | Vite 8（`base: './'` — サブパス配信対応） |
| UI | React 19 + TypeScript（strict, **erasableSyntaxOnly**）+ react-router 7（**HashRouter**） |
| 保存 | idb（IndexedDB）, zod 4（スキーマ検証）, jszip |
| テスト | vitest + jsdom + fake-indexeddb（29 tests） |
| Lint | oxlint（`.oxlintrc.json`） |

```bash
npm install
npm run dev      # localhost:5173
npm run test     # vitest run
npm run build    # tsc -b && vite build → dist/
npm run lint
```

- **デプロイ**: `main` へ push → `.github/workflows/deploy.yml`（test → build → GitHub Pages）。
- VS Code: `.vscode/launch.json`（Chrome/Edge 起動デバッグ、Vitest）、`.vscode/tasks.json`（vite dev をバックグラウンド起動）。

## 3. アーキテクチャ（最重要）

```
src/
  domain/     ← ゲームの中核。React・ブラウザ API 非依存の純粋 TS。サーバーでもそのまま動く
  ports/      ← インターフェース（差し替え点）。domain の型のみに依存
  adapters/   ← ports の実装（IndexedDB、音声）。ブラウザ API に依存
  generator/  ← カード画像の Canvas 生成・入出力。ブラウザ API（Canvas/FileReader）依存
  app/        ← React。di.ts が Composition Root（唯一の実装組み立て箇所）
```

依存方向: `app → ports/domain/generator`, `adapters → ports/domain`。**domain は何にも依存しない**。

統合時の取捨選択の目安:
- ゲームロジックだけ欲しい → `domain/` を丸ごとコピー（依存は zod のみ）
- データ永続化の口を変えたい → `ports/` のインターフェースを実装し `app/di.ts` の `createServices()` で差し替え。**画面側の変更は不要**
- 画像生成だけ欲しい → `generator/renderCard.ts`（+ `domain/card.ts` の型）

## 4. データモデル

zod スキーマは全て [src/domain/card.ts](src/domain/card.ts) / [rules.ts](src/domain/rules.ts) に定義。TS 型はそこから infer。

### CardSet（札セット = デッキ）
```jsonc
{
  "id": "set_xxx", "name": "...", "description": "", "version": 1,
  "createdAt": "ISO8601", "updatedAt": "ISO8601",
  "voiceConfig": { "rate": 1.0 },              // 任意
  "cards": [ /* Card[] */ ]
}
```

### Card（札）
```jsonc
{
  "id": "card_xxx",
  "order": 0,                    // 表示順（0 始まり、normalizeOrder() で振り直し）
  "kana": "あ",                  // 頭文字（決まり字）。セット内で重複禁止（validateCardSet）
  "yomi": "読み札の文",
  "yomiKana": "よみあげよう",     // 任意。読み上げは yomiKana || yomi（readingTextOf()）
  "efudaImage": "data:image/png;base64,...",   // 任意。dataURL / URL
  "yomifudaImage": "data:...",                 // 任意
  "audio": "data:audio/...",                   // 任意。あれば音声合成より優先再生
  "kanaBadge": { "show": true, "x": 0.16, "y": 0.12, "size": 0.13 }, // 任意。頭文字バッジ（比率座標）
  "meta": { "emblem": "🌸", "note": "..." }    // 任意の string map
}
```
- **頭文字バッジは画像に焼き込まれていない**。表示時に `KanaBadgeOverlay` で重ね、PNG 書き出し時のみ `composeEfudaPng()` で合成する。
- 札 1 枚単位の交換形式: `{ "format": "sdkkaruta-card", "version": 1, "card": {...} }`（`io.ts` の export/importCardJson）。

### GameRule
`cardCount('all'|number) / pick(random|head) / onMiss(penalty|gameover|ignore) / penaltySec / showYomiText / readOnly(読み上げモード) / autoNextDelayMs / shuffleField / shuffleReading / removeTaken`。
プリセット 4 種は `PRESET_RULES`（全札TA / 半分TA / サドンデス / 読み上げ）。カスタムルールは IndexedDB `rules` ストアに保存。

### ScoreRecord（[src/domain/score.ts](src/domain/score.ts)）
フラット JSON（サーバーへそのまま POST できる想定）。
`{ id, cardSetId, ruleId, timeMs, rawTimeMs, misses, takenCount, totalCount, finishReason, playedAt, voiceId?, mode?('solo'|'pvp'|'cpu'), players?[], winnerIndex?, synced? }`
- ベストタイム対象は `isRankable()`: **complete かつ solo のみ**。対戦は履歴のみ。

## 5. 主要フロー

### ゲーム進行 — [src/domain/engine.ts](src/domain/engine.ts) `KarutaEngine`
- 状態機械（phase: idle → playing → finished）。`start()` で場札選択＆読み順決定、`answer(cardId, playerIndex)` が `'correct'|'miss'|'locked'|'ignored'` を返す。
- **時刻(now)・乱数(random)・players はコンストラクタ注入**（テスト・サーバー移植のため）。
- 複数プレイヤー対応: `players` を渡すと対戦。ミス時、ソロは `penaltyMs` 加算、対戦は当該プレイヤーを `lockedUntil` までロック（札が進むと解除）。勝者は `winnerIndex()`（枚数比較、同数 null）。
- `subscribe(fn)` で状態変化を購読（React とはこの一点で接続、[useGame.ts](src/app/hooks/useGame.ts)）。

### CPU — [src/domain/cpu.ts](src/domain/cpu.ts) + [useCpuPlayer.ts](src/app/hooks/useCpuPlayer.ts)
`planCpuMove(random, level, field, currentId)` が純粋関数で {delayMs, cardId, isMiss} を返し、フックが setTimeout で実行。難易度 easy/normal/hard（反応 1.2〜6 秒、ミス率 5〜25%）。

### 読み上げ — [src/ports/SpeechProvider.ts](src/ports/SpeechProvider.ts)
`CompositeSpeechProvider` が優先順フォールバック: **札の登録音声（AudioFileProvider）→ ブラウザ音声合成（WebSpeechProvider）**。
`speak(card, set, {voiceId, rate, signal})` は再生完了で resolve。AbortSignal で中断。新しい TTS を足すなら SpeechProvider を実装して di.ts の配列に追加するだけ。

### エディタ / ジェネレーター — [src/generator/](src/generator/)
- `renderCard.ts`: `renderEfuda` / `renderYomifuda`（Canvas → PNG dataURL）、`composeEfudaPng`（バッジ合成）、`fileToResizedDataUrl`（アップロード画像を最大 900px に縮小）
- `dummy.ts`: 五十音ダミーセット生成、`fillMissingImages`（未設定画像のみ自動生成、force で全上書き）
- `io.ts`: セット JSON / ZIP（アセット分離）/ PNG 一括 ZIP、札単体 JSON、`downloadBlob` 等

## 6. 拡張ポイント（オンライン化の設計済み経路）

1. `src/adapters/http/HttpCardSetRepository.ts` 等を新規作成し、[ports/CardSetRepository.ts](src/ports/CardSetRepository.ts)（list/get/save/delete）、[ScoreRepository.ts](src/ports/ScoreRepository.ts)（save/list/getBest/clear）を実装
2. [src/app/di.ts](src/app/di.ts) `createServices()` で IndexedDb 実装と差し替え（またはハイブリッドに合成）
3. ランキング API は `ScoreRecord` をそのまま受けて `isRankable` 相当のフィルタ＋`compareScores` で集計すればよい
4. オンライン対戦の権威サーバーは `KarutaEngine` を Node でそのまま実行可能（domain は DOM 非依存）

## 7. 他プロジェクトへの統合パターン

**(a) ロジックのみ流用（推奨・最軽量）**
`src/domain/`（+必要なら `src/generator/`）をコピーか git subtree で取り込む。依存は zod のみ（generator は jszip も）。UI は統合先で自作。

**(b) アプリ丸ごとマウント**
本体は `<ServicesProvider><HashRouter><App/></HashRouter></ServicesProvider>`（[src/main.tsx](src/main.tsx)）。統合先が React なら `App` をサブルートに載せられるが、HashRouter・グローバル CSS（index.css は素の class 名でスコープなし）・IndexedDB 名 `sdkkaruta` の衝突に注意。CSS はプレフィックス化を推奨。

**(c) iframe / 別パス配信**
`npm run build` の dist/ は完全静的・相対パス（`base:'./'`）なので、統合先サイトの任意サブディレクトリに置くだけで動く。最も安全。

## 8. 既知の注意点・ハマりどころ

- **データはブラウザローカル**。端末・ブラウザが変われば空。バックアップは JSON エクスポート。
- **旧形式の焼き込みバッジ**: 2550ca8 以前に自動生成した絵札はバッジが画像に焼き込まれている。エディタの「全画像を再生成」で除去（README にも記載）。
- **React StrictMode の二重マウント**: `useGame` はアンマウント時に `engine.abort()` を呼ばない・同一 engine を二度 `start()` しない設計にしてある（[useGame.ts](src/app/hooks/useGame.ts) コメント参照）。安易に「クリーンアップで abort」を足すと開発モードで即ゲーム終了する。
- **tsconfig `erasableSyntaxOnly`**: constructor parameter properties（`constructor(private x)`）が使えない。明示的フィールド代入で書く。
- **Web Speech API**: 声は OS/ブラウザ依存。`getVoices()` が初回空のことがあり `onvoiceschanged` + タイムアウトで対処済み（WebSpeechProvider）。
- **VOICEVOX 連携は廃止済み**（過去に存在した）。復活させる場合は SpeechProvider 実装を追加する形で。
- 対戦（pvp）は 1 台の画面を上下分割し**同じ場を 2 回描画**している。片方で取った札は両方から消える。上段は `faceToFace` 設定で 180° 回転。

## 9. 未実装・保留中

- **デッキのサーバー公開機能**（検討中のまま保留）。候補:
  - Supabase 無料枠（誰でも公開/閲覧。オーナーの Supabase プロジェクト作成が必要。anon キーはコミット可）
  - リポジトリ同梱方式（`public/decks/` + index.json をアプリが fetch。公開はリポジトリオーナーのみ）
  - どちらも ports 層の追加実装（例: `PublishedDeckRepository`）で対応する想定
- オンラインランキング / オンライン対戦（設計済み・未実装、§6 参照）

## 10. ファイルマップ

| パス | 内容 |
| --- | --- |
| `src/domain/card.ts` | Card/CardSet/KanaBadge スキーマ、validateCardSet、readingTextOf、badgeOf |
| `src/domain/rules.ts` | GameRule スキーマ、PRESET_RULES、resolveCardCount |
| `src/domain/engine.ts` | KarutaEngine（状態機械・複数プレイヤー・formatTime） |
| `src/domain/cpu.ts` | CPU 難易度プロファイルと planCpuMove |
| `src/domain/score.ts` | ScoreRecord、isRankable、compareScores |
| `src/ports/*.ts` | CardSet/Score/Rule リポジトリ + SpeechProvider の各インターフェース |
| `src/adapters/storage/db.ts` | idb 接続（DB 名 `sdkkaruta`、stores: cardSets/scores/rules） |
| `src/adapters/storage/IndexedDb*.ts` | 各リポジトリ実装 |
| `src/adapters/storage/LocalSettings.ts` | AppSettings（モード・CPU 難易度・プレイヤー名・声など） |
| `src/adapters/speech/*` | WebSpeech / AudioFile / Composite / AudioPlayer |
| `src/generator/renderCard.ts` | Canvas 描画（絵札/読み札/バッジ合成/画像縮小） |
| `src/generator/dummy.ts` | ダミーセット生成・fillMissingImages・GOJUON_KEYS |
| `src/generator/io.ts` | JSON/ZIP/PNG 入出力、札単体 JSON、ダウンロードヘルパー |
| `src/app/di.ts` | **Composition Root**（実装差し替えはここ） |
| `src/app/ServicesContext.tsx` | services + settings の React Context |
| `src/app/hooks/useGame.ts` | engine+読み上げ+タイマーの統合フック |
| `src/app/hooks/useCpuPlayer.ts` | CPU の自動打牌 |
| `src/app/pages/*` | Home（セット/モード/ルール選択）/ Play / Result / EditorList / Editor / Rules / Settings |
| `src/app/components/*` | CardGrid（場）/ CardForm（札編集）/ KanaBadge / DeckThumbs / VoicePicker / Layout |
| `src/index.css` | 全スタイル（グローバル class、スコープなし） |
| `samples/sample_mini.json` | 5 枚のサンプルセット |
| `.github/workflows/deploy.yml` | Pages 自動デプロイ（test→build→deploy） |
| `*.test.ts`（domain/adapters/generator） | vitest。`src/test/setup.ts` が fake-indexeddb を注入 |
