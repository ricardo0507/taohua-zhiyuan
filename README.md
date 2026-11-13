# 桃花之源

一个极简的记事页：写下此刻的想法，它会以卡片形式留在时间线上。内容保存在**服务端内存**中，页面刷新或换浏览器都不会丢；但**服务进程重启后所有内容会清空**。

技术形态：**Vue 3 + Pinia 前端 + Hono RESTful 后端（内存存储）**，使用 **Vitest + Vue Test Utils** 以 TDD（测试驱动开发）方式实现。前端不再读写 `localStorage`，所有数据都通过 `fetch` 调用 `/api/posts` 获得。

## 功能

- **发布内容**：多行输入，实时字数统计（上限 280），空内容时发布按钮不可用；发布成功后由服务端返回的记录置顶展示。
- **时间线**：新内容置顶，卡片底部显示相对时间（刚刚 / 5 分钟前 / 3 天前 / 具体日期），每分钟自动刷新。
- **点赞与收藏**：卡片右下角可点赞（♥ 计数）与收藏（★ 已收藏），状态由服务端保存，刷新不丢；重复点击幂等，计数永不为负。
- **只看收藏**：时间线上方「全部 / 只看收藏 N」筛选，收藏数实时联动；无收藏时给出引导，整页无内容时回落到空状态。
- **服务端持久化（内存）**：内容经 `POST /api/posts` 落库，首屏通过 `GET /api/posts` 拉取，`createdAt` 倒序。
- **加载与失败处理**：首屏展示骨架占位；加载失败给出「内容加载失败，请确认服务已启动」与重试按钮；发布失败提示错误且不会伪造/回滚数据。
- **空状态引导**与**响应式布局**：移动端单列铺满，桌面端 640px 居中。

## 技术栈

| 分类 | 选型 |
| --- | --- |
| 运行时 | Node.js ≥ 20.19 |
| 前端框架 | Vue 3.5（Composition API + `<script setup>` + TypeScript） |
| 状态管理 | Pinia 3（setup store） |
| 前端构建 | Vite 7 |
| 后端框架 | Hono 4 + `@hono/node-server` |
| 存储 | 进程内内存数组（无数据库、无持久化） |
| 测试 | Vitest 3 + Vue Test Utils + jsdom |

## 目录结构

```text
├─ index.html                  # Vite 入口
├─ vite.config.ts              # Vite + Vitest 配置（@ → src 别名，/api 代理到 8787）
├─ server/
│  ├─ app.ts                   # Hono 路由与 HTTP 错误映射
│  ├─ post-store.ts            # 内存仓储：校验、倒序列表、创建、删除
│  └─ index.ts                 # 启动 API 服务（默认 8787），并托管 dist/ 静态产物
├─ src/
│  ├─ main.ts                  # 创建应用、安装 Pinia
│  ├─ App.vue                  # 页面编排：首屏加载、重试、发布、提示
│  ├─ api/posts.ts             # RESTful 客户端：Post / MAX_CONTENT_LENGTH / ApiError
│  ├─ assets/main.css          # 桃花主题全局样式
│  ├─ stores/posts.ts          # Pinia store：posts / ready / loading / error + load / addPost / toggleLike / toggleFavorite
│  ├─ utils/time.ts            # 相对时间与绝对时间格式化
│  ├─ composables/
│  │  ├─ useNotice.ts          # 轻提示：自动消失 + 定时器清理
│  │  └─ useNow.ts             # 共享当前时刻，定时 / 可见性刷新
│  └─ components/
│     ├─ BrandHeader.vue       # 品牌头部
│     ├─ PetalScene.vue        # 背景光晕与飘落花瓣
│     ├─ PostComposer.vue      # 发布表单（草稿、字数、按钮态）
│     ├─ PostCard.vue          # 单条内容卡片（点赞 / 收藏按钮）
│     ├─ TimelineList.vue      # 时间线列表、计数与加载骨架
│     ├─ EmptyState.vue        # 空状态
│     └─ AppFooter.vue         # 页脚说明
└─ tests/
   ├─ api/posts.spec.ts        # 请求 URL/方法/headers/body、错误映射、网络异常、点赞收藏方法
   ├─ stores/posts.spec.ts     # 加载、并发去重、本地校验、发布失败不污染列表、toggle 与收藏计数
   ├─ App.spec.ts              # 首屏加载、加载失败重试、发布成功/失败、点赞收藏与筛选
   ├─ components/PostComposer.spec.ts
   ├─ components/PostCard.spec.ts   # 点赞 / 收藏按钮的渲染、aria 状态与事件派发
   ├─ components/TimelineList.spec.ts
   ├─ unit/time.spec.ts        # 相对时间边界
   └─ server/                  # 后端：仓储单测 + HTTP 接口测试
```

