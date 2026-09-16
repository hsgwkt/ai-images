import * as z from 'zod'

import { safeObject, safeArray, safeRecord } from '$lib/schema'

export const baseSizeValues: `${number}`[] = ['1024', '1280', '1536']
export const aspectRatioValues: `${number}:${number}`[] = ['2:3', '1:1', '3:2', '16:9']
export const stepsValues = ['1/3', '2/3', '1', '1.5', '2'] as const

export type BaseSize = (typeof baseSizeValues)[number]
export type AspectRatio = (typeof aspectRatioValues)[number]
export type Steps = (typeof stepsValues)[number]

export const loraSettingsSchema = safeObject({
  strength: z.number().min(0).catch(1),
  triggerWord: safeArray(z.number().int().min(0).catch(0)).catch([0]),
})

export const genImageInputsSchema = safeObject({
  checkpoint: z.string().trim().catch('example.safetensors'),
  loras: safeArray(z.string().trim()).catch([]),
  loraSettings: safeRecord(z.string(), loraSettingsSchema).catch({}),
  positivePrompt: z.string().trim().catch('1girl, blush, light_smile,'),
  negativePrompt: z.string().trim().catch(''),
  randomSeed: z.boolean().catch(true),
  seed: z.number().int().min(0).catch(0),
  baseSize: z.enum(baseSizeValues).catch(baseSizeValues[0]),
  aspectRatio: z.enum(aspectRatioValues).catch(aspectRatioValues[0]),
  steps: z.enum(stepsValues).catch('1'),
  workflowId: z.string().trim().catch(''),
})

export type LoraSettings = z.infer<typeof loraSettingsSchema>
export type GenImageInputs = z.infer<typeof genImageInputsSchema>
