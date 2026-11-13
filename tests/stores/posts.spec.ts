import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { MAX_CONTENT_LENGTH, STORAGE_KEY, usePostsStore } from '@/stores/posts'

function readRaw() {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null')
}

describe('posts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.localStorage.clear()
  })

  describe('hydrate', () => {
    it('从 localStorage 读取已保存的内容并标记为就绪', () => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
          { id: 'a', content: '第一条', createdAt: 1_700_000_000_000 },
          { id: 'b', content: '第二条', createdAt: 1_700_000_100_000 },
        ]),
      )

      const store = usePostsStore()
      store.hydrate()

      expect(store.ready).toBe(true)
      expect(store.storageAvailable).toBe(true)
      expect(store.posts).toHaveLength(2)
      expect(store.total).toBe(2)
      expect(store.isEmpty).toBe(false)
    })

    it('过滤结构不完整的脏数据并归一化字段', () => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
          null,
          { content: '' },
          { content: 123 },
          { id: 42, content: '有效内容', createdAt: 'not-a-number', extra: true },
        ]),
      )

      const store = usePostsStore()
      store.hydrate()

      expect(store.posts).toHaveLength(1)
      expect(store.posts[0]).toMatchObject({ id: '42', content: '有效内容' })
      expect(typeof store.posts[0].createdAt).toBe('number')
      expect(Object.keys(store.posts[0])).toEqual(['id', 'content', 'createdAt'])
    })

    it('localStorage 内容不是合法 JSON 时返回空列表且不报错', () => {
      window.localStorage.setItem(STORAGE_KEY, '{oops')

      const store = usePostsStore()
      store.hydrate()

      expect(store.posts).toEqual([])
      expect(store.isEmpty).toBe(true)
      expect(store.storageAvailable).toBe(true)
    })

    it('存储内容不是数组时返回空列表', () => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ content: 'x' }))

      const store = usePostsStore()
      store.hydrate()

      expect(store.posts).toEqual([])
    })

    it('localStorage 不可用时降级为内存数据并标记存储不可用', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })

      const store = usePostsStore()
      store.hydrate()

      expect(store.posts).toEqual([])
      expect(store.storageAvailable).toBe(false)
      expect(store.ready).toBe(true)
    })
  })

  describe('addPost', () => {
    it('去除首尾空白并把最新内容放在最前面', () => {
      const store = usePostsStore()
      store.hydrate()

      const first = store.addPost('  第一条心绪  ')
      const second = store.addPost('第二条心绪')

      expect(first).toMatchObject({ ok: true, persisted: true })
      expect(second).toMatchObject({ ok: true, persisted: true })
      expect(store.posts.map((post) => post.content)).toEqual(['第二条心绪', '第一条心绪'])
      expect(readRaw().map((post: { content: string }) => post.content)).toEqual([
        '第二条心绪',
        '第一条心绪',
      ])
    })

    it('生成带 id 与时间戳的完整记录', () => {
      const store = usePostsStore()
      store.hydrate()

      const result = store.addPost('记录一下')

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.post.id).toEqual(expect.any(String))
      expect(result.post.createdAt).toEqual(expect.any(Number))
      expect(result.post.content).toBe('记录一下')
    })

    it('空内容或纯空白内容被拒绝，且不写存储', () => {
      const store = usePostsStore()
      store.hydrate()

      expect(store.addPost('')).toEqual({ ok: false, reason: 'empty' })
      expect(store.addPost('   \n  ')).toEqual({ ok: false, reason: 'empty' })
      expect(store.posts).toEqual([])
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('超过最大长度的内容被拒绝', () => {
      const store = usePostsStore()
      store.hydrate()

      const tooLong = '花'.repeat(MAX_CONTENT_LENGTH + 1)

      expect(store.addPost(tooLong)).toEqual({ ok: false, reason: 'too-long' })
      expect(store.posts).toEqual([])
    })

    it('恰好达到最大长度时可以发布', () => {
      const store = usePostsStore()
      store.hydrate()

      const result = store.addPost('花'.repeat(MAX_CONTENT_LENGTH))

      expect(result.ok).toBe(true)
      expect(store.posts[0].content).toHaveLength(MAX_CONTENT_LENGTH)
    })

    it('写入存储失败时仍保留内存数据，并标记存储不可用', () => {
      const store = usePostsStore()
      store.hydrate()

      const originalSetItem = Storage.prototype.setItem
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
        this: Storage,
        key: string,
        value: string,
      ) {
        if (key === STORAGE_KEY) throw new Error('QuotaExceededError')
        originalSetItem.call(this, key, value)
      })

      const result = store.addPost('只留在内存里')

      expect(result).toMatchObject({ ok: true, persisted: false })
      expect(store.posts).toHaveLength(1)
      expect(store.storageAvailable).toBe(false)
    })

    it('存储确认不可用后不再重复尝试写入', () => {
      const store = usePostsStore()
      store.hydrate()

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

      store.addPost('第一次失败')
      const spy = vi.spyOn(Storage.prototype, 'setItem')
      store.addPost('第二次')

      expect(spy).not.toHaveBeenCalled()
      expect(store.posts).toHaveLength(2)
    })

    it('新实例重新 hydrate 后能恢复之前发布的内容', () => {
      const first = usePostsStore()
      first.hydrate()
      first.addPost('会留下来的内容')

      setActivePinia(createPinia())
      const second = usePostsStore()
      second.hydrate()

      expect(second.posts).toHaveLength(1)
      expect(second.posts[0].content).toBe('会留下来的内容')
    })
  })
})
