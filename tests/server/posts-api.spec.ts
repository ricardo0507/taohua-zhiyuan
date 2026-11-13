// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../server/app'
import { createPostStore } from '../../server/post-store'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

interface ApiPost {
  id: string
  content: string
  createdAt: number
  likes: number
  liked: boolean
  favorited: boolean
}

function jsonPost(body: string): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  }
}

async function readJson(response: Response): Promise<unknown> {
  return response.json()
}

async function expectJsonContentType(response: Response): Promise<unknown> {
  expect(response.headers.get('content-type')).toContain('application/json')
  return readJson(response)
}

function expectError(payload: unknown, code: string, message: string): void {
  expect(payload).toEqual({ error: { code, message } })
}

/** 走 HTTP 接口建一条内容，返回服务端落库后的完整记录 */
async function createPost(app: ReturnType<typeof createApp>, content = '桃花源记'): Promise<ApiPost> {
  const response = await app.request('/api/posts', jsonPost(JSON.stringify({ content })))
  const payload = (await response.json()) as { post: ApiPost }

  return payload.post
}

function findByContent(posts: ApiPost[], content: string): ApiPost | undefined {
  return posts.find((post) => post.content === content)
}

function expectInteractionState(
  post: ApiPost,
  expected: { likes: number; liked: boolean; favorited: boolean },
): void {
  expect(post.likes).toBe(expected.likes)
  expect(post.liked).toBe(expected.liked)
  expect(post.favorited).toBe(expected.favorited)
  // 契约要求：likes 永远是非负整数
  expect(Number.isInteger(post.likes)).toBe(true)
  expect(post.likes).toBeGreaterThanOrEqual(0)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/health', () => {
  it('返回 200 与 ok 状态', async () => {
    const app = createApp()

    const response = await app.request('/api/health')

    expect(response.status).toBe(200)
    expect(await expectJsonContentType(response)).toEqual({ status: 'ok' })
  })
})

describe('GET /api/posts', () => {
  it('空仓储返回空列表', async () => {
    const app = createApp()

    const response = await app.request('/api/posts')

    expect(response.status).toBe(200)
    expect(await expectJsonContentType(response)).toEqual({ posts: [] })
  })

  it('返回已创建的内容并保持 createdAt 倒序', async () => {
    const now = vi.spyOn(Date, 'now')
    const app = createApp()

    now.mockReturnValue(1_000)
    await app.request('/api/posts', jsonPost(JSON.stringify({ content: '较早' })))
    now.mockReturnValue(2_000)
    await app.request('/api/posts', jsonPost(JSON.stringify({ content: '最新' })))

    const response = await app.request('/api/posts')
    const payload = (await expectJsonContentType(response)) as { posts: ApiPost[] }

    expect(payload.posts.map((post) => post.content)).toEqual(['最新', '较早'])
    expect(payload.posts.map((post) => post.createdAt)).toEqual([2_000, 1_000])
  })

  it('列表中的每条记录都带初始互动状态字段', async () => {
    const app = createApp()
    await createPost(app)

    const payload = (await (await app.request('/api/posts')).json()) as { posts: ApiPost[] }
    const [first] = payload.posts
    expect(first).toBeDefined()
    if (!first) return

    expectInteractionState(first, { likes: 0, liked: false, favorited: false })
  })

  it('不同的 app 实例之间数据互相隔离', async () => {
    const first = createApp()
    const second = createApp()

    await first.request('/api/posts', jsonPost(JSON.stringify({ content: '只属于第一个实例' })))

    expect(await (await first.request('/api/posts')).json()).toMatchObject({
      posts: [{ content: '只属于第一个实例' }],
    })
    expect(await (await second.request('/api/posts')).json()).toEqual({ posts: [] })
  })

  it('注入同一个仓储的多个 app 共享同一份数据', async () => {
    const store = createPostStore()
    const first = createApp(store)
    const second = createApp(store)

    await first.request('/api/posts', jsonPost(JSON.stringify({ content: '共享数据' })))

    expect(await (await second.request('/api/posts')).json()).toMatchObject({
      posts: [{ content: '共享数据' }],
    })
  })
})

