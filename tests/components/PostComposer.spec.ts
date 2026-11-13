import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PostComposer from '@/components/PostComposer.vue'

function mountComposer(props: Record<string, unknown> = {}) {
  return mount(PostComposer, {
    props: {
      notice: { text: '', type: null },
      ...props,
    },
  })
}

describe('PostComposer', () => {
  it('初始展示 0/280 字数统计且按钮不可用', () => {
    const wrapper = mountComposer()

    expect(wrapper.get('[data-testid="char-count"]').text()).toBe('0/280')
    expect(wrapper.get('[data-testid="submit-button"]').attributes('disabled')).toBeDefined()
  })

  it('输入内容后实时更新字数并启用按钮', async () => {
    const wrapper = mountComposer()

    await wrapper.get('[data-testid="composer-input"]').setValue('此刻心绪')

    expect(wrapper.get('[data-testid="char-count"]').text()).toBe('4/280')
    expect(wrapper.get('[data-testid="submit-button"]').attributes('disabled')).toBeUndefined()
  })

  it('纯空白内容不能提交', async () => {
    const wrapper = mountComposer()

    await wrapper.get('[data-testid="composer-input"]').setValue('   \n  ')

    expect(wrapper.get('[data-testid="submit-button"]').attributes('disabled')).toBeDefined()
  })

  it('字数达到上限时统计高亮告警', async () => {
    const wrapper = mountComposer({ maxLength: 10 })

    await wrapper.get('[data-testid="composer-input"]').setValue('十个字十个字十个字十')

    expect(wrapper.get('[data-testid="char-count"]').classes()).toContain('is-warn')
    expect(wrapper.get('[data-testid="char-count"]').text()).toBe('10/10')
  })

  it('提交时向父级派发去除首尾空白的内容并清空输入框', async () => {
    const wrapper = mountComposer()
    const input = wrapper.get<HTMLTextAreaElement>('[data-testid="composer-input"]')

    await input.setValue('  今天风很轻  ')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([['今天风很轻']])
    expect(input.element.value).toBe('')
    expect(wrapper.get('[data-testid="char-count"]').text()).toBe('0/280')
  })

  it('内容超长时派发原文，交由上层校验，且不清空草稿', async () => {
    const wrapper = mountComposer({ maxLength: 5 })
    const input = wrapper.get<HTMLTextAreaElement>('[data-testid="composer-input"]')

    input.element.value = '这已经超过五个字了'
    await input.trigger('input')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([['这已经超过五个字了']])
    expect(input.element.value).toBe('这已经超过五个字了')
  })

  it('渲染上层传入的提示文案与状态样式', () => {
    const wrapper = mountComposer({ notice: { text: '内容超过 280 字了', type: 'error' } })
    const notice = wrapper.get('[data-testid="composer-notice"]')

    expect(notice.text()).toBe('内容超过 280 字了')
    expect(notice.classes()).toContain('is-visible')
    expect(notice.classes()).toContain('is-error')
  })
})
