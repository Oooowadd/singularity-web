# Singularity Web — 最终架构

**Last revised**: 2026-05-20

---

## 架构图

```
┌────────────────────────────────────────────────┐
│   浏览器                                        │
└────────────────────┬───────────────────────────┘
                     │
        ┌────────────▼─────────────────────┐
        │   Next.js 16 (Vercel)             │
        │   ─────────────────────────────   │
        │   • Tailwind 4 + shadcn/ui        │
        │   • tRPC v11 (BFF)                │
        │   • Vercel AI SDK (流式批改)      │
        │   • Trigger.dev v3 (长任务)       │
        └────┬─────────────────┬────────────┘
             │                 │
   ┌─────────┴────┐    ┌───────┴───────────────┐
   ▼              ▼    ▼                       ▼
 Logto       Supabase  TikHub                  LLM / ASR
(Auth)      (Postgres) (YouTube + XHS data    DeepSeek (主)
                       + audio streams)        Claude Sonnet (vision)
            R2                                  Deepgram Nova-3 (主 ASR)
            (大文件)                            Groq Whisper (备 ASR)
                                                YouTube Data API (metadata)
```

---

## 技术栈一览

| 层 | 选择 |
|---|---|
| 主语言 | TypeScript |
| 前端框架 | Next.js 16 App Router (Vercel) |
| UI 组件 | shadcn/ui (base-nova) + Radix（Tailwind 4） |
| API 层 | tRPC v11 |
| 客户端缓存 | tRPC + React Query（按需补 Zustand） |
| AI 流式 | Vercel AI SDK |
| 长任务编排 | Trigger.dev v3（Hobby, $10/mo） |
| Auth | Logto Cloud |
| 数据库 | Supabase Pro (Postgres + Realtime) + Drizzle |
| 大文件存储 | Cloudflare R2 |
| 数据层 / 抓取 | TikHub（YouTube 频道列表 + audio streams + XHS 全套） |
| LLM 主链 | DeepSeek V4 Pro + Flash |
| LLM vision | Claude Sonnet 4.6 |
| ASR | Deepgram Nova-3（主）+ Groq Whisper（备） |
| 视频元数据 | YouTube Data API v3（免费 10K/天） |
| Monorepo | pnpm + Turborepo |

> 状态管理：Server Components + tRPC + React Query 已覆盖大部分场景。本地 UI 状态用 `useState` / `Context`。跨页面复杂共享状态出现时再引入 Zustand。

---

## 核心决策要点

### 1. Auth 用 Logto Cloud（不是 Supabase Auth）

Day 1 支持 Email / 手机号 / Apple / Google / GitHub；原生 WeChat 连接器（M3 加 WeChat 时无需迁移）；50K MAU 免费。Supabase Auth 不支持 WeChat，对中国创作者不可缺失。

### 2. 长任务用 Trigger.dev v3

Vercel 函数最长 800s，30 分钟长稿生成单函数跑不了。Hobby $10/mo 解锁 7 天 maxDuration。`useRealtimeRun` 推进度到前端，无需自管轮询。

### 3. 输出 HTML + PDF（放弃 .docx）

npm `docx` 弱于 `python-docx`；Web 场景 HTML/PDF 更通用。

### 4. ICP 备案 + WeChat 开放平台尽早启动

备案 3-6 月 + $5-15K。不立即启动会推迟 WeChat 上线。

---

## 配套文档

功能模块、服务商与区域、运维注意事项、未来优化、关键决策证据：
👉 [`./beta_rewrite_plan.md`](./beta_rewrite_plan.md)
