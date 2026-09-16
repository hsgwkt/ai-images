import * as z from 'zod'

import { safeObject } from '$lib/schema'

export const comfyuiConfigSchema = safeObject({
  clientId: z
    .string()
    .trim()
    .catch(() => crypto.randomUUID()),
  baseUrl: z.string().trim().catch(''),
})

export type ComfyuiConfig = z.infer<typeof comfyuiConfigSchema>

export type Model = {
  folder: string
  fileName: string
  filePath: string
  previewUrl: string
  triggerWords: string[]
}
