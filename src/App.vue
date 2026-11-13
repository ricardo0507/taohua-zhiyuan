<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import {
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

const postsStore = usePostsStore()
const { notice, show } = useNotice()
const { now } = useNow()
const freshId = shallowRef<string | null>(null)
/** 加载失败的提示文案，为空表示当前无需展示重试横幅 */
const loadErrorText = shallowRef<string | null>(null)

const isLoading = computed(() => postsStore.loading || !postsStore.ready)

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

      <TimelineList :posts="postsStore.posts" :now="now" :fresh-id="freshId" :loading="isLoading" />
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
