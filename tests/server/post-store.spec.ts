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

    expect(Object.keys(result.post)).toEqual([
      'id',
      'content',
      'createdAt',
      'likes',
      'liked',
      'favorited',
    ])
    expect(result.post.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(result.post.content).toBe('桃花源里可耕田')
    expect(result.post.createdAt).toBe(1_700_000_000_000)
    expect(result.post.likes).toBe(0)
    expect(result.post.liked).toBe(false)
    expect(result.post.favorited).toBe(false)
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
    listed.push({
      id: 'fake',
      content: '外部塞入',
      createdAt: 0,
      likes: 0,
      liked: false,
      favorited: false,
    })
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

describe('setLiked', () => {
  function seed(store: ReturnType<typeof createPostStore>): string {
    const created = store.create('桃花潭水深千尺')
    if (!created.ok) throw new Error('创建失败')
    return created.post.id
  }

  it('点赞后 likes 变为 1、liked 为 true，其他字段不变', () => {
    const store = createPostStore()
    const id = seed(store)
    const before = store.find(id)
    if (!before) throw new Error('查找失败')

    const updated = store.setLiked(id, true)

    expect(updated).toBeDefined()
    expect(updated?.id).toBe(id)
    expect(updated?.content).toBe(before.content)
    expect(updated?.createdAt).toBe(before.createdAt)
    expect(updated?.likes).toBe(1)
    expect(updated?.liked).toBe(true)
    expect(updated?.favorited).toBe(false)
    expect(store.find(id)).toEqual(updated)
    expect(store.list()[0]).toEqual(updated)
  })

  it('重复点赞保持幂等：likes 仍为 1', () => {
    const store = createPostStore()
    const id = seed(store)

    store.setLiked(id, true)
    store.setLiked(id, true)
    const updated = store.setLiked(id, true)

    expect(updated?.likes).toBe(1)
    expect(updated?.liked).toBe(true)
    expect(store.find(id)?.likes).toBe(1)
  })

  it('取消点赞后 likes 回到 0、liked 为 false', () => {
    const store = createPostStore()
    const id = seed(store)

    store.setLiked(id, true)
    const updated = store.setLiked(id, false)

    expect(updated?.likes).toBe(0)
    expect(updated?.liked).toBe(false)
    expect(store.find(id)?.likes).toBe(0)
  })

  it('未点赞时取消点赞不改变计数，likes 不会为负', () => {
    const store = createPostStore()
    const id = seed(store)

    const updated = store.setLiked(id, false)

    expect(updated?.likes).toBe(0)
    expect(updated?.liked).toBe(false)
    expect(updated?.likes).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(updated?.likes)).toBe(true)
  })

  it('id 不存在返回 undefined 且不创建记录', () => {
    const store = createPostStore()

    expect(store.setLiked('missing-id', true)).toBeUndefined()
    expect(store.setLiked('missing-id', false)).toBeUndefined()
    expect(store.list()).toEqual([])
  })

  it('返回的是副本，外部修改不影响内部数据', () => {
    const store = createPostStore()
    const id = seed(store)

    const updated = store.setLiked(id, true)
    if (!updated) throw new Error('点赞失败')
    updated.likes = 999
    updated.liked = false

    expect(store.find(id)?.likes).toBe(1)
    expect(store.find(id)?.liked).toBe(true)
  })

  it('只影响目标记录', () => {
    const store = createPostStore()
    const first = seed(store)
    const second = seed(store)

    store.setLiked(first, true)

    expect(store.find(first)?.liked).toBe(true)
    expect(store.find(second)?.liked).toBe(false)
    expect(store.find(second)?.likes).toBe(0)
  })
})

describe('setFavorited', () => {
  function seed(store: ReturnType<typeof createPostStore>): string {
    const created = store.create('落英缤纷')
    if (!created.ok) throw new Error('创建失败')
    return created.post.id
  }

  it('收藏后 favorited 为 true 且 likes 不受影响', () => {
    const store = createPostStore()
    const id = seed(store)

    const updated = store.setFavorited(id, true)

    expect(updated?.favorited).toBe(true)
    expect(updated?.liked).toBe(false)
    expect(updated?.likes).toBe(0)
    expect(store.find(id)?.favorited).toBe(true)
  })

  it('重复收藏保持幂等', () => {
    const store = createPostStore()
    const id = seed(store)

    store.setFavorited(id, true)
    const updated = store.setFavorited(id, true)

    expect(updated?.favorited).toBe(true)
    expect(updated?.likes).toBe(0)
  })

  it('取消收藏后 favorited 为 false', () => {
    const store = createPostStore()
    const id = seed(store)

    store.setFavorited(id, true)
    const updated = store.setFavorited(id, false)

    expect(updated?.favorited).toBe(false)
    expect(store.find(id)?.favorited).toBe(false)
  })

  it('未收藏时取消收藏仍返回记录且不产生副作用', () => {
    const store = createPostStore()
    const id = seed(store)

    const updated = store.setFavorited(id, false)

    expect(updated?.favorited).toBe(false)
    expect(updated?.likes).toBe(0)
    expect(updated?.liked).toBe(false)
  })

  it('id 不存在返回 undefined 且不创建记录', () => {
    const store = createPostStore()

    expect(store.setFavorited('missing-id', true)).toBeUndefined()
    expect(store.setFavorited('missing-id', false)).toBeUndefined()
    expect(store.list()).toEqual([])
  })

  it('返回的是副本，外部修改不影响内部数据', () => {
    const store = createPostStore()
    const id = seed(store)

    const updated = store.setFavorited(id, true)
    if (!updated) throw new Error('收藏失败')
    updated.favorited = false

    expect(store.find(id)?.favorited).toBe(true)
  })
})

describe('点赞与收藏互不影响', () => {
  it('同时点赞与收藏后状态各自独立保持', () => {
    const store = createPostStore()
    const created = store.create('芳草鲜美')
    if (!created.ok) throw new Error('创建失败')
    const id = created.post.id

    store.setLiked(id, true)
    store.setFavorited(id, true)
    const both = store.find(id)

    expect(both?.likes).toBe(1)
    expect(both?.liked).toBe(true)
    expect(both?.favorited).toBe(true)

    store.setLiked(id, false)
    const afterUnlike = store.find(id)

    expect(afterUnlike?.likes).toBe(0)
    expect(afterUnlike?.liked).toBe(false)
    expect(afterUnlike?.favorited).toBe(true)

    store.setFavorited(id, false)
    const afterUnfavorite = store.find(id)

    expect(afterUnfavorite?.favorited).toBe(false)
    expect(afterUnfavorite?.likes).toBe(0)
    expect(afterUnfavorite?.liked).toBe(false)
  })
})
