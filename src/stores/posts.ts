import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { createId } from '@/utils/id'

export const STORAGE_KEY = 'taohua:posts'
export const MAX_CONTENT_LENGTH = 280

const PROBE_KEY = '__taohua_probe__'

export interface Post {
  id: string
  content: string
  createdAt: number
}

export type AddPostFailureReason = 'empty' | 'too-long'

export type AddPostResult =
  | { ok: true; post: Post; persisted: boolean }
  | { ok: false; reason: AddPostFailureReason }

function detectStorage(): boolean {
  try {
    window.localStorage.setItem(PROBE_KEY, '1')
    window.localStorage.removeItem(PROBE_KEY)
    return true
  } catch {
    return false
  }
}

/** 把存储中的任意数据归一化为合法记录，结构不完整则丢弃 */
function normalizePost(raw: unknown): Post | null {
  if (!raw || typeof raw !== 'object') return null

  const item = raw as Record<string, unknown>
  if (typeof item.content !== 'string' || item.content.length === 0) return null

  return {
    id: item.id ? String(item.id) : createId(),
    content: item.content,
    createdAt: Number(item.createdAt) || Date.now(),
  }
}

export const usePostsStore = defineStore('posts', () => {
  const posts = ref<Post[]>([])
  /** localStorage 是否可写；不可用时退化为本次会话的内存数据 */
  const storageAvailable = ref(true)
  const ready = ref(false)

  const total = computed(() => posts.value.length)
  const isEmpty = computed(() => posts.value.length === 0)

  function persist(): boolean {
    if (!storageAvailable.value) return false

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(posts.value))
      return true
    } catch {
      storageAvailable.value = false
      return false
    }
  }

  /** 从 localStorage 载入历史内容，重复调用是安全的 */
  function hydrate(): void {
    storageAvailable.value = detectStorage()

    if (!storageAvailable.value) {
      posts.value = []
      ready.value = true
      return
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        posts.value = []
      } else {
        const parsed: unknown = JSON.parse(raw)
        posts.value = Array.isArray(parsed)
          ? parsed.map(normalizePost).filter((post): post is Post => post !== null)
          : []
      }
    } catch {
      posts.value = []
    }

    ready.value = true
  }

  /** 发布一条内容；新内容置顶，并尽可能写入本地存储 */
  function addPost(content: string): AddPostResult {
    const text = content.trim()

    if (!text) return { ok: false, reason: 'empty' }
    if (text.length > MAX_CONTENT_LENGTH) return { ok: false, reason: 'too-long' }

    const post: Post = {
      id: createId(),
      content: text,
      createdAt: Date.now(),
    }

    posts.value = [post, ...posts.value]

    return { ok: true, post, persisted: persist() }
  }

  return {
    posts,
    storageAvailable,
    ready,
    total,
    isEmpty,
    hydrate,
    addPost,
  }
})
