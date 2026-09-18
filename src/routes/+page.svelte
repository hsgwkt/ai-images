<script lang="ts">
  import { onMount } from 'svelte'
  import { SvelteMap } from 'svelte/reactivity'

  import { pushStatus } from '$lib/toast'
  import { apiConfig, genImageInputs, workflows } from '$lib/state'
  import type { ComfyuiClient, ComfyuiProgress, Model, Workflow } from '$lib/comfyui'
  import { createComfyuiClient, formatExecutingMessage, withoutExt } from '$lib/comfyui'
  import { createWorkflow, baseSizeValues, aspectRatioValues, stepsValues, calcSteps, getOriginalSteps } from '$lib/gen-image'
  import LorasSettings from '$lib/components/LorasSettings.svelte'
  import ImageCarousel from '$lib/components/ImageCarousel.svelte'
  import PromptTextarea from '$lib/components/PromptTextarea.svelte'
  import TranslatePopover from '$lib/components/TranslatePopover.svelte'

  const uid = $props.id()

  let comfyui: ComfyuiClient | null = null
  let checkpoints: Model[] = $state([])
  let loras: Model[] = $state([])
  let isGeneratingImage = $state(false)
  let executing: ComfyuiProgress | null = $state(null)
  const queuedWorkflows = new SvelteMap<string, Workflow>()
  let images: (Blob | string)[] = $state.raw([])
  let isRepeatMode = $state(false)

  const originalSteps = $derived(getOriginalSteps(workflows.state[genImageInputs.state.workflowId]))

  const executingMessage = $derived.by(() => {
    const progress = executing
    if (!progress) return ''
    return formatExecutingMessage(progress.promptId ? queuedWorkflows.get(progress.promptId) : undefined, progress)
  })

  async function generateImage() {
    if (!comfyui) return

    if (isGeneratingImage) {
      isRepeatMode = true
      return
    }
    isGeneratingImage = true

    try {
      const workflow = createWorkflow(genImageInputs.state, loras)
      const promptId = await comfyui.queuePrompt(workflow)
      queuedWorkflows.set(promptId, workflow)
    } catch (error) {
      isGeneratingImage = false
      executing = null
      throw error
    }
  }

  function handleGenerationComplete(promptId: string) {
    queuedWorkflows.delete(promptId)
    executing = null
    if (isRepeatMode) {
      isGeneratingImage = false
      queueMicrotask(generateImage)
    } else {
      isGeneratingImage = false
      pushStatus('done')
    }
  }

  async function restoreQueuedWorkflow(promptId: string | null) {
    if (!comfyui || !promptId || queuedWorkflows.has(promptId)) return
    const tempWorkflow: Workflow = {}
    queuedWorkflows.set(promptId, tempWorkflow)
    isGeneratingImage = true
    const workflow = await comfyui.fetchQueuedWorkflow(promptId)
    if (workflow && queuedWorkflows.get(promptId) === tempWorkflow) {
      queuedWorkflows.set(promptId, workflow)
    }
  }

  function handleGlobalKeyDown(e: KeyboardEvent) {
    if (e.defaultPrevented) return

    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      const form = e.target instanceof HTMLElement ? e.target.closest('form') : null
      if (form) {
        form.requestSubmit()
        return
      }
      generateImage()
    }

    if (e.key === 'Escape') {
      const dialog = e.target instanceof HTMLElement ? e.target.closest('dialog') : null
      if (!dialog) {
        isRepeatMode = false
      }
    }
  }

  onMount(() => {
    comfyui = createComfyuiClient(apiConfig.state.comfyui)
    const connection = comfyui.connect({
      onProgress(progress) {
        executing = progress
        restoreQueuedWorkflow(progress.promptId)
      },
      onImage({ image, nodeId }) {
        if (nodeId == null) return
        if (images.includes(image)) return
        images = [image, ...images].slice(0, 16)
      },
      onComplete: handleGenerationComplete,
      onError(error, promptId) {
        if (promptId) queuedWorkflows.delete(promptId)
        isGeneratingImage = false
        executing = null
        queueMicrotask(() => {
          throw error
        })
      },
    })

    void (async () => {
      checkpoints = await comfyui!.fetchModelList('checkpoints')
      loras = await comfyui!.fetchModelList('loras')
    })()

    return () => {
      connection[Symbol.dispose]()
    }
  })

  function onsubmit(e: Event) {
    e.preventDefault()
    generateImage()
  }
