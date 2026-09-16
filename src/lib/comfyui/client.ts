import createClient from 'openapi-fetch'
import * as z from 'zod'

import type { paths } from './openapi'
import type { Model, ComfyuiConfig } from './types'
import type { Workflow } from './utils'
import { withoutExt } from './utils'
import { comfyuiBaseUrlDefault } from './constants'

const PREVIEW_IMAGE_EVENT = 1
const PREVIEW_IMAGE_WITH_METADATA_EVENT = 4

const comfyuiModelFileSchema = z.object({
  name: z.string(),
  pathIndex: z.number(),
  modified: z.number().catch(0),
})

const lmModelListSchema = z.object({
  items: z.array(
    z.object({
      folder: z.string(),
      file_name: z.string(),
      civitai: z
        .object({
          trainedWords: z.array(z.string()).optional(),
        })
        .nullish(),
    }),
  ),
  total_pages: z.number(),
})

const errorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
  }),
})

const nodeSchema = z.object({
  class_type: z.string(),
  _meta: z
    .object({
      title: z.string().optional(),
    })
    .optional(),
})

const wsTextMessageSchema = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
})

export type ComfyuiProgress = {
  promptId: string | null
  nodeId: string
  progress?: number
}

export type ComfyuiPreviewImage = {
  image: Blob | string
  promptId: string | null
  nodeId: string | null
}

const previewMetadataSchema = z.object({
  node_id: z.string().optional(),
  prompt_id: z.string().optional(),
  image_type: z.string().optional(),
})

const queueItemSchema = z.tuple([z.unknown(), z.string(), z.record(z.string(), z.unknown())]).rest(z.unknown())

const queueInfoSchema = z.object({
  queue_running: z.array(queueItemSchema).catch([]),
  queue_pending: z.array(queueItemSchema).catch([]),
})

const executedOutputSchema = z.object({
  images: z.array(
    z.object({
      filename: z.string(),
      subfolder: z.string().catch(''),
      type: z.string().catch('output'),
    }),
  ),
})

function getNodeName(node: unknown): string | null {
  const result = z.safeParse(nodeSchema, node)
  if (result.success) {
    return result.data._meta?.title || result.data.class_type
  }
  return null
}

export function formatExecutingMessage(workflow: Workflow | undefined, { nodeId, progress }: ComfyuiProgress) {
  const name = getNodeName(workflow?.[nodeId]) ?? `Node #${nodeId}`
  const percent = progress != null ? ` ${Math.round(progress * 100)}%` : ''
  return `Executing ${name}...${percent}`
}

function parsePreviewImage(buffer: ArrayBuffer): ComfyuiPreviewImage | null {
  if (buffer.byteLength < 8) return null
  const view = new DataView(buffer)
  const eventType = view.getUint32(0)

  if (eventType === PREVIEW_IMAGE_EVENT) {
    const imageType = view.getUint32(4)
    const mimeType = imageType === 2 ? 'image/png' : imageType === 1 ? 'image/jpeg' : 'application/octet-stream'
    return {
      image: new Blob([new Uint8Array(buffer.slice(8))], { type: mimeType }),
      promptId: null,
      nodeId: null,
    }
  }

  if (eventType !== PREVIEW_IMAGE_WITH_METADATA_EVENT) return null

  const metadataEnd = 8 + view.getUint32(4)
  if (metadataEnd > buffer.byteLength) return null

  try {
    const result = z.safeParse(previewMetadataSchema, JSON.parse(new TextDecoder().decode(buffer.slice(8, metadataEnd))))
    if (!result.success) return null

    return {
      image: new Blob([new Uint8Array(buffer.slice(metadataEnd))], {
        type: result.data.image_type || 'application/octet-stream',
      }),
      promptId: result.data.prompt_id ?? null,
      nodeId: result.data.node_id ?? null,
    }
  } catch {
    return null
  }
}

