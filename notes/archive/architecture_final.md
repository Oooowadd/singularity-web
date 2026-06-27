# Singularity Web — 最终架构

**Last revised**: 2026-05-21

---

## 架构图

```
┌────────────────────────────────────────────────┐
│   浏览器                                        │
└────────────────────┬───────────────────────────┘
                     │
        ┌────────────▼─────────────────────┐
        │   Next.js 16 (Vercel hkg1)        │
        │   ─────────────────────────────   │
        │   • Tailwind 4 + shadcn/ui        │
        │   • tRPC v11 (BFF)                │
        │   • Vercel AI SDK v6 (流式批改)   │
        │   • Trigger.dev v4 (长任务, us-east) │
        └────┬─────────────────┬────────────┘
             │                 │
   ┌─────────┴────┐    ┌───────┴───────────────┐
   ▼              ▼    ▼                       ▼
 Logto       Supabase  TikHub                  LLM / ASR
(Tokyo)     (Singapore) (YouTube + XHS data   DeepSeek (主, 中国)
            Postgres   + audio streams)        Claude Sonnet (vision, us-east)
                                                Deepgram Nova-3 (主 ASR, us-east)
                                                Groq Whisper (备 ASR, us-east)
                                                YouTube Data API (metadata)
```

---

## 技术栈一览

| 层            | 选择                                                  |
| ------------- | ----------------------------------------------------- |
| 主语言        | TypeScript                                            |
| 前端框架      | Next.js 16 App Router (Vercel)                        |
| UI 组件       | shadcn/ui (base-nova) + Radix（Tailwind 4）           |
| API 层        | tRPC v11                                              |
| 客户端缓存    | tRPC + React Query（按需补 Zustand）                  |
| AI 流式       | Vercel AI SDK                                         |
| 长任务编排    | Trigger.dev v4（Hobby $10/mo, workers us-east-1）     |
| Auth          | Logto Cloud（Tokyo）                                  |
| 数据库        | Supabase Pro (Postgres ap-southeast-1) + Drizzle      |
| 数据层 / 抓取 | TikHub（YouTube 频道列表 + audio streams + XHS 全套） |
| LLM 主链      | DeepSeek V4 Pro + Flash                               |
| LLM vision    | Claude Sonnet 4.6                                     |
| ASR           | Deepgram Nova-3（主）+ Groq Whisper（备）             |
| 视频元数据    | YouTube Data API v3（免费 10K/天）                    |
| Monorepo      | pnpm + Turborepo                                      |

> 状态管理：Server Components + tRPC + React Query 已覆盖大部分场景。本地 UI 状态用 `useState` / `Context`。跨页面复杂共享状态出现时再引入 Zustand。
