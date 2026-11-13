<script setup lang="ts">
import { shallowRef } from 'vue'
import { MAX_CONTENT_LENGTH, usePostsStore } from '@/stores/posts'
import { useNotice } from '@/composables/useNotice'
import { useNow } from '@/composables/useNow'
import PetalScene from '@/components/PetalScene.vue'
import BrandHeader from '@/components/BrandHeader.vue'
import PostComposer from '@/components/PostComposer.vue'
import TimelineList from '@/components/TimelineList.vue'
import AppFooter from '@/components/AppFooter.vue'

const STORAGE_WARNING = '当前浏览器无法使用本地存储，内容刷新后会丢失'

const postsStore = usePostsStore()
const { notice, show } = useNotice()
const { now } = useNow()
const freshId = shallowRef<string | null>(null)

// 首屏渲染前同步读取本地数据，避免先闪一下空状态
postsStore.hydrate()

if (!postsStore.storageAvailable) {
  show(STORAGE_WARNING, 'error')
}

function handleSubmit(content: string): void {
  const result = postsStore.addPost(content)

  if (!result.ok) {
    show(
      result.reason === 'too-long' ? `内容超过 ${MAX_CONTENT_LENGTH} 字了` : '先写点什么，再让桃花开花',
      'error',
    )
    return
  }

  freshId.value = result.post.id
  show(
    result.persisted ? '已发布，只保存在这台设备的浏览器里' : '已发布，但本地存储不可用，刷新后会丢失',
    result.persisted ? 'ok' : 'error',
  )
}
</script>

<template>
  <PetalScene />

  <div class="app">
    <BrandHeader />

    <main class="main">
      <PostComposer :max-length="MAX_CONTENT_LENGTH" :notice="notice" @submit="handleSubmit" />
      <TimelineList :posts="postsStore.posts" :now="now" :fresh-id="freshId" />
    </main>

    <AppFooter />
  </div>
</template>
