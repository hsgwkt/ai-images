# ai-images 要件仕様書

AI画像生成を支援するブラウザアプリの要件仕様。

## 1. 概要

- ComfyUI をバックエンドとして、テキストプロンプトから画像を生成する Web UI。
- ワークフローはアプリ側で組み立てず、ユーザーが ComfyUI から「API 形式」で書き出した JSON を登録し、入力値を差し込むべきノード入力（バインディング）を設定して使う。
- プロンプト作成を支援する機能（Danbooru タグ補完、和英翻訳）を持つ。
- 完全にクライアントサイドで動作する（独自サーバー不要）。設定・入力値はすべて `localStorage` に保存する。タグ CSV のような大きいファイルは OPFS に保存する。

### 1.1 基本方針

- 開発者本人が使う私的ツールであり、不特定多数のユーザーへの配布・互換性維持は想定しない。
- 最新技術を積極的に採用する。レガシー環境へのフォロー（ポリフィル、フォールバック実装、古いブラウザ対応、後方互換シム）は原則行わない。
- 実行環境は開発者が使う最新の Chrome 系ブラウザのみを対象とし、実験的・策定中の Web API（Popover / CSS Anchor Positioning / CSS Carousel / Chrome 組み込み AI など）も機能検出なしで直接使用してよい。
- 依存ライブラリ・ランタイムも常に最新メジャーバージョンを前提とする。

### 1.2 変更するとき

- 詳細仕様・内部メモを変えたら **このファイルを更新する**
- 詳細未定なら **先に要件を質問確認してから着手**
- 自己判断したなら **先に内容を共有確認してから着手**

## 2. 技術スタック・動作環境

| 項目           | 内容                                                                                                                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| フレームワーク | SvelteKit / Svelte 5（runes モード強制、`experimental.async: true`）                                                                                                                                       |
| ビルド         | Vite / `@sveltejs/adapter-static`（GitHub Pages。`BASE_PATH` で `paths.base`）。CSS minify は Lightning CSS。`light-dark()` はポリフィルせず `css.lightningcss.exclude` で `Features.LightDark` を除外する |
| 言語           | TypeScript                                                                                                                                                                                                 |
| バリデーション | Zod v4                                                                                                                                                                                                     |
| ComfyUI API    | `openapi-fetch` + Comfy-Org 公開の OpenAPI 定義（`openapi-cloud.yaml`）から生成した型                                                                                                                      |
| Node.js        | v24（`.node-version`）                                                                                                                                                                                     |
| 対象ブラウザ   | 最新 Chrome 前提。以下の新しめの API を使用する                                                                                                                                                            |

前提とするブラウザ API:

- Popover API（`popover` 属性、`command`/`commandfor` によるインボーカー）
- CSS Anchor Positioning（`anchor-name` / `position-anchor` / `position-area` / `position-try-fallbacks`）
- CSS Carousel（`::scroll-button()`、`container-type: scroll-state`）
- Chrome 組み込み AI（`Translator`。型は `@types/dom-chromium-ai`）
- `Promise.withResolvers`、`using`（Explicit Resource Management）、`Object.groupBy`
- OPFS（`navigator.storage.getDirectory()` + `FileSystemFileHandle.createWritable()`）
- WebSocket、Web Worker、Fullscreen API

レンダリング方針:

- SSR 無効（`+layout.ts` で `export const ssr = false`）。全ページクライアント実行。静的出力のため `prerender = true`。GitHub Pages 用に `fallback: '404.html'`。

## 3. 状態管理・永続化

### 3.1 localStorage ステート

`createLocalStorageState(key, zodSchema)` ユーティリティを実装する。

- 初期化時に `localStorage.getItem(key)` を JSON パースし、Zod スキーマの `parse` に通して `$state` として保持する（パース失敗・不正値はスキーマの `catch` でデフォルト値に落ちる）。
- ルートレイアウト初期化時に `$effect` を登録し、ステート変更を検知したら `queueMicrotask` でデバウンスして `JSON.stringify` した値を `localStorage.setItem` する。
- `state` の getter/setter に加え、`import(value)`（スキーマ検証して置換）と `export()`（`$state.snapshot`）を提供する。

