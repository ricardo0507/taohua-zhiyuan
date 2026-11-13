import { describe, expect, it, vi, afterEach } from 'vitest'
import { createId } from '@/utils/id'

describe('createId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('生成非空字符串且多次调用不重复', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createId()))

    expect(ids.size).toBe(100)
    ids.forEach((id) => expect(id.length).toBeGreaterThan(0))
  })

  it('浏览器不支持 randomUUID 时使用可读的回退格式', () => {
    vi.stubGlobal('crypto', {})

    expect(createId()).toMatch(/^p-[a-z0-9]+-[a-z0-9]+$/)
  })
})
