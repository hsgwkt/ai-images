<script module lang="ts">
  import type { Attachment } from 'svelte/attachments'

  export type ToastKind = 'status' | 'alert'

  type ToastEntry = {
    id: string
    kind: ToastKind
    message: string
    height: number
  }

  export const TOAST_STACK_GAP_PX = 8

  const MAX_TOASTS = 5
  const SUCCESS_DURATION_MS = 2000

  let toastItems = $state<ToastEntry[]>([])

  export function addToast(kind: ToastKind, message: string): string {
    if (message.trim() === '') return ''
    const id = crypto.randomUUID()
    const entry: ToastEntry = { id, kind, message, height: 0 }
    toastItems = [...toastItems, entry].slice(-MAX_TOASTS)
    return id
  }

  export function dismissToast(id: string): void {
    const index = toastItems.findIndex((t) => t.id === id)
    if (index < 0) return
    toastItems.splice(index, 1)
  }

  function toastAttachFor(entry: ToastEntry): Attachment<HTMLElement> {
    return (el) => {
      const ro = new ResizeObserver(() => {
        const h = Math.ceil(el.getBoundingClientRect().height)
        if (h > 0 && entry.height !== h) {
          entry.height = h
        }
      })
      ro.observe(el)

      let autoDismiss = 0
      if (entry.kind === 'status') {
        autoDismiss = window.setTimeout(() => dismissToast(entry.id), SUCCESS_DURATION_MS)
      }

      el.showPopover()

      return () => {
        ro.disconnect()
        window.clearTimeout(autoDismiss)
        el.hidePopover()
      }
    }
  }
</script>

<script lang="ts">
  let uid = $props.id()
</script>

{#each toastItems as toast, index (toast.id)}
  {@const stackOffsetY = toastItems.slice(0, index).reduce((y, t) => y + t.height + TOAST_STACK_GAP_PX, 0)}
  <div
    popover="manual"
    role={toast.kind}
    id="{uid}-{toast.id}"
    style:--toast-offset-y="{stackOffsetY}px"
    {@attach toastAttachFor(toast)}
    ontoggle={(e) => e.newState === 'closed' && dismissToast(toast.id)}
  >
    <button type="button" popovertargetaction="hide" popovertarget="{uid}-{toast.id}" aria-label="閉じる">×</button>
    {toast.message}
  </div>
{/each}
