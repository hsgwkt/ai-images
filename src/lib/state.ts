import * as z from 'zod'

import { safeObject } from '$lib/schema'
import { createLocalStorageState } from './local-storage-state.svelte'
import { comfyuiConfigSchema } from './comfyui'
import { genImageInputsSchema } from './gen-image'
import { tagConfigSchema } from './tags/types'
import { workflowsSchema } from './workflows'

export type { TagConfig } from './tags/types'
export const tagConfig = createLocalStorageState('ai-images:tag-config', tagConfigSchema)

export const apiConfigSchema = safeObject({
  comfyui: comfyuiConfigSchema,
})
export type ApiConfig = z.infer<typeof apiConfigSchema>
export const apiConfig = createLocalStorageState('ai-images:api-config', apiConfigSchema)

export type { GenImageInputs } from './gen-image'
export const genImageInputs = createLocalStorageState('ai-images:gen-image-inputs', genImageInputsSchema)

export type { Workflows } from './workflows'
export const workflows = createLocalStorageState('ai-images:workflows', workflowsSchema)
