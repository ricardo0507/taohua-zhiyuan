import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import { STORAGE_KEY } from '@/stores/posts'

function mountApp() {
  return mount(App, {
    global: { plugins: [createPinia()] },
    attachTo: document.body,
  })
}

async function publish(wrapper: ReturnType<typeof mountApp>, text: string) {
  const input = wrapper.get<HTMLTextAreaElement>('[data-testid="composer-input"]')
  input.element.value = text
  await input.trigger('input')
  await wrapper.get('form').trigger('submit')
}

describe('App', () => {
  it('启动时加载并展示 localStorage 中已有的内容', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'a', content: '旧日心绪', createdAt: Date.now() - 60_000 },
      ]),
    )

    const wrapper = mountApp()

    expect(wrapper.findAll('[data-testid="post-item"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('旧日心绪')
    expect(wrapper.get('[data-testid="post-total"]').text()).toBe('共 1 条')
  })

  it('发布后内容置顶展示、写入 localStorage 并给出成功提示', async () => {
    const wrapper = mountApp()

    await publish(wrapper, '  今天的风很温柔  ')

    const items = wrapper.findAll('[data-testid="post-item"]')
    expect(items).toHaveLength(1)
    expect(items[0].text()).toContain('今天的风很温柔')
    expect(wrapper.get('[data-testid="post-total"]').text()).toBe('共 1 条')
    expect(wrapper.get<HTMLTextAreaElement>('[data-testid="composer-input"]').element.value).toBe('')

    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    expect(saved).toHaveLength(1)
    expect(saved[0].content).toBe('今天的风很温柔')

    expect(wrapper.get('[data-testid="composer-notice"]').text()).toContain('已发布')
  })

  it('多次发布时最新内容排在最前面', async () => {
    const wrapper = mountApp()

    await publish(wrapper, '第一句')
    await publish(wrapper, '第二句')

    const items = wrapper.findAll('[data-testid="post-item"]')

    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('第二句')
    expect(items[1].text()).toContain('第一句')
  })

  it('提交空内容时只提示，不产生记录', async () => {
    const wrapper = mountApp()

    await publish(wrapper, '   ')

    expect(wrapper.findAll('[data-testid="post-item"]')).toHaveLength(0)
    expect(wrapper.get('[data-testid="composer-notice"]').text()).toContain('先写点什么')
    expect(wrapper.get('[data-testid="composer-notice"]').classes()).toContain('is-error')
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('内容超长时提示并拒绝发布', async () => {
    const wrapper = mountApp()

    await publish(wrapper, '花'.repeat(281))

    expect(wrapper.findAll('[data-testid="post-item"]')).toHaveLength(0)
    expect(wrapper.get('[data-testid="composer-notice"]').text()).toContain('超过 280 字')
    expect(wrapper.get<HTMLTextAreaElement>('[data-testid="composer-input"]').element.value).toHaveLength(
      281,
    )
  })

  it('重新挂载页面后仍能看到上次发布的内容', async () => {
    const first = mountApp()
    await publish(first, '会留下来的心绪')
    first.unmount()

    const second = mountApp()

    expect(second.findAll('[data-testid="post-item"]')).toHaveLength(1)
    expect(second.text()).toContain('会留下来的心绪')
  })

  it('本地存储不可用时给出提示，且本次会话仍可正常记录', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    const wrapper = mountApp()

    expect(wrapper.get('[data-testid="composer-notice"]').text()).toContain('本地存储')
    expect(wrapper.get('[data-testid="composer-notice"]').classes()).toContain('is-error')

    await publish(wrapper, '仅本次有效')

    expect(wrapper.findAll('[data-testid="post-item"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="composer-notice"]').text()).toContain('刷新后会丢失')
  })
})
