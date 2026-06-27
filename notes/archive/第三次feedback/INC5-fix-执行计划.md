# INC5-fix 执行计划 —— 前端 IA 对齐 §5（一次性大改 + 全链路测试）

> 目标：把前端 IA 改成 `Part2-实施方案.md` §5（lines 128-163）的样子，然后从头到尾跑一遍全链路深度测试（性能 / 生成内容质量 / UI-UX-HCI / edge）。
> 后端 + 数据模型（三层 own_accounts/projects/competitor、#3 对标 tRPC、Bible 硬 pin、SOP/Bible resolver、全部迁移）**已 §5-correct，本轮不动**。

## 现状盘点（Explore 实测，2026-06-08）

- **真实工具页**在 `/projects/[slug]/{clerk,muse,poet}/**`（INC5c 搬过来的），页面体可复用。
- 旧 `/clerk/[slug]`、`/muse/[slug]`、`/poet/[slug]/**` 是 308 stub → 指向 `/projects/[slug]/*`。
- `/clerk`、`/muse`、`/poet` landing（频道列表 hub）仍是真实页。
- `/channels*` → 308 → `/accounts*`（已对）。
- `/accounts`、`/accounts/[slug]`（含 ProjectCompetitorsCard）、`/competitors` 真实页。
- Bible 历史 UI 在 `/projects/[slug]/poet/_components/bible-history.tsx`（poet 页内）。
- `getDashboardSnapshot`（lib/dashboard-data.ts）= 9 并行 query，按 **userId** 聚合（非 own_account），无 per-account breakdown。
- 残留 stale 链接（landing 表格行点击仍指旧 URL）：poet/page:90、muse/page:82、clerk/page:71、projects/[slug]/poet:393、projects/[slug]/clerk:151。

## 目标路由树（§5）

```
/                                              工作台 dashboard（own_account 聚合 + onboarding 阶梯）
/clerk                                         Clerk landing（全局）
/clerk/[slug]                                  Clerk 工作台（REAL，从 projects 搬回）
/clerk/[slug]/[videoId]                        视频详情（REAL，搬回）
/sops                                          全局 SOP 库（NEW）
/competitors                                   对标池
/competitors/[id]                              对标详情（INC7，可选，本轮可留 stub/不做）
/accounts                                      账号列表
/accounts/[slug]                               账号 hub（设置/资产/项目列表入口）
/accounts/[slug]/bible                         账号级 Bible（NEW，从 poet 页抽出）
/accounts/[slug]/projects/new                  项目创建（NEW，内联 平台+时长+SOP+对标绑定）
/accounts/[slug]/projects/[project]            项目 hub（NEW，含对标绑定卡 + Muse/Poet 入口）
/accounts/[slug]/projects/[project]/muse       Muse 工作台（REAL，从 projects 搬来）
/accounts/[slug]/projects/[project]/poet       Poet 工作台（REAL，搬来）
/accounts/[slug]/projects/[project]/poet/scripts/[scriptId]   （搬来）
/accounts/[slug]/projects/[project]/poet/topics/[topicId]     （搬来）
```

动态段命名：账号段统一 `[slug]`，项目段统一 `[project]`。展开期 slug==project==老 channel slug（projects.id==channels.id==own_accounts.id）。

## 深链 308（旧 URL 真实路由段，server 查 slug 后 permanentRedirect）

- `/projects/[slug]` → `/accounts/[slug]`
- `/projects/[slug]/clerk` → `/clerk/[slug]`；`/projects/[slug]/clerk/[videoId]` → `/clerk/[slug]/[videoId]`
- `/projects/[slug]/muse` → `/accounts/[slug]/projects/[slug]/muse`
- `/projects/[slug]/poet` → `/accounts/[slug]/projects/[slug]/poet`；poet/scripts/[id]、poet/topics/[id] 各自显式嵌套
- `/muse/[slug]` → `/accounts/[slug]/projects/[slug]/muse`
- `/poet/[slug]` / scripts/[id] / topics/[id] → 对应新嵌套
- `/muse`、`/poet` landing → `/accounts`（§5 nav 无全局 muse/poet hub）
- `/clerk`、`/clerk/[slug]`、`/clerk/[slug]/[videoId]` **保留为真实页（不 redirect）**
- `/channels*` → `/accounts*`（已存在）

## Phase A —— 前端 IA 大改（执行顺序，每步后 `pnpm typecheck`）

