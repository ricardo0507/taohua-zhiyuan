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
})
