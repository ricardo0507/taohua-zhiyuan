<script setup lang="ts">
import type { Post } from '@/stores/posts'
import PostCard from '@/components/PostCard.vue'
import EmptyState from '@/components/EmptyState.vue'

defineProps<{
  posts: Post[]
  now: number
  freshId?: string | null
}>()
</script>

<template>
  <section class="timeline" aria-label="时间线">
    <div class="timeline__head">
      <h2 class="timeline__title">花开有时</h2>
      <span class="timeline__total" data-testid="post-total">共 {{ posts.length }} 条</span>
    </div>

    <ul class="timeline__list" data-testid="timeline-list">
      <PostCard
        v-for="(post, index) in posts"
        :key="post.id"
        :post="post"
        :now="now"
        :index="index"
        :fresh="post.id === freshId"
      />
    </ul>

    <EmptyState v-if="posts.length === 0" />
  </section>
</template>
