// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_CONTENT_LENGTH, createPostStore } from '../../server/post-store'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createPostStore', () => {
  it('新实例的列表为空', () => {
    const store = createPostStore()

    expect(store.list()).toEqual([])
  })

  it('每次调用返回互相隔离的实例', () => {
    const first = createPostStore()
    const second = createPostStore()

    first.create('只属于第一个实例')

    expect(first.list()).toHaveLength(1)
    expect(second.list()).toEqual([])
  })

  it('create 返回带 id 与 createdAt 的完整记录，并落库 trim 后的内容', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const store = createPostStore()

    const result = store.create('  桃花源里可耕田  ')

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(Object.keys(result.post)).toEqual(['id', 'content', 'createdAt'])
    expect(result.post.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(result.post.content).toBe('桃花源里可耕田')
    expect(result.post.createdAt).toBe(1_700_000_000_000)
    expect(store.list()).toEqual([result.post])
  })

  it('每次创建的 id 都不相同', () => {
    const store = createPostStore()

    const first = store.create('第一条')
    const second = store.create('第二条')

    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(first.post.id).not.toBe(second.post.id)
  })

  it('list 按 createdAt 倒序返回', () => {
    const now = vi.spyOn(Date, 'now')
    const store = createPostStore()

    now.mockReturnValue(1_000)
    store.create('较早')
    now.mockReturnValue(2_000)
    store.create('最新')
    now.mockReturnValue(1_500)
    store.create('居中')

    expect(store.list().map((post) => post.content)).toEqual(['最新', '居中', '较早'])
  })

  it('createdAt 相同的记录按创建先后倒序排列', () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000)
    const store = createPostStore()

    store.create('先创建')
    store.create('后创建')

    expect(store.list().map((post) => post.content)).toEqual(['后创建', '先创建'])
  })

  it('find 命中时返回记录，未命中返回 undefined', () => {
    const store = createPostStore()
    const result = store.create('可被查找的内容')
    if (!result.ok) throw new Error('创建失败')

    expect(store.find(result.post.id)).toEqual(result.post)
    expect(store.find('missing-id')).toBeUndefined()
  })

  it('remove 删除成功返回 true，再次删除同一 id 返回 false', () => {
    const store = createPostStore()
    const result = store.create('即将被删除')
    if (!result.ok) throw new Error('创建失败')

    expect(store.remove(result.post.id)).toBe(true)
    expect(store.list()).toEqual([])
    expect(store.remove(result.post.id)).toBe(false)
    expect(store.remove('missing-id')).toBe(false)
  })

  it('空白内容被拒绝且不落库', () => {
    const store = createPostStore()

    expect(store.create('   \n\t ')).toEqual({ ok: false, code: 'EMPTY_CONTENT' })
    expect(store.list()).toEqual([])
  })

  it('空字符串内容被拒绝', () => {
    const store = createPostStore()

    expect(store.create('')).toEqual({ ok: false, code: 'EMPTY_CONTENT' })
    expect(store.list()).toEqual([])
  })

  it('超过最大长度的内容被拒绝，恰好最大长度可以创建', () => {
    const store = createPostStore()

    expect(store.create('花'.repeat(MAX_CONTENT_LENGTH + 1))).toEqual({
      ok: false,
      code: 'CONTENT_TOO_LONG',
    })
    expect(store.list()).toEqual([])

    const ok = store.create('花'.repeat(MAX_CONTENT_LENGTH))
    expect(ok.ok).toBe(true)
    expect(store.list()[0]?.content).toHaveLength(MAX_CONTENT_LENGTH)
  })

  it('长度按 trim 后的内容计算', () => {
    const store = createPostStore()

    const result = store.create(`   ${'花'.repeat(MAX_CONTENT_LENGTH)}   `)

    expect(result.ok).toBe(true)
    expect(store.list()[0]?.content).toHaveLength(MAX_CONTENT_LENGTH)
  })

  it('list 返回值被外部修改不影响内部数据', () => {
    const store = createPostStore()
    const result = store.create('原始内容')
    if (!result.ok) throw new Error('创建失败')

    const listed = store.list()
    listed.push({ id: 'fake', content: '外部塞入', createdAt: 0 })
    const first = listed[0]
    if (first) first.content = '外部篡改'

    expect(store.list()).toEqual([result.post])
    expect(store.find(result.post.id)?.content).toBe('原始内容')
  })

  it('create 返回的记录被外部修改不影响内部数据', () => {
    const store = createPostStore()
    const result = store.create('原始内容')
    if (!result.ok) throw new Error('创建失败')

    result.post.content = '外部篡改'

    expect(store.list()[0]?.content).toBe('原始内容')
  })
})