### 3.2 安全スキーマヘルパ

すべての永続化スキーマは「壊れたデータでも例外を出さずデフォルトに回復する」ことを要件とする。次のヘルパを用意する。

- `safeObject(shape)`: 値がプレーンオブジェクトでなければ `{}` に前処理してから `z.object`。
- `safeArray(element)`: 配列でなければ `[]` に前処理してから `z.array`。
- `safeRecord(key, value)`: プレーンオブジェクトでなければ `{}` に前処理してから `z.record`。
- 各フィールドには `.catch(デフォルト値)` を必ず付ける。

### 3.3 永続化データ一覧（localStorage キー）

| キー                         | 内容                                                       |
| ---------------------------- | ---------------------------------------------------------- |
| `ai-images:api-config`       | `{ comfyui: ComfyuiConfig }`                               |
| `ai-images:tag-config`       | タグ CSV のファイル名（実体は OPFS）とカスタムタグ（§5.5） |
| `ai-images:workflows`        | 登録済みワークフロー（JSON + バインディング）の Record     |
| `ai-images:gen-image-inputs` | 画像生成フォームの入力値一式                               |

スキーマ詳細:

```ts
// api-config
comfyui: {
  clientId: string  // catch: crypto.randomUUID()
  baseUrl: string   // catch: ''（空なら 'http://127.0.0.1:8188' を使用）
}

// tag-config（CSV のファイル名は表示用。実体は OPFS の tags.csv / tag-translations.csv。カスタムタグは localStorage）
{
  tagsCsv: string             // catch: ''
  tagTranslationsCsv: string  // catch: ''
  customTags: string          // 1行1タグ（追加分）。catch: ''
}

// workflows（キーは w1, w2, … 連番）
Record<string, {
  name: string  // catch: ''
  json: string  // ComfyUI API 形式のワークフロー JSON 文字列。catch: ''
  bindings: {
    // 入力値の差し込み先。nodeId / property のいずれかが空なら「未使用」で何もしない
    checkpoint: { nodeId: string; property: string }
    width: { nodeId: string; property: string }
    height: { nodeId: string; property: string }
    positivePrompt: { nodeId: string; property: string }
    negativePrompt: { nodeId: string; property: string }
    seed: { nodeId: string; property: string }
    steps: { nodeId: string; property: string }
    // LoRA ノードのテンプレート。property 名を個別に指定する
    lora: { nodeId: string; name: string; strengthModel: string; strengthClip: string }
  }
}>

// gen-image-inputs
{
  workflowId: string        // 使用するワークフローのキー。catch: ''
  checkpoint: string        // ComfyUI 上のモデル名（拡張子付き）。catch: 'example.safetensors'
  loras: string[]           // ON の filePath（ComfyUI 上の名前、拡張子付き）。catch: []
  loraSettings: Record<string, {
    strength: number        // min 0, catch: 1
    triggerWord: number[]   // 有効な trainedWords グループのインデックス。catch: [0]
  }>                        // ポップオーバーで触った LoRA だけ。未登録は strength 1 / triggerWord [0]
  positivePrompt: string    // catch: ''
  negativePrompt: string    // catch: ''
  randomSeed: boolean       // catch: true
  seed: number              // int >= 0, catch: 0
  baseSize: '1024' | '1280' | '1536'          // catch: '1024'
  aspectRatio: '9:16' | '2:3' | '1:1' | '3:2' | '16:9' // catch: '2:3'
  steps: '1/3' | '2/3' | '1' | '1.5' | '2'    // catch: '1'
}
```

## 4. 画面構成

### 4.1 共通レイアウト

