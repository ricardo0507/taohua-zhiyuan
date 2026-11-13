import { onMounted, onUnmounted, shallowRef } from 'vue'

/** 共享的「当前时刻」，定时刷新相对时间；页面重新可见时立即校准 */
export function useNow(intervalMs: number = 60 * 1000) {
  const now = shallowRef(Date.now())

  let timer: ReturnType<typeof setInterval> | undefined

  function refresh(): void {
    now.value = Date.now()
  }

  function handleVisibilityChange(): void {
    if (!document.hidden) refresh()
  }

  onMounted(() => {
    refresh()
    timer = setInterval(refresh, intervalMs)
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onUnmounted(() => {
    if (timer !== undefined) clearInterval(timer)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  return { now, refresh }
}