## API 接口

基础地址来自 `import.meta.env.VITE_API_BASE`，默认 `/api`（开发环境由 Vite 代理到 `http://127.0.0.1:8787`）。

| 方法与路径 | 请求 | 成功响应 | 失败响应 |
| --- | --- | --- | --- |
| `GET /api/posts` | — | `200 { posts: Post[] }`（`createdAt` 倒序） | — |
| `POST /api/posts` | `{ content: string }`（`Content-Type: application/json`） | `201 { post: Post }` | `400 { error: { code, message } }` |
| `GET /api/posts/:id` | — | `200 { post: Post }` | `404 { error: { code: 'NOT_FOUND', message } }` |
| `DELETE /api/posts/:id` | — | `204` | `404 { error: { code: 'NOT_FOUND', message } }` |
| `PUT /api/posts/:id/like` | — | `200 { post: Post }`（幂等） | `404 { error: { code: 'NOT_FOUND', message } }` |
| `DELETE /api/posts/:id/like` | — | `200 { post: Post }`（未点赞时也返回 200） | `404` |
| `PUT /api/posts/:id/favorite` | — | `200 { post: Post }`（幂等） | `404` |
| `DELETE /api/posts/:id/favorite` | — | `200 { post: Post }`（未收藏时也返回 200） | `404` |

- `Post = { id: string; content: string; createdAt: number; likes: number; liked: boolean; favorited: boolean }`，`MAX_CONTENT_LENGTH = 280`。
- `likes` 为点赞数（单用户演示下即 0/1，重复 `PUT` 不会叠加），`liked` / `favorited` 为服务端保存的当前状态；前端解析时对缺失字段容错（`likes → 0`、布尔 → `false`），老数据也能正常渲染。
- 400 错误码：`EMPTY_CONTENT`（内容为空）、`CONTENT_TOO_LONG`（超过 280 字）、`INVALID_BODY`（body 缺少字符串 `content`）、`INVALID_JSON`（body 不是合法 JSON）。
- 前端 `src/api/posts.ts` 会把非 2xx 响应解析为 `ApiError`（含后端 `code`、HTTP `status` 与后端 `message`）；`fetch` 本身失败时包装为 `code: 'NETWORK_ERROR'`、`status: 0`。

## 数据流

1. `App.vue` 在 `onMounted` 调用 `store.load()` → `fetchPosts()` → `GET /api/posts`，期间 `TimelineList` 展示骨架（`data-testid="timeline-loading"`）。
2. 发布时 `PostComposer` 只派发去除首尾空白的文本；`store.addPost()` 先做本地 trim + 空/超长校验，通过后调用 `createPost()`。
3. 服务端返回的 `Post` 直接置顶插入列表（不本地生成 id、不本地伪造记录）；失败则返回 `{ ok: false, reason: 'request-failed' }`，列表原样保留。
4. 点赞 / 收藏时卡片只派发 `toggle-like` / `toggle-favorite`，`App.vue` 调 `store.toggleLike()` / `toggleFavorite()`，store 用服务端返回的 `Post` 整体替换同 id 项（不本地自增），失败只提示不改数据。
5. 「只看收藏」是纯前端筛选：`store.favoritePosts` 按 `favorited` 过滤，切换筛选不重新请求后端。
6. 列表只来自服务端，页面中不存在任何 `localStorage` 读写。

