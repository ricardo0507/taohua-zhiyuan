<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import {
  ACTION_ERROR_MESSAGE,
  ADD_ERROR_MESSAGE,
  LOAD_ERROR_MESSAGE,
  MAX_CONTENT_LENGTH,
  usePostsStore,
} from '@/stores/posts'
import { useNotice } from '@/composables/useNotice'
import { useNow } from '@/composables/useNow'
import PetalScene from '@/components/PetalScene.vue'
import BrandHeader from '@/components/BrandHeader.vue'
import PostComposer from '@/components/PostComposer.vue'
import TimelineList from '@/components/TimelineList.vue'
import AppFooter from '@/components/AppFooter.vue'

const PUBLISH_OK_TEXT = '已发布，已保存到服务器'
const EMPTY_TEXT = '先写点什么，再让桃花开花'
const TOO_LONG_TEXT = `内容超过 ${MAX_CONTENT_LENGTH} 字了`
const FOOTER_TEXT = '桃花之源 · 内容保存在服务器内存中，服务重启后会清空'
const FAVORITES_EMPTY_TEXT = '还没有收藏的内容，点卡片右下角的收藏试试'

type FilterMode = 'all' | 'favorites'

const postsStore = usePostsStore()
const { notice, show } = useNotice()
const { now } = useNow()
const freshId = shallowRef<string | null>(null)
/** 加载失败的提示文案，为空表示当前无需展示重试横幅 */
const loadErrorText = shallowRef<string | null>(null)
/** 当前时间线筛选：全部 / 只看收藏 */
const filter = shallowRef<FilterMode>('all')

const isLoading = computed(() => postsStore.loading || !postsStore.ready)
const isFavoritesOnly = computed(() => filter.value === 'favorites')
const visiblePosts = computed(() =>
  isFavoritesOnly.value ? postsStore.favoritePosts : postsStore.posts,
)
/** 整页还有内容、只是没有收藏时才提示引导；整页为空交给时间线的空状态 */
const showFavoritesEmpty = computed(
  () =>
    isFavoritesOnly.value &&
    !isLoading.value &&
    postsStore.favoriteCount === 0 &&
    postsStore.posts.length > 0,
)

// 首屏从接口拉取内容
onMounted(runLoad)

async function runLoad(): Promise<void> {
  loadErrorText.value = null

  const ok = await postsStore.load()
  if (ok) return

  loadErrorText.value = postsStore.error ?? LOAD_ERROR_MESSAGE
  show(loadErrorText.value, 'error')
}

async function handleSubmit(content: string): Promise<void> {
  const result = await postsStore.addPost(content)

  if (!result.ok) {
    const message =
      result.reason === 'too-long'
        ? TOO_LONG_TEXT
        : result.reason === 'empty'
          ? EMPTY_TEXT
          : ADD_ERROR_MESSAGE

    show(message, 'error')
    return
  }

  freshId.value = result.post.id
  show(PUBLISH_OK_TEXT, 'ok')
}

function setFilter(next: FilterMode): void {
  filter.value = next
}

/** 点赞：先用点击前的状态决定提示文案，再交给 store 请求服务端 */
async function handleToggleLike(id: string): Promise<void> {
  const wasLiked = postsStore.posts.find((post) => post.id === id)?.liked === true
  const ok = await postsStore.toggleLike(id)

  if (!ok) {
    show(ACTION_ERROR_MESSAGE, 'error')
    return
  }

  show(wasLiked ? '已取消点赞' : '已点赞', 'ok')
}

/** 收藏：同样用点击前的状态决定提示文案，失败时统一提示错误 */
async function handleToggleFavorite(id: string): Promise<void> {
  const wasFavorited = postsStore.posts.find((post) => post.id === id)?.favorited === true
  const ok = await postsStore.toggleFavorite(id)

  if (!ok) {
    show(ACTION_ERROR_MESSAGE, 'error')
    return
  }

  show(wasFavorited ? '已取消收藏' : '已收藏', 'ok')
}
</script>

<template>
  <PetalScene />

  <div class="app">
    <BrandHeader />

    <main class="main">
      <PostComposer :max-length="MAX_CONTENT_LENGTH" :notice="notice" @submit="handleSubmit" />

      <div v-if="loadErrorText" class="app__alert" role="alert" data-testid="load-error">
        <span class="app__alert-text">{{ loadErrorText }}</span>
        <button class="app__retry" type="button" data-testid="retry-button" @click="runLoad">
          重试
        </button>
      </div>

      <div class="filters" role="group" aria-label="时间线筛选">
        <button
          class="filter"
          :class="{ 'is-active': !isFavoritesOnly }"
          type="button"
          :aria-pressed="!isFavoritesOnly"
          data-testid="filter-all"
          @click="setFilter('all')"
        >
          全部
        </button>
        <button
          class="filter"
          :class="{ 'is-active': isFavoritesOnly }"
          type="button"
          :aria-pressed="isFavoritesOnly"
          data-testid="filter-favorites"
          @click="setFilter('favorites')"
        >
          只看收藏 {{ postsStore.favoriteCount }}
        </button>
      </div>

      <p v-if="showFavoritesEmpty" class="filters__empty" data-testid="favorites-empty">
        {{ FAVORITES_EMPTY_TEXT }}
      </p>

      <TimelineList
        :posts="visiblePosts"
        :now="now"
        :fresh-id="freshId"
        :loading="isLoading"
        :hide-empty="showFavoritesEmpty"
        @toggle-like="handleToggleLike"
        @toggle-favorite="handleToggleFavorite"
      />
    </main>

    <AppFooter :text="FOOTER_TEXT" />
  </div>
</template>

<style scoped>
.app__alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  background: rgba(255, 244, 246, .92);
  border: 1px solid rgba(242, 120, 159, .35);
  color: var(--danger);
  font-size: 13px;
  line-height: 1.5;
}

.app__alert-text {
  flex: 1;
}

.app__retry {
  flex: none;
  padding: 5px 14px;
  border-radius: 999px;
  border: 1px solid rgba(242, 120, 159, .45);
  background: rgba(255, 255, 255, .86);
  color: var(--danger);
  font-size: 12.5px;
  cursor: pointer;
  transition: transform .2s var(--ease), background .2s var(--ease);
}

.app__retry:hover {
  background: #fff;
  transform: translateY(-1px);
}
</style>