- ヘッダー: 「API設定」「ワークフロー設定」「タグ設定」の 3 ボタン。各ボタンは `command="show-modal"` で対応する `<dialog>` を開く。
- メイン: 中央寄せ（幅 `min(100rem, 100vw)`）。メイン画面は 2 カラムグリッド（`2fr 1fr`）。
- フッター: 空（レイアウト枠のみ）。
- トーストホストと各ダイアログはレイアウト直下に常駐。
- グローバル CSS はリセット + レイアウト + フォーム/ダイアログ/トーストの見た目のみ（ユーティリティクラスなし、`@scope` を活用）。

### 4.2 メイン画面（画像生成）

2 カラム構成:

1. **左カラム（生成・プロンプト）**:
   - ヘッダー行: 実行中メッセージ（進捗）、`Generate` ボタン（生成中は disabled）、`Repeat` チェックボックス。
   - 画像カルーセル: 生成画像の横スクロールリスト。
   - 生成フォーム: Workflow セレクト（登録済みワークフロー） / Checkpoint セレクト（ComfyUI から取得したリスト。表示は拡張子なし） / Prompt (Positive) 見出し横に翻訳ボタン + タグ補完付き textarea（3 行） / Prompt (Negative) 同上（1 行） / Base Size・Aspect Ratio・Steps のセレクト（グリッド配置） / Seed 数値入力 + Random チェックボックス。
2. **右カラム（Lora）**: ComfyUI から取得した全件を、ディレクトリごとに区切ったタイル一覧として常時表示。

### 4.3 キーボードショートカット（グローバル）

- `Ctrl+Enter`: フォーカス位置のフォームを submit。フォーム外なら画像生成を実行。
- `Escape`: ダイアログ外で押した場合、Repeat モードを解除。

## 5. 機能要件

### 5.1 画像生成（ComfyUI 連携）

生成リクエストと状況監視を分離する。

**常時 WebSocket**（マウント時に接続、アンマウント時に切断）:

- `WS {ws(s)://baseUrl}/ws?clientId={clientId}` を常時接続する。`open` 直後に `{ type: 'feature_flags', data: { supports_preview_metadata: true } }` を送り、メタデータ付きプレビュー画像を有効にする。
- `type: 'progress'` → `data.value / data.max` を百分率で「Executing {ノード名}... {n}%」と表示。ノード名は送信したワークフローの該当ノードの `_meta.title` または `class_type`（不明なら `Node #{nodeId}`）。
- `type: 'executing'`:
  - `data.node` がある → 進捗メッセージを更新。
  - `data.node === null` → そのプロンプト完了として扱い、完了トースト「done」を表示（Repeat 時は次の生成を開始）。
- `type: 'executed'` → `data.output.images[]`（`filename` / `subfolder` / `type`）を `{baseUrl}/api/view?filename=…&type=…[&subfolder=…]` の URL に組み立てて画像として通知する（`SaveImage` などディスク保存系ノードの出力）。
- バイナリフレーム: 先頭 4 バイト（big-endian）が event type。
  - `1 = PREVIEW_IMAGE`: 続く 4 バイトが image format（`1=JPEG` / `2=PNG`）、以降が画像本体。メタデータがないため `promptId` / `nodeId` は `null`。
  - `4 = PREVIEW_IMAGE_WITH_METADATA`: 続く 4 バイトがメタデータ JSON のバイト長。JSON は `{ node_id?, prompt_id?, image_type? }` で、以降が画像本体（MIME は `image_type`）。
- `type: 'execution_error'` → `data.exception_message` を持つ Error として扱う（グローバルハンドラでトースト表示）。

画像ハンドラは `{ image: Blob | string, promptId, nodeId }` を受け取る。カルーセルには受信した画像を先頭に追加する（最大 16 件、同一参照は無視）。`nodeId` が不明な画像（メタデータなしのプレビュー）は採用しない。

**生成リクエスト**（Generate / Ctrl+Enter）:

1. 選択中ワークフローの JSON に入力値を適用する（§5.2）。
2. `POST {baseUrl}/api/prompt` に `{ prompt: workflow, client_id }` を送信し `prompt_id` を得る（待ち受けはしない。画像・進捗は常時 WS 側で処理）。
3. 適用したワークフローを `prompt_id` をキーに控えておき、進捗メッセージのノード名解決に使う。完了・エラー時にそのキーを削除する。
4. 進捗の `promptId` が控えに無い場合（起動時に実行中の生成がある場合など）は `GET /api/queue` から該当プロンプトのワークフロー JSON を取得して控えに入れる。見つからなければノード名は `Node #{nodeId}` のまま。

