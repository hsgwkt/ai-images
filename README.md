# ai-images

ComfyUI をバックエンドにした、AI画像生成用のブラウザ UI です。ワークフローはアプリ側で組み立てず、ComfyUI から書き出した API 形式 JSON に入力を差し込んで使います。ブラウザ上で完結し、設定はブラウザ内（localStorage / OPFS）に保存します。

対象ブラウザは最新の Chrome のみ。画像生成には、手元で起動した ComfyUI（既定 `http://127.0.0.1:8188`）が必要です。

## Prompt 独自仕様

`$名前=値` で変数を定義し、`$名前` で使います。`$it` は直前に定義した変数名の代わりです。

`[a, b, c]` は英語の列挙になります。1件はそのまま、2件は `A and B`、3件以上は `A, B, and C` です。

```
$boy=Akira
$it has black hair.
$it is looking at $girl.
$it wears [white, blue shorts, armband].

$girl=Yuki
$it has brown hair.
```

↓

```
Akira has black hair.
Akira is looking at Yuki.
Akira wears white, blue shorts, and armband.
Yuki has brown hair.
```

## Requirements

- Node.js: `.node-version` を参照
- npm
- 最新の Chrome
- 手元で起動した ComfyUI

## Setup

```sh
npm ci
npm run dev
```

品質確認:

```sh
npm run lint
npm run check
```
