import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createPost, fetchPosts, setPostFavorited, setPostLiked } from '@/api/posts'
import { ACTION_ERROR_MESSAGE, MAX_CONTENT_LENGTH, usePostsStore } from '@/stores/posts'
import type { Post } from '@/stores/posts'

vi.mock('@/api/posts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/posts')>()

  return {
    ...actual,
    fetchPosts: vi.fn(),
    createPost: vi.fn(),
    setPostLiked: vi.fn(),
    setPostFavorited: vi.fn(),
  }
})

const fetchPostsMock = vi.mocked(fetchPosts)
const createPostMock = vi.mocked(createPost)
const setPostLikedMock = vi.mocked(setPostLiked)
const setPostFavoritedMock = vi.mocked(setPostFavorited)

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    content: '一条心绪',
    createdAt: 1_700_000_000_000,
    likes: 0,
    liked: false,
    favorited: false,
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

async function loadWith(posts: Post[]): Promise<ReturnType<typeof usePostsStore>> {
  fetchPostsMock.mockResolvedValue(posts)

  const store = usePostsStore()
  await store.load()

  return store
}

beforeEach(() => {
  setActivePinia(createPinia())
  fetchPostsMock.mockReset()
  createPostMock.mockReset()
  setPostLikedMock.mockReset()
  setPostFavoritedMock.mockReset()
})

describe('常量导出', () => {
  it('store 透出与后端一致的最大长度', () => {
    expect(MAX_CONTENT_LENGTH).toBe(280)
  })

  it('操作失败统一使用固定文案', () => {
    expect(ACTION_ERROR_MESSAGE).toBe('操作失败，请稍后重试')
  })
})

