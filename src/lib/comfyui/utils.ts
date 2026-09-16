export type WorkflowNode = {
  class_type: string
  inputs?: Record<string, unknown>
  _meta?: { title?: string }
}

export type Workflow = Record<string, WorkflowNode>

export function randomSeed(): number {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
}

export function parseAspectRatio(aspectRatio: string): number {
  const [width, height] = aspectRatio.split(':').map(Number)
  return width / height || 1
}

export function calcSize(aspectRatio: number, baseSize = 1024) {
  const pixels = baseSize ** 2
  const width = Math.sqrt(pixels * aspectRatio)
  const height = width / aspectRatio
  return {
    width: Math.floor(width / 64) * 64,
    height: Math.floor(height / 64) * 64,
  }
}

export function withoutExt(path: string) {
  return path.replaceAll('\\', '/').replace(/\.[^./]+$/, '')
}

export function groupLorasByFolder<T extends { folder: string }>(loras: T[]) {
  return Object.entries(Object.groupBy(loras, (lora) => lora.folder)).sort(([a], [b]) => a.localeCompare(b))
}

export function splitTriggerWords(triggerWords: string): string[] {
  const words = new Set<string>()
  let word = ''
  let depth = 0
  for (const char of triggerWords) {
    if (char === '(') {
      depth++
    } else if (char === ')') {
      depth = Math.max(0, depth - 1)
    } else if (char === ',' && depth === 0) {
      words.add(word.trim())
      word = ''
      continue
    }
    word += char
  }
  if (word) {
    words.add(word.trim())
  }
  return Array.from(words)
}
