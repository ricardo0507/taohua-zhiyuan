/** 生成记录 id，优先使用浏览器原生 UUID，环境不支持时回退到时间戳 + 随机串 */
export function createId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // 某些环境访问 crypto 会抛错，继续走回退方案
  }

  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