補足挙動:

- **Repeat モード**: ON の間、生成完了（`executing` の `node === null`）ごとに `queueMicrotask` で次の生成を自動開始する。生成中に再度 `generateImage` を呼ぶと（例: Ctrl+Enter。Generate ボタンは生成中 disabled）Repeat モードに入る。
- 接続前に投入されたジョブについて、進捗イベントからワークフロー JSON をキュー API で補完する（ノード名表示用）。過去画像の復元は行わない。
- エラーレスポンスは `{ error: { message } }` 形式を想定してメッセージを取り出し、例外として投げる（グローバルハンドラでトースト表示される）。

### 5.2 ワークフローへの入力値適用

アプリはノードグラフを組み立てない。登録済みワークフローの JSON をパースし、バインディングで指定されたノード入力を上書きしたものを ComfyUI に投げる。

- ワークフロー JSON は `Record<nodeId, { class_type, inputs?, _meta? }>`（ComfyUI API 形式）としてスキーマ検証する。
- `nodeId` / `property` のどちらかが空のバインディングは「未使用」として何もしない。バインド先ノードが存在しない場合はエラー。
- ノード入力のうち `[nodeId, outputIndex]` 形式のタプルはノード間リンクとして扱い、プロパティ選択の候補からは除外する。

**steps 決定**: UI は倍率 `×1/3` / `×2/3` / `×1` / `×1.5` / `×2`。ワークフロー JSON に元から入っている steps 値に掛けて `floor`（最小 1）。元 steps を `×1` として扱う。セレクトのラベルは `×1 (40)` のように実ステップ数を括弧で出す（元 steps が取れないときは倍率のみ）。旧値 `fast` / `medium` / `high` は `catch` で `1` に落ちる。

**画像サイズ計算**: `baseSize²` を総ピクセル数とし、アスペクト比に合わせて `width = sqrt(pixels × ratio)`、`height = width / ratio`。それぞれ 64 の倍数に切り捨て。

**シード**: Random ON なら生成のたびに `floor(random × MAX_SAFE_INTEGER)` を入力値に書き戻す（UI に反映される）。

**LoRA の適用**（`lora` バインディングのノードをテンプレートとして使う）:

- 有効 LoRA が 0 件 → テンプレートノードをバイパスする（入力リンクを消費側の該当入力に繋ぎ替えてノードを削除）。
- 1 件目はテンプレートノード自身に `name` / `strengthModel` / `strengthClip` の各プロパティを設定する。
- 2 件目以降はテンプレートのスナップショットを `structuredClone` して追加し、入力リンクを直前の LoRA ノードへ繋ぎ替える。新しいノード ID は既存の数値 ID の最大値 + 1。
- 元のテンプレートノードを参照していた消費側リンクは、最後に追加した LoRA ノードへ繋ぎ替える。
- `strengthClip` は未指定なら `strengthModel` と同値。負値は 0 に丸める。

**最終プロンプトの合成**（ワークフロー JSON に元から入っている値を接頭辞として使う）:

- positive = 元の positive + 有効 LoRA の選択グループのトリガーワード + 入力 positive
- negative = 元の negative + 入力 negative
- いずれも空要素を除いて改行で連結したあと、`expandPrompt` でコメント削除・変数・join を展開する（§5.13）。

### 5.3 モデル一覧の取得

ComfyUI 本体の API から一覧を取得し、トリガーワードのみ LoRA Manager 拡張から補う。

- `GET {baseUrl}/api/experiment/models/{folder}` → `[{ name, pathIndex, modified }]`。
  - checkpoint 一覧は `checkpoints` と `diffusion_models` の両方を取得して結合する。
  - LoRA 一覧は `loras`。
