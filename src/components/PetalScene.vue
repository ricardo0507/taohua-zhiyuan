<script setup lang="ts">
const PETAL_COUNT = 9
</script>

<template>
  <div class="scene" aria-hidden="true">
    <span class="scene__glow scene__glow--a"></span>
    <span class="scene__glow scene__glow--b"></span>
    <div class="petals">
      <i v-for="index in PETAL_COUNT" :key="index" class="petal"></i>
    </div>
  </div>
</template>
