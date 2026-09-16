export function stripComments(text: string): string {
  return text.replace(/\/\*.*?\*\//gs, '').replace(/^\/\/.*/gm, '')
}

export function formatEnglishList(items: string[]): string {
  const parts = items.map((item) => item.trim()).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`
}

export function formatEnglishSentence(items: string[]): string {
  const parts = items.map((item) => item.trim().replace(/\.+$/, '')).filter(Boolean)
  const list = formatEnglishList(parts)
  return list ? `${list}.` : ''
}

export function expandPrompt(text: string): string {
  const normalized = stripComments(text.replaceAll('\r\n', '\n'))
  return expandJoins(expandVars(normalized))
}

function expandVars(text: string): string {
  const vars = new Map<string, string>()
  let lastName: string | null = null

  return text
    .replace(/^\s*(\$\w+)\s*=(.*)$|\$it\b/gm, (match, name, value) => {
      if (name) {
        vars.set(name, value.trim())
        lastName = name
        return ''
      }
      return lastName ?? match
    })
    .replace(/\$\w+/g, (match) => vars.get(match) ?? match)
}

function splitComma(text: string): string[] {
  const items: string[] = []
  let current = ''
  let depth = 0
  for (const char of text) {
    if (char === '(') {
      depth++
    } else if (char === ')') {
      depth = Math.max(0, depth - 1)
    } else if (char === ',' && depth === 0) {
      items.push(current)
      current = ''
      continue
    }
    current += char
  }
  items.push(current)
  return items
}

function expandJoins(text: string): string {
  const innerBrackets = /\[([^[\]]*)\]/g
  let current = text
  for (;;) {
    const next = current.replace(innerBrackets, (_, content) => formatEnglishList(splitComma(content)))
    if (next === current) return current
    current = next
  }
}
