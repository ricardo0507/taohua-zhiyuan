import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  MAX_CONTENT_LENGTH,
  createPost,
  deletePost,
  fetchPosts,
  setPostFavorited,
  setPostLiked,
} from '@/api/posts'

const fetchMock = vi.fn<typeof fetch>()

/** 后端新增字段：未点赞未收藏的默认状态 */
const IDLE_FLAGS = { likes: 0, liked: false, favorited: false }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function errorResponse(code: string, message: string, status: number): Response {
  return jsonResponse({ error: { code, message } }, status)
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/plain' } })
}

function callAt(index = 0): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls[index]
  if (!call) throw new Error(`缺少第 ${index} 次 fetch 调用`)

  return { url: String(call[0]), init: call[1] ?? {} }
}

function headerOf(init: RequestInit, name: string): string | null {
  return new Headers(init.headers).get(name)
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('常量与契约', () => {
  it('最大内容长度与后端保持一致', () => {
    expect(MAX_CONTENT_LENGTH).toBe(280)
  })
})

describe('fetchPosts', () => {
  it('用 GET 请求 /api/posts 并返回接口中的列表', async () => {
    const posts = [
      { id: 'b', content: '较新的', createdAt: 1_700_000_100_000, ...IDLE_FLAGS },
      { id: 'a', content: '较旧的', createdAt: 1_700_000_000_000, ...IDLE_FLAGS },
    ]
    fetchMock.mockResolvedValue(jsonResponse({ posts }))

    await expect(fetchPosts()).resolves.toEqual(posts)

    const { url, init } = callAt()
    expect(url).toBe('/api/posts')
    expect(init.method).toBe('GET')
  })

  it('把 AbortSignal 透传给 fetch', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ posts: [] }))
    const controller = new AbortController()

    await fetchPosts(controller.signal)

    expect(callAt().init.signal).toBe(controller.signal)
  })

  it('丢弃结构不完整的记录', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        posts: [
          null,
          { content: '缺少 id' },
          { id: 'x', content: 123, createdAt: 1 },
          { id: 'ok', content: '合法记录', createdAt: 1_700_000_000_000, ...IDLE_FLAGS },
        ],
      }),
    )

    await expect(fetchPosts()).resolves.toEqual([
      { id: 'ok', content: '合法记录', createdAt: 1_700_000_000_000, ...IDLE_FLAGS },
    ])
  })

  it('缺少点赞/收藏字段的老记录仍保留，并补齐默认值（向后兼容）', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        posts: [{ id: 'legacy', content: '老数据', createdAt: 1_700_000_000_000 }],
      }),
    )

    await expect(fetchPosts()).resolves.toEqual([
      { id: 'legacy', content: '老数据', createdAt: 1_700_000_000_000, ...IDLE_FLAGS },
    ])
  })

  it('点赞数为非法值或负数时归零，布尔标记非布尔时归 false', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        posts: [
          { id: 'a', content: '负数', createdAt: 1, likes: -3, liked: 'yes', favorited: 1 },
          { id: 'b', content: '非数字', createdAt: 1, likes: 'many', liked: null, favorited: {} },
          { id: 'c', content: '正常', createdAt: 1, likes: 7, liked: true, favorited: true },
        ],
      }),
    )

    await expect(fetchPosts()).resolves.toEqual([
      { id: 'a', content: '负数', createdAt: 1, ...IDLE_FLAGS },
      { id: 'b', content: '非数字', createdAt: 1, ...IDLE_FLAGS },
      { id: 'c', content: '正常', createdAt: 1, likes: 7, liked: true, favorited: true },
    ])
  })

  it('响应体缺少 posts 数组时抛出 ApiError，而不是静默返回空列表', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ posts: 'oops' }))

    const error = await fetchPosts().catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'INVALID_RESPONSE', status: 200 })
  })

  it('服务端返回非 2xx 时抛出 ApiError', async () => {
    fetchMock.mockResolvedValue(errorResponse('INTERNAL_ERROR', '服务器开小差了', 500))

    const error = await fetchPosts().catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 500,
      message: '服务器开小差了',
    })
  })
})

describe('createPost', () => {
  it('以 JSON 提交 content 并返回服务端创建的记录', async () => {
    const post = { id: 'new', content: '今天的风很温柔', createdAt: 1_700_000_200_000, ...IDLE_FLAGS }
    fetchMock.mockResolvedValue(jsonResponse({ post }, 201))

    await expect(createPost('今天的风很温柔')).resolves.toEqual(post)

    const { url, init } = callAt()
    expect(url).toBe('/api/posts')
    expect(init.method).toBe('POST')
    expect(headerOf(init, 'content-type')).toBe('application/json')
    expect(init.body).toBe(JSON.stringify({ content: '今天的风很温柔' }))
  })

  it('400 CONTENT_TOO_LONG 映射为带状态码的 ApiError', async () => {
    fetchMock.mockResolvedValue(errorResponse('CONTENT_TOO_LONG', '内容不能超过 280 字', 400))

    const error = await createPost('花'.repeat(281)).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      code: 'CONTENT_TOO_LONG',
      status: 400,
      message: '内容不能超过 280 字',
    })
  })

  it('400 EMPTY_CONTENT 映射为带状态码的 ApiError', async () => {
    fetchMock.mockResolvedValue(errorResponse('EMPTY_CONTENT', '内容不能为空', 400))

    const error = await createPost('   ').catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'EMPTY_CONTENT', status: 400, message: '内容不能为空' })
  })

  it('错误体不是 JSON 时使用兜底文案', async () => {
    fetchMock.mockResolvedValue(textResponse('<html>500</html>', 502))

    const error = await createPost('随便写点什么').catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'UNKNOWN_ERROR', status: 502 })
    expect((error as ApiError).message).toContain('502')
  })

  it('网络异常包装为 NETWORK_ERROR，状态码为 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await createPost('网络断了').catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'NETWORK_ERROR', status: 0 })
    expect((error as ApiError).message).toContain('服务')
  })

  it('响应体缺少 post 字段时抛出 ApiError', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 201))

    const error = await createPost('返回体异常').catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('INVALID_RESPONSE')
  })
})

