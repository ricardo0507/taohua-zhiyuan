<script setup lang="ts">
defineProps<{
  title?: string
  subtitle?: string
}>()
</script>

<template>
  <header class="brand">
    <div class="brand__mark" aria-hidden="true">
      <svg viewBox="0 0 48 48" width="44" height="44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="15" r="8.5" fill="url(#p1)" opacity=".92" />
        <circle cx="15" cy="23" r="8.5" fill="url(#p2)" opacity=".85" />
        <circle cx="33" cy="23" r="8.5" fill="url(#p2)" opacity=".85" />
        <circle cx="19" cy="33" r="8" fill="url(#p1)" opacity=".8" />
        <circle cx="29" cy="33" r="8" fill="url(#p1)" opacity=".8" />
        <circle cx="24" cy="25" r="4.6" fill="#FFF7F4" />
        <circle cx="24" cy="25" r="2.2" fill="#F0A9B8" />
        <defs>
          <linearGradient id="p1" x1="16" y1="8" x2="34" y2="38" gradientUnits="userSpaceOnUse">
            <stop stop-color="#F2789F" />
            <stop offset="1" stop-color="#E8657F" />
          </linearGradient>
          <linearGradient id="p2" x1="8" y1="16" x2="30" y2="34" gradientUnits="userSpaceOnUse">
            <stop stop-color="#FFB3C6" />
            <stop offset="1" stop-color="#F2789F" />
          </linearGradient>
        </defs>
      </svg>
    </div>
    <div class="brand__text">
      <h1 class="brand__title">{{ title ?? '桃花之源' }}</h1>
      <p class="brand__sub">{{ subtitle ?? '落笔即生花，随手记下此刻心绪' }}</p>
    </div>
    <span class="brand__line" aria-hidden="true"></span>
  </header>
</template>
