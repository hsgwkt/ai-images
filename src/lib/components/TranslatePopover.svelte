<script lang="ts">
  import { isJaEnAvailable, translateJaEn } from '$lib/translate'
  import { pushStatus } from '$lib/toast'

  const uid = $props.id()

  let source = $state('')
  let translated = $state('')
  let refSource: HTMLTextAreaElement | undefined = $state()
  let translateTimerId = 0
  let translateRequestId = 0

  function scheduleTranslate() {
    window.clearTimeout(translateTimerId)
    const text = source
    if (!text.trim()) {
      translateRequestId += 1
      translated = ''
      return
    }

    const requestId = ++translateRequestId
    translateTimerId = window.setTimeout(async () => {
      try {
        const result = await translateJaEn(text)
        if (requestId === translateRequestId) translated = result
      } catch (error) {
        if (requestId === translateRequestId) {
          queueMicrotask(() => {
            throw error
          })
        }
      }
    }, 300)
  }

  async function copy() {
    if (!translated) return
    await navigator.clipboard.writeText(translated)
    pushStatus('コピーしました')
  }

  function handleToggle(event: ToggleEvent) {
    if (event.newState === 'open') {
      queueMicrotask(() => refSource?.focus())
    }
  }
</script>

{#if await isJaEnAvailable()}
  <button type="button" class="toggle" style:anchor-name="--{uid}-translate" commandfor="{uid}-popover" command="toggle-popover"
    >翻訳</button
  >

  <div id="{uid}-popover" class="panel" popover style:position-anchor="--{uid}-translate" ontoggle={handleToggle}>
    <label for="{uid}-source">入力（日本語）</label>
    <textarea id="{uid}-source" bind:this={refSource} bind:value={source} oninput={scheduleTranslate} autocomplete="off" rows={4}
    ></textarea>

    <label for="{uid}-result">翻訳（英語）</label>
    <textarea id="{uid}-result" value={translated} readonly rows={4}></textarea>

    <button type="button" onclick={copy} disabled={!translated}>コピー</button>
  </div>
{/if}

<style>
  .toggle {
    font-size: 0.8em;
  }

  .panel {
    margin: 0;
    position-area: bottom span-right;
    position-try-fallbacks: flip-block, flip-inline;
    width: min(24rem, calc(100vw - 2rem));
    padding: 0.5rem;

    label {
      display: block;
      margin: 0.5rem 0 0.1rem;
      font-size: 0.8em;
    }

    textarea {
      display: block;
      width: stretch;
      resize: vertical;
    }

    button {
      margin-top: 0.5rem;
    }
  }
</style>
