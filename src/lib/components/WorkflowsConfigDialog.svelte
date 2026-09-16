<script lang="ts">
  import { workflowSchema, workflowJsonSchema } from '$lib/workflows'
  import type { NodePropertyBinding, Workflows, WorkflowJson } from '$lib/workflows'
  import { workflows } from '$lib/state'
  import { z } from 'zod'

  let { id }: { id: string } = $props()
  const uid = $props.id()

  let draft: Workflows | null = $state(null)
  let selectedId: string | null = $state(null)
  let jsonError = $state('')

  const selectedWorkflow = $derived.by(() => {
    if (selectedId === null) return null
    return draft?.[selectedId] ?? null
  })

  const parsedWorkflowJson = $derived.by(() => {
    if (!selectedWorkflow) return {}
    try {
      return workflowJsonSchema.parse(JSON.parse(selectedWorkflow.json))
    } catch {
      return {}
    }
  })

  function handleOpen() {
    draft = workflows.export()
    selectedId = Object.keys(draft)[0] ?? null
    jsonError = ''
  }

  function handleSubmit(e: SubmitEvent) {
    if (draft === null) return

    for (const [workflowId, workflow] of Object.entries(draft)) {
      try {
        workflowJsonSchema.parse(JSON.parse(workflow.json))
      } catch (err) {
        e.preventDefault()
        selectedId = workflowId
        jsonError = err instanceof z.ZodError ? 'ワークフローが不正です' : 'JSONが不正です'
        return
      }
    }

    workflows.import($state.snapshot(draft))
  }

  function handleAdd() {
    if (draft === null) return
    const maxId = Object.keys(draft)
      .map((workflowId) => parseInt(workflowId.slice(1)))
      .reduce((prev, n) => Math.max(prev, n), 0)
    const newId = `w${maxId + 1}`
    draft[newId] = workflowSchema.parse({ name: `ワークフロー${newId}` })
    selectedId = newId
    jsonError = ''
  }

  function handleDelete() {
    if (draft === null || selectedId === null) return
    let index = Object.keys(draft).indexOf(selectedId)
    delete draft[selectedId]
    const ids = Object.keys(draft)
    index = Math.min(index, ids.length - 1)
    selectedId = ids[index] ?? null
    jsonError = ''
  }

  async function handleOpenJsonFile() {
    if (!selectedWorkflow) return

    const file = await new Promise<File | null>((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'application/json'
      input.onchange = () => (input.remove(), resolve(input.files?.[0] ?? null))
      input.oncancel = () => (input.remove(), resolve(null))
      document.body.appendChild(input)
      input.click()
    })

    if (file === null) return

    const text = await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string) ?? null)
      reader.onerror = () => resolve(null)
      reader.readAsText(file)
    })

    selectedWorkflow.json = text ?? '{}'
  }

  function handleFormatJson() {
    if (!selectedWorkflow) return
    try {
      selectedWorkflow.json = JSON.stringify(JSON.parse(selectedWorkflow.json), null, 2)
      jsonError = ''
    } catch {
      jsonError = 'JSONが不正です'
    }
  }

  function handleSelect() {
    jsonError = ''
  }

  function nodeTitle(node: WorkflowJson[string]) {
    if (node._meta?.title && node._meta.title !== node.class_type) {
      return `${node._meta.title} (${node.class_type})`
    }
    return node.class_type
  }
</script>