- `modified` の降順（新しい順）に並べる。
- 各アイテムから `Model` を構成する。
  - `filePath`: `name` の `\` を `/` に正規化したもの（ComfyUI 上の名前。拡張子を含む）
  - `fileName`: `filePath` の最終セグメント、`folder`: それ以外のディレクトリ部
  - `previewUrl`: `{baseUrl}/api/experiment/models/preview/{folder}/{pathIndex}/{filePath}`（パスはセグメントごとに `encodeURIComponent`）
  - `triggerWords`: 初期値は空配列
- LoRA のみ、LoRA Manager 拡張から `civitai.trainedWords` を取得して拡張子を除いた `filePath` をキーにマージする。拡張が無い環境でも動くよう、この取得の失敗は握り潰す。
- ベースモデルによる絞り込みや checkpoint 切り替え時の LoRA 自動除去は行わない（どのモデルと組み合わせるかはワークフローとユーザーの責任）。
- `checkpoint` / LoRA の `filePath` は ComfyUI 上の名前をそのままワークフローに渡す（拡張子の付与・除去はしない）。UI 表示のみ拡張子を落とす。

### 5.4 LoRA 設定 UI

ComfyUI の LoRA 全件を常時表示する。追加ポップオーバーや選択済みの別リストは持たない。

- **グループ**: フォルダごとに区切る（フォルダ名昇順。空フォルダ名の見出しは出さない）。区切り内の並びは ComfyUI の取得順（`modified` 降順）。
- **タイル**: プレビュー画像（なければ blank 画像）+ ファイル名（1 行省略、本体に `title` で全文）。生成に使う ON/OFF はタイル本体クリック。ON 時は枠に加えて、強度・トリガー件数・名前のオーバーレイも `highlight` で色付ける。
  - 通常クリック: そのフォルダ内ではその 1 件だけ ON。すでに ON なら OFF。他フォルダの選択は維持。
  - Ctrl / Shift クリック: その 1 件だけの ON/OFF。複数選択できる。
- **重み**: 左上に強度を表示（未設定は `1`）。クリックで強度ポップオーバーを開く（`command="toggle-popover"` + CSS Anchor）。数値入力（step 0.1）。
- **トリガー**: 右上にトリガーグループ数を `🏷️` 付きで右揃え表示（例: `🏷️3`）。0 件ならバッジもポップオーバーも出さない。クリックでトリガーワードのみのポップオーバーを開く（`command="toggle-popover"` + CSS Anchor）。civitai の `trainedWords` 各エントリを 1 グループとし、グループ単位のオンオフのみ。未設定時は先頭グループだけ ON（インデックス `[0]`）。文字列の分割は括弧の深さを考慮したカンマ分割（重複排除）で、適用時にワードへ展開する。
- **永続化**: 選択は `loras`（ON の filePath 集合）。重み・トリガーは `loraSettings`（ポップオーバーで触った filePath だけ）。OFF にしても設定は残す。未登録は OFF・重み `1`・トリガー `[0]`。
- **適用順**: 表示と同じ（フォルダ名昇順 → 区切り内は ComfyUI の並び）。

### 5.5 プロンプト入力支援（タグ補完 textarea）

再利用可能な `PromptTextarea` コンポーネントとして実装する。

**タグデータ**:

- CSV はアプリに同梱せず、タグ設定ダイアログ（§5.10）でユーザーが選んだファイルを OPFS に保存して使う。ファイル名は固定（`tags.csv` / `tag-translations.csv`）で、元のファイル名は表示用に `ai-images:tag-config` へ保持する。
- タグ CSV は `name,type,count,aliases` 形式（type 数値 0/1/3/4/5 を `general` / `artist` / `copyright` / `character` / `meta` にマップ）、日本語訳 CSV は `tagName,"訳1,訳2,…"` 形式。
- Web Worker が OPFS から 2 ファイルを読んでパースし、使用回数の降順でソートしたタグ配列をメインスレッドへ送る（起動時 + `reloadTags()` 時）。タグ CSV が未設定なら CSV 由来は空配列（訳 CSV は任意）。
- 補完の先頭に常に載せる内蔵タグ: `$it is [].` / `$it has [].` / `$it wears [].` / `$it [].` / `$it's [].`。設定には出さない。
- カスタムタグは `ai-images:tag-config` の `customTags`（1行1タグ、空行は無視、重複は先勝ち）。Worker は使わず、内蔵タグの直後・CSV タグの前へ `type: 'custom'` として差し込む。CSV 未設定でも補完に出る。
- タグは `{ name, type（上記文字列または custom）, count, displayCount（Intl compact表記。カスタムは空）, aliases, translations }`。
- OPFS 操作は `writeFile` / `readFile` / `readTextFile`（ファイル名指定）のユーティリティに集約する。