describe('POST /api/posts', () => {
  it('创建成功返回 201、Location 与完整记录', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const app = createApp()

    const response = await app.request(
      '/api/posts',
      jsonPost(JSON.stringify({ content: '  采菊东篱下  ' })),
    )
    const payload = (await expectJsonContentType(response)) as { post: ApiPost }

    expect(response.status).toBe(201)
    expect(payload.post.id).toMatch(UUID_V4)
    expect(payload.post.content).toBe('采菊东篱下')
    expect(payload.post.createdAt).toBe(1_700_000_000_000)
    expect(Object.keys(payload.post)).toEqual([
      'id',
      'content',
      'createdAt',
      'likes',
      'liked',
      'favorited',
    ])
    expect(payload.post.likes).toBe(0)
    expect(payload.post.liked).toBe(false)
    expect(payload.post.favorited).toBe(false)
    expect(response.headers.get('location')).toBe(`/api/posts/${payload.post.id}`)
  })

  it('创建后可以通过列表接口读回', async () => {
    const app = createApp()

    const created = (await (
      await app.request('/api/posts', jsonPost(JSON.stringify({ content: '写下的内容' })))
    ).json()) as { post: ApiPost }

    const listed = (await (await app.request('/api/posts')).json()) as { posts: ApiPost[] }

    expect(listed.posts).toEqual([created.post])
  })

  it('恰好 280 字可以创建', async () => {
    const app = createApp()
    const content = '花'.repeat(280)

    const response = await app.request('/api/posts', jsonPost(JSON.stringify({ content })))
    const payload = (await response.json()) as { post: ApiPost }

    expect(response.status).toBe(201)
    expect(payload.post.content).toHaveLength(280)
  })

  it('空白内容返回 400 EMPTY_CONTENT', async () => {
    const app = createApp()

    const response = await app.request('/api/posts', jsonPost(JSON.stringify({ content: '   \n ' })))

    expect(response.status).toBe(400)
    expectError(await expectJsonContentType(response), 'EMPTY_CONTENT', '内容不能为空')
    expect(await (await app.request('/api/posts')).json()).toEqual({ posts: [] })
  })

  it('空字符串内容返回 400 EMPTY_CONTENT', async () => {
    const app = createApp()

    const response = await app.request('/api/posts', jsonPost(JSON.stringify({ content: '' })))

    expect(response.status).toBe(400)
    expectError(await response.json(), 'EMPTY_CONTENT', '内容不能为空')
  })

  it('缺少 content 字段返回 400 INVALID_BODY', async () => {
    const app = createApp()

    const response = await app.request('/api/posts', jsonPost(JSON.stringify({})))

    expect(response.status).toBe(400)
    expectError(await expectJsonContentType(response), 'INVALID_BODY', '请求内容格式不正确')
  })

  it('content 不是字符串时返回 400 INVALID_BODY', async () => {
    const app = createApp()

    const response = await app.request('/api/posts', jsonPost(JSON.stringify({ content: 42 })))

    expect(response.status).toBe(400)
    expectError(await response.json(), 'INVALID_BODY', '请求内容格式不正确')
  })

  it('请求体不是对象时返回 400 INVALID_BODY', async () => {
    const app = createApp()

    for (const body of ['null', '[]', '"文本"', '123']) {
      const response = await app.request('/api/posts', jsonPost(body))

      expect(response.status).toBe(400)
      expectError(await response.json(), 'INVALID_BODY', '请求内容格式不正确')
    }
  })

  it('非法 JSON 返回 400 INVALID_JSON', async () => {
    const app = createApp()

    const response = await app.request('/api/posts', jsonPost('{oops'))

    expect(response.status).toBe(400)
    expectError(await expectJsonContentType(response), 'INVALID_JSON', '请求内容不是合法的 JSON')
  })

  it('281 字返回 400 CONTENT_TOO_LONG', async () => {
    const app = createApp()

    const response = await app.request(
      '/api/posts',
      jsonPost(JSON.stringify({ content: '花'.repeat(281) })),
    )

    expect(response.status).toBe(400)
    expectError(await expectJsonContentType(response), 'CONTENT_TOO_LONG', '内容不能超过 280 字')
    expect(await (await app.request('/api/posts')).json()).toEqual({ posts: [] })
  })
})

describe('GET /api/posts/:id', () => {
  it('返回指定记录', async () => {
    const app = createApp()
    const created = (await (
      await app.request('/api/posts', jsonPost(JSON.stringify({ content: '按 id 查询' })))
    ).json()) as { post: ApiPost }

    const response = await app.request(`/api/posts/${created.post.id}`)
    const payload = (await expectJsonContentType(response)) as { post: ApiPost }

    expect(response.status).toBe(200)
    expect(payload).toEqual({ post: created.post })
    expectInteractionState(payload.post, { likes: 0, liked: false, favorited: false })
  })

  it('id 不存在返回 404 NOT_FOUND', async () => {
    const app = createApp()

    const response = await app.request('/api/posts/not-exist')

    expect(response.status).toBe(404)
    expectError(await expectJsonContentType(response), 'NOT_FOUND', '内容不存在')
  })
})

