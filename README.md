# Singularity Web

AI 内容教练 web SaaS — 给中国小型创作者（XHS + YouTube）完成"看对标 → 出选题 → 写稿"的全链路。Closed beta 目标 Q3 2026。

## 技术栈

Next.js 16 · TypeScript · tRPC v11 · Vercel AI SDK v6 · Trigger.dev v4 · Logto Cloud · Supabase + Drizzle · DeepSeek + Claude Sonnet · Deepgram + Qwen3-ASR-Flash · TikHub

## 文档

- 代码结构与部署模型：[`ARCHITECTURE.md`](./ARCHITECTURE.md)
- 功能模块、运维注意事项、未来优化：[`notes/beta.md`](./notes/beta.md)
- Claude Code 工作约定：[`CLAUDE.md`](./CLAUDE.md)

## 仓库结构

```
singularity-web/
├── apps/
│   ├── web/                  # Next.js (前端 UI + tRPC API)
│   └── worker/               # Trigger.dev 长任务
├── packages/
│   ├── db/                   # Drizzle schema + 迁移 + smoke 脚本
│   ├── domain/               # 领域服务 + schemas
│   ├── integrations/         # 外部集成 clients + proxy + utils
│   ├── prompts/              # LLM 提示词（核心 IP）
│   └── ui/                   # 共用 UI
└── notes/                    # 功能 / 成本 / 流程说明（archive/ 为历史）
```

## 开发

```bash
pnpm install
pnpm --filter @singularity/web build
pnpm --filter @singularity/web dev          # Next.js dev
pnpm --filter @singularity/worker dev       # Trigger.dev worker（另开窗口）
```

Smoke 测试（任选）：

```bash
pnpm --filter @singularity/db poet-services-smoke
pnpm --filter @singularity/db muse-services-smoke
pnpm --filter @singularity/db xhs-client-smoke
pnpm --filter @singularity/db vision-and-verify-smoke
pnpm --filter @singularity/db asr-fallback-smoke
```
