import { computed, onScopeDispose, readonly, shallowRef } from 'vue'

export type NoticeType = 'ok' | 'error' | 'info'

export interface Notice {
  text: string
  type: NoticeType | null
}

export const NOTICE_DURATION = 2600

/** 轻提示：展示一段时间后自动消失，并在作用域销毁时清理定时器 */
export function useNotice(duration: number = NOTICE_DURATION) {
  const text = shallowRef('')
  const type = shallowRef<NoticeType | null>(null)

  let timer: ReturnType<typeof setTimeout> | undefined

  const visible = computed(() => text.value.length > 0)
  const notice = computed<Notice>(() => ({ text: text.value, type: type.value }))

  function clear(): void {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }

    text.value = ''
    type.value = null
  }

  function show(nextText: string, nextType: NoticeType = 'info'): void {
    clear()

    if (!nextText) return

    text.value = nextText
    type.value = nextType
    timer = setTimeout(clear, duration)
  }

  onScopeDispose(clear)

  return {
    text: readonly(text),
    type: readonly(type),
    visible,
    notice,
    show,
    clear,
  }
}