export type ComfyuiConnectionHandlers = {
  onProgress?: (progress: ComfyuiProgress) => void
  onImage?: (image: ComfyuiPreviewImage) => void
  onComplete?: (promptId: string) => void
  onError?: (error: Error, promptId?: string | null) => void
}

export function createComfyuiClient(config: ComfyuiConfig) {
  const baseUrl = config.baseUrl || comfyuiBaseUrlDefault
  const clientId = config.clientId || crypto.randomUUID()
  const api = createClient<paths>({ baseUrl })

  return {
    api,

    async queuePrompt(workflow: Workflow): Promise<string> {
      console.debug(workflow)

      const resPrompt = await api.POST('/api/prompt', {
        body: {
          prompt: workflow,
          client_id: clientId,
        },
      })

      if (!resPrompt.data) {
        const errorResult = z.safeParse(errorResponseSchema, resPrompt.error)
        if (errorResult.success) throw new Error(`Prompt error: ${errorResult.data.error.message}`)
        throw new Error(`Failed to queue prompt: ${JSON.stringify(resPrompt.error)}`)
      }

      const promptId = resPrompt.data.prompt_id ?? ''
      if (!promptId) throw new Error('Prompt ID is required')

      return promptId
    },

    connect(handlers: ComfyuiConnectionHandlers) {
      return createWebSocket(baseUrl, clientId, handlers)
    },

    async fetchQueuedWorkflow(promptId: string): Promise<Workflow | null> {
      const res = await api.GET('/api/queue')
      if (!res.data) throw new Error('Failed to fetch queue')

      const result = z.safeParse(queueInfoSchema, res.data)
      if (!result.success) throw new Error('Failed to parse queue')

      const item = [...result.data.queue_running, ...result.data.queue_pending].find((entry) => entry[1] === promptId)
      return (item?.[2] as Workflow | undefined) ?? null
    },

    async fetchModelList(folder: 'checkpoints' | 'loras'): Promise<Model[]> {
      const folders = folder === 'checkpoints' ? ['checkpoints', 'diffusion_models'] : [folder]
      const files = (
        await Promise.all(
          folders.map(async (name) => {
            const files = await fetchComfyuiModelFiles(api, name)
            return files.map((file) => ({ folder: name, file }))
          }),
        )
      ).flat()
      files.sort((a, b) => b.file.modified - a.file.modified)

      const models = files.map(({ folder, file }) => toModel(baseUrl, folder, file))

      if (folder === 'loras') {
        try {
          mergeTriggerWords(models, await fetchLmTriggerWords(baseUrl))
        } catch {
          // LoRA Manager is optional
        }
      }

      return models
    },
  }
}

export type ComfyuiClient = ReturnType<typeof createComfyuiClient>

async function fetchComfyuiModelFiles(api: ReturnType<typeof createClient<paths>>, folder: string) {
  const res = await api.GET('/api/experiment/models/{folder}', {
    params: { path: { folder } },
  })
  if (!res.data) throw new Error(`Failed to fetch ${folder} list`)

  const result = z.safeParse(z.array(comfyuiModelFileSchema), res.data)
  if (!result.success) throw new Error(`Failed to parse ${folder} list`)

  return result.data
}

function toModel(baseUrl: string, folder: string, file: z.infer<typeof comfyuiModelFileSchema>): Model {
  const filePath = file.name.replaceAll('\\', '/')
  const parts = filePath.split('/')
  const fileName = parts.at(-1) ?? filePath
  const encodedPath = parts.map(encodeURIComponent).join('/')
  return {
    folder: parts.slice(0, -1).join('/'),
    fileName,
    filePath,
    previewUrl: `${baseUrl}/api/experiment/models/preview/${folder}/${file.pathIndex}/${encodedPath}`,
    triggerWords: [],
  }
}