</script>

<svelte:window onkeydown={handleGlobalKeyDown} />

<div class="layout">
  <div>
    <div class="header">
      <span class="executing-message">{executingMessage}</span>
      <button onclick={generateImage} disabled={isGeneratingImage}>Generate</button>
      <label><input type="checkbox" bind:checked={isRepeatMode} />Repeat</label>
    </div>

    <ImageCarousel {images} highlight={isRepeatMode}>
      <div class="fullscreen-executing-message">{executingMessage}</div>
    </ImageCarousel>

    <form {onsubmit}>
      <div class="grid">
        <label for="{uid}-workflow">Workflow</label>
        <select id="{uid}-workflow" bind:value={genImageInputs.state.workflowId}>
          {#each Object.entries(workflows.state) as [id, workflow] (id)}
            <option value={id}>{workflow.name}</option>
          {/each}
        </select>

        <label for="{uid}-checkpoint">Checkpoint</label>
        <select id="{uid}-checkpoint" bind:value={genImageInputs.state.checkpoint}>
          {#each checkpoints as checkpoint (`${checkpoint.filePath}`)}
            <option value={checkpoint.filePath}>{withoutExt(checkpoint.filePath)}</option>
          {/each}
        </select>
      </div>

      <div class="prompt-heading">
        <label for="{uid}-positive-prompt">Prompt (Positive)</label>
        <TranslatePopover />
      </div>
      <PromptTextarea id="{uid}-positive-prompt" bind:value={genImageInputs.state.positivePrompt} rows={3} />

      <label for="{uid}-negative-prompt">Prompt (Negative)</label>
      <PromptTextarea id="{uid}-negative-prompt" bind:value={genImageInputs.state.negativePrompt} rows={1} />

      <div class="grid">
        <label for="{uid}-base-size">Base Size</label>
        <select id="{uid}-base-size" bind:value={genImageInputs.state.baseSize}>
          {#each baseSizeValues as baseSize (baseSize)}
            <option value={baseSize}>{baseSize}</option>
          {/each}
        </select>

        <label for="{uid}-aspect-ratio">Aspect Ratio</label>
        <select id="{uid}-aspect-ratio" bind:value={genImageInputs.state.aspectRatio}>
          {#each aspectRatioValues as aspectRatio (aspectRatio)}
            <option value={aspectRatio}>{aspectRatio}</option>
          {/each}
        </select>

        <label for="{uid}-steps">Steps</label>
        <select id="{uid}-steps" bind:value={genImageInputs.state.steps}>
          {#each stepsValues as step (step)}
            <option value={step}>
              x{step}{#if originalSteps}&nbsp;({calcSteps(originalSteps, step)}){/if}
            </option>
          {/each}
        </select>
      </div>

      <label for="{uid}-seed">Seed</label>
      <div>
        <input id="{uid}-seed" type="number" bind:value={genImageInputs.state.seed} />
        <label>
          <input type="checkbox" bind:checked={genImageInputs.state.randomSeed} />Random
        </label>
      </div>
    </form>
  </div>

  <div>
    <form {onsubmit}>
      <label for="">LoRA</label>
      <LorasSettings bind:selected={genImageInputs.state.loras} bind:loraSettings={genImageInputs.state.loraSettings} {loras} />
    </form>
  </div>
</div>

<style>
  .layout {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 1rem;

    & > * {
      min-width: 0;
    }
  }

  .header {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .prompt-heading {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .grid {
    display: grid;
    grid-auto-flow: column;
    grid-template-rows: auto auto;
    justify-content: start;
    gap: 0 0.5rem;
  }

  .executing-message {
    margin-right: auto;
  }

  .fullscreen-executing-message {
    display: none;
    position: absolute;
    left: 0;
    top: 0;
    color: #fff;

    :global(:fullscreen) & {
      display: block;
    }
  }
</style>
