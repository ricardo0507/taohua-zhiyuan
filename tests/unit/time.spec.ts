import { describe, expect, it } from 'vitest'
import { formatAbsoluteTime, formatRelativeTime } from '@/utils/time'

/** 固定“当前时刻”，保证相对时间断言稳定 */
const NOW = new Date('2026-11-13T12:00:00').getTime()
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('formatRelativeTime', () => {
  it('一分钟以内显示「刚刚」', () => {
    expect(formatRelativeTime(NOW, NOW)).toBe('刚刚')
    expect(formatRelativeTime(NOW - 59 * 1000, NOW)).toBe('刚刚')
  })

  it('一小时以内显示分钟数', () => {
    expect(formatRelativeTime(NOW - 5 * MINUTE, NOW)).toBe('5 分钟前')
    expect(formatRelativeTime(NOW - 59 * MINUTE, NOW)).toBe('59 分钟前')
  })

  it('一天以内显示小时数', () => {
    expect(formatRelativeTime(NOW - 3 * HOUR, NOW)).toBe('3 小时前')
  })

  it('七天以内显示天数', () => {
    expect(formatRelativeTime(NOW - 2 * DAY, NOW)).toBe('2 天前')
    expect(formatRelativeTime(NOW - 6 * DAY, NOW)).toBe('6 天前')
  })

  it('同年更早的时间显示月日与时分', () => {
    const earlier = new Date('2026-11-05T09:05:00').getTime()
    expect(formatRelativeTime(earlier, NOW)).toBe('11-05 09:05')
  })

  it('跨年更早的时间显示完整日期', () => {
    const earlier = new Date('2025-12-31T23:10:00').getTime()
    expect(formatRelativeTime(earlier, NOW)).toBe('2025-12-31')
  })

  it('未来时间不会出现负数，按「刚刚」处理', () => {
    expect(formatRelativeTime(NOW + 5 * MINUTE, NOW)).toBe('刚刚')
  })
})

describe('formatAbsoluteTime', () => {
  it('返回包含完整年份的本地时间文案，用于 title 提示', () => {
    const label = formatAbsoluteTime(NOW)
    expect(label).toContain('2026')
    expect(label.length).toBeGreaterThan(0)
  })
})
