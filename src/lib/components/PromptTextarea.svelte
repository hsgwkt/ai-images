<script lang="ts">
  import { tick } from 'svelte'

  import type { FindResult, Tag } from '$lib/tags'
  import { findTags } from '$lib/tags'

  import DummyTextarea from './DummyTextarea.svelte'

  let { id, value = $bindable(''), rows, disabled = false }: { id?: string; value?: string; rows?: number; disabled?: boolean } = $props()

  const uid = $props.id()

  let refTextarea: HTMLTextAreaElement
  let refSuggest: HTMLDivElement
  let refResults: HTMLButtonElement[] = $state([])
  let refDummy: DummyTextarea

  let results: readonly FindResult[] = $state([])
  let selectedIndex: number = $state(0)

  function isPopoverOpen() {
    return refSuggest.matches(':popover-open')
  }

  function handleBeforeInput(event: InputEvent) {
    if (event.inputType === 'insertText' || (event.inputType === 'deleteContentBackward' && isPopoverOpen())) {
      debounceShowSuggest()
    }
  }

  async function handleKeyDown(event: KeyboardEvent) {
    if (isPopoverOpen()) {
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        selectTag(results[selectedIndex].tag)
        refSuggest.hidePopover()
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        selectedIndex = Math.min(selectedIndex + 1, results.length - 1)
        refResults[selectedIndex].scrollIntoView({ block: 'nearest' })
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        selectedIndex = Math.max(selectedIndex - 1, 0)
        refResults[selectedIndex].scrollIntoView({ block: 'nearest' })
      }
    } else {
      if (event.key === ' ' && event.ctrlKey) {
        event.preventDefault()
        debounceShowSuggest()
      }

      if (event.key === 'ArrowDown' && event.ctrlKey) {
        event.preventDefault()
        let start = refTextarea.selectionStart
        let end = refTextarea.selectionEnd
        if (start === end) [start, end] = getWeightRange(start)
        if (start === end) return
        const newWeight = changeWeight(value.substring(start, end), -0.1)
        insertText(start, end, newWeight)
        await tick()
        refTextarea.setSelectionRange(start, start + newWeight.length)
      }

      if (event.key === 'ArrowUp' && event.ctrlKey) {
        event.preventDefault()
        let start = refTextarea.selectionStart
        let end = refTextarea.selectionEnd
        if (start === end) [start, end] = getWeightRange(start)
        if (start === end) return
        const newWeight = changeWeight(value.substring(start, end), 0.1)
        insertText(start, end, newWeight)
        await tick()
        refTextarea.setSelectionRange(start, start + newWeight.length)
      }

      if (event.key === '/' && event.ctrlKey) {
        event.preventDefault()

        const startEdge = value.lastIndexOf('\n', refTextarea.selectionStart - 1) + 1
        let endEdge = value.indexOf('\n', refTextarea.selectionEnd)
        if (endEdge < 0) endEdge = value.length

        let newStart = refTextarea.selectionStart
        let newEnd = refTextarea.selectionEnd

        let lines = value.substring(startEdge, endEdge).split('\n')
        if (lines.every((line) => line.startsWith('// '))) {
          lines = lines.map((line) => line.substring(3))
          const startColumnIndex = refTextarea.selectionStart - (value.lastIndexOf('\n', refTextarea.selectionStart - 1) + 1)
          const endColumnIndex = refTextarea.selectionEnd - (value.lastIndexOf('\n', refTextarea.selectionEnd - 1) + 1)
          newStart -= Math.min(startColumnIndex, 3)
          newEnd -= (lines.length - 1) * 3 + Math.min(endColumnIndex, 3)
        } else {
          lines = lines.map((line) => `// ${line}`)
          newStart += 3
          newEnd += lines.length * 3
        }
        insertText(startEdge, endEdge, lines.join('\n'))
        await tick()
        refTextarea.setSelectionRange(newStart, newEnd)
      }
    }
  }

  let suggestTimerId = 0

  function debounceShowSuggest() {
    if (!isPopoverOpen()) {
      refDummy.sync(refTextarea)
    }
    window.clearTimeout(suggestTimerId)
    suggestTimerId = window.setTimeout(showSuggest, 100)
  }

  function showSuggest() {
    const currentPos = refTextarea.selectionStart
    const query = value.substring(searchWordStart(currentPos), currentPos)
    results = findTags(query)
    if (results.length > 0) {
      selectedIndex = 0
      refSuggest.showPopover()
      refSuggest.scrollTop = 0
    } else {
      refSuggest.hidePopover()
    }
  }

  function searchWordStart(pos: number) {
    const beforeLine = value.substring(0, pos).split(/\n/).pop() ?? ''
    const beforeWord = beforeLine.match(/[^,()[\]]*$/)?.[0]?.trimStart() ?? ''
    return pos - beforeWord.length
  }

  function getWeightRange(pos: number) {
    const beforeLine = value.substring(0, pos).split(/\n/).pop() ?? ''
    const afterLine = value.substring(pos).split(/\r?\n/).shift() ?? ''

    const start = beforeLine.lastIndexOf('(')
    const end = afterLine.indexOf(')')
    if (start >= 0 && end >= 0) return [pos - (beforeLine.length - start), pos + end + 1]

    const beforeWord = beforeLine.match(/[^,]*$/)?.[0]?.trimStart() ?? ''
    const afterWord = afterLine.match(/^[^,]*/)?.[0]?.trimEnd() ?? ''
    return [pos - beforeWord.length, pos + afterWord.length]
  }

  function changeWeight(text: string, addWeight: number) {
    const m = text.match(/^\((.*?)(?::(\d+(?:\.\d+)?)?)?\)$/)
    const content = m?.[1] ?? text
    const weight = m ? parseFloat(m[2] ?? '1.1') : 1
    const newWeight = Math.round((weight + addWeight) * 10) / 10
    return newWeight === 1 ? content : `(${content}:${newWeight})`
  }

  async function selectTag(tag: Tag) {
    let tagName = tag.name
    if (tag.type !== 'custom') {
      tagName = tagName.replaceAll('_', ' ').replaceAll(/[()]/g, '\\$&')
      if (tag.type === 'artist') tagName = `@${tagName}`
      tagName += ','
    }
    const start = searchWordStart(refTextarea.selectionStart)
    insertText(start, refTextarea.selectionEnd, tagName)
    await tick()
    const placeholder = tagName.indexOf('[]')
    const caret = placeholder >= 0 ? start + placeholder + 1 : start + tagName.length
    refTextarea.setSelectionRange(caret, caret)
  }

  function insertText(start: number, end: number, text: string) {
    // const before = value.substring(0, start)
    // const after = value.substring(end)
    // value = before + text + after
    refTextarea.focus()
    refTextarea.setSelectionRange(start, end)
    document.execCommand('insertText', false, text)
  }

  export function setText(text: string, newLine = false) {
    const start = refTextarea.selectionStart
    const end = refTextarea.selectionEnd
    if (newLine) {
      if (start > 0 && value[start - 1] !== '\n' && !text.startsWith('\n')) {
        text = `\n${text}`
      }
      if (end < value.length && value[end] !== '\n' && !text.endsWith('\n')) {
        text = `${text}\n`
      }
    }
    insertText(start, end, text)
  }

  export function replaceOrInsert(previous: string, text: string) {
    if (previous && value.includes(previous)) {
      const start = value.indexOf(previous)
      insertText(start, start + previous.length, text)
      return
    }
    setText(text, true)
  }

  export function getText(): string {
    return value.substring(refTextarea.selectionStart, refTextarea.selectionEnd)
  }

  export function focus() {
    refTextarea.focus()
  }
