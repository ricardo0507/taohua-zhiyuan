<script setup lang="ts">
defineProps<{
  title?: string
  hint?: string
}>()
</script>

<template>
  <div class="empty" data-testid="empty-state">
    <div class="empty__art" aria-hidden="true">
      <svg viewBox="0 0 120 90" width="112" height="84" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M60 78V42" stroke="#F0A9B8" stroke-width="2.4" stroke-linecap="round" />
        <path d="M60 62c-9 0-16-5-18-12 9-1 16 3 18 12Z" fill="#FFB3C6" opacity=".75" />
        <path d="M60 54c8-1 14-6 15-13-8 0-14 5-15 13Z" fill="#F2789F" opacity=".55" />
        <g opacity=".9">
          <circle cx="60" cy="26" r="8" fill="#FFB3C6" />
          <circle cx="50" cy="33" r="7.4" fill="#F7A2BA" />
          <circle cx="70" cy="33" r="7.4" fill="#F7A2BA" />
          <circle cx="55" cy="41" r="6.6" fill="#FFB3C6" />
          <circle cx="65" cy="41" r="6.6" fill="#FFB3C6" />
          <circle cx="60" cy="33" r="3.4" fill="#FFF7F4" />
        </g>
        <circle cx="24" cy="72" r="2" fill="#F0A9B8" />
        <circle cx="98" cy="60" r="2.4" fill="#FFB3C6" />
        <circle cx="30" cy="50" r="1.6" fill="#FFB3C6" />
      </svg>
    </div>
    <p class="empty__title">{{ title ?? '这里还是一片空地' }}</p>
    <p class="empty__hint">{{ hint ?? '写下第一句心绪，让桃花为你开一次' }}</p>
  </div>
</template>
