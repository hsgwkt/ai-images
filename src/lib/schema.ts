import * as z from 'zod'

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return isObject(value) && (value.constructor === Object || value.constructor === null)
}

export function safeObject<T extends z.core.$ZodLooseShape = Partial<Record<never, z.core.SomeType>>>(
  shape?: T,
  params?: string | z.core.$ZodObjectParams,
) {
  return z.preprocess((v) => (isPlainObject(v) ? v : {}), z.object(shape, params))
}

export function safeArray<T extends z.core.SomeType>(element: T, params?: string | z.core.$ZodArrayParams) {
  return z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(element, params))
}

export function safeRecord<Key extends z.core.$ZodRecordKey, Value extends z.core.SomeType>(
  keyType: Key,
  valueType: Value,
  params?: string | z.core.$ZodRecordParams,
) {
  return z.preprocess((v) => (isPlainObject(v) ? v : {}), z.record(keyType, valueType, params))
}
