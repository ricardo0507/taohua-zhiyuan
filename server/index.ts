import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createApp } from './app'

const app = createApp()

// API 路由优先匹配，其余请求交给 ./dist 中的前端构建产物
app.use('/*', serveStatic({ root: './dist' }))

const port = Number(process.env.PORT ?? 8787)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API 已启动：http://127.0.0.1:${info.port}`)
})
