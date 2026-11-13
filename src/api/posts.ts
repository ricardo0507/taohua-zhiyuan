export interface Post {
  id: string
  content: string
  createdAt: number
}

/** 与后端保持一致的内容长度上限 */
export const MAX_CONTENT_LENGTH = 280

/** 后端返回的错误码，以及客户端补齐的网络类错误码 */
export type ApiErrorCode =
  | 'EMPTY_CONTENT'
  | 'CONTENT_TOO_LONG'
  | 'INVALID_BODY'
  | 'INVALID_JSON'
  | 'NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR'
  | 'INVALID_RESPONSE'

/** 统一的接口异常：带上后端错误码与 HTTP 状态码（网络异常时状态码为 0） */
export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

const NETWORK_ERROR_MESSAGE = '无法连接服务器，请确认服务已启动'
const INVALID_RESPONSE_MESSAGE = '服务端返回的数据格式不正确'

function baseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE as string | undefined
  const base = configured && configured.length > 0 ? configured : '/api'

  return base.replace(/\/+$/, '')
}

interface ApiResponse {
  status: number
  body: unknown
}

/** json() 在 204 或非 JSON 响应上会抛错，这里统一吞掉 */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function extractError(body: unknown): { code: string; message: string } | null {
  if (!body || typeof body !== 'object') return null

  const { error } = body as { error?: unknown }
  if (!error || typeof error !== 'object') return null

  const { code, message } = error as Record<string, unknown>
  if (typeof code !== 'string' || code.length === 0) return null

  return { code, message: typeof message === 'string' ? message : '' }
}

/** 统一请求入口：非 2xx 抛出 ApiError，网络异常包装为 NETWORK_ERROR */
async function request(path: string, init: RequestInit = {}): Promise<ApiResponse> {
  let response: Response

  try {
    response = await fetch(`${baseUrl()}${path}`, init)
  } catch {
    throw new ApiError('NETWORK_ERROR', 0, NETWORK_ERROR_MESSAGE)
  }

  if (!response.ok) {
    const detail = extractError(await readJson(response))
    const message = detail?.message ? detail.message : `请求失败（HTTP ${response.status}）`

    throw new ApiError(detail?.code ?? 'UNKNOWN_ERROR', response.status, message)
  }

  return { status: response.status, body: await readJson(response) }
}

/** 结构不完整的记录一律丢弃，避免脏数据进入界面 */
function toPost(value: unknown): Post | null {
  if (!value || typeof value !== 'object') return null

  const { id, content, createdAt } = value as Record<string, unknown>

  if (typeof id !== 'string' || id.length === 0) return null
  if (typeof content !== 'string' || content.length === 0) return null
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return null

  return { id, content, createdAt }
}

function pickField(body: unknown, key: string): unknown {
  if (!body || typeof body !== 'object') return undefined

  return (body as Record<string, unknown>)[key]
}

export async function fetchPosts(signal?: AbortSignal): Promise<Post[]> {
  const { status, body } = await request('/posts', { method: 'GET', signal })
  const raw = pickField(body, 'posts')

  // 列表响应缺少 posts 数组属于服务端异常，不能静默当作空时间线
  if (!Array.isArray(raw)) {
    throw new ApiError('INVALID_RESPONSE', status, INVALID_RESPONSE_MESSAGE)
  }

  return raw.map(toPost).filter((post): post is Post => post !== null)
}

export async function createPost(content: string): Promise<Post> {
  const { status, body } = await request('/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })

  const post = toPost(pickField(body, 'post'))
  if (!post) throw new ApiError('INVALID_RESPONSE', status, INVALID_RESPONSE_MESSAGE)

  return post
}

export async function deletePost(id: string): Promise<void> {
  await request(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