## 运行

```bash
npm install        # 安装依赖
npm run dev        # 同时启动 API（http://127.0.0.1:8787）与前端（http://localhost:5173）
npm run dev:api    # 仅启动 API（tsx watch）
npm run dev:web    # 仅启动前端（Vite，/api 代理到 8787）
npm run test       # 监听模式运行测试
npm run test:run   # 单次运行全部测试（前端 + 后端）
npm run typecheck  # vue-tsc 类型检查
npm run build      # 类型检查 + 生产构建（输出 dist/）
npm run start      # 以生产模式启动 API 并托管 dist/（默认 8787）
```

> 内存存储：内容保存在 API 进程的数组中，**重启服务（`npm run dev` 重新启动、进程崩溃、部署重启）即全部清空**，不做落盘。

## TDD 流程

项目按「红 → 绿 → 重构」推进，数据层由 localStorage 迁移到 RESTful API 时同样如此：

1. **红**：先写 `tests/api/posts.spec.ts`、重写 `tests/stores/posts.spec.ts` 与 `tests/App.spec.ts`、给 `TimelineList` 补 loading 用例，运行 `npm run test:run`：3 个文件因 `@/api/posts` 模块不存在而失败，`TimelineList` 的 3 个 loading 用例断言「找不到 `timeline-loading`」失败。
2. **绿**：实现 `src/api/posts.ts`、重写 `src/stores/posts.ts`、改造 `App.vue` 与 `TimelineList.vue`，并删除不再需要的 `src/utils/id.ts`、`tests/setup.ts`，直到 94 个用例全部通过。
3. **重构**：把错误文案收敛为 store 导出的常量（`LOAD_ERROR_MESSAGE` / `ADD_ERROR_MESSAGE`），统一 `ApiError` 类型与响应体解析逻辑，删除 localStorage 相关代码，随后补跑类型检查与构建。

测试遵循黑盒原则：通过角色、文案与 `data-testid` 查询，模拟用户输入与提交，断言可见结果与派发事件；数据层测试 mock `globalThis.fetch` 或 `@/api/posts` 模块，断言请求形态与状态变化。

点赞 / 收藏这一次迭代用 **Git Worktree + 双 Agent 并行** 完成：后端（`server/**` + `tests/server/**`）与前端（`src/**` + 其余测试）在两条 worktree 分支上各自按红→绿→重构推进，再由主流程合并，最后统一跑测试、构建与浏览器验收。

当前用例分布：**前端 103 个（7 个文件）+ 后端 67 个（2 个文件）= 170 个**。

覆盖的关键行为：

- API 客户端：`GET /api/posts`、`POST` 的 JSON headers 与 body、`DELETE` 的 204、400 错误码与 message 映射、非 JSON 错误体兜底、`fetch` 失败 → `NETWORK_ERROR`（status 0）、脏记录过滤；点赞/收藏的 PUT/DELETE 方法、id 编码、无请求体、`INVALID_RESPONSE`。
- store：加载成功/失败/并发去重、`ready` / `loading` / `error` 状态迁移、空与超长内容不发请求、恰好 280 字、成功置顶、服务端失败 `request-failed` 且不污染列表、action 不抛异常；toggle 成功后计数与标记以服务端返回为准、顺序不变、失败不污染数据、未知 id 不发请求。
- 页面：首屏拉取并渲染、加载骨架、加载失败提示与重试、发布成功置顶且清空输入框、发布失败错误提示、空内容提示，并断言 `localStorage` 从未被写入；点赞 +1 再取消归零、收藏筛选只剩收藏项、空收藏引导与整页空状态互斥、接口失败提示。
- 组件：字数与告警、空白禁用、超长保留草稿、提示样式、加载骨架与空状态的互斥、`<script>` 按纯文本渲染、新内容动画标记；点赞/收藏按钮的 `aria-pressed`、计数展示与事件派发。
- 后端：仓储校验与倒序、八个接口的状态码与错误体、点赞收藏幂等与非负计数、404 兜底。

## 许可

MIT
