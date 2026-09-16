let translatorEnJa: Translator | null = null
let translatorJaEn: Translator | null = null
let jaEnAvailablePromise: Promise<boolean> | undefined

const jaEnOptions = { sourceLanguage: 'ja', targetLanguage: 'en' } as const
const enJaOptions = { sourceLanguage: 'en', targetLanguage: 'ja' } as const

export function isJaEnAvailable() {
  jaEnAvailablePromise ??= checkJaEnAvailable()
  return jaEnAvailablePromise
}

async function checkJaEnAvailable() {
  if (!('Translator' in globalThis)) return false
  try {
    const availability = await Translator.availability(jaEnOptions)
    return availability !== 'unavailable'
  } catch {
    return false
  }
}

export async function translateJaEn(sourceText: string) {
  if (!translatorJaEn) {
    translatorJaEn = await Translator.create(jaEnOptions)
  }

  const translatedText = await translatorJaEn.translate(sourceText)
  return translatedText.trim()
}

export async function translateEnJa(sourceText: string) {
  if (!translatorEnJa) {
    translatorEnJa = await Translator.create(enJaOptions)
  }

  const translatedText = await translatorEnJa.translate(sourceText)
  return translatedText.trim()
}