- **A1 Clerk 搬回全局**：`git mv projects/[slug]/clerk/**` → `clerk/[slug]/**`（覆盖现 stub）。改 params（已是 [slug]，但语义从 project→account）；back-link `/clerk`；视频深链 `/clerk/[slug]/[videoId]`。
- **A2 Muse/Poet 嵌套到项目**：`git mv projects/[slug]/{muse,poet}/**` → `accounts/[slug]/projects/[project]/{muse,poet}/**`。params 从 `{slug}` → `{slug, project}`；页面按 project slug 解析并校验归属 account。bible-history 留在 poet 页（账号级 bible 页 A4 另建只读/管理视图，二者数据同源，避免重复写）。
- **A3 旧 projects/* 转 stub**：`projects/[slug]/page.tsx` 已是 redirect；新增 `projects/[slug]/{clerk,muse,poet}` 各 308（A1/A2 搬走后留壳）。
- **A4 旧 muse/poet stub 改目标**：`muse/[slug]`、`poet/[slug]/**` redirect 目标改成新嵌套 URL；`muse`、`poet` landing → `/accounts`。
- **A5 新页面**：
  - `/sops`：全局 SOP 库（聚合所有 clerkSops，按 own_account/类型分组；复用 clerk SOP 渲染）。
  - `/accounts/[slug]/bible`：账号级 Bible 页（抽 bible-history 的管理 UI，account 维度）。
  - `/accounts/[slug]/projects/new`：项目创建（内联 平台 + target_duration + SOP 选择 M:N + 对标绑定）。
  - `/accounts/[slug]/projects/[project]`：项目 hub（ProjectCompetitorsCard 从账号页移来 + Muse/Poet 入口 + 项目设置）。
- **A6 nav 重构**：app-sidebar → 全局（工作台 `/` / Clerk `/clerk` / SOP库 `/sops` / 对标池 `/competitors`）+ 我的账号（`/accounts` → 可展开账号 → Bible + Project[]）。
- **A7 href 一次性清扫**：landing 表格行（poet:90/muse:82/clerk:71）、跨页 back-link、scripts/topics/video 深链、agent-stat-cards、next-step-card 全部 context-aware（带 account/project）。
- **A8 dashboard/onboarding/context-header**：
  - getDashboardSnapshot 增 own_account 聚合（每账号一行：平台 + 项目数 + 各 agent 计数）；AgentStatCard href 落 `/accounts`；active-runs-banner 保持 channelId 域。
  - next-step-card 阶梯：账号 → 项目 → 加对标 → Clerk SOP → Muse → Poet；老用户跳首个未完成步。
  - 持久 context header `[账号·平台] > [项目·时长]`（layout 级，工具页显示）。
- **文案**：所有新 UI 文案逐条「待你定」；archive 措辞（`对标账号` / `巡视对标频道`）原样复用；禁「拍死/完胜/硬伤」。

## Phase B —— 全链路深度测试矩阵

| 维度 | 内容 | 谁跑 |
|---|---|---|
| **B1 静态门** | `pnpm typecheck` 全仓绿 / `pnpm lint` 绿 / `pnpm build`（web）成功 / 无 dead import | 我 |
| **B2 路由完整性** | route-smoke 脚本（不提交）：所有新 URL→200；所有旧形态→308→正确目标（无 loop，终态 200）；不存在 slug→404 | 我（curl vs prod 或 local `next start`）|
| **B3 全链路 E2E** | 空账号→建账号→建项目(平台+时长+SOP+对标)→Clerk SOP→Muse 选题→Poet 写稿；每步验 resolvePrimarySop / resolveActiveBible(pin) / duration 优先级 / competitor platform→ASR 路由；peek 脚本验落库 | 我（Trigger+peek）+ 用户(UI) |
| **B4 生成内容质量** ⭐ | Clerk SOP 三型 / Muse 选题+fact-check 残留 / Poet 短稿+长稿(outline→section) / Bible 文风+drift / grounding-factCheck 闭环(徕卡 M4≠1964 复测) / humanizer 中文 / ASR 中文(XHS competitor)乱码残留 | 我（真机重跑+抽查）|
| **B5 性能** | dashboard 加载(聚合改造后再测) / tRPC p50-p95 / 6 个 Trigger job 时长 / build 产物大小+首屏 / useRealtimeRun 推送延迟 | 我 |
| **B6 UI/UX/HCI** ⭐ | 导航可发现性+信息架构 / context header 始终回答「我在哪」/ 空-loading-error 三态 / 对标绑定交互 / 响应式+基本 a11y(focus/aria/键盘) / 文案占位一致 / Nielsen 10 启发式走查 | sub-agent 代码级走查 + 用户视觉验收 |
| **B7 edge** | 无账号/项目/Bible/SOP/对标 各空态 / stale pin→fallback / SOP retry 重复→unique idx / 多项目同账号路由 / slug 冲突 / 旧深链 404 回退 / 并发 run guard | 我 |

## 部署 + 验收门

- 改 packages/shared 或 apps/jobs → **必须重部署 Trigger.dev**（MCP deploy，docker workaround）。本轮 A 主要动 apps/web（Vercel 自动），若 B4 要改 prompt/服务则触发重部署。
- 每个 Phase A 子步 typecheck 绿才进下一步；A 全绿 → push → Vercel 预览 → B 测试。
- 迁移：本轮 A 不新增迁移（纯前端）；INC6 契约删列在 INC5-fix + 验收后单独做。

## 边界（本轮不做）

- INC6 契约（drop channels.competitors/duration_minutes/channel_id + SET NOT NULL）→ INC5-fix 验收后。
- `/competitors/[id]` 对标详情（INC7）可留最小 stub。
- Muse 选题 fact-check（Part 1 残留）→ B4 评估后单独排。

## 关键复用（勿重造）

- 工具页页面体：`projects/[slug]/{clerk,muse,poet}/**`（搬不改）。
- bible 管理：`projects/[slug]/poet/_components/bible-history.tsx`。
- 对标绑定卡：`accounts/_components/project-competitors-card.tsx`。
- competitors tRPC：list/import/remove/bind/unbind/listForProject。
- resolver：`packages/db/src/queries/{sop,bible}.ts`。
