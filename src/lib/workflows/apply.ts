import type { LoraBinding, NodePropertyBinding, Workflow, WorkflowJson } from './types'
import { workflowJsonSchema } from './types'
import { z } from 'zod'

export type ApplyWorkflowLora = {
  name: string
  strengthModel: number
  strengthClip?: number
}

export type ApplyWorkflowParams = {
  workflow: Workflow
  checkpoint: string
  width: number
  height: number
  positivePrompt: string
  negativePrompt: string
  seed: number
  steps: number
  loras: ApplyWorkflowLora[]
}

const linkSchema = z.tuple([z.union([z.string(), z.number()]), z.number()])

export function applyWorkflow({ workflow, ...inputs }: ApplyWorkflowParams): WorkflowJson {
  const result = workflowJsonSchema.parse(JSON.parse(workflow.json))

  setBoundInput(result, workflow.bindings.checkpoint, inputs.checkpoint)
  setBoundInput(result, workflow.bindings.width, inputs.width)
  setBoundInput(result, workflow.bindings.height, inputs.height)
  setBoundInput(result, workflow.bindings.positivePrompt, inputs.positivePrompt)
  setBoundInput(result, workflow.bindings.negativePrompt, inputs.negativePrompt)
  setBoundInput(result, workflow.bindings.seed, inputs.seed)
  setBoundInput(result, workflow.bindings.steps, inputs.steps)
  applyLoras(result, workflow.bindings.lora, inputs.loras)

  return result
}

export function getBoundInput(workflow: WorkflowJson, binding: NodePropertyBinding) {
  if (!binding.nodeId || !binding.property) return
  return workflow[binding.nodeId]?.inputs?.[binding.property]
}

function setBoundInput(workflow: WorkflowJson, binding: NodePropertyBinding, value: unknown) {
  if (!binding.nodeId || !binding.property) return
  const node = requireNode(workflow, binding.nodeId)
  node.inputs ??= {}
  node.inputs[binding.property] = value
}

function applyLoras(workflow: WorkflowJson, binding: LoraBinding, loras: ApplyWorkflowLora[]) {
  if (!binding.nodeId) return

  const template = requireNode(workflow, binding.nodeId)

  if (loras.length === 0) {
    bypassNode(workflow, binding.nodeId)
    return
  }

  const snapshot = structuredClone(template)
  const consumers = findConsumers(workflow, binding.nodeId)

  setLoraInputs(template, binding, loras[0])

  let lastId = binding.nodeId

  for (const lora of loras.slice(1)) {
    const cloned = structuredClone(snapshot)
    for (const [index, link] of inputLinks(cloned).entries()) {
      link.splice(0, 2, lastId, index)
    }
    setLoraInputs(cloned, binding, lora)
    lastId = nextNodeId(workflow)
    workflow[lastId] = cloned
  }

  for (const consumer of consumers) {
    consumer[0] = lastId
  }
}

function setLoraInputs(node: WorkflowJson[string], binding: LoraBinding, lora: ApplyWorkflowLora) {
  node.inputs ??= {}
  if (binding.name) node.inputs[binding.name] = lora.name
  if (binding.strengthModel) node.inputs[binding.strengthModel] = lora.strengthModel
  if (binding.strengthClip) node.inputs[binding.strengthClip] = Math.max(lora.strengthClip ?? lora.strengthModel, 0)
}

function bypassNode(workflow: WorkflowJson, nodeId: string) {
  const incoming = inputLinks(requireNode(workflow, nodeId))
  for (const consumer of findConsumers(workflow, nodeId)) {
    consumer.splice(0, 2, ...incoming[consumer[1]])
  }
  delete workflow[nodeId]
}

function inputLinks(node: WorkflowJson[string]) {
  return Object.values(node.inputs ?? {}).filter(isLink)
}

function findConsumers(workflow: WorkflowJson, sourceId: string) {
  return Object.values(workflow).flatMap((node) => inputLinks(node).filter(([id]) => id === sourceId))
}

function nextNodeId(workflow: WorkflowJson) {
  const ids = Object.keys(workflow).map((id) => Number(id) || 0)
  return String(Math.max(...ids) + 1)
}

function requireNode(workflow: WorkflowJson, nodeId: string) {
  const node = workflow[nodeId]
  if (!node) throw new Error(`Node ${nodeId} not found`)
  return node
}

function isLink(value: unknown): value is z.infer<typeof linkSchema> {
  return linkSchema.safeParse(value).success
}
