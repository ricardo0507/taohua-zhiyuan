<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import { MAX_CONTENT_LENGTH } from '@/stores/posts'
import type { Notice } from '@/composables/useNotice'

const props = withDefaults(
  defineProps<{
    maxLength?: number
    notice?: Notice
  }>(),
  {
    maxLength: MAX_CONTENT_LENGTH,
    notice: undefined,
  },
)

const emit = defineEmits<{
  submit: [content: string]
}>()

const draft = shallowRef('')
const textarea = useTemplateRef<HTMLTextAreaElement>('textarea')

const charCount = computed(() => draft.value.length)
const isWarn = computed(() => charCount.value >= props.maxLength)
const canSubmit = computed(() => draft.value.trim().length > 0)
const noticeText = computed(() => props.notice?.text ?? '')
const noticeType = computed(() => props.notice?.type ?? null)

const noticeClasses = computed(() => ({
  notice: true,
  'is-visible': noticeText.value.length > 0,
  'is-ok': noticeType.value === 'ok',
  'is-error': noticeType.value === 'error',
}))

/** 输入框随内容自动增高，内容较少时交回 CSS 控制 */
function autoGrow(): void {
  const element = textarea.value
  if (!element) return

  element.style.height = 'auto'
  const need = element.scrollHeight
  element.style.height = need <= 88 ? '' : `${Math.min(need, 240)}px`
}

watch(draft, async () => {
  await nextTick()
  autoGrow()
})

function handleSubmit(): void {
  const text = draft.value.trim()
  const tooLong = draft.value.length > props.maxLength

  // 校验统一交给上层（store），组件只负责把内容交出去
  emit('submit', text)

  if (text && !tooLong) {
    draft.value = ''
    textarea.value?.focus()
  }
}
</script>

<template>
  <section class="composer" aria-label="发布">
    <form class="composer__form" novalidate @submit.prevent="handleSubmit">
      <label class="sr-only" for="composer-input">写下此刻的想法</label>
      <textarea
        id="composer-input"
        ref="textarea"
        v-model="draft"
        class="composer__input"
        name="content"
        rows="3"
        :maxlength="maxLength"
        placeholder="此刻想到了什么？写下来，它会留在这里。"
        autocomplete="off"
        data-testid="composer-input"
      ></textarea>

      <div class="composer__bar">
        <span class="composer__count" :class="{ 'is-warn': isWarn }" aria-live="off" data-testid="char-count">
          <b>{{ charCount }}</b><span class="composer__count-total">/{{ maxLength }}</span>
        </span>
        <button class="btn-publish" type="submit" :disabled="!canSubmit" data-testid="submit-button">
          <span class="btn-publish__text">发布</span>
          <svg class="btn-publish__icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
            <path d="M2.5 10.5 17 3.5l-4.6 14-2.6-5.6-5.3-1.4Z" fill="currentColor" opacity=".95" />
          </svg>
        </button>
      </div>
    </form>

    <p :class="noticeClasses" role="status" aria-live="polite" data-testid="composer-notice">
      {{ noticeText }}
    </p>
  </section>
</template>