describe('deletePost', () => {
  it('204 时正常结束并请求对应资源', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(deletePost('post 1')).resolves.toBeUndefined()

    const { url, init } = callAt()
    expect(url).toBe('/api/posts/post%201')
    expect(init.method).toBe('DELETE')
  })

  it('404 时抛出 NOT_FOUND 的 ApiError', async () => {
    fetchMock.mockResolvedValue(errorResponse('NOT_FOUND', '内容不存在', 404))

    const error = await deletePost('missing').catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'NOT_FOUND', status: 404, message: '内容不存在' })
  })
})

describe('setPostLiked', () => {
  it('点赞时用 PUT 请求 /posts/:id/like，不带请求体与 Content-Type', async () => {
    const post = { id: 'p 1', content: '一条心绪', createdAt: 1, likes: 1, liked: true, favorited: false }
    fetchMock.mockResolvedValue(jsonResponse({ post }))

    await expect(setPostLiked('p 1', true)).resolves.toEqual(post)

    const { url, init } = callAt()
    expect(url).toBe('/api/posts/p%201/like')
    expect(init.method).toBe('PUT')
    expect(init.body).toBeUndefined()
    expect(headerOf(init, 'content-type')).toBeNull()
  })

  it('取消点赞时用 DELETE 请求同一路径', async () => {
    const post = { id: 'p1', content: '一条心绪', createdAt: 1, ...IDLE_FLAGS }
    fetchMock.mockResolvedValue(jsonResponse({ post }))

    await expect(setPostLiked('p1', false)).resolves.toEqual(post)

    const { url, init } = callAt()
    expect(url).toBe('/api/posts/p1/like')
    expect(init.method).toBe('DELETE')
    expect(init.body).toBeUndefined()
    expect(headerOf(init, 'content-type')).toBeNull()
  })

  it('响应缺少 post 时抛出 INVALID_RESPONSE', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ post: { id: 'p1' } }))

    const error = await setPostLiked('p1', true).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'INVALID_RESPONSE', status: 200 })
  })

  it('响应体不是对象时抛出 INVALID_RESPONSE', async () => {
    fetchMock.mockResolvedValue(textResponse('ok', 200))

    const error = await setPostLiked('p1', true).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('INVALID_RESPONSE')
  })

  it('返回体缺少点赞字段时补齐默认值', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ post: { id: 'p1', content: '一条心绪', createdAt: 1 } }),
    )

    await expect(setPostLiked('p1', true)).resolves.toEqual({
      id: 'p1',
      content: '一条心绪',
      createdAt: 1,
      ...IDLE_FLAGS,
    })
  })

  it('404 NOT_FOUND 透传错误码与状态码', async () => {
    fetchMock.mockResolvedValue(errorResponse('NOT_FOUND', '内容不存在', 404))

    const error = await setPostLiked('missing', true).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'NOT_FOUND', status: 404, message: '内容不存在' })
  })

  it('网络异常包装为 NETWORK_ERROR', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await setPostLiked('p1', true).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('NETWORK_ERROR')
  })
})

describe('setPostFavorited', () => {
  it('收藏时用 PUT 请求 /posts/:id/favorite，不带请求体与 Content-Type', async () => {
    const post = { id: 'p1', content: '一条心绪', createdAt: 1, likes: 0, liked: false, favorited: true }
    fetchMock.mockResolvedValue(jsonResponse({ post }))

    await expect(setPostFavorited('p1', true)).resolves.toEqual(post)

    const { url, init } = callAt()
    expect(url).toBe('/api/posts/p1/favorite')
    expect(init.method).toBe('PUT')
    expect(init.body).toBeUndefined()
    expect(headerOf(init, 'content-type')).toBeNull()
  })

  it('取消收藏时用 DELETE 请求同一路径', async () => {
    const post = { id: 'p 1', content: '一条心绪', createdAt: 1, ...IDLE_FLAGS }
    fetchMock.mockResolvedValue(jsonResponse({ post }))

    await expect(setPostFavorited('p 1', false)).resolves.toEqual(post)

    const { url, init } = callAt()
    expect(url).toBe('/api/posts/p%201/favorite')
    expect(init.method).toBe('DELETE')
  })

  it('响应结构不合法时抛出 INVALID_RESPONSE', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))

    const error = await setPostFavorited('p1', true).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('INVALID_RESPONSE')
  })

  it('500 时透传错误码', async () => {
    fetchMock.mockResolvedValue(errorResponse('INTERNAL_ERROR', '服务器开小差了', 500))

    const error = await setPostFavorited('p1', true).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'INTERNAL_ERROR', status: 500, message: '服务器开小差了' })
  })
})
