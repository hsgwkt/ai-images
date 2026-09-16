<script lang="ts">
  import type { ApiConfig } from '$lib/state'
  import { apiConfig } from '$lib/state'
  import { comfyuiBaseUrlDefault } from '$lib/comfyui'

  let { id }: { id: string } = $props()
  const uid = $props.id()

  let draft: ApiConfig | null = $state(null)

  function handleOpen() {
    draft = apiConfig.export()
  }

  function handleSubmit() {
    if (draft === null) return
    apiConfig.import($state.snapshot(draft))
  }
</script>

<dialog {id} onbeforetoggle={(e) => e.newState === 'open' && handleOpen()}>
  <form method="dialog" onsubmit={handleSubmit}>
    <header>
      <button type="button" commandfor={id} command="close" aria-label="閉じる">×</button>
      <h4>API設定</h4>
    </header>
    {#if draft}
      <label for="{uid}-comfyui-base-url">ComfyUI URL</label>
      <input
        id="{uid}-comfyui-base-url"
        type="text"
        placeholder={comfyuiBaseUrlDefault}
        bind:value={draft.comfyui.baseUrl}
        autocomplete="off"
      />
      <p>
        LoRAのトリガーワードは
        <a href="https://github.com/willmiao/ComfyUI-Lora-Manager" target="_blank" rel="noopener">ComfyUI-Lora-Manager</a>
        のAPIから取得します。
      </p>
    {/if}
    <footer>
      <button type="button" commandfor={id} command="close">キャンセル</button>
      <button type="submit">保存</button>
    </footer>
  </form>
</dialog>

<style>
  p {
    margin: 0.5rem 0 0;
    font-size: 0.8em;
    color: #666;
  }

  a {
    text-decoration: underline;
  }
</style>
