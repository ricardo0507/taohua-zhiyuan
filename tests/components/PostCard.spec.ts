import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PostCard from '@/components/PostCard.vue'
import type { Post } from '@/stores/posts'

const NOW = new Date('2026-11-13T12:00:00').getTime()

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    content: '一条心绪',
    createdAt: NOW - 5 * 60 * 1000,
    likes: 0,
    liked: false,
    favorited: false,
    ...overrides,
  }
}

function mountCard(post: Post = makePost()) {
  return mount(PostCard, {
    props: { post, now: NOW, index: 0 },
  })
}

describe('PostCard', () => {
  it('保留既有的卡片与内容标记，并展示相对时间', () => {
    const wrapper = mountCard(makePost({ content: '今天的风很温柔' }))

    expect(wrapper.find('[data-testid="post-item"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="post-content"]').text()).toBe('今天的风很温柔')
    expect(wrapper.get('time').text()).toBe('5 分钟前')
  })

  it('未点赞时心形为空心、计数为 0，aria 标记为未按下', () => {
    const wrapper = mountCard()

    const button = wrapper.get('[data-testid="like-button"]')

    expect(button.attributes('aria-pressed')).toBe('false')
    expect(button.attributes('aria-label')).toBe('点赞')
    expect(button.text()).toContain('♡')
    expect(wrapper.get('[data-testid="like-count"]').text()).toBe('0')
  })

  it('已点赞时心形为实心、展示计数，aria 标记为已按下', () => {
    const wrapper = mountCard(makePost({ likes: 7, liked: true }))

    const button = wrapper.get('[data-testid="like-button"]')

    expect(button.attributes('aria-pressed')).toBe('true')
    expect(button.attributes('aria-label')).toBe('取消点赞')
    expect(button.text()).toContain('♥')
    expect(wrapper.get('[data-testid="like-count"]').text()).toBe('7')
  })

  it('点击点赞按钮派发 toggle-like 事件并带上 post id', async () => {
    const wrapper = mountCard(makePost({ id: 'post-42' }))

    await wrapper.get('[data-testid="like-button"]').trigger('click')

    expect(wrapper.emitted('toggle-like')).toEqual([['post-42']])
  })

  it('未收藏时按钮文案为「收藏」且 aria 标记为未按下', () => {
    const wrapper = mountCard()

    const button = wrapper.get('[data-testid="favorite-button"]')

    expect(button.attributes('aria-pressed')).toBe('false')
    expect(button.attributes('aria-label')).toBe('收藏')
    expect(button.text()).toContain('收藏')
    expect(button.text()).not.toContain('已收藏')
  })

  it('已收藏时按钮文案为「已收藏」且 aria 标记为已按下', () => {
    const wrapper = mountCard(makePost({ favorited: true }))

    const button = wrapper.get('[data-testid="favorite-button"]')

    expect(button.attributes('aria-pressed')).toBe('true')
    expect(button.attributes('aria-label')).toBe('取消收藏')
    expect(button.text()).toContain('已收藏')
  })

  it('点击收藏按钮派发 toggle-favorite 事件并带上 post id', async () => {
    const wrapper = mountCard(makePost({ id: 'post-9' }))

    await wrapper.get('[data-testid="favorite-button"]').trigger('click')

    expect(wrapper.emitted('toggle-favorite')).toEqual([['post-9']])
  })

  it('两个按钮都是 type=button，避免触发表单提交', () => {
    const wrapper = mountCard()

    expect(wrapper.get('[data-testid="like-button"]').attributes('type')).toBe('button')
    expect(wrapper.get('[data-testid="favorite-button"]').attributes('type')).toBe('button')
  })
})
