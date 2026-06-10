# P-C · Clerk 拆对标真解耦 — 设计文档

> 状态:待 owner 拍板。来源:三视角评审(用户 persona / 产品 IA / HCI,2026-06-10)+ 方案一决策 A/B/Q1。
> 工期估算:**4-5 天**,含一次 Trigger 重部署与 expand 迁移。前置:owner 完成 YouTube 全流程走查。

## 1. 目标与非目标

**目标**:Clerk 可直接拆解「对标账号」(competitor_accounts),产物 SOP 溯源到对标、进 SOP 库、可被任意项目选用(P-B 已通)。用户不再需要把学习对象伪装成「我的账号」。

**非目标(记录在案,本轮不做)**:Bible 跨账号母版;跨项目选题库/脚本库;统一 analysis_targets 实体(beta 后);多项目 projects.create;历史伪账号强制批量搬迁。

**红线(HCI)**:绝不交付「UI 两组目标 + 底层自动建假账号」的半套。UI 与数据解耦是同一交付,缺一不上线。

## 2. 数据模型

### 2.1 归属规则(一句话)

**一次 Clerk 分析的目标 = 恰好一个「我的账号」或恰好一个「对标账号」**;run 行是权威记录,clerk_videos / clerk_sops 在写入时由 job 从 payload 单点盖章(单写入路径,不存在第二个写者)。ad-hoc URL 分析(方案一决策 A 的「未命名源」)**建模为自动创建的无名 competitor_account 行**(name=null, needs_resolution=true)——因此约束统一为「恰一归属」,无两空特例。

> 为什么不是纯 run 头继承:`clerk_sops.run_id` 是 ON DELETE SET NULL,run 删除后内容会失去归属;且 dedup 唯一索引需要本表列。为什么不是三表各自为政:写入只有 analyze-channel 一条路径,owner 从 payload 派生一次、盖章到所有行,漂移面收敛为零。

### 2.2 DDL(expand 一次迁移,部署前应用;旧 worker 不受影响,因为旧代码永不写 NULL)

```sql
-- 0018_pc_clerk_competitor_expand.sql
-- ① 对标归属列(clerk_sops 已有,INC1 预留)
ALTER TABLE clerk_videos ADD COLUMN competitor_account_id uuid
  REFERENCES competitor_accounts(id) ON DELETE CASCADE;
ALTER TABLE pipeline_runs ADD COLUMN competitor_account_id uuid
  REFERENCES competitor_accounts(id) ON DELETE CASCADE;

-- ② 放开自有归属(对标行该三列为 NULL)
ALTER TABLE clerk_videos  ALTER COLUMN channel_id DROP NOT NULL,
                          ALTER COLUMN own_account_id DROP NOT NULL;
ALTER TABLE clerk_sops    ALTER COLUMN channel_id DROP NOT NULL,
                          ALTER COLUMN own_account_id DROP NOT NULL;
ALTER TABLE pipeline_runs ALTER COLUMN channel_id DROP NOT NULL;

-- ③ 恰一归属 + 自有侧成对出现(NOT VALID 后 VALIDATE,不锁表)
ALTER TABLE clerk_videos ADD CONSTRAINT clerk_videos_one_owner CHECK (
  num_nonnulls(own_account_id, competitor_account_id) = 1
  AND (own_account_id IS NULL) = (channel_id IS NULL)
) NOT VALID;
ALTER TABLE clerk_sops ADD CONSTRAINT clerk_sops_one_owner CHECK (
  num_nonnulls(own_account_id, competitor_account_id) = 1
  AND (own_account_id IS NULL) = (channel_id IS NULL)
) NOT VALID;
-- pipeline_runs:muse/poet 仍必有 channel;仅 clerk 允许对标归属
ALTER TABLE pipeline_runs ADD CONSTRAINT pipeline_runs_one_owner CHECK (
  num_nonnulls(channel_id, competitor_account_id) = 1
) NOT VALID;
-- (各自 VALIDATE CONSTRAINT 跟随执行)

-- ④ 对标侧 dedup 双胞胎(与 INC6 的 owner-unique twins 对称)
CREATE UNIQUE INDEX clerk_videos_competitor_video_unique
  ON clerk_videos (competitor_account_id, platform_video_id)
  WHERE competitor_account_id IS NOT NULL;
CREATE INDEX clerk_videos_competitor_idx ON clerk_videos (competitor_account_id)
  WHERE competitor_account_id IS NOT NULL;
CREATE INDEX clerk_sops_competitor_idx ON clerk_sops (competitor_account_id)
  WHERE competitor_account_id IS NOT NULL;
CREATE INDEX pipeline_runs_competitor_status_idx
  ON pipeline_runs (competitor_account_id, status)
  WHERE competitor_account_id IS NOT NULL;
```

既有 `(own_account_id, platform_video_id)` / `(channel_id, platform_video_id)` 唯一索引保留——Postgres 对 NULL 视为互不相等,对标行天然不受其约束;自有行为继续受保护。**insert 的 ON CONFLICT target 在 job 内按归属分支**。

### 2.3 回滚

新数据可识别(`competitor_account_id IS NOT NULL`):`DELETE` 对标行 → `VALIDATE` 后重加 NOT NULL → 回退 worker 版本。expand 阶段旧代码完全兼容,回滚窗口内零数据损失(自有侧从未受影响)。

## 3. 任务管线(apps/jobs/trigger/analyze-channel.ts)

