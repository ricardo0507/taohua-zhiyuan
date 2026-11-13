import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  MAX_CONTENT_LENGTH,
  createPost,
  fetchPosts,
  setPostFavorited,
  setPostLiked,
} from '@/api/posts'
import type { Post } from '@/api/posts'

// 组件统一从 store 引入契约，避免改动调用方
export { MAX_CONTENT_LENGTH }
export type { Post }

export const LOAD_ERROR_MESSAGE = '内容加载失败，请确认服务已启动'
export const ADD_ERROR_MESSAGE = '发布失败，请确认服务已启动后重试'
export const ACTION_ERROR_MESSAGE = '操作失败，请稍后重试'

export type AddPostFailureReason = 'empty' | 'too-long' | 'request-failed'

export type AddPostResult =
  | { ok: true; post: Post }
  | { ok: false; reason: AddPostFailureReason }

export const usePostsStore = defineStore('posts', () => {
  const posts = ref<Post[]>([])
  /** 首次加载是否结束（成功或失败） */
  const ready = ref(false)
  const loading = ref(false)
  /** 最近一次读写失败的提示文案，成功后清空 */
  const error = ref<string | null>(null)

  const total = computed(() => posts.value.length)
  const isEmpty = computed(() => posts.value.length === 0)
  const favoritePosts = computed(() => posts.value.filter((post) => post.favorited))
  const favoriteCount = computed(() => favoritePosts.value.length)

  let inflight: Promise<boolean> | null = null

  async function runLoad(): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      posts.value = await fetchPosts()

      return true
    } catch {
      error.value = LOAD_ERROR_MESSAGE

      return false
    } finally {
      loading.value = false
      ready.value = true
    }
  }

  /** 拉取服务端列表；并发调用共享同一个请求 */
  function load(): Promise<boolean> {
    if (!inflight) {
      inflight = runLoad().finally(() => {
        inflight = null
      })
    }

    return inflight
  }

  /** 发布一条内容：本地先校验，再交由服务端落库，成功后置顶 */
  async function addPost(content: string): Promise<AddPostResult> {
    const text = content.trim()

    if (!text) return { ok: false, reason: 'empty' }
    if (text.length > MAX_CONTENT_LENGTH) return { ok: false, reason: 'too-long' }

    try {
      const post = await createPost(text)
      posts.value = [post, ...posts.value.filter((item) => item.id !== post.id)]
      error.value = null

      return { ok: true, post }
    } catch {
      error.value = ADD_ERROR_MESSAGE

      return { ok: false, reason: 'request-failed' }
    }
  }

  /** 用服务端返回的最新记录替换同 id 项，产生新数组以触发响应式更新并保持顺序 */
  function replacePost(next: Post): void {
    posts.value = posts.value.map((item) => (item.id === next.id ? next : item))
  }

  /** 统一的开关型操作：成功返回 true，失败只记录错误文案不抛异常 */
  async function runAction(id: string, toggle: (post: Post) => Promise<Post>): Promise<boolean> {
    const current = posts.value.find((post) => post.id === id)

    // 列表里没有这条记录时无法确定目标状态，直接按失败处理
    if (!current) {
      error.value = ACTION_ERROR_MESSAGE

      return false
    }

    try {
      replacePost(await toggle(current))
      error.value = null

      return true
    } catch {
      error.value = ACTION_ERROR_MESSAGE

      return false
    }
  }

  function toggleLike(id: string): Promise<boolean> {
    return runAction(id, (post) => setPostLiked(id, !post.liked))
  }

  function toggleFavorite(id: string): Promise<boolean> {
    return runAction(id, (post) => setPostFavorited(id, !post.favorited))
  }

  return {
    posts,
    ready,
    loading,
    error,
    total,
    isEmpty,
    favoritePosts,
    favoriteCount,
    load,
    addPost,
    toggleLike,
    toggleFavorite,
  }
})
