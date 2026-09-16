import { addToast, dismissToast, type ToastKind } from '$lib/components/ToastHost.svelte'

export type { ToastKind }

export { dismissToast }

export function pushStatus(message: string): string {
  return addToast('status', message)
}

export function pushAlert(value: unknown): string {
  return addToast('alert', errorToToastMessage(value))
}

/**
 * 任意の値をトースト用の短文にする。
 */
export function errorToToastMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return ''
  }
  if (error instanceof Error) {
    return error.message || '(メッセージなし)'
  }
  if (typeof error === 'string') {
    return error || '(メッセージなし)'
  }
  if (error == null) {
    return '(メッセージなし)'
  }
  return String(error)
}

export function installGlobalErrorToasts(): () => void {
  const onWindowError = (event: ErrorEvent) => {
    if (event.defaultPrevented) return
    pushAlert(event.error)
  }

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    pushAlert(event.reason)
  }

  window.addEventListener('error', onWindowError)
  window.addEventListener('unhandledrejection', onUnhandledRejection)

  return () => {
    window.removeEventListener('error', onWindowError)
    window.removeEventListener('unhandledrejection', onUnhandledRejection)
  }
}