describe('DELETE /api/posts/:id', () => {
  it('删除成功返回 204 且无 body，列表随之清空', async () => {
    const app = createApp()
    const created = (await (
      await app.request('/api/posts', jsonPost(JSON.stringify({ content: '待删除' })))
    ).json()) as { post: ApiPost }

    const response = await app.request(`/api/posts/${created.post.id}`, { method: 'DELETE' })

    expect(response.status).toBe(204)
    expect(response.headers.get('content-type')).toBeNull()
    expect(await response.text()).toBe('')
    expect(await (await app.request('/api/posts')).json()).toEqual({ posts: [] })
  })

  it('重复删除同一条返回 404 NOT_FOUND', async () => {
    const app = createApp()
    const created = (await (
      await app.request('/api/posts', jsonPost(JSON.stringify({ content: '待删除' })))
    ).json()) as { post: ApiPost }

    await app.request(`/api/posts/${created.post.id}`, { method: 'DELETE' })
    const response = await app.request(`/api/posts/${created.post.id}`, { method: 'DELETE' })

    expect(response.status).toBe(404)
    expectError(await expectJsonContentType(response), 'NOT_FOUND', '内容不存在')
  })

  it('删除不存在的 id 返回 404 NOT_FOUND', async () => {
    const app = createApp()

    const response = await app.request('/api/posts/not-exist', { method: 'DELETE' })

    expect(response.status).toBe(404)
    expectError(await response.json(), 'NOT_FOUND', '内容不存在')
  })
})

describe('PUT /api/posts/:id/like', () => {
  it('点赞成功返回 200 与更新后的记录', async () => {
    const app = createApp()
    const created = await createPost(app)

    const response = await app.request(`/api/posts/${created.id}/like`, { method: 'PUT' })
    const payload = (await expectJsonContentType(response)) as { post: ApiPost }

    expect(response.status).toBe(200)
    expect(payload.post.id).toBe(created.id)
    expect(payload.post.content).toBe(created.content)
    expect(payload.post.createdAt).toBe(created.createdAt)
    expectInteractionState(payload.post, { likes: 1, liked: true, favorited: false })
    expect(Object.keys(payload.post)).toEqual([
      'id',
      'content',
      'createdAt',
      'likes',
      'liked',
      'favorited',
    ])
  })

  it('重复点赞保持幂等，likes 仍为 1', async () => {
    const app = createApp()
    const created = await createPost(app)

    await app.request(`/api/posts/${created.id}/like`, { method: 'PUT' })
    const repeated = await app.request(`/api/posts/${created.id}/like`, { method: 'PUT' })
    const payload = (await repeated.json()) as { post: ApiPost }

    expect(repeated.status).toBe(200)
    expect(payload.post.likes).toBe(1)
    expect(payload.post.liked).toBe(true)
  })

  it('点赞状态在列表与单条接口中同步可见', async () => {
    const app = createApp()
    const created = await createPost(app)

    await app.request(`/api/posts/${created.id}/like`, { method: 'PUT' })

    const single = (await (await app.request(`/api/posts/${created.id}`)).json()) as {
      post: ApiPost
    }
    const listed = (await (await app.request('/api/posts')).json()) as { posts: ApiPost[] }

    expectInteractionState(single.post, { likes: 1, liked: true, favorited: false })
    const target = findByContent(listed.posts, created.content)
    expect(target).toBeDefined()
    if (target) expectInteractionState(target, { likes: 1, liked: true, favorited: false })
  })

  it('id 不存在返回 404 NOT_FOUND', async () => {
    const app = createApp()

    const response = await app.request('/api/posts/not-exist/like', { method: 'PUT' })

    expect(response.status).toBe(404)
    expectError(await expectJsonContentType(response), 'NOT_FOUND', '内容不存在')
  })

  it('删除记录后点赞返回 404 NOT_FOUND', async () => {
    const app = createApp()
    const created = await createPost(app)

    await app.request(`/api/posts/${created.id}`, { method: 'DELETE' })
    const response = await app.request(`/api/posts/${created.id}/like`, { method: 'PUT' })

    expect(response.status).toBe(404)
    expectError(await expectJsonContentType(response), 'NOT_FOUND', '内容不存在')
  })

  it('不支持的 POST 方法仍落入兜底 404', async () => {
    const app = createApp()
    const created = await createPost(app)

    const response = await app.request(`/api/posts/${created.id}/like`, { method: 'POST' })

    expect(response.status).toBe(404)
    expectError(await expectJsonContentType(response), 'NOT_FOUND', '接口不存在')
  })
})

