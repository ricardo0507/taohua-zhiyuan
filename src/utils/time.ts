const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const RECENT_DAYS = 7

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/** 相对时间：7 天内用「刚刚 / x 分钟前」，更早显示日期 */
export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - timestamp)

  if (diff < MINUTE) return '刚刚'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`
  if (diff < RECENT_DAYS * DAY) return `${Math.floor(diff / DAY)} 天前`

  const date = new Date(timestamp)
  const monthDay = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

  return date.getFullYear() === new Date(now).getFullYear()
    ? `${monthDay} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    : `${date.getFullYear()}-${monthDay}`
}

/** 完整本地时间，用于 title 悬浮提示 */
export function formatAbsoluteTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}
