# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目状态

**Week 0**：仓库刚初始化，只有 planning 文档。Week 1 Day 1 才开始 `pnpm dlx create-turbo` 拉骨架。8 周 closed beta 目标 Q3 2026，里程碑见 `notes/beta_rewrite_plan.md` §5。

## 它是什么

AI 内容教练 web SaaS。目标用户：中国小型创作者（1-2 人团队，主战 XHS + YouTube）。核心交付：60 秒内出流式 AI 批改稿件。

完整定位 / 业务模型见 `notes/beta_rewrite_plan.md`；架构图与决策依据见 `notes/architecture_final.md`。

## 锁定的技术栈

| 层 | 选择 |
|---|---|
| 主语言 | **TypeScript**（仅 yt-dlp / XHS sidecar 用 Python）|
| 前端 | Next.js 15 App Router on Vercel |
| UI | Tailwind 4 + shadcn/ui + Radix |
| API | tRPC v11 |
| AI 流式 | Vercel AI SDK v4+ |
| 长任务 | Trigger.dev v3（Vercel Pro 函数最长 800s 跑不了 30 min 长稿）|
| Auth | Logto Cloud（不是 Supabase Auth；要支持 WeChat）|
| DB | Supabase Pro (Postgres + Realtime) + Drizzle ORM |
| 大文件 | Cloudflare R2 |
| Python sidecar | FastAPI on Render SG（yt-dlp + bgutil-pot-provider + XHS sign.js）|
| Monorepo | pnpm + Turborepo |

## 任务分类决定代码放哪里

任务时长 + 运行时决定写在哪个 workspace：

- **Class A 短任务（< 800s）** → Next.js API 路由内 Vercel AI SDK：`streamText` / `useChat` / `streamObject` / `useObject`；多步 agent 用 `stopWhen: stepCountIs(N)`。Upload Critique、Link Analysis、短脚本都走这条
- **Class B 长任务（≥ 800s）** → `apps/jobs/trigger/` 下 Trigger.dev v3 任务，前端 `useRealtimeRun` 推进度。30 分钟长稿（outline → section expand）、Clerk 频道分析、Muse 竞品监控都走这条
- **抓取（yt-dlp / XHS）** → `apps/scraper/`（Python FastAPI on Render SG），Next.js 通过内部 JWT 调；唯一允许出现 Python 的子目录

完整规划目录树见 `notes/beta_rewrite_plan.md` §3。

## 约定

- TS 一统天下，Python 只在 `apps/scraper/` 出现
- **不**预装 Zustand。客户端状态用 tRPC + React Query + useState/Context；只有跨页面复杂共享状态出现时才引入
- 所有 prompt 模板集中在 `packages/shared/prompts/`（核心 IP，从 archive 1:1 移植，见下方清单）
- 所有 Trigger.dev 任务在 `apps/jobs/trigger/`
- 文档输出统一 HTML + PDF（不做 `.docx`，npm `docx` 功能弱于 `python-docx`，已在 2026-05-15 决策放弃）
- 长稿阈值：中文 ≥2000 字 / 英文 ≥1500 词（约 10 min+）触发 outline → section expand 路径（即走 Trigger.dev）。来源 archive `script_writer.py:_write_script_long_form()`
- 用词避免"拍死""完胜""硬伤"等口语化措辞

## 核心 IP（从 archive 1:1 移植到 `packages/shared/prompts/`）

这些 prompt 与算法是产品壁垒，移植时保留原措辞与逻辑：

- `prompts/poet_prompts.py` — SCRIPT_WRITING / LONG_FORM_OUTLINE / SECTION_EXPAND / CHANNEL_BIBLE
- `prompts/muse_prompts.py` — VIRAL_TRIGGER / IDEA_GENERATION
- `prompts/clerk_prompts.py` — analysis prompts
- `services/humanizer.py` — humanize_chinese
- `services/bible_generator.py` — drift detection 算法（lexical overlap + stopwords list）
- `services/script_writer.py` — long-form thresholds（即上方 4000 字 / 3000 词的来源）

archive 路径见文末"前身仓库"。

## 开发命令

**Week 0：尚未 scaffold**。Week 1 Day 1 启动序列见 `notes/beta_rewrite_plan.md` §9（`pnpm dlx create-turbo` → `create-next-app` → `shadcn init` → 注册云服务 → Vercel deploy）。

Turborepo 拉起后此处填入 build / lint / test / 单 workspace 运行命令。

## 仍待 Justin 决定

- **D3**：1 人 8 周 vs 2 人 5 周开发节奏
- **D4**：ICP 备案 + 微信开放平台是否 Week 1 启动（备案周期 3-6 个月、$5-15K，启动越晚 WeChat 上线越晚）

## 前身仓库（archive）

`~/Desktop/Singularity-Macos-Social-Media-AI-Agent/` — Electron 原型，含 6K Python LOC。
重写时从这里查阅：
- prompt 模板（`backend/app/prompts/*.py`）
- bible drift detection 算法（`backend/app/services/bible_generator.py`）
- long-form thresholds（`backend/app/services/script_writer.py`）
- XHS sign.js（`backend/app/services/xhs_fetcher.py`）
- LLM 调用 retry 模式（`backend/app/services/transcript.py`）
