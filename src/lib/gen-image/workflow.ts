import { randomSeed, calcSize, parseAspectRatio, groupLorasByFolder, splitTriggerWords, type Model } from '$lib/comfyui'
import { expandPrompt } from '$lib/prompt'
import { workflows } from '$lib/state'
import { applyWorkflow, getBoundInput, workflowJsonSchema } from '$lib/workflows'
import type { ApplyWorkflowLora, Workflow } from '$lib/workflows'

import type { GenImageInputs, Steps } from './types'

const stepsRates: Record<Steps, number> = {
  '1/3': 1 / 3,
  '2/3': 2 / 3,
  '1': 1,
  '1.5': 1.5,
  '2': 2,
}

export function calcSteps(originalSteps: number, rate: Steps) {
  return Math.max(1, Math.floor(originalSteps * stepsRates[rate]))
}

export function getOriginalSteps(workflow: Workflow | undefined) {
  if (!workflow) return
  try {
    const json = workflowJsonSchema.parse(JSON.parse(workflow.json))
    const value = Number(getBoundInput(json, workflow.bindings.steps))
    if (!Number.isFinite(value) || value <= 0) return
    return value
  } catch {
    return
  }
}

export function createWorkflow(inputs: GenImageInputs, loraModels: Model[]) {
  const workflow = workflows.state[inputs.workflowId]
  if (!workflow) throw new Error('Workflow is not selected')

  if (inputs.randomSeed) {
    inputs.seed = randomSeed()
  }

  const json = workflowJsonSchema.parse(JSON.parse(workflow.json))
  const originalSteps = Number(getBoundInput(json, workflow.bindings.steps)) || 0
  const originalPositive = String(getBoundInput(json, workflow.bindings.positivePrompt) ?? '')
  const originalNegative = String(getBoundInput(json, workflow.bindings.negativePrompt) ?? '')

  const triggerWords = new Set<string>()
  const loras: ApplyWorkflowLora[] = []
  const selected = new Set(inputs.loras)

  const selectedModels = groupLorasByFolder(loraModels)
    .flatMap(([, models]) => models ?? [])
    .filter((lora) => selected.has(lora.filePath))

  for (const model of selectedModels) {
    const settings = inputs.loraSettings[model.filePath]
    const triggerIndexes = settings?.triggerWord ?? [0]
    const words = model.triggerWords.filter((_, i) => triggerIndexes.includes(i)).flatMap(splitTriggerWords)
    for (const word of words) {
      triggerWords.add(word)
    }
    loras.push({
      name: model.filePath,
      strengthModel: settings?.strength ?? 1,
    })
  }

  return applyWorkflow({
    workflow,
    checkpoint: inputs.checkpoint,
    ...calcSize(parseAspectRatio(inputs.aspectRatio), Number(inputs.baseSize)),
    positivePrompt: expandPrompt(joinPrompt(originalPositive, ...triggerWords, inputs.positivePrompt)),
    negativePrompt: expandPrompt(joinPrompt(originalNegative, inputs.negativePrompt)),
    seed: inputs.seed,
    steps: calcSteps(originalSteps, inputs.steps),
    loras,
  })
}

function joinPrompt(...prompts: string[]) {
  return prompts.filter(Boolean).join('\n')
}
