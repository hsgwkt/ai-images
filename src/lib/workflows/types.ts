import * as z from 'zod'

import { safeObject, safeRecord } from '$lib/schema'

function emptyNodePropertyBinding() {
  return { nodeId: '', property: '' }
}

function emptyLoraBinding() {
  return { nodeId: '', name: '', strengthModel: '', strengthClip: '' }
}

export const nodePropertyBindingSchema = safeObject({
  nodeId: z.string().trim().catch(''),
  property: z.string().trim().catch(''),
})

export type NodePropertyBinding = z.infer<typeof nodePropertyBindingSchema>

export const loraBindingSchema = safeObject({
  nodeId: z.string().trim().catch(''),
  name: z.string().trim().catch(''),
  strengthModel: z.string().trim().catch(''),
  strengthClip: z.string().trim().catch(''),
})

export type LoraBinding = z.infer<typeof loraBindingSchema>

function emptyBindings() {
  return {
    checkpoint: emptyNodePropertyBinding(),
    width: emptyNodePropertyBinding(),
    height: emptyNodePropertyBinding(),
    positivePrompt: emptyNodePropertyBinding(),
    negativePrompt: emptyNodePropertyBinding(),
    seed: emptyNodePropertyBinding(),
    steps: emptyNodePropertyBinding(),
    lora: emptyLoraBinding(),
  }
}

export const workflowBindingsSchema = safeObject({
  checkpoint: nodePropertyBindingSchema.catch(emptyNodePropertyBinding),
  width: nodePropertyBindingSchema.catch(emptyNodePropertyBinding),
  height: nodePropertyBindingSchema.catch(emptyNodePropertyBinding),
  positivePrompt: nodePropertyBindingSchema.catch(emptyNodePropertyBinding),
  negativePrompt: nodePropertyBindingSchema.catch(emptyNodePropertyBinding),
  seed: nodePropertyBindingSchema.catch(emptyNodePropertyBinding),
  steps: nodePropertyBindingSchema.catch(emptyNodePropertyBinding),
  lora: loraBindingSchema.catch(emptyLoraBinding),
})

export type WorkflowBindings = z.infer<typeof workflowBindingsSchema>

export const workflowSchema = safeObject({
  name: z.string().trim().catch(''),
  json: z.string().catch(''),
  bindings: workflowBindingsSchema.catch(emptyBindings),
})

export type Workflow = z.infer<typeof workflowSchema>

export const workflowsSchema = safeRecord(z.string(), workflowSchema)

export type Workflows = z.infer<typeof workflowsSchema>

export const workflowJsonSchema = z.record(
  z.string(),
  z.looseObject({
    class_type: z.string(),
    inputs: z.record(z.string(), z.any()).optional(),
    _meta: z
      .looseObject({
        title: z.string().optional(),
      })
      .optional(),
  }),
)

export type WorkflowJson = z.infer<typeof workflowJsonSchema>
