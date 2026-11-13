// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../server/app'
import { createPostStore } from '../../server/post-store'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

interface ApiPost {
  id: string
  content: string
  createdAt: number
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
    expect(Object.keys(payload.post)).toEqual(['id', 'content', 'createdAt'])
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

    expect(response.status).toBe(200)
    expect(await expectJsonContentType(response)).toEqual({ post: created.post })
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
