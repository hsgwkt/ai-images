import type { Tag } from './types'
import { tagsFileName, translationsFileName } from './types'
import { readTextFile } from './opfs'

function parseCsvLine(line: string) {
  return line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((cell) => {
    return cell.replace(/^"|"$/g, '').replace(/""/g, '"')
  })
}

function splitComma(str: string) {
  if (!str) return []
  return str
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')
}

const tagTypes: Record<string, string> = {
  '0': 'general',
  '1': 'artist',
  '3': 'copyright',
  '4': 'character',
  '5': 'meta',
}

const numberFormatter = new Intl.NumberFormat('en', { notation: 'compact', compactDisplay: 'short' })

async function loadTags(): Promise<readonly Tag[]> {
  const [tagsCsv, tagTranslationsCsv] = await Promise.all([readTextFile(tagsFileName), readTextFile(translationsFileName)])
  if (!tagsCsv) return []

  const tagTranslations: Record<string, string[]> = {}

  for (const line of tagTranslationsCsv.split(/\r?\n/)) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue
    const [tagName, translationsStr] = parseCsvLine(trimmedLine)
    tagTranslations[tagName] = splitComma(translationsStr)
  }

  const tags: Tag[] = []

  for (const line of tagsCsv.split(/\r?\n/)) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue
    const [name, type, count, aliases] = parseCsvLine(trimmedLine)
    tags.push({
      name,
      type: tagTypes[type],
      count: parseInt(count),
      displayCount: numberFormatter.format(parseInt(count)),
      aliases: splitComma(aliases),
      translations: tagTranslations[name] ?? [],
    })
  }

  return tags.sort((a, b) => b.count - a.count)
}

self.addEventListener('message', async (event) => {
  if (event.data !== 'load') return
  self.postMessage(await loadTags())
})