describe('DELETE /api/posts/:id/like', () => {
  it('取消点赞成功返回 200 且 likes 为 0', async () => {
    const app = createApp()
    const created = await createPost(app)

    await app.request(`/api/posts/${created.id}/like`, { method: 'PUT' })
    const response = await app.request(`/api/posts/${created.id}/like`, { method: 'DELETE' })
    const payload = (await expectJsonContentType(response)) as { post: ApiPost }

    expect(response.status).toBe(200)
    expectInteractionState(payload.post, { likes: 0, liked: false, favorited: false })
  })

  it('未点赞时取消点赞仍返回 200 且 likes 为 0', async () => {
    const app = createApp()
    const created = await createPost(app)

    const response = await app.request(`/api/posts/${created.id}/like`, { method: 'DELETE' })
    const payload = (await expectJsonContentType(response)) as { post: ApiPost }

    expect(response.status).toBe(200)
    expectInteractionState(payload.post, { likes: 0, liked: false, favorited: false })
  })

  it('id 不存在返回 404 NOT_FOUND', async () => {
    const app = createApp()

    const response = await app.request('/api/posts/not-exist/like', { method: 'DELETE' })

    expect(response.status).toBe(404)
    expectError(await expectJsonContentType(response), 'NOT_FOUND', '内容不存在')
  })
})

describe('PUT /api/posts/:id/favorite', () => {
  it('收藏成功返回 200 与更新后的记录', async () => {
    const app = createApp()
    const created = await createPost(app)

    const response = await app.request(`/api/posts/${created.id}/favorite`, { method: 'PUT' })
    const payload = (await expectJsonContentType(response)) as { post: ApiPost }

    expect(response.status).toBe(200)
    expect(payload.post.id).toBe(created.id)
    expectInteractionState(payload.post, { likes: 0, liked: false, favorited: true })
  })

  it('重复收藏保持幂等', async () => {
    const app = createApp()
    const created = await createPost(app)

    await app.request(`/api/posts/${created.id}/favorite`, { method: 'PUT' })
    const repeated = await app.request(`/api/posts/${created.id}/favorite`, { method: 'PUT' })
    const payload = (await repeated.json()) as { post: ApiPost }

    expect(repeated.status).toBe(200)
    expectInteractionState(payload.post, { likes: 0, liked: false, favorited: true })
  })

  it('id 不存在返回 404 NOT_FOUND', async () => {
    const app = createApp()

    const response = await app.request('/api/posts/not-exist/favorite', { method: 'PUT' })

    expect(response.status).toBe(404)
    expectError(await expectJsonContentType(response), 'NOT_FOUND', '内容不存在')
  })
})

describe('DELETE /api/posts/:id/favorite', () => {
  it('取消收藏成功返回 200 且 favorited 为 false', async () => {
    const app = createApp()
    const created = await createPost(app)

    await app.request(`/api/posts/${created.id}/favorite`, { method: 'PUT' })
    const response = await app.request(`/api/posts/${created.id}/favorite`, { method: 'DELETE' })
    const payload = (await expectJsonContentType(response)) as { post: ApiPost }

    expect(response.status).toBe(200)
    expectInteractionState(payload.post, { likes: 0, liked: false, favorited: false })
  })

  it('未收藏时取消收藏仍返回 200', async () => {
    const app = createApp()
    const created = await createPost(app)

    const response = await app.request(`/api/posts/${created.id}/favorite`, { method: 'DELETE' })
    const payload = (await expectJsonContentType(response)) as { post: ApiPost }

    expect(response.status).toBe(200)
    expectInteractionState(payload.post, { likes: 0, liked: false, favorited: false })
  })

  it('id 不存在返回 404 NOT_FOUND', async () => {
    const app = createApp()

    const response = await app.request('/api/posts/not-exist/favorite', { method: 'DELETE' })

    expect(response.status).toBe(404)
    expectError(await expectJsonContentType(response), 'NOT_FOUND', '内容不存在')
  })
})

describe('点赞与收藏互不影响', () => {
  it('点赞后收藏，两个状态各自保持', async () => {
    const app = createApp()
    const created = await createPost(app)

    await app.request(`/api/posts/${created.id}/like`, { method: 'PUT' })
    const favorited = await app.request(`/api/posts/${created.id}/favorite`, { method: 'PUT' })
    const payload = (await favorited.json()) as { post: ApiPost }

    expectInteractionState(payload.post, { likes: 1, liked: true, favorited: true })

    const unliked = await app.request(`/api/posts/${created.id}/like`, { method: 'DELETE' })
    const afterUnlike = (await unliked.json()) as { post: ApiPost }

    expectInteractionState(afterUnlike.post, { likes: 0, liked: false, favorited: true })
  })
})

describe('未知接口', () => {
  it('返回 404 JSON', async () => {
    const app = createApp()

    const response = await app.request('/api/nope')

    expect(response.status).toBe(404)
    expectError(await expectJsonContentType(response), 'NOT_FOUND', '接口不存在')
  })

  it('未知的写方法同样返回 404 JSON', async () => {
    const app = createApp()

    const response = await app.request('/api/nope', { method: 'PATCH', body: '{}' })

    expect(response.status).toBe(404)
    expectError(await expectJsonContentType(response), 'NOT_FOUND', '接口不存在')
  })
})
