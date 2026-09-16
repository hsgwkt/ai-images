<script module lang="ts">
  const copyProps = [
    // ボックスモデル
    // 'boxSizing',
    // 'width',
    // 'height',
    'padding',
    'border-width',
    'border-style',

    // タイポグラフィ
    'font',
    // 'font-family',
    // 'font-size',
    // 'font-weight',
    // 'font-style',
    // 'font-variant',
    // 'font-stretch',
    // 'line-height',
    'font-size-adjust',

    // テキストレイアウト
    'letter-spacing',
    'word-spacing',
    'text-align',
    'text-indent',
    'text-transform',
    'text-decoration',

    // スクロールバーの挙動
    'overflow',
    'direction',

    // タブ幅
    'tab-size',
    // '-moz-tab-size',
  ]
</script>

<script lang="ts">
  let { caretAnchor, value }: { caretAnchor: string; value: string } = $props()

  const uid = $props.id()

  let refSelf: HTMLElement
  let textareaAnchor = $state('')
  let anchorCount = 0
  let caretPos = $state(0)

  export function sync(textarea: HTMLTextAreaElement) {
    const textareaStyle = window.getComputedStyle(textarea)
    for (const prop of copyProps) {
      refSelf.style.setProperty(prop, textareaStyle.getPropertyValue(prop))
    }

    if (textarea.style.anchorName) {
      textareaAnchor = textarea.style.anchorName
    } else {
      textareaAnchor = `--${uid}-textarea-${anchorCount++}`
      textarea.style.anchorName = textareaAnchor
    }

    caretPos = textarea.selectionStart
    refSelf.scrollTo(textarea.scrollLeft, textarea.scrollTop)
  }
</script>

<div style:position-anchor={textareaAnchor} bind:this={refSelf}>
  {value.substring(0, caretPos)}<span style:anchor-name={caretAnchor}>&ZeroWidthSpace;</span>{value.substring(caretPos)}&ZeroWidthSpace;
</div>

<style>
  div {
    position: absolute;
    top: anchor(top);
    left: anchor(left);
    width: anchor-size(width);
    height: anchor-size(height);
    box-sizing: border-box;
    opacity: 0;
    pointer-events: none;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
</style>