</script>

<textarea
  {id}
  bind:value
  autocomplete="off"
  spellcheck="false"
  {rows}
  onbeforeinput={handleBeforeInput}
  oncompositionend={debounceShowSuggest}
  onkeydown={handleKeyDown}
  {disabled}
  bind:this={refTextarea}
  style:min-height="{rows}lh"></textarea>

<DummyTextarea caretAnchor="--{uid}-caret" {value} bind:this={refDummy} />

<div class="suggest" id="{uid}-suggest" popover bind:this={refSuggest} style:position-anchor="--{uid}-caret">
  {#each results as result, index (result)}
    <button
      type="button"
      commandfor="{uid}-suggest"
      command="hide-popover"
      onclick={() => selectTag(result.tag)}
      class={[`type-${result.tag.type}`, index === selectedIndex ? 'selected' : '']}
      bind:this={refResults[index]}
    >
      <span class="ellipsis">{result.texts[0]}<b>{result.texts[1]}</b>{result.texts[2]}</span>
      {#if result.isAlias}
        <span class="arrow">→</span><span class="ellipsis">{result.tag.name}</span>
      {/if}
      {#if result.tag.translations.length > 0 && !result.isFirstTranslation}
        [<span class="ellipsis">{result.tag.translations[0]}</span>]
      {/if}
      {#if result.tag.displayCount}
        <span class="count">{result.tag.displayCount}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  textarea {
    padding: 0.4rem;
    font-size: 1em;
    font-family: monospace;
    field-sizing: content;
    box-sizing: content-box;
  }

  .suggest {
    position-area: bottom span-right;
    position-try-fallbacks: flip-block, flip-inline;
    margin-top: 0.2rem;
    width: min(30rem, calc(100vw - 2rem));
    height: min(40rem, calc(100vh - 2rem));
    padding: 0;
  }

  button {
    display: block;
    width: stretch;
    text-align: left;
    font-size: 0.6em;
    border: none;
    background-color: #0000000c;
    margin: 0.1rem 0;
    padding: 0.2rem 0.4rem;
    display: flex;
    font-family: monospace;
  }

  .selected {
    background-color: #fff8;
  }

  .type-general {
    color: light-dark(dodgerblue, lightblue);
  }

  .type-artist {
    color: light-dark(firebrick, indianred);
  }

  .type-copyright {
    color: light-dark(darkorchid, violet);
  }

  .type-character {
    color: light-dark(darkgreen, lightgreen);
  }

  .type-meta {
    color: light-dark(darkorange, orange);
  }

  .type-custom {
    color: light-dark(teal, paleturquoise);
  }

  b {
    background-color: #0002;
  }

  .ellipsis {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .arrow {
    flex: none;
    margin: 0 0.2rem;
  }

  .count {
    flex: none;
    margin-left: auto;
    padding-left: 0.2rem;
  }
</style>
