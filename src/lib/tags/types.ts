import * as z from 'zod'

import { safeObject } from '$lib/schema'

export const builtinTags = ['$it is [].', '$it has [].', '$it wears [].', '$it [].', "$it's []."]

export const tagConfigSchema = safeObject({
  tagsCsv: z.string().trim().catch(''),
  tagTranslationsCsv: z.string().trim().catch(''),
  customTags: z.string().catch(''),
})

export type TagConfig = z.infer<typeof tagConfigSchema>

export type Tag = {
  name: string
  type: string
  count: number
  displayCount: string
  aliases: string[]
  translations: string[]
}

export type FindResult = {
  texts: [string, string, string]
  isAlias?: boolean
  isFirstTranslation?: boolean
  tag: Tag
}

export const tagsFileName = 'tags.csv'
export const translationsFileName = 'tag-translations.csv'
