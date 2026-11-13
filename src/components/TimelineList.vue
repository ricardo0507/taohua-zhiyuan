<script setup lang="ts">
import type { Post } from '@/stores/posts'
import PostCard from '@/components/PostCard.vue'
import EmptyState from '@/components/EmptyState.vue'

withDefaults(
  defineProps<{
    posts: Post[]
    now: number
    freshId?: string | null
    loading?: boolean
  }>(),
  {
    freshId: null,
    loading: false,
  },
)

const SKELETON_COUNT = 3
</script>

<template>
  <section class="timeline" aria-label="时间线">
    <div class="timeline__head">
      <h2 class="timeline__title">花开有时</h2>
      <span class="timeline__total" data-testid="post-total">共 {{ posts.length }} 条</span>
    </div>

    <div
      v-if="loading"
      class="timeline__skeleton"
      data-testid="timeline-loading"
      aria-busy="true"
      aria-label="正在加载内容"
    >
      <div v-for="index in SKELETON_COUNT" :key="index" class="skeleton" aria-hidden="true">
        <span class="skeleton__bar"></span>
        <span class="skeleton__bar skeleton__bar--short"></span>
      </div>
    </div>

    <ul v-else class="timeline__list" data-testid="timeline-list">
      <PostCard
        v-for="(post, index) in posts"
        :key="post.id"
        :post="post"
        :now="now"
        :index="index"
        :fresh="post.id === freshId"
      />
    </ul>

    <EmptyState v-if="!loading && posts.length === 0" />
  </section>
</template>

<style scoped>
.timeline__skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 18px 18px 20px;
  border-radius: var(--radius-md);
  background: linear-gradient(160deg, rgba(255, 255, 255, .9), rgba(255, 250, 248, .72));
  border: 1px solid rgba(255, 255, 255, .9);
  box-shadow: var(--shadow-card);
}

.skeleton__bar {
  height: 12px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(240, 169, 184, .22), rgba(242, 120, 159, .36), rgba(240, 169, 184, .22));
  background-size: 220% 100%;
  animation: skeletonBreath 1.4s ease-in-out infinite;
}

.skeleton__bar--short {
  width: 52%;
}

@keyframes skeletonBreath {
  0%, 100% { opacity: .55; background-position: 0% 50%; }
  50% { opacity: 1; background-position: 100% 50%; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton__bar { animation: none; }
}
</style>
