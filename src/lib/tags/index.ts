import { tagConfig } from '$lib/state'

import LoadWorker from './loader?worker'
import { builtinTags, type FindResult, type Tag } from './types'

export * from './opfs'
export * from './types'

let tags: readonly Tag[] = []

const loadWorker = new LoadWorker()
loadWorker.addEventListener('message', (event) => (tags = event.data))
loadWorker.postMessage('load')

export function reloadTags() {
  loadWorker.postMessage('load')
}

function splitFind(text: string, query: string): [string, string, string] | null {
  const index = text.indexOf(query)
  if (index < 0) return null
  return [text.substring(0, index), query, text.substring(index + query.length)]
}

function matchQueries(text: string, queries: readonly string[]) {
  for (const query of queries) {
    const texts = splitFind(text, query)
    if (texts) return texts
  }
  return null
}

function toCustomTag(name: string): Tag {
  return {
    name,
    type: 'custom',
    count: Number.POSITIVE_INFINITY,
    displayCount: '',
    aliases: [],
    translations: [],
  }
}

function extraTags(): Tag[] {
  const seen = new Set<string>()
  const result: Tag[] = []
  for (const line of [...builtinTags, ...tagConfig.state.customTags.split(/\r?\n/)]) {
    const name = line.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    result.push(toCustomTag(name))
  }
  return result
}

export function findTags(query: string, maxResults: number = 100): readonly FindResult[] {
  if (!query) return []
  const queries = [...new Set([query, query.replaceAll(' ', '_')])]
  const results: FindResult[] = []

  tagLoop: for (const tag of [...extraTags(), ...tags]) {
    if (results.length >= maxResults) break

    const texts = matchQueries(tag.name, queries)
    if (texts) {
      results.push({ texts, tag })
      continue
    }

    for (const alias of tag.aliases) {
      const texts = matchQueries(alias, queries)
      if (texts) {
        results.push({ texts, isAlias: true, tag })
        continue tagLoop
      }
    }

    for (const [index, translation] of tag.translations.entries()) {
      const texts = matchQueries(translation, queries)
      if (texts) {
        results.push({ texts, isAlias: true, isFirstTranslation: index === 0, tag })
        continue tagLoop
      }
    }
  }

  return results
}