describe('load', () => {
  it('拉取列表后填充状态并标记就绪', async () => {
    const posts = [makePost({ id: 'b', content: '新的' }), makePost({ id: 'a', content: '旧的' })]
    fetchPostsMock.mockResolvedValue(posts)

    const store = usePostsStore()
    await expect(store.load()).resolves.toBe(true)

    expect(fetchPostsMock).toHaveBeenCalledTimes(1)
    expect(store.posts.map((post) => post.id)).toEqual(['b', 'a'])
    expect(store.total).toBe(2)
    expect(store.isEmpty).toBe(false)
    expect(store.ready).toBe(true)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('请求进行中 loading 为 true 且尚未就绪', async () => {
    const request = deferred<Post[]>()
    fetchPostsMock.mockReturnValue(request.promise)

    const store = usePostsStore()
    const pending = store.load()

    expect(store.loading).toBe(true)
    expect(store.ready).toBe(false)

    request.resolve([])
    await expect(pending).resolves.toBe(true)

    expect(store.loading).toBe(false)
    expect(store.ready).toBe(true)
    expect(store.isEmpty).toBe(true)
  })

  it('请求失败时记录错误文案、标记就绪且不抛出异常', async () => {
    fetchPostsMock.mockRejectedValue(new Error('connect ECONNREFUSED'))

    const store = usePostsStore()

    await expect(store.load()).resolves.toBe(false)

    expect(store.posts).toEqual([])
    expect(store.ready).toBe(true)
    expect(store.loading).toBe(false)
    expect(store.error).toContain('加载失败')
  })

  it('并发调用只发起一次请求，两个结果一致', async () => {
    const request = deferred<Post[]>()
    fetchPostsMock.mockReturnValue(request.promise)

    const store = usePostsStore()
    const first = store.load()
    const second = store.load()

    expect(fetchPostsMock).toHaveBeenCalledTimes(1)

    request.resolve([makePost()])

    await expect(first).resolves.toBe(true)
    await expect(second).resolves.toBe(true)
    expect(store.posts).toHaveLength(1)
  })

  it('结束后再次 load 会重新请求并替换列表', async () => {
    fetchPostsMock.mockResolvedValueOnce([makePost({ id: 'a' })])
    fetchPostsMock.mockResolvedValueOnce([makePost({ id: 'c' }), makePost({ id: 'a' })])

    const store = usePostsStore()
    await store.load()
    expect(store.posts).toHaveLength(1)

    await store.load()

    expect(fetchPostsMock).toHaveBeenCalledTimes(2)
    expect(store.posts.map((post) => post.id)).toEqual(['c', 'a'])
  })

  it('失败后重试成功会清空错误文案', async () => {
    fetchPostsMock.mockRejectedValueOnce(new Error('boom'))
    fetchPostsMock.mockResolvedValueOnce([makePost()])

    const store = usePostsStore()
    await expect(store.load()).resolves.toBe(false)
    expect(store.error).not.toBeNull()

    await expect(store.load()).resolves.toBe(true)
    expect(store.error).toBeNull()
    expect(store.posts).toHaveLength(1)
  })
})

describe('addPost', () => {
  it('空内容与纯空白不发起请求', async () => {
    const store = usePostsStore()

    await expect(store.addPost('')).resolves.toEqual({ ok: false, reason: 'empty' })
    await expect(store.addPost('   \n  ')).resolves.toEqual({ ok: false, reason: 'empty' })

    expect(createPostMock).not.toHaveBeenCalled()
    expect(store.posts).toEqual([])
    expect(store.error).toBeNull()
  })

  it('超过最大长度不发起请求', async () => {
    const store = usePostsStore()

    await expect(store.addPost('花'.repeat(MAX_CONTENT_LENGTH + 1))).resolves.toEqual({
      ok: false,
      reason: 'too-long',
    })

    expect(createPostMock).not.toHaveBeenCalled()
    expect(store.posts).toEqual([])
  })

  it('恰好达到上限时可以发布', async () => {
    const content = '花'.repeat(MAX_CONTENT_LENGTH)
    createPostMock.mockResolvedValue(makePost({ content }))

    const store = usePostsStore()
    const result = await store.addPost(content)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) return

    expect(createPostMock).toHaveBeenCalledWith(content)
    expect(store.posts[0].content).toHaveLength(MAX_CONTENT_LENGTH)
  })

  it('去除首尾空白后提交，并把服务端返回的记录置顶', async () => {
    fetchPostsMock.mockResolvedValue([makePost({ id: 'old', content: '旧的心绪' })])
    createPostMock.mockResolvedValue(makePost({ id: 'new', content: '新的心绪' }))

    const store = usePostsStore()
    await store.load()

    const result = await store.addPost('  新的心绪  ')

    expect(createPostMock).toHaveBeenCalledWith('新的心绪')
    expect(result).toMatchObject({ ok: true, post: { id: 'new', content: '新的心绪' } })
    expect(store.posts.map((post) => post.id)).toEqual(['new', 'old'])
    expect(store.total).toBe(2)
    expect(store.error).toBeNull()
  })

  it('服务端失败时返回 request-failed 且不污染列表', async () => {
    fetchPostsMock.mockResolvedValue([makePost({ id: 'old', content: '旧的心绪' })])
    createPostMock.mockRejectedValue(new Error('Failed to fetch'))

    const store = usePostsStore()
    await store.load()

    await expect(store.addPost('发不出去的心绪')).resolves.toEqual({
      ok: false,
      reason: 'request-failed',
    })

    expect(store.posts.map((post) => post.id)).toEqual(['old'])
    expect(store.error).toContain('发布失败')
  })

  it('发布成功会清除上一次的错误文案', async () => {
    createPostMock.mockRejectedValueOnce(new Error('boom'))
    createPostMock.mockResolvedValueOnce(makePost({ id: 'new' }))

    const store = usePostsStore()
    await store.addPost('第一次失败')
    expect(store.error).not.toBeNull()

    await store.addPost('第二次成功')

    expect(store.error).toBeNull()
    expect(store.posts).toHaveLength(1)
  })
})

describe('toggleLike', () => {
  it('未点赞时调用 setPostLiked(id, true)，并用服务端结果替换列表项且保持顺序', async () => {
    const store = await loadWith([
      makePost({ id: 'a', content: '第一条' }),
      makePost({ id: 'b', content: '第二条' }),
      makePost({ id: 'c', content: '第三条' }),
    ])
    setPostLikedMock.mockResolvedValue(makePost({ id: 'b', content: '第二条', likes: 1, liked: true }))

    await expect(store.toggleLike('b')).resolves.toBe(true)

    expect(setPostLikedMock).toHaveBeenCalledWith('b', true)
    expect(store.posts.map((post) => post.id)).toEqual(['a', 'b', 'c'])
    expect(store.posts[1]).toMatchObject({ id: 'b', likes: 1, liked: true })
    expect(store.posts[0].liked).toBe(false)
    expect(store.error).toBeNull()
  })

  it('已点赞时调用 setPostLiked(id, false)，计数与标记跟随服务端', async () => {
    const store = await loadWith([makePost({ id: 'a', likes: 3, liked: true })])
    setPostLikedMock.mockResolvedValue(makePost({ id: 'a', likes: 2, liked: false }))

    await expect(store.toggleLike('a')).resolves.toBe(true)

    expect(setPostLikedMock).toHaveBeenCalledWith('a', false)
    expect(store.posts[0]).toMatchObject({ likes: 2, liked: false })
  })

  it('替换列表项会产生新数组，便于响应式更新', async () => {
    const store = await loadWith([makePost({ id: 'a' })])
    const before = store.posts
    setPostLikedMock.mockResolvedValue(makePost({ id: 'a', likes: 1, liked: true }))

    await store.toggleLike('a')

    expect(store.posts).not.toBe(before)
  })

  it('请求失败时返回 false、写入统一错误文案且不改动列表', async () => {
    const store = await loadWith([makePost({ id: 'a', content: '保持原样' })])
    setPostLikedMock.mockRejectedValue(new Error('Failed to fetch'))

    await expect(store.toggleLike('a')).resolves.toBe(false)

    expect(store.error).toBe(ACTION_ERROR_MESSAGE)
    expect(store.posts[0]).toMatchObject({ id: 'a', likes: 0, liked: false })
  })

  it('失败后再成功会清除错误文案', async () => {
    const store = await loadWith([makePost({ id: 'a' })])
    setPostLikedMock.mockRejectedValueOnce(new Error('boom'))
    setPostLikedMock.mockResolvedValueOnce(makePost({ id: 'a', likes: 1, liked: true }))

    await store.toggleLike('a')
    expect(store.error).toBe(ACTION_ERROR_MESSAGE)

    await expect(store.toggleLike('a')).resolves.toBe(true)
    expect(store.error).toBeNull()
  })

  it('id 不存在时不发请求，返回 false 并写错误文案', async () => {
    const store = await loadWith([makePost({ id: 'a' })])

    await expect(store.toggleLike('missing')).resolves.toBe(false)

    expect(setPostLikedMock).not.toHaveBeenCalled()
    expect(store.error).toBe(ACTION_ERROR_MESSAGE)
    expect(store.posts).toHaveLength(1)
  })
})

describe('toggleFavorite', () => {
  it('未收藏时调用 setPostFavorited(id, true)，收藏列表随之更新', async () => {
    const store = await loadWith([
      makePost({ id: 'a', content: '第一条' }),
      makePost({ id: 'b', content: '第二条' }),
    ])
    setPostFavoritedMock.mockResolvedValue(makePost({ id: 'a', content: '第一条', favorited: true }))

    await expect(store.toggleFavorite('a')).resolves.toBe(true)

    expect(setPostFavoritedMock).toHaveBeenCalledWith('a', true)
    expect(store.posts.map((post) => post.id)).toEqual(['a', 'b'])
    expect(store.posts[0].favorited).toBe(true)
    expect(store.favoritePosts.map((post) => post.id)).toEqual(['a'])
    expect(store.favoriteCount).toBe(1)
  })

  it('已收藏时调用 setPostFavorited(id, false)，并从收藏列表移除', async () => {
    const store = await loadWith([makePost({ id: 'a', favorited: true })])
    expect(store.favoriteCount).toBe(1)

    setPostFavoritedMock.mockResolvedValue(makePost({ id: 'a', favorited: false }))

    await expect(store.toggleFavorite('a')).resolves.toBe(true)

    expect(setPostFavoritedMock).toHaveBeenCalledWith('a', false)
    expect(store.favoritePosts).toEqual([])
    expect(store.favoriteCount).toBe(0)
  })

  it('请求失败时返回 false 且保持原收藏状态', async () => {
    const store = await loadWith([makePost({ id: 'a', favorited: true })])
    setPostFavoritedMock.mockRejectedValue(new Error('boom'))

    await expect(store.toggleFavorite('a')).resolves.toBe(false)

    expect(store.error).toBe(ACTION_ERROR_MESSAGE)
    expect(store.favoriteCount).toBe(1)
    expect(store.posts[0].favorited).toBe(true)
  })

  it('id 不存在时不发请求，返回 false 并写错误文案', async () => {
    const store = await loadWith([makePost({ id: 'a' })])

    await expect(store.toggleFavorite('missing')).resolves.toBe(false)

    expect(setPostFavoritedMock).not.toHaveBeenCalled()
    expect(store.error).toBe(ACTION_ERROR_MESSAGE)
  })

  it('favoritePosts 只包含已收藏项且保持原顺序', async () => {
    const store = await loadWith([
      makePost({ id: 'a', favorited: true }),
      makePost({ id: 'b', favorited: false }),
      makePost({ id: 'c', favorited: true }),
    ])

    expect(store.favoritePosts.map((post) => post.id)).toEqual(['a', 'c'])
    expect(store.favoriteCount).toBe(2)
  })
})