- **payload**:`channelId?: string` + `competitorAccountId?: string`(恰一;tRPC 层 zod 校验)。
- **目标解析**:own → channels 行(现逻辑);competitor → competitor_accounts 行(取 url/platform/name,管线其余完全复用——抓取/转写/分析/出 SOP 都只依赖 url+platform)。
- **盖章**:job 启动时派生 `owner = { channelId, ownAccountId, competitorAccountId }`,所有 clerk_videos/clerk_sops insert 统一展开该对象;ON CONFLICT target 按归属选 twin 索引。
- **守卫**:`assertNoActiveRun` 增加对标键(同一 competitor_account 不可并发拆解);与自有键互不阻塞。
- **project_sops 自动绑定**:仅 own 目标保留现行为(默认项目 primary);**competitor 目标不自动绑任何项目**——SOP 进库,由用户在 P-B 选用器里显式选用(评审共识:显式选择优于隐式绑定)。
- **ETA**:命令名不变(`clerk-analyze-channel`),etaHints 桶继续有效。

## 4. 路由与页面

### 4.1 路由

| 路由 | 内容 |
|---|---|
| `/clerk` | **选择器**:两组目标(我的账号 / 对标账号),点击即进入目标页;仅 1 自有账号且 0 对标时直达(吸收 P-A) |
| `/clerk/own/[slug]` | 自有账号分析页(现 `/clerk/[slug]` 全量迁移) |
| `/clerk/competitor/[id]` | 对标分析页(uuid;对标无 slug,显式段位避免 `[slug]` 吞 `c` 的劫持风险) |
| `/clerk/[slug]`(旧) | 308 → `/clerk/own/[slug]`(沿用 A3-A4 的 308 模式) |

两个详情页共用 `_components/clerk-analysis-view.tsx`(视频表/锚点/SOP 区/运行按钮),page 只负责按归属取数。

### 4.2 选择器(/clerk 落地页)

- 对标组行:CompetitorAvatar + 名称 + 粉丝数 + 已拆 N 条 / M 份 SOP(复用 P-B 同款行视觉);自有组同构
- 空 SOP 首触解释沿用「SOP = 可复用写稿方法论」口径
- **跨表重影提示**:添加对标 / 新建账号时,按 platformKey 跨两表查重 →「该频道已是你的账号/对标,确定再添加?」

### 4.3 防错三件套(HCI 必配,不可裁)

1. **启动确认条**:ClerkStartSheet 顶部常驻「🎯 你正在拆解【对标账号】X /📺 你正在复盘【我的账号】Y · [换一个]」
2. **来源 chip**:每份 SOP 卡(详情页 + /sops 库)左上角「来自对标·X / 来自我的账号·Y」
3. **运行可取消**:全局运行指示器行带来源 + 现有取消链路覆盖对标 run

### 4.4 SOP 库分区(/sops)

按来源分两个 section:「来自对标账号」「来自我的账号」;组内仍按账号分组。P-B 选用器同步按此分区。

### 4.5 对标账号聚合详情页(吸收 INC7)

`/competitors/[id]`:头像/粉丝 + 「Clerk 拆解:N 条视频 · M 份 SOP [查看][再拆一次]」+「Muse 巡视:被 K 个项目绑定 [查看]」+「SOP 被引用于:项目…」。动词全站锁定:**Clerk=拆解,Muse=巡视**。

### 4.6 历史伪账号收口(不搬迁 ≠ 不处理)

账号(项目 Hub)页加低调操作「这其实是学习对象?转为对标账号」:
- **守卫**:仅当该账号无圣经/无脚本/无选题(纯 Clerk 学习用途)时可转——26 个伪账号绝大多数满足
- **转换事务**:创建 competitor_account(继承 url/platform/name)→ `UPDATE clerk_videos/clerk_sops SET competitor_account_id = 新id, channel_id = NULL, own_account_id = NULL WHERE channel_id = 旧id` → 删除 channels 行(spine 三胞胎随级联清理)→ project_sops 既有引用不受影响(sop_id 不变)
- 不满足守卫时给出原因并拒绝(防误转毁掉真账号)

## 5. 工期切分(4-5 天)

| 天 | 内容 | 门 |
|---|---|---|
| D1 | 迁移 0018 应用(逐条授权)+ schema/types + 对账脚本 | tsc 全绿 + 对账 |
| D2 | analyze-channel 目标分支 + 守卫 + 盖章 + tRPC;Trigger 部署 | 真机拆 1 个对标(小批量) |
| D3 | 路由迁移(own/competitor/308)+ 选择器 + 确认条 | 走查自有路径无回归 |
| D4 | 来源 chip + SOP 库分区 + 聚合详情页 + 重影提示 + 伪账号转换 | 转换 1 个真实伪账号验证 |
| D5 | 全链路回归(own+competitor 各一轮)+ P-B 选用对标 SOP 写稿 + 文档 | Opus 质检对标 SOP 内容 |

## 6. 留给 owner 的决策点(拍板时勾选)

1. **伪账号转换的守卫范围**:按 4.6(无圣经/脚本/选题才可转)?还是更宽(允许带内容转,内容留在原地)?**建议:按 4.6,安全第一。**
2. **对标 SOP 的类型**:对标拆解默认生成全部三种 SOP(human/hottest/ai_reference,与自有一致)?**建议:一致**,human 版正是"学对手"的可读产物。
3. **/clerk 选择器顺序**:对标组在前(学习是主场景)还是自有组在前?**建议:对标在前**——方案一里 Clerk 的本职是拆对标。