**補完動作**:

- 文字入力（`insertText`）とサジェスト表示中の Backspace で 100ms デバウンスして検索。`Ctrl+Space` で手動起動。IME 確定（`compositionend`）でも起動。
- 検索語はカーソル位置から行内の直前のカンマ・`(`・`)`・`[`・`]` までの文字列。空白を `_` にしたものと、空白つきの原文の両方で部分一致する（カスタムタグの空白を残すため）。
- タグ名 → エイリアス → 日本語訳の順に部分一致検索し、最大 100 件。内蔵タグ → カスタムタグ（登録順）→ CSV の順。エイリアス/訳ヒット時は「→ 正式タグ名」を表示。マッチ箇所は強調。タグ種別で色分けし、使用回数を右端に表示（カスタムは回数なし）。
- サジェストはポップオーバーで、入力しはじめた検索語の先頭（1 文字目の左端）にアンカーして表示する。表示中は追従しない（`beforeinput` 時点の位置を固定）。ポップオーバー非表示時のみ `DummyTextarea.sync()` を呼ぶ。
- caret アンカー取得は `DummyTextarea` コンポーネント（`PromptTextarea` から `<DummyTextarea>` を配置）。textarea 自身を CSS Anchor の基準（`anchor-name`）とし、不可視ダミーは `position-anchor` + `anchor(top/left)` + `anchor-size(width/height)` で textarea に重ねる（ダミーは `box-sizing: border-box`。`anchor-size()` は常にアンカーの border box）。折り返し一致のため `getComputedStyle(textarea)` から必要なプロパティを `setProperty` でコピーし、検索語先頭位置に marker span（`anchor-name`）を置く。
- `↑/↓` で選択移動（`scrollIntoView`）、`Enter`/`Tab` で確定。確定するとタグ名 + `,` を検索語と置換し、undo 履歴を保つため `document.execCommand('insertText')` を使う。カスタムタグは末尾の `,` を付けない。挿入文字列に `[]` があればキャレットを括弧内に置く。

**編集ショートカット**（サジェスト非表示時）:

- `Ctrl+↑` / `Ctrl+↓`: カーソル位置（または選択範囲）のタグの重みを ±0.1。`(tag:1.2)` 形式を増減し、1.0 になったら括弧を外す。未指定は 1.0、`(tag)` は 1.1 として扱う。選択範囲がなければ行内の `(...)` またはカンマ区切りの語を対象範囲として自動判定。
- `Ctrl+/`: カーソル行（または選択範囲の行）の `// ` コメントをトグル。選択位置を維持。

**公開メソッド**: `setText(text, newLine?)`（選択位置に挿入、`newLine` 時は前後に改行を補う）、`replaceOrInsert(previous, text)`（`previous` が本文にあればその箇所を置換、なければ `setText(text, true)`）、`getText()`（選択文字列取得）、`focus()`。

### 5.6 翻訳

Prompt (Positive) 見出しの横に「翻訳」ボタン。`Translator` が無い、または ja→en の `availability` が `unavailable` のときは出さない（`downloadable` / `downloading` / `available` なら出す）。`command="toggle-popover"` + CSS Anchor でポップオーバーを開く。下書きは永続化しない。

