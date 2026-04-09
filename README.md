# Sohu Auto Advisor Demo

一个面向中文用户的车型选购助手 Demo。

## 核心能力

- 覆盖多品牌多车型推荐，不再限定单一品牌叙事。
- 首页合并自然语言输入与高级筛选器。
- 后端代理抓取搜狐汽车页面，前端不直连搜狐。
- 支持 10-30 分钟级缓存（当前默认 15 分钟）。
- AI 解析自然语言需求失败时自动回退到规则+表单筛选。
- 默认输出 Top 3 推荐，并展示关键参数对比表。
- 每条推荐包含推荐理由、参数、价格区间、来源链接。
- 当搜狐与品牌官网参数冲突时优先官网。

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 配置环境变量（可选但推荐）

复制 `.env.example` 为 `.env.local` 并设置：

```env
LLM_API_KEY=your_api_key
LLM_MODEL=your_model
LLM_API_URL=https://ark.cn-beijing.volces.com/api/v3/chat/completions
VITE_API_BASE_URL=
```

说明：

- 未配置 LLM 时，系统会自动使用规则解析用户自然语言。
- 仅影响自然语言需求抽取，不影响基础筛选推荐流程。
- 如果本地 `npm run dev` 环境下 `/api` 不可用，可以设置 `VITE_API_BASE_URL` 指向已部署站点域名，例如 `https://your-domain.vercel.app`。

3. 启动开发服务

```bash
npm run dev
```

## API 说明

- 入口：`api/experience-guide.js`
- 方法：`POST`
- 请求体：

```json
{
  "query": "预算20-30万，家用7座，优先插混",
  "filters": {
    "budgetMinWan": 20,
    "budgetMaxWan": 30,
    "scene": "家用",
    "powerPreference": "插混",
    "brandInclude": ["比亚迪"],
    "brandExclude": ["某品牌"],
    "seats": 7,
    "smartNeed": "高速领航"
  }
}
```

- 响应：解析模式、推荐列表、对比表、抓取时间、数据来源说明。

## 抓取与缓存策略

- 后端实时抓取搜狐页面并做结构化抽取。
- 为保证稳定性，使用内存缓存（默认 15 分钟）。
- 抓取失败时仍会使用内置种子车型保障最小可用体验。

## 线上部署（Vercel / Node）

### Vercel

1. 导入仓库到 Vercel。
2. 在项目环境变量中配置 `LLM_API_KEY`、`LLM_MODEL`、可选 `LLM_API_URL`。
3. 直接部署。

### Node 服务

该项目前端为 Vite。若需 Node 常驻服务，请将 `api/experience-guide.js` 挂载到你的 Node 框架（如 Express/Fastify）并确保：

- Node 版本 >= 20
- 可访问外网（用于抓取搜狐与调用 LLM）
- 生产环境使用 Redis 或外部缓存替换内存缓存

## 合规提示

页面应明确展示：

- 数据来源于搜狐汽车，价格与配置以官方最新信息为准。
- 如搜狐与官网冲突，优先展示官网信息。

## API排查建议

1. 先直接调用线上接口 `POST /api/experience-guide` 验证是否返回 `recommendations`。
2. 若返回 404，请确认部署分支与接口路径；若返回 405，请确认方法为 POST。
3. 若返回 5xx，请在 Vercel Functions 日志中查看错误详情。
4. 修改 Vercel 环境变量后必须 Redeploy 才会生效。
