<script setup lang="ts">
import { computed } from 'vue'
import type { Post } from '@/stores/posts'
import { formatAbsoluteTime, formatRelativeTime } from '@/utils/time'

const props = defineProps<{
  post: Post
  now: number
  index: number
  fresh?: boolean
}>()

const relativeTime = computed(() => formatRelativeTime(props.post.createdAt, props.now))
const absoluteTime = computed(() => formatAbsoluteTime(props.post.createdAt))
const dateTime = computed(() => new Date(props.post.createdAt).toISOString())
const staggerIndex = computed(() => String(Math.min(props.index, 12)))

const itemClasses = computed(() => ({
  post: true,
  'post--fresh': props.fresh === true,
}))
</script>

<template>
  <li
    :class="itemClasses"
    :style="{ '--i': staggerIndex }"
    :data-id="post.id"
    data-testid="post-item"
  >
    <p class="post__content" data-testid="post-content">{{ post.content }}</p>
    <div class="post__foot">
      <span class="post__dot"></span>
      <time class="post__time" :datetime="dateTime" :title="absoluteTime">{{ relativeTime }}</time>
    </div>
  </li>
</template>