async function fetchLmTriggerWords(baseUrl: string) {
  const triggerWords = new Map<string, string[]>()
  let totalPages = Number.MAX_SAFE_INTEGER

  for (let page = 1; page <= totalPages; page++) {
    const params = new URLSearchParams({
      page: String(page),
      page_size: '100',
      sort_by: 'date:desc',
      recursive: 'true',
      tag_logic: 'any',
    })

    const res = await fetch(`${baseUrl}/api/lm/loras/list?${params}`)
    if (!res.ok) throw new Error('Failed to fetch LoRA Manager list')

    const result = z.safeParse(lmModelListSchema, await res.json())
    if (!result.success) throw new Error('Failed to parse LoRA Manager list')

    for (const item of result.data.items) {
      const filePath = (item.folder && `${item.folder}/`) + item.file_name
      triggerWords.set(withoutExt(filePath), item.civitai?.trainedWords ?? [])
    }

    totalPages = result.data.total_pages
  }

  return triggerWords
}

function mergeTriggerWords(models: Model[], triggerWords: Map<string, string[]>) {
  for (const model of models) {
    model.triggerWords = triggerWords.get(withoutExt(model.filePath)) ?? []
  }
}

function createWebSocket(baseUrl: string, clientId: string, handlers: ComfyuiConnectionHandlers) {
  const wsBaseUrl = baseUrl.replace(/^http(?=s?:\/\/)/, 'ws')
  const ws = new WebSocket(`${wsBaseUrl}/ws?clientId=${clientId}`)
  ws.binaryType = 'arraybuffer'

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        type: 'feature_flags',
        data: { supports_preview_metadata: true },
      }),
    )
  }

  ws.onmessage = (event) => {
    if (event.data instanceof ArrayBuffer) {
      const image = parsePreviewImage(event.data)
      if (image) handlers.onImage?.(image)
      return
    }

    if (typeof event.data !== 'string') return

    const parsed = z.safeParse(wsTextMessageSchema, JSON.parse(event.data))
    if (!parsed.success) return

    const { type, data = {} } = parsed.data
    const promptId = typeof data.prompt_id === 'string' ? data.prompt_id : null
    const nodeId = typeof data.node === 'string' ? data.node : data.node === null ? null : undefined

    if (type === 'progress') {
      if (typeof data.node !== 'string' || typeof data.value !== 'number' || typeof data.max !== 'number') return
      handlers.onProgress?.({
        promptId,
        nodeId: data.node,
        progress: data.max ? data.value / data.max : 0,
      })
      return
    }

    if (type === 'executing') {
      if (!promptId || nodeId === undefined) return
      if (nodeId === null) {
        handlers.onComplete?.(promptId)
      } else {
        handlers.onProgress?.({ promptId, nodeId })
      }
      return
    }

    if (type === 'executed') {
      const output = z.safeParse(executedOutputSchema, data.output)
      if (!output.success) return
      for (const file of output.data.images) {
        const params = new URLSearchParams({ filename: file.filename, type: file.type })
        if (file.subfolder) params.set('subfolder', file.subfolder)
        handlers.onImage?.({
          image: `${baseUrl}/api/view?${params}`,
          promptId,
          nodeId: nodeId ?? null,
        })
      }
      return
    }

    if (type === 'execution_error') {
      const message = typeof data.exception_message === 'string' ? data.exception_message : 'Unknown execution error'
      handlers.onError?.(new Error(`ComfyUI execution error: ${message}`), promptId)
      return
    }
  }

  ws.onerror = (event) => {
    const errorResult = z.safeParse(errorResponseSchema, event)
    if (errorResult.success) {
      handlers.onError?.(new Error(`ComfyUI WebSocket error: ${errorResult.data.error.message}`))
    } else {
      handlers.onError?.(new Error(`ComfyUI WebSocket error: ${JSON.stringify(event)}`))
    }
  }

  return {
    [Symbol.dispose]() {
      ws.close()
    },
  }
}
