<script setup lang="ts">
defineProps<{
  text?: string
}>()
</script>

<template>
  <footer class="footer">
    <p>{{ text ?? '桃花之源 · 记录只留在本机浏览器，不上传任何服务器' }}</p>
  </footer>
</template>