- 「入力（日本語）」と「翻訳（英語）」（読み取り専用）。入力は 300ms デバウンスで `translateJaEn` し、空なら結果も空。
- 開いたとき入力欄にフォーカスする。
- 「コピー」で翻訳結果をクリップボードへ。空なら disabled。成功したら status トースト「コピーしました」。

Chrome 組み込み `Translator` を使う。インスタンスはモジュールレベルでキャッシュ（遅延生成 1 回）。

- `isJaEnAvailable()`: `Translator` が無い／例外／ja→en が `unavailable` なら `false`。結果は Promise をキャッシュする。
- `translateJaEn(text)`: `Translator.create({ sourceLanguage: 'ja', targetLanguage: 'en' })`
- `translateEnJa(text)`: 逆方向

### 5.9 画像カルーセル

- 入力は `(Blob | string)[]`。`Blob` は `{@attach}` で `URL.createObjectURL` した URL を `<img>` に設定し、要素破棄時に `revokeObjectURL` する。`string` は URL としてそのまま設定する（`/api/view` の URL）。keyed each のキーは要素そのもの。
- 高さ 16rem（`resize: vertical` で可変）、横スクロール + `scroll-snap`。CSS `::scroll-button()` で左右ボタンを表示（アンカー配置、無効時非表示）。
- ダブルクリックでフルスクリーン切替。フルスクリーン時は画像を `100vw` で表示し、ダブルクリックした画像へスクロール。Repeat モード中かつフルスクリーン時は背景色でハイライトし、フルスクリーン中も左上に進捗メッセージをオーバーレイ表示する。

### 5.10 設定ダイアログ

共通仕様: `<dialog>` + `method="dialog"` フォーム。開くとき現在値のスナップショットを draft にコピーし、「保存」でスキーマ検証して反映、「キャンセル」「×」で破棄。

