import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TimelineList from '@/components/TimelineList.vue'
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

describe('TimelineList', () => {
  it('没有内容时展示空状态与 0 条计数', () => {
    const wrapper = mount(TimelineList, {
      props: { posts: [], now: NOW },
    })

    expect(wrapper.get('[data-testid="post-total"]').text()).toBe('共 0 条')
    expect(wrapper.text()).toContain('这里还是一片空地')
    expect(wrapper.findAll('[data-testid="post-item"]')).toHaveLength(0)
  })

  it('按传入顺序渲染卡片并显示总数', () => {
    const posts = [
      makePost({ id: 'a', content: '最新的' }),
      makePost({ id: 'b', content: '早一点的' }),
      makePost({ id: 'c', content: '最旧的' }),
    ]

    const wrapper = mount(TimelineList, {
      props: { posts, now: NOW },
    })

    const items = wrapper.findAll('[data-testid="post-item"]')

    expect(wrapper.get('[data-testid="post-total"]').text()).toBe('共 3 条')
    expect(items).toHaveLength(3)
    expect(items.map((item) => item.text())).toEqual([
      expect.stringContaining('最新的'),
      expect.stringContaining('早一点的'),
      expect.stringContaining('最旧的'),
    ])
  })

  it('使用传入的当前时刻计算相对时间', () => {
    const wrapper = mount(TimelineList, {
      props: { posts: [makePost()], now: NOW },
    })

    expect(wrapper.get('[data-testid="post-item"] time').text()).toBe('5 分钟前')
  })

  it('内容按纯文本渲染，不执行 HTML', () => {
    const wrapper = mount(TimelineList, {
      props: {
        posts: [makePost({ content: '<script>alert(1)</script>' })],
        now: NOW,
      },
    })

    const content = wrapper.get('[data-testid="post-content"]')

    expect(content.text()).toBe('<script>alert(1)</script>')
    expect(content.find('script').exists()).toBe(false)
  })

  it('加载中展示占位骨架，且不展示空状态', () => {
    const wrapper = mount(TimelineList, {
      props: { posts: [], now: NOW, loading: true },
    })

    expect(wrapper.find('[data-testid="timeline-loading"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="post-item"]')).toHaveLength(0)
  })

  it('加载中即使已有内容也展示骨架而不是卡片', () => {
    const wrapper = mount(TimelineList, {
      props: { posts: [makePost()], now: NOW, loading: true },
    })

    expect(wrapper.find('[data-testid="timeline-loading"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="post-item"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
  })

  it('加载结束后回到列表：有内容展示卡片，无内容展示空状态', async () => {
    const wrapper = mount(TimelineList, {
      props: { posts: [makePost({ content: '加载完成的内容' })], now: NOW, loading: true },
    })

    expect(wrapper.find('[data-testid="timeline-loading"]').exists()).toBe(true)

    await wrapper.setProps({ loading: false })

    expect(wrapper.find('[data-testid="timeline-loading"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="post-item"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('加载完成的内容')

    await wrapper.setProps({ posts: [] })

    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
  })

  it('刚发布的内容带 fresh 动画标记', () => {
    const wrapper = mount(TimelineList, {
      props: {
        posts: [makePost({ id: 'fresh' }), makePost({ id: 'old' })],
        now: NOW,
        freshId: 'fresh',
      },
    })

    const items = wrapper.findAll('[data-testid="post-item"]')

    expect(items[0].classes()).toContain('post--fresh')
    expect(items[1].classes()).not.toContain('post--fresh')
  })

  it('把点赞点击透传为 toggle-like 事件（带 post id）', async () => {
    const posts = [makePost({ id: 'a', content: '第一条' }), makePost({ id: 'b', content: '第二条' })]

    const wrapper = mount(TimelineList, {
      props: { posts, now: NOW },
    })

    await wrapper.findAll('[data-testid="like-button"]')[1].trigger('click')

    expect(wrapper.emitted('toggle-like')).toEqual([['b']])
  })

  it('把收藏点击透传为 toggle-favorite 事件（带 post id）', async () => {
    const posts = [makePost({ id: 'a' })]

    const wrapper = mount(TimelineList, {
      props: { posts, now: NOW },
    })

    await wrapper.get('[data-testid="favorite-button"]').trigger('click')

    expect(wrapper.emitted('toggle-favorite')).toEqual([['a']])
  })

  it('卡片上的点赞计数与状态来自传入数据', () => {
    const wrapper = mount(TimelineList, {
      props: { posts: [makePost({ likes: 4, liked: true, favorited: true })], now: NOW },
    })

    expect(wrapper.get('[data-testid="like-count"]').text()).toBe('4')
    expect(wrapper.get('[data-testid="like-button"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="favorite-button"]').attributes('aria-pressed')).toBe('true')
  })
})
