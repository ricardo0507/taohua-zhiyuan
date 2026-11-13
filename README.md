# 桃花之源

一个极简的本地记事页：写下此刻的想法，它会以卡片形式留在时间线上，刷新或关闭页面都不会丢失。

项目已由原生 HTML/CSS/JS 改写为 **Node.js + Vue 3 + Pinia**，并使用 **Vitest + Vue Test Utils** 以 TDD（测试驱动开发）方式实现。数据依然只存放在浏览器 `localStorage`，没有任何后端请求。

## 功能

- **发布内容**：多行输入，实时字数统计（上限 280），空内容时发布按钮不可用。
- **时间线**：新内容置顶，卡片底部显示相对时间（刚刚 / 5 分钟前 / 3 天前 / 具体日期），每分钟自动刷新。
- **本地持久化**：所有内容保存在 `localStorage`，键名 `taohua:posts`。
- **健壮性**：脏数据过滤与归一化、非法 JSON 容错、存储不可用时降级为内存存储并提示。
- **空状态引导**与**响应式布局**：移动端单列铺满，桌面端 640px 居中。

## 技术栈

| 分类 | 选型 |
| --- | --- |
| 运行时 | Node.js ≥ 20.19 |
| 框架 | Vue 3.5（Composition API + `<script setup>` + TypeScript） |
| 状态管理 | Pinia 3（setup store） |
| 构建 | Vite 7 |
| 测试 | Vitest 3 + Vue Test Utils + jsdom |

## 目录结构

```text
├─ index.html                  # Vite 入口
├─ vite.config.ts              # Vite + Vitest 配置（@ → src 别名）
├─ src/
│  ├─ main.ts                  # 创建应用、安装 Pinia
│  ├─ App.vue                  # 页面编排：hydrate、发布、提示
│  ├─ assets/main.css          # 桃花主题全局样式（沿用原设计）
│  ├─ stores/posts.ts          # Pinia store：载入 / 发布 / 持久化
│  ├─ utils/
│  │  ├─ id.ts                 # UUID 与回退 id
│  │  └─ time.ts               # 相对时间与绝对时间格式化
│  ├─ composables/
│  │  ├─ useNotice.ts          # 轻提示：自动消失 + 定时器清理
│  │  └─ useNow.ts             # 共享当前时刻，定时 / 可见性刷新
│  └─ components/
│     ├─ BrandHeader.vue       # 品牌头部
│     ├─ PetalScene.vue        # 背景光晕与飘落花瓣
│     ├─ PostComposer.vue      # 发布表单（草稿、字数、按钮态）
│     ├─ PostCard.vue          # 单条内容卡片
│     ├─ TimelineList.vue      # 时间线列表与计数
│     ├─ EmptyState.vue        # 空状态
│     └─ AppFooter.vue         # 页脚说明
└─ tests/
   ├─ setup.ts                 # 每个用例前后清理 localStorage
   ├─ unit/time.spec.ts        # 相对时间边界
   ├─ unit/id.spec.ts          # id 唯一性与回退
   ├─ stores/posts.spec.ts     # 持久化、校验、降级、脏数据
   ├─ components/PostComposer.spec.ts
   ├─ components/TimelineList.spec.ts
   └─ App.spec.ts              # 发布、加载、提示、刷新的端到端行为
```

## TDD 流程

项目按「红 → 绿 → 重构」推进：

1. **红**：先写 `tests/**` 下的行为断言，运行 `npm run test:run`，6 个测试文件因缺少实现全部失败。
2. **绿**：依次实现纯函数、Pinia store、composable 与组件，不改断言，直到 42 个用例全部通过。
3. **重构**：抽离 `useNotice` / `useNow`，把校验与持久化收敛到 store，组件只保留 UI 职责；随后补充类型检查与构建。

测试遵循黑盒原则：通过角色、文案与 `data-testid` 查询，模拟用户输入与提交，断言可见结果、派发事件与 `localStorage` 内容，不直接触碰组件内部状态。

覆盖的关键行为：

- 时间文案的四个相对区间、同年 / 跨年格式、未来时间兜底。
- id 多次生成不重复、`crypto.randomUUID` 不存在时的回退格式。
- store：载入既有数据、脏数据过滤、非法 JSON、非数组、写入失败降级、超长与空内容拒绝、恰好 280 字、跨实例恢复。
- 发布表单：字数与告警、空白禁用、提交去除首尾空白、超长保留草稿、提示样式。
- 列表：空状态、计数、顺序、相对时间、`<script>` 按纯文本渲染、新内容动画标记。
- 页面：首屏加载历史、发布置顶并落盘、提示文案、本地存储不可用时的降级与提示。

## 运行

```bash
npm install        # 安装依赖
npm run dev        # 本地开发，默认 http://localhost:5173
npm run test       # 监听模式运行测试
npm run test:run   # 单次运行全部测试
npm run typecheck  # vue-tsc 类型检查
npm run build      # 类型检查 + 生产构建（输出 dist/）
npm run preview    # 预览构建产物
```

## 数据说明

数据存放在当前浏览器的 `localStorage`，键名 `taohua:posts`，值为如下结构的数组（按发布时间倒序）：

```json
[{ "id": "uuid", "content": "内容", "createdAt": 1730000000000 }]
```

载入时会过滤结构不完整的记录，并补全缺失的 `id` / `createdAt`。内容仅存在于本机浏览器：换浏览器、换设备、清理浏览器数据都会导致内容消失。

## 许可

MIT
