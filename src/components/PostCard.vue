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

const emit = defineEmits<{
  'toggle-like': [id: string]
  'toggle-favorite': [id: string]
}>()

const relativeTime = computed(() => formatRelativeTime(props.post.createdAt, props.now))
const absoluteTime = computed(() => formatAbsoluteTime(props.post.createdAt))
const dateTime = computed(() => new Date(props.post.createdAt).toISOString())
const staggerIndex = computed(() => String(Math.min(props.index, 12)))

const itemClasses = computed(() => ({
  post: true,
  'post--fresh': props.fresh === true,
}))

const likeLabel = computed(() => (props.post.liked ? '取消点赞' : '点赞'))
const likeIcon = computed(() => (props.post.liked ? '♥' : '♡'))
const favoriteLabel = computed(() => (props.post.favorited ? '取消收藏' : '收藏'))
const favoriteText = computed(() => (props.post.favorited ? '已收藏' : '收藏'))
const favoriteIcon = computed(() => (props.post.favorited ? '★' : '☆'))

function like(): void {
  emit('toggle-like', props.post.id)
}

function favorite(): void {
  emit('toggle-favorite', props.post.id)
}
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

      <div class="post__actions">
        <button
          class="pill pill--like"
          :class="{ 'is-active': post.liked }"
          type="button"
          :aria-pressed="post.liked"
          :aria-label="likeLabel"
          :title="likeLabel"
          data-testid="like-button"
          @click="like"
        >
          <span class="pill__icon" aria-hidden="true">{{ likeIcon }}</span>
          <span class="pill__count" data-testid="like-count">{{ post.likes }}</span>
        </button>

        <button
          class="pill pill--favorite"
          :class="{ 'is-active': post.favorited }"
          type="button"
          :aria-pressed="post.favorited"
          :aria-label="favoriteLabel"
          :title="favoriteLabel"
          data-testid="favorite-button"
          @click="favorite"
        >
          <span class="pill__icon" aria-hidden="true">{{ favoriteIcon }}</span>
          <span>{{ favoriteText }}</span>
        </button>
      </div>
    </div>
  </li>
</template>
