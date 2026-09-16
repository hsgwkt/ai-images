<script lang="ts">
  import type { TagConfig } from '$lib/state'
  import { tagConfig } from '$lib/state'
  import { reloadTags, readFile, writeFile, tagsFileName, translationsFileName } from '$lib/tags'

  let { id }: { id: string } = $props()
  const uid = $props.id()

  let draft: TagConfig | null = $state(null)
  let pendingTagsFile: File | null = null
  let pendingTranslationsFile: File | null = null

  function handleOpen() {
    draft = tagConfig.export()
    pendingTagsFile = null
    pendingTranslationsFile = null
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    if (draft === null) return

    if (pendingTagsFile) await writeFile(tagsFileName, pendingTagsFile)
    if (pendingTranslationsFile) await writeFile(translationsFileName, pendingTranslationsFile)
    tagConfig.import($state.snapshot(draft))
    reloadTags()
    if (e.target instanceof HTMLElement) e.target.closest('dialog')?.close()
  }

  async function pickCsv() {
    return new Promise<File | null>((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.csv,text/csv'
      input.onchange = () => (input.remove(), resolve(input.files?.[0] ?? null))
      input.oncancel = () => (input.remove(), resolve(null))
      document.body.appendChild(input)
      input.click()
    })
  }

  async function handlePickTags() {
    if (!draft) return
    const file = await pickCsv()
    if (file === null) return
    pendingTagsFile = file
    draft.tagsCsv = file.name
  }

  async function handlePickTranslations() {
    if (!draft) return
    const file = await pickCsv()
    if (file === null) return
    pendingTranslationsFile = file
    draft.tagTranslationsCsv = file.name
  }

  async function handleDownload(fileName: string, downloadName: string) {
    const file = await readFile(fileName)
    if (!file) return
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = downloadName || file.name
    a.click()
    URL.revokeObjectURL(url)
  }
</script>

<dialog {id} onbeforetoggle={(e) => e.newState === 'open' && handleOpen()}>
  <form method="dialog" onsubmit={handleSubmit}>
    <header>
      <button type="button" commandfor={id} command="close" aria-label="閉じる">×</button>
      <h4>タグ設定</h4>
    </header>
    {#if draft}
      <label for="{uid}-tags-csv">
        タグCSV
        <button type="button" onclick={handlePickTags}>選択</button>
        <button type="button" onclick={() => draft && handleDownload(tagsFileName, draft.tagsCsv)} disabled={!tagConfig.state.tagsCsv}
          >取り出す</button
        >
      </label>
      <input id="{uid}-tags-csv" type="text" value={draft.tagsCsv} placeholder="（未設定）" disabled />

      <label for="{uid}-tag-translations-csv">
        タグ翻訳CSV
        <button type="button" onclick={handlePickTranslations}>選択</button>
        <button
          type="button"
          onclick={() => draft && handleDownload(translationsFileName, draft.tagTranslationsCsv)}
          disabled={!tagConfig.state.tagTranslationsCsv}>取り出す</button
        >
      </label>
      <input id="{uid}-tag-translations-csv" type="text" value={draft.tagTranslationsCsv} placeholder="（未設定）" disabled />

      <label for="{uid}-custom-tags">カスタムタグ（1行に1つ）</label>
      <textarea id="{uid}-custom-tags" bind:value={draft.customTags} autocomplete="off" spellcheck="false" rows={8}></textarea>
    {/if}
    <footer>
      <button type="button" commandfor={id} command="close">キャンセル</button>
      <button type="submit">保存</button>
    </footer>
  </form>
</dialog>

<style>
  input[type='text'],
  textarea {
    width: stretch;
  }

  textarea {
    font-family: monospace;
    font-size: 0.8em;
  }
</style>
