import * as z from 'zod'

function safeJsonParse(value: unknown) {
  try {
    return JSON.parse(String(value))
  } catch {
    return null
  }
}

const onInits: (() => void)[] = []

export function createLocalStorageState<T extends object>(key: string, schema: z.ZodSchema<T>) {
  let stateValue = $state<T>(schema.parse(safeJsonParse(localStorage.getItem(key))))

  onInits.push(() => {
    let payloadValue: string | null = null

    $effect(() => {
      if (payloadValue === null) {
        queueMicrotask(() => {
          if (payloadValue === null) return
          localStorage.setItem(key, payloadValue)
          payloadValue = null
        })
      }

      payloadValue = JSON.stringify(stateValue)
    })
  })

  return {
    get state() {
      return stateValue
    },

    set state(value) {
      stateValue = value
    },

    import(value: unknown) {
      stateValue = schema.parse(value)
    },

    export() {
      return $state.snapshot(stateValue)
    },
  }
}

export type LocalStorageState<T extends object> = ReturnType<typeof createLocalStorageState<T>>

export function initializeLocalStorageState() {
  for (const onInit of onInits) {
    onInit()
  }
}