{#snippet nodeOptions()}
  <option value="">（未使用）</option>
  {#each Object.entries(parsedWorkflowJson) as [nodeId, node] (nodeId)}
    <option value={nodeId}>{nodeId}: {nodeTitle(node)}</option>
  {/each}
{/snippet}

{#snippet propertyOptions(nodeId: string)}
  {@const inputs = parsedWorkflowJson[nodeId]?.inputs ?? {}}
  <option value="">（未使用）</option>
  {#each Object.entries(inputs) as [property, value] (property)}
    {#if !Array.isArray(value)}
      <option value={property}>{property}</option>
    {/if}
  {/each}
{/snippet}

{#snippet bindingSelect(id: string, label: string, binding: NodePropertyBinding)}
  <label for={id}>{label}</label>
  <div>
    <select {id} bind:value={binding.nodeId}>
      {@render nodeOptions()}
    </select>
    <select bind:value={binding.property}>
      {@render propertyOptions(binding.nodeId)}
    </select>
  </div>
{/snippet}

<dialog {id} onbeforetoggle={(e) => e.newState === 'open' && handleOpen()}>
  <form method="dialog" onsubmit={handleSubmit}>
    <header>
      <button type="button" commandfor={id} command="close" aria-label="閉じる">×</button>
      <h4>ワークフロー設定</h4>
    </header>
    {#if draft}
      <div class="grid">
        <div>
          <label for="{uid}-workflows">
            ワークフロー
            <button type="button" onclick={handleAdd}>追加</button>
            <button type="button" onclick={handleDelete} disabled={!selectedWorkflow}>削除</button>
          </label>
          <select id="{uid}-workflows" size="26" bind:value={selectedId} onchange={handleSelect}>
            {#each Object.keys(draft) as workflowId (workflowId)}
              <option value={workflowId}>{draft[workflowId].name}</option>
            {/each}
          </select>
        </div>

        <div class="details">
          <label for="{uid}-name">名前</label>
          {#if selectedWorkflow}
            <input id="{uid}-name" type="text" bind:value={selectedWorkflow.name} />
          {:else}
            <input id="{uid}-name" type="text" disabled />
          {/if}

          <label for="{uid}-json">
            ワークフローJSON
            <button type="button" onclick={handleOpenJsonFile} disabled={!selectedWorkflow}>ファイルを開く</button>
            <button type="button" onclick={handleFormatJson} disabled={!selectedWorkflow}>整形</button>
          </label>
          {#if selectedWorkflow}
            <textarea id="{uid}-json" bind:value={selectedWorkflow.json} autocomplete="off" spellcheck="false" rows={4}></textarea>
          {:else}
            <textarea id="{uid}-json" disabled autocomplete="off" spellcheck="false" rows={4}></textarea>
          {/if}
          {#if jsonError}
            <p>{jsonError}</p>
          {/if}

          {#if selectedWorkflow}
            {@const bindings = selectedWorkflow.bindings}

            {@render bindingSelect(`${uid}-checkpoint-node`, 'Checkpoint', bindings.checkpoint)}

            {@render bindingSelect(`${uid}-width-node`, 'Width', bindings.width)}
            {@render bindingSelect(`${uid}-height-node`, 'Height', bindings.height)}

            {@render bindingSelect(`${uid}-positive-prompt-node`, 'Prompt (Positive)', bindings.positivePrompt)}
            {@render bindingSelect(`${uid}-negative-prompt-node`, 'Prompt (Negative)', bindings.negativePrompt)}

            {@render bindingSelect(`${uid}-seed-node`, 'Seed', bindings.seed)}
            {@render bindingSelect(`${uid}-steps-node`, 'Steps', bindings.steps)}

            <label for="{uid}-lora-node">LoRA（テンプレートとして利用）</label>
            <div>
              <select id="{uid}-lora-node" bind:value={bindings.lora.nodeId}>
                {@render nodeOptions()}
              </select>
              <select bind:value={bindings.lora.name}>
                {@render propertyOptions(bindings.lora.nodeId)}
              </select>
            </div>

            <label for="{uid}-lora-strength">LoRA 強度 (モデル）（クリップ)</label>
            <div>
              <select id="{uid}-lora-strength" bind:value={bindings.lora.strengthModel}>
                {@render propertyOptions(bindings.lora.nodeId)}
              </select>
              <select bind:value={bindings.lora.strengthClip}>
                {@render propertyOptions(bindings.lora.nodeId)}
              </select>
            </div>
          {/if}
        </div>
      </div>
    {/if}
    <footer>
      <button type="button" commandfor={id} command="close">キャンセル</button>
      <button type="submit">保存</button>
    </footer>
  </form>
</dialog>

<style>
  dialog {
    width: min(56rem, calc(100vw - 2rem));
  }

  .grid {
    width: stretch;
    display: grid;
    grid-template-columns: 12rem 1fr;
    gap: 0.5rem;
  }

  select[size],
  input,
  textarea {
    width: stretch;
  }

  textarea {
    font-family: monospace;
    font-size: 0.8em;
  }

  .details select {
    font-size: 0.8em;
  }

  p {
    margin: 0.25rem 0 0;
    color: #dc2626;
    font-size: 0.8em;
  }
</style>
