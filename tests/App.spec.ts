import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import { createPost, fetchPosts, setPostFavorited, setPostLiked } from '@/api/posts'
import type { Post } from '@/api/posts'
import { ACTION_ERROR_MESSAGE } from '@/stores/posts'

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

const NOW = 1_700_000_000_000

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    content: '一条心绪',
    createdAt: NOW,
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

let wrapper: VueWrapper | undefined

function mountApp(): VueWrapper {
  wrapper = mount(App, {
    global: { plugins: [createPinia()] },
    attachTo: document.body,
  })

  return wrapper
}

async function publish(target: VueWrapper, text: string): Promise<void> {
  const input = target.get<HTMLTextAreaElement>('[data-testid="composer-input"]')
  input.element.value = text
  await input.trigger('input')
  await target.get('form').trigger('submit')
  await flushPromises()
}

function noticeOf(target: VueWrapper) {
  return target.get('[data-testid="composer-notice"]')
}

beforeEach(() => {
  fetchPostsMock.mockReset()
  createPostMock.mockReset()
  setPostLikedMock.mockReset()
  setPostFavoritedMock.mockReset()
  window.localStorage.clear()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('App', () => {
  it('启动时从接口拉取内容并渲染，不再使用 localStorage', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    fetchPostsMock.mockResolvedValue([
      makePost({ id: 'newer', content: '刚写下的心绪', createdAt: NOW }),
      makePost({ id: 'older', content: '旧日心绪', createdAt: NOW - 60_000 }),
    ])

    const app = mountApp()
    await flushPromises()

    const items = app.findAll('[data-testid="post-item"]')

    expect(fetchPostsMock).toHaveBeenCalledTimes(1)
    expect(items).toHaveLength(2)
    expect(app.get('[data-testid="post-total"]').text()).toBe('共 2 条')
    expect(items[0].text()).toContain('刚写下的心绪')
    expect(items[1].text()).toContain('旧日心绪')
    expect(setItemSpy).not.toHaveBeenCalled()
    expect(window.localStorage.length).toBe(0)
  })

  it('首屏加载期间展示占位骨架且不展示空状态', async () => {
    const request = deferred<Post[]>()
    fetchPostsMock.mockReturnValue(request.promise)

    const app = mountApp()

    expect(app.find('[data-testid="timeline-loading"]').exists()).toBe(true)
    expect(app.find('[data-testid="empty-state"]').exists()).toBe(false)

    request.resolve([makePost({ content: '终于到了' })])
    await flushPromises()

    expect(app.find('[data-testid="timeline-loading"]').exists()).toBe(false)
    expect(app.findAll('[data-testid="post-item"]')).toHaveLength(1)
    expect(app.text()).toContain('终于到了')
  })

  it('加载失败时给出可重试提示，重试成功后展示内容', async () => {
    fetchPostsMock.mockRejectedValueOnce(new Error('Failed to fetch'))

    const app = mountApp()
    await flushPromises()

    const alert = app.get('[data-testid="load-error"]')

    expect(alert.text()).toContain('内容加载失败')
    expect(alert.text()).toContain('请确认服务已启动')
    expect(app.findAll('[data-testid="post-item"]')).toHaveLength(0)

    fetchPostsMock.mockResolvedValueOnce([makePost({ content: '重试拿到的内容' })])
    await app.get('[data-testid="retry-button"]').trigger('click')
    await flushPromises()

    expect(fetchPostsMock).toHaveBeenCalledTimes(2)
    expect(app.find('[data-testid="load-error"]').exists()).toBe(false)
    expect(app.text()).toContain('重试拿到的内容')
  })

  it('发布成功后置顶展示、清空输入框并提示已保存到服务器', async () => {
    fetchPostsMock.mockResolvedValue([])
    createPostMock.mockResolvedValue(makePost({ id: 'new', content: '今天的风很温柔' }))

    const app = mountApp()
    await flushPromises()

    await publish(app, '  今天的风很温柔  ')

    const items = app.findAll('[data-testid="post-item"]')

    expect(createPostMock).toHaveBeenCalledWith('今天的风很温柔')
    expect(items).toHaveLength(1)
    expect(items[0].text()).toContain('今天的风很温柔')
    expect(app.get('[data-testid="post-total"]').text()).toBe('共 1 条')
    expect(app.get<HTMLTextAreaElement>('[data-testid="composer-input"]').element.value).toBe('')
    expect(noticeOf(app).text()).toContain('已保存到服务器')
    expect(noticeOf(app).classes()).toContain('is-ok')
    expect(window.localStorage.length).toBe(0)
  })

  it('多次发布时最新内容排在最前面', async () => {
    fetchPostsMock.mockResolvedValue([])
    createPostMock
      .mockResolvedValueOnce(makePost({ id: '1', content: '第一句' }))
      .mockResolvedValueOnce(makePost({ id: '2', content: '第二句' }))

    const app = mountApp()
    await flushPromises()

    await publish(app, '第一句')
    await publish(app, '第二句')

    const items = app.findAll('[data-testid="post-item"]')

    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('第二句')
    expect(items[1].text()).toContain('第一句')
  })

  it('发布失败时给出错误提示，且不新增任何内容', async () => {
    fetchPostsMock.mockResolvedValue([])
    createPostMock.mockRejectedValue(new Error('Failed to fetch'))

    const app = mountApp()
    await flushPromises()

    await publish(app, '发不出去的心绪')

    expect(app.findAll('[data-testid="post-item"]')).toHaveLength(0)
    expect(noticeOf(app).text()).toContain('发布失败')
    expect(noticeOf(app).classes()).toContain('is-error')
  })

  it('提交空内容时只提示，不发起请求', async () => {
    fetchPostsMock.mockResolvedValue([])

    const app = mountApp()
    await flushPromises()

    await publish(app, '   ')

    expect(createPostMock).not.toHaveBeenCalled()
    expect(app.findAll('[data-testid="post-item"]')).toHaveLength(0)
    expect(noticeOf(app).text()).toContain('先写点什么')
    expect(noticeOf(app).classes()).toContain('is-error')
  })

  it('内容超长时提示并拒绝发布，草稿保留在输入框', async () => {
    fetchPostsMock.mockResolvedValue([])

    const app = mountApp()
    await flushPromises()

    await publish(app, '花'.repeat(281))

    expect(createPostMock).not.toHaveBeenCalled()
    expect(app.findAll('[data-testid="post-item"]')).toHaveLength(0)
    expect(noticeOf(app).text()).toContain('超过 280 字')
    expect(noticeOf(app).classes()).toContain('is-error')
    expect(app.get<HTMLTextAreaElement>('[data-testid="composer-input"]').element.value).toHaveLength(
      281,
    )
  })
})

describe('App 点赞', () => {
  it('点击点赞后计数 +1，再点一次回到 0 并派发正确的接口调用', async () => {
    fetchPostsMock.mockResolvedValue([makePost({ id: 'a', content: '一条心绪', likes: 0 })])
    setPostLikedMock
      .mockResolvedValueOnce(makePost({ id: 'a', content: '一条心绪', likes: 1, liked: true }))
      .mockResolvedValueOnce(makePost({ id: 'a', content: '一条心绪', likes: 0, liked: false }))

    const app = mountApp()
    await flushPromises()

    expect(app.get('[data-testid="like-count"]').text()).toBe('0')

    await app.get('[data-testid="like-button"]').trigger('click')
    await flushPromises()

    expect(setPostLikedMock).toHaveBeenNthCalledWith(1, 'a', true)
    expect(app.get('[data-testid="like-count"]').text()).toBe('1')
    expect(app.get('[data-testid="like-button"]').attributes('aria-pressed')).toBe('true')
    expect(noticeOf(app).text()).toContain('已点赞')

    await app.get('[data-testid="like-button"]').trigger('click')
    await flushPromises()

    expect(setPostLikedMock).toHaveBeenNthCalledWith(2, 'a', false)
    expect(app.get('[data-testid="like-count"]').text()).toBe('0')
    expect(app.get('[data-testid="like-button"]').attributes('aria-pressed')).toBe('false')
    expect(noticeOf(app).text()).toContain('已取消点赞')
    expect(app.findAll('[data-testid="post-item"]')).toHaveLength(1)
  })

  it('点赞失败时提示统一错误文案，且数据保持原样', async () => {
    fetchPostsMock.mockResolvedValue([makePost({ id: 'a', likes: 2 })])
    setPostLikedMock.mockRejectedValue(new Error('Failed to fetch'))

    const app = mountApp()
    await flushPromises()

    await app.get('[data-testid="like-button"]').trigger('click')
    await flushPromises()

    expect(noticeOf(app).text()).toContain(ACTION_ERROR_MESSAGE)
    expect(noticeOf(app).classes()).toContain('is-error')
    expect(app.get('[data-testid="like-count"]').text()).toBe('2')
    expect(app.get('[data-testid="like-button"]').attributes('aria-pressed')).toBe('false')
  })
})

describe('App 收藏与筛选', () => {
  it('收藏后「只看收藏」只剩该条，切回「全部」恢复全部', async () => {
    fetchPostsMock.mockResolvedValue([
      makePost({ id: 'a', content: '第一条', createdAt: NOW }),
      makePost({ id: 'b', content: '第二条', createdAt: NOW - 1000 }),
    ])
    setPostFavoritedMock.mockResolvedValue(
      makePost({ id: 'b', content: '第二条', createdAt: NOW - 1000, favorited: true }),
    )

    const app = mountApp()
    await flushPromises()

    expect(app.get('[data-testid="filter-all"]').attributes('aria-pressed')).toBe('true')
    expect(app.get('[data-testid="filter-favorites"]').text().trim()).toBe('只看收藏 0')

    await app.findAll('[data-testid="favorite-button"]')[1].trigger('click')
    await flushPromises()

    expect(setPostFavoritedMock).toHaveBeenCalledWith('b', true)
    expect(app.get('[data-testid="filter-favorites"]').text().trim()).toBe('只看收藏 1')
    expect(noticeOf(app).text()).toContain('已收藏')

    await app.get('[data-testid="filter-favorites"]').trigger('click')

    const items = app.findAll('[data-testid="post-item"]')

    expect(app.get('[data-testid="filter-favorites"]').attributes('aria-pressed')).toBe('true')
    expect(app.get('[data-testid="filter-all"]').attributes('aria-pressed')).toBe('false')
    expect(items).toHaveLength(1)
    expect(items[0].text()).toContain('第二条')
    expect(app.get('[data-testid="post-total"]').text()).toBe('共 1 条')

    await app.get('[data-testid="filter-all"]').trigger('click')

    expect(app.findAll('[data-testid="post-item"]')).toHaveLength(2)
    expect(app.get('[data-testid="post-total"]').text()).toBe('共 2 条')
  })

  it('取消收藏后从「只看收藏」中消失', async () => {
    fetchPostsMock.mockResolvedValue([makePost({ id: 'a', favorited: true })])
    setPostFavoritedMock.mockResolvedValue(makePost({ id: 'a', favorited: false }))

    const app = mountApp()
    await flushPromises()

    await app.get('[data-testid="filter-favorites"]').trigger('click')
    expect(app.findAll('[data-testid="post-item"]')).toHaveLength(1)

    await app.get('[data-testid="favorite-button"]').trigger('click')
    await flushPromises()

    expect(app.findAll('[data-testid="post-item"]')).toHaveLength(0)
    expect(app.get('[data-testid="post-total"]').text()).toBe('共 0 条')
    expect(noticeOf(app).text()).toContain('已取消收藏')
  })

  it('「只看收藏」且无收藏时展示引导提示，切回「全部」后隐藏', async () => {
    fetchPostsMock.mockResolvedValue([makePost({ id: 'a', content: '还没收藏' })])

    const app = mountApp()
    await flushPromises()

    expect(app.find('[data-testid="favorites-empty"]').exists()).toBe(false)

    await app.get('[data-testid="filter-favorites"]').trigger('click')

    const hint = app.get('[data-testid="favorites-empty"]')

    expect(hint.text()).toContain('还没有收藏')
    expect(app.findAll('[data-testid="post-item"]')).toHaveLength(0)

    await app.get('[data-testid="filter-all"]').trigger('click')

    expect(app.find('[data-testid="favorites-empty"]').exists()).toBe(false)
    expect(app.findAll('[data-testid="post-item"]')).toHaveLength(1)
  })

  it('收藏失败时提示统一错误文案，收藏数量不变', async () => {
    fetchPostsMock.mockResolvedValue([makePost({ id: 'a' })])
    setPostFavoritedMock.mockRejectedValue(new Error('Failed to fetch'))

    const app = mountApp()
    await flushPromises()

    await app.get('[data-testid="favorite-button"]').trigger('click')
    await flushPromises()

    expect(noticeOf(app).text()).toContain(ACTION_ERROR_MESSAGE)
    expect(noticeOf(app).classes()).toContain('is-error')
    expect(app.get('[data-testid="filter-favorites"]').text().trim()).toBe('只看收藏 0')
    expect(app.get('[data-testid="favorite-button"]').attributes('aria-pressed')).toBe('false')
  })
})
