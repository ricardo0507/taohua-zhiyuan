import { Hono } from 'hono'
import { createPostStore } from './post-store'
import type { CreatePostFailureCode, PostStore } from './post-store'

const CONTENT_ERROR_MESSAGES: Record<CreatePostFailureCode, string> = {
  EMPTY_CONTENT: '内容不能为空',
  CONTENT_TOO_LONG: '内容不能超过 280 字',
}

const INVALID_BODY_MESSAGE = '请求内容格式不正确'
const INVALID_JSON_MESSAGE = '请求内容不是合法的 JSON'
const NOT_FOUND_MESSAGE = '内容不存在'
const ROUTE_NOT_FOUND_MESSAGE = '接口不存在'

function errorPayload(code: string, message: string) {
  return { error: { code, message } }
}

/** 请求体必须是对象且 content 为字符串，否则返回 null（由路由层映射为 INVALID_BODY） */
function extractContent(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null

  const { content } = payload as Record<string, unknown>

  return typeof content === 'string' ? content : null
}

export function createApp(store: PostStore = createPostStore()) {
  const app = new Hono()

  app.get('/api/health', (c) => c.json({ status: 'ok' }))

  app.get('/api/posts', (c) => c.json({ posts: store.list() }))

  app.post('/api/posts', async (c) => {
    let payload: unknown

    try {
      payload = await c.req.json()
    } catch {
      return c.json(errorPayload('INVALID_JSON', INVALID_JSON_MESSAGE), 400)
    }

    const content = extractContent(payload)
    if (content === null) return c.json(errorPayload('INVALID_BODY', INVALID_BODY_MESSAGE), 400)

    const result = store.create(content)
    if (!result.ok) {
      return c.json(errorPayload(result.code, CONTENT_ERROR_MESSAGES[result.code]), 400)
    }

    return c.json({ post: result.post }, 201, {
      Location: `/api/posts/${result.post.id}`,
    })
  })

  app.get('/api/posts/:id', (c) => {
    const post = store.find(c.req.param('id'))
    if (!post) return c.json(errorPayload('NOT_FOUND', NOT_FOUND_MESSAGE), 404)

    return c.json({ post })
  })

  app.delete('/api/posts/:id', (c) => {
    if (!store.remove(c.req.param('id'))) {
      return c.json(errorPayload('NOT_FOUND', NOT_FOUND_MESSAGE), 404)
    }

    return c.body(null, 204)
  })

  // 其余 /api/* 一律返回 JSON 404
  app.all('/api/*', (c) => c.json(errorPayload('NOT_FOUND', ROUTE_NOT_FOUND_MESSAGE), 404))

  return app
}
