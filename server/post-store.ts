/**
 * 内存仓储：进程重启即清空，不落盘。
 * 所有内容校验都收敛在这里，路由层只做 HTTP 映射。
 */
export interface Post {
  id: string
  content: string
  createdAt: number
}

export const MAX_CONTENT_LENGTH = 280

export type CreatePostFailureCode = 'EMPTY_CONTENT' | 'CONTENT_TOO_LONG'

export type CreatePostResult =
  | { ok: true; post: Post }
  | { ok: false; code: CreatePostFailureCode }

export interface PostStore {
  /** 全部内容，createdAt 倒序（同一毫秒内后创建的在前） */
  list(): Post[]
  find(id: string): Post | undefined
  create(content: string): CreatePostResult
  /** 删除成功返回 true，id 不存在返回 false */
  remove(id: string): boolean
}

/** 校验待落库内容；返回 null 表示合法 */
export function validateContent(content: string): CreatePostFailureCode | null {
  const text = content.trim()

  if (!text) return 'EMPTY_CONTENT'
  if (text.length > MAX_CONTENT_LENGTH) return 'CONTENT_TOO_LONG'

  return null
}

/** 对外只暴露副本，避免调用方改写内部数据 */
function copyPost(post: Post): Post {
  return { id: post.id, content: post.content, createdAt: post.createdAt }
}

export function createPostStore(): PostStore {
  // 新创建的记录插到最前面，配合稳定排序实现"同一时间戳后创建者在前"
  const posts: Post[] = []

  return {
    list() {
      return [...posts].sort((a, b) => b.createdAt - a.createdAt).map(copyPost)
    },

    find(id) {
      const found = posts.find((post) => post.id === id)
      return found ? copyPost(found) : undefined
    },

    create(content) {
      const code = validateContent(content)
      if (code) return { ok: false, code }

      const post: Post = {
        id: crypto.randomUUID(),
        content: content.trim(),
        createdAt: Date.now(),
      }

      posts.unshift(post)

      return { ok: true, post: copyPost(post) }
    },

    remove(id) {
      const index = posts.findIndex((post) => post.id === id)
      if (index === -1) return false

      posts.splice(index, 1)

      return true
    },
  }
}