- **API設定**: ComfyUI URL（プレースホルダー `http://127.0.0.1:8188`）。LoRA のトリガーワードは [ComfyUI-Lora-Manager](https://github.com/willmiao/ComfyUI-Lora-Manager) の API から取得する旨の注記を表示する（拡張が無い環境でも動作はする）。
- **ワークフロー設定**: 左に登録済みワークフローのリストボックス + 「追加」「削除」、右に選択中ワークフローの詳細。
  - ワークフロー ID は `w1, w2, …` 連番。追加時の名前は `ワークフロー{id}`。
  - 名前 / ワークフロー JSON（textarea + 「ファイルを開く」でローカル JSON を読み込み、「整形」で `JSON.stringify(…, null, 2)`）。
  - 各バインディングは「ノード」「プロパティ」の 2 段セレクト。ノードの選択肢は `{nodeId}: {_meta.title (class_type)}`、プロパティの選択肢は当該ノードの `inputs` のうちリンク（配列）でないものだけ。LoRA はノード + 3 プロパティ（name / strength model / strength clip）を個別に選ぶ。
  - 保存時に全ワークフローの JSON を検証し、不正ならそのワークフローを選択してエラーメッセージ（「JSONが不正です」/「ワークフローが不正です」）を表示し、ダイアログを閉じない。
- **タグ設定**: タグ CSV / タグ翻訳 CSV それぞれに「選択」（ファイルピッカーでファイルを保持し、名前を draft に反映）と「取り出す」（OPFS の内容を元のファイル名でダウンロード）。加えてカスタムタグの textarea（1行1タグ。内蔵の `$it … [].` は含めない）。保存時に選択済みファイルを OPFS へ書き込み、`customTags` を反映し、`reloadTags()` で CSV タグを再読込する。

### 5.12 トースト通知・エラー処理

- トーストは `popover="manual"` 要素として画面上部中央にスタック表示（各要素の実測高さ + 8px で縦にオフセット）。最大 5 件、超過分は古いものから破棄。
- 種別は `status`（2 秒で自動消滅）と `alert`（赤枠、手動クローズ）。空メッセージは表示しない。
- `window` の `error` / `unhandledrejection` をグローバルに捕捉して alert トーストにする。`AbortError` は無視。`Error` は `message`、その他は文字列化（空なら「(メッセージなし)」）。
- 非同期処理（画像生成、翻訳等）は基本的に例外をグローバルハンドラに任せてよい。

### 5.13 プロンプト書式（変数・join）

ComfyUI に投げる直前、連結後の positive / negative に `expandPrompt` を適用する。textarea 上の原文は変えない。

処理順:

1. コメント削除（`/* */` と行頭 `//`。変数・join はコメントを見ない）
2. 行頭の `$name=値`（値は行末まで、trim）を覚えつつ定義行を削除。同じ名前は後勝ち。同時に `$it` を直近の定義名（`$boy` など）に置換。`$it=` も通常の定義として扱う
3. 残った `$name` を値に置換（未定義はそのまま）。名前は `\w+`
4. 最も内側の `[…]` から join。深さ 0 のカンマで分割し `A` / `A and B` / `A, B, and C`（文末ピリオドは付けない）

```
$boy=Akira
$it has black hair.
$it is looking at $girl.
$it wears [white, blue shorts, armband].

$girl=Yuki
$it has brown hair.
```

→ `Akira has black hair.` / `Akira is looking at Yuki.` / `Akira wears white, blue shorts, and armband.` / `Yuki has brown hair.`

## 6. 外部 API 仕様（依存先）

### 6.1 ComfyUI 本体

- `POST /api/prompt` body `{ prompt: Workflow, client_id }` → `{ prompt_id }`
- `GET /api/queue` → `{ queue_running, queue_pending }`。各要素は `[job_number, prompt_id, workflow, extra_data, output_node_ids]`
- `WS /ws?clientId=`
  - 送信: `{ type: 'feature_flags', data: { supports_preview_metadata: true } }`（接続直後）
  - 受信 JSON: `{ type: 'progress' | 'executing' | 'executed' | 'execution_error', data: … }`
  - 受信バイナリ: 4 バイトの event type + 種別ごとのヘッダ + 画像（§5.1）
- `GET /api/view?filename=&subfolder=&type=` → 生成済み画像
- `GET /api/experiment/models/{folder}` → `[{ name, pathIndex, modified }]`
- `GET /api/experiment/models/preview/{folder}/{pathIndex}/{path}` → プレビュー画像

型は Comfy-Org の `openapi-cloud.yaml` から `openapi-typescript` で生成する（npm script `gen:comfyui_openapi`）。OpenAPI 定義に無いエンドポイントは Zod で個別に検証する。

### 6.2 ComfyUI LoRA Manager 拡張（任意）

- `GET /api/lm/loras/list?page={n}&page_size=100&sort_by=date:desc&recursive=true&tag_logic=any` → `{ items: [{ folder, file_name, civitai: { trainedWords? } }], total_pages }`
- `total_pages` に従い全ページ取得する。用途は `trainedWords`（トリガーワード）の補完のみで、拡張が無い環境でも動作すること。

## 7. 開発・品質・CI

- コミットメッセージと Pull Request（タイトル・本文）は日本語で書く。
- npm scripts: `dev` / `build` / `preview` / `check`（svelte-check）/ `check:watch` / `lint`（prettier --check + eslint）/ `format` / `gen:comfyui_openapi` / `update`（npm-check-updates）。
- Prettier + ESLint（typescript-eslint, eslint-plugin-svelte, eslint-config-prettier）。
- GitHub Actions（push/PR to main）: `npm ci` → `npm run lint` と `npm run check` を並列ジョブで実行。
- GitHub Pages: `main` への push（または `workflow_dispatch`）で `deploy.yml` が `BASE_PATH=/<repo>` 付きで `npm run build` し、Pages に公開する。リポジトリの Pages ソースは GitHub Actions。
- Vite: `css.lightningcss.exclude` で `Features.LightDark` を指定し、`light-dark()` の下位変換を無効化。dev サーバーは `.trycloudflare.com` を `allowedHosts` に許可（トンネル経由の動作確認用）。

## 8. アセット

- `blank.png`: プレビュー画像がないモデル用のプレースホルダー。
- `favicon.svg`。
