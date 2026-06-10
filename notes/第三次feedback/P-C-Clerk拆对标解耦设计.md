# P-C · Clerk 拆对标真解耦 — 设计文档 v2

> 状态:**v2,经两轮对抗审计修订**(消费方影响审计 + 架构终审,2026-06-10),待 owner 拍板 §7 决策点。
> 终审裁决:盖章混合模型是该 spine 下唯一自洽解,方向维持;v1 文档的 3 处硬伤与 1 处事实错误已在本版修正。
> 工期:**6-7 天**(v1 的 4-5 天经审计上修),含一次 Trigger 重部署与 0018 expand 迁移。前置:owner 完成 YouTube 走查。

## 1. 目标与非目标

**目标**:Clerk 可直接拆解「对标账号」,产物 SOP 溯源到对标、进 SOP 库、可被任意项目选用(P-B 已通)。用户不再把学习对象伪装成「我的账号」。

**非目标**:Bible 跨账号母版;跨项目选题库/脚本库;统一 analysis_targets 实体(beta 后);多项目;历史伪账号强制搬迁;**ad-hoc 无名对标账号(v1 禁用,见 §2.1)**。

**红线(HCI)**:绝不交付「UI 两组目标 + 底层自动建假账号」的半套;**消费方读路径不改完不算交付**(§5 清单)——否则对标 run 在指示器/进度/取消里隐身、对标 SOP 选用器选不到,目标等于未达成。

## 2. 数据模型

### 2.1 归属规则

**一次 Clerk 分析的目标 = 恰好一个「我的账号」或恰好一个「对标账号」。** run 行是权威记录;clerk_videos / clerk_sops 由 job 在启动时从 payload 派生一次 owner 对象、统一盖章(单写入路径,3 处 insert 展开同一对象,跨表漂移物理不可能;单表 CHECK 兜底,无需触发器——终审裁定)。

**ad-hoc URL 分析 v1 不建无名对标账号**(v1 文档方案被终审否决:会污染对标池 UI、被 Muse 误绑浪费预算、与正式添加的同账号 platformKey 撞键成双行)。v1 规则:`source:"urls"` 贴链接分析必须先选定一个归属目标(自有或已建对标);纯 ad-hoc 留待后续按需评估。由此**全部表的约束都是「恰一归属」,无两空特例**。

> 为何不是纯 run 头继承:`clerk_sops.run_id` 是 ON DELETE SET NULL,run 删除后内容失去归属;SOP 是跨项目复用的一等资产(project_sops),生命周期必须独立于 run,改 run FK 为 RESTRICT/CASCADE 是模型倒退——终审驳回。

### 2.2 DDL(0018,expand 一次迁移,部署前应用)

**⚠️ 工程纪律(审计新增):**
- 0018 走**手写 raw SQL + apply 脚本**(同 0015-0017)。**禁止 drizzle-kit generate**——meta/journal 漂移停在 0014,generate 会基于陈旧快照产出错误 diff。
- 本迁移**显式撤销 INC6 契约 §2.5 对 clerk 两表 own_account_id 的 NOT NULL**(架构反悔,记录在案,理由:方案一决策 A 要求 SOP 可归属对标)。pipeline_runs.channel_id 同步放开。schema TS 同步:`clerk.ts:28-29,78-79`、`runs.ts:14` 去掉 `.notNull()`;`clerk.ts:80` 的 onDelete 改 cascade。

```sql
-- 0018_pc_clerk_competitor_expand.sql
-- ① 归属列(clerk_sops 已有但 FK 语义错误,必须重建)
ALTER TABLE clerk_videos ADD COLUMN competitor_account_id uuid
  REFERENCES competitor_accounts(id) ON DELETE CASCADE;
ALTER TABLE pipeline_runs ADD COLUMN competitor_account_id uuid
  REFERENCES competitor_accounts(id) ON DELETE CASCADE;
-- clerk_sops.competitor_account_id 现为 ON DELETE SET NULL(0012 预留):删除对标时
-- 会把行抹成双 NULL,直接违反下方 CHECK → 改为 CASCADE(两位审计独立发现的同一矛盾)
ALTER TABLE clerk_sops DROP CONSTRAINT clerk_sops_competitor_account_id_competitor_accounts_id_fk;
ALTER TABLE clerk_sops ADD CONSTRAINT clerk_sops_competitor_account_id_competitor_accounts_id_fk
  FOREIGN KEY (competitor_account_id) REFERENCES competitor_accounts(id) ON DELETE CASCADE;

-- ② 放开自有归属(对标行三列为 NULL)— 撤销 INC6 的 SET NOT NULL
ALTER TABLE clerk_videos  ALTER COLUMN channel_id DROP NOT NULL,
                          ALTER COLUMN own_account_id DROP NOT NULL;
ALTER TABLE clerk_sops    ALTER COLUMN channel_id DROP NOT NULL,
                          ALTER COLUMN own_account_id DROP NOT NULL;
ALTER TABLE pipeline_runs ALTER COLUMN channel_id DROP NOT NULL;

-- ③ 恰一归属 + 自有侧成对(NOT VALID → VALIDATE,不锁表;历史行全部满足,VALIDATE 安全)
ALTER TABLE clerk_videos ADD CONSTRAINT clerk_videos_one_owner CHECK (
  num_nonnulls(own_account_id, competitor_account_id) = 1
  AND (own_account_id IS NULL) = (channel_id IS NULL)
) NOT VALID;
ALTER TABLE clerk_sops ADD CONSTRAINT clerk_sops_one_owner CHECK (
  num_nonnulls(own_account_id, competitor_account_id) = 1
  AND (own_account_id IS NULL) = (channel_id IS NULL)
) NOT VALID;
ALTER TABLE pipeline_runs ADD CONSTRAINT pipeline_runs_one_owner CHECK (
  num_nonnulls(channel_id, competitor_account_id) = 1
) NOT VALID;
-- VALIDATE CONSTRAINT ×3 跟随执行

-- ④ 对标侧 dedup 双胞胎(对称于 INC6 owner-unique twins;既有 (own,video)/(channel,video)
-- 唯一索引对 NULL 行天然失效,对标行唯一性只能靠新索引 + job 切 ON CONFLICT target)
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

### 2.3 回滚

新数据可识别(`competitor_account_id IS NOT NULL`):DELETE 对标行 → 重加 NOT NULL → 回退 worker。expand 阶段旧代码完全兼容(永不写 NULL owner),回滚窗口零自有数据损失。

## 3. 任务管线(apps/jobs/trigger/analyze-channel.ts,审计落实到行)

1. **payload**:`channelId?` + `competitorAccountId?`(恰一);`schemas/clerk.ts` startAnalysisInput 加 `competitorAccountId` + xor refine;`startAnalysis` mutation 校验 competitor 属当前 user,pipeline_runs 写对应归属。
2. **目标解析**(:365-372 现只查 channels):competitor 分支从 competitor_accounts 取 url/platform/name,其余抓取/转写/分析管线复用。
3. **owner 盖章**:job 启动派生 `owner = { channelId, ownAccountId, competitorAccountId }`,3 处 insert(:695 XHS 视频、:1101 YT 视频、:1349 SOP)统一展开。
4. **ON CONFLICT 切换**(:698/:1103 等 3 处现写死 `[channelId, platformVideoId]`):对标行该 target 无唯一索引,ON CONFLICT 永不触发 → 重复行。按归属切到 `clerk_videos_competitor_video_unique`。
5. **SOP 原子交换重写**(:1359-1372 + :1402-1411 现按 `channelId+sopType` 删旧):对标路径按 `competitorAccountId + sopType` 删旧(旧版策略见 §7 决策点 ⑤)。
6. **project_sops 自动绑定**(:1374-1379):加 `if (own)` 跳过——对标 SOP 不自动绑项目,由 P-B 选用器显式选用;且 channel.id 当 projectId 对对标本就不成立。
7. **守卫**:`assertNoActiveRun`(routers.ts:89 现硬编码 `eq(pipelineRuns.channelId, …)`)改为按归属键分支(channelId 或 competitorAccountId);同一对标不可并发拆,与自有键互不阻塞。
8. ETA:命令名不变,etaHints 不 join channels,无影响(审计核实)。

## 4. 消费方读路径改造清单(审计新增,红线级——缺一不交付)

| 消费方 | 对标行的现行为 | 改法 | 排期 |
|---|---|---|---|
| `sops.pickerList` / `sops.setPrimary`(routers) | 对标 SOP 选不到 / setPrimary NOT_FOUND → **P-C 核心目标落空** | innerJoin channels → left join 双侧,COALESCE 来源名 | D4 |
| `pipeline.listActiveAll` / `listActive` | 对标 run 从全局指示器/横幅**隐身** | left join + 双侧名称;listActive 按归属键 | D4 |
| `pipeline.activeRun` / `runStatus` / `cancelRun` | 对标 run 拿不到 token/状态/**无法取消** | 三处授权改写(channel 属主或 competitor 属主) | D4 |
| `pipeline.deleteSop` | 对标 SOP **永远删不掉** | 子查询加 competitor 属主分支 | D4 |
| `lib/agent-run.ts getActiveAgentRun` | 对标详情页拿不到 active run | 参数化归属键 | D4 |
| `lib/dashboard-data.ts`(8 处 innerJoin) | 对标视频不计入统计(**保持,见决策点⑦**);对标 run 不进活动流 | 活动流 left join 双侧;统计口径按决策 | D5 |
| `activity-feed agentDeepLink` | 对标 run 深链断(无 slug) | ActivityRow 带 targetKind+id → `/clerk/competitor/[id]` | D5 |
| `sops/page.tsx`(innerJoin channels) | 对标 SOP **从库里消失** | left join 双侧 + §5.4 分区 | D5 |
| `resolvePrimarySop` legacy fallback | 对标 SOP 不命中 fallback——**正确**(对标不自动当 primary),记录为预期 | 无 | — |
| `monitor-competitors` insert run | muse 永远有 channel_id,CHECK 兼容 | 无 | — |

## 5. 路由与页面

### 5.1 路由
`/clerk` = 选择器(两组;仅 1 自有且 0 对标时直达,吸收 P-A);`/clerk/own/[slug]`(现 `/clerk/[slug]` 全量迁移);`/clerk/competitor/[id]`(uuid;显式段位防 slug 劫持);旧 `/clerk/[slug]` 308 → own。两详情页共用 `clerk-analysis-view.tsx`。

### 5.2 选择器
对标组行 = CompetitorAvatar + 名称 + 粉丝数 + 已拆 N 条/M 份 SOP;自有组同构;跨表 platformKey 重影提示(添加任一侧时查另一侧:「该频道已是你的账号/对标,确定再添加?」)。

### 5.3 防错三件套(HCI 必配)
启动确认条「🎯 你正在拆解【对标账号】X · [换一个]」;SOP 来源 chip(来自对标·X / 来自我的账号·Y);全局指示器行带来源 + 取消(依赖 §4 改造)。

### 5.4 SOP 库分区
/sops 与 P-B 选用器均按「来自对标账号 / 来自我的账号」分区,组内按账号分组。

### 5.5 对标聚合详情页(吸收 INC7)
`/competitors/[id]`:头像/粉丝 + Clerk 拆解(N 视频/M SOP/[再拆一次]) + Muse 巡视(被 K 项目) + SOP 被引用于项目列表。动词锁定:Clerk=拆解,Muse=巡视。

### 5.6 历史伪账号转换(审计重写——v1 的「spine 随级联清理」是事实错误:own_accounts/projects 对 channels 无 FK,必须显式删)

入口:项目 Hub 低调操作「这其实是学习对象?转为对标账号」。事务(单事务执行):
1. **守卫**:poet_bible、poet_scripts、poet_custom_topics、muse_ideas、muse_monitor_videos 五表对该账号计数全 0,否则拒绝并说明
2. **跨表查重**:competitor_accounts 已有同 (user, platform, platformKey) 活跃行则复用,不新建
3. INSERT competitor_accounts(继承 url/platform/name/platformKey)
4. UPDATE clerk_videos SET competitor 归属、自有三列 NULL WHERE channel_id = 旧
5. UPDATE clerk_sops 同上
6. UPDATE pipeline_runs(仅 agent='clerk')改挂 competitor 归属——保住分析历史与 etaHints 样本;其余 agent 的 run 随 channel 删除
7. **显式 DELETE projects WHERE id = 旧**(project_sops/project_competitors 随级联;该默认项目的 SOP 绑定清空 = 符合「对标 SOP 显式选用」哲学)
8. **显式 DELETE own_accounts WHERE id = 旧**
9. DELETE channels WHERE id = 旧(此时 clerk 内容已脱钩,channel_series 等随级联)

## 6. 工期(6-7 天,审计上修;D2/D4 是 v1 低估的爆点)

| 天 | 内容 | 门 |
|---|---|---|
| D1 | 0018 迁移(逐条授权)+ schema TS + 对账脚本 | tsc 全绿 + 对账 |
| D2 | job:目标解析 + 守卫 + startAnalysis tRPC + payload | 单测/类型 |
| D3 | job:owner 盖章 + 3 处 ON CONFLICT + SOP 交换重写;Trigger 部署 | 真机拆 1 个对标(小批量) |
| D4 | §4 消费方改造(指示器/进度/取消/选用器/删除/agent-run) | 对标 run 全链路可见可取消;P-B 能选对标 SOP |
| D5 | 路由迁移 + 选择器 + 确认条 + 来源 chip + 库分区 + 活动流深链 | 自有路径走查无回归 |
| D6 | 聚合详情页(INC7)+ 伪账号转换 + 重影提示 | 转换 1 个真实伪账号验证 |
| D7 | 全链路回归(own+competitor)+ 对标 SOP 选用写稿 + Opus 质检 + 文档 | 验收 |

## 7. 留给 owner 的决策点(v2 共 7 个,①-③ 为 v1 原有)

1. **伪账号转换守卫范围**:五表全 0 才可转(建议:是,安全第一)
2. **对标拆解出几种 SOP**:与自有一致三种(建议:一致,human 版正是"学对手"的可读产物)
3. **/clerk 选择器顺序**:对标组在前(建议:是——方案一里 Clerk 本职是拆对标)
4. **ad-hoc 贴链接分析 v1 是否启用**:建议 **v1 禁用**自动建无名对标(三个已证实副作用);贴 URL 必须先选归属目标
5. **重拆同一对标时旧 SOP 的处理**:覆盖(同自有的原子交换,建议)还是保留多版本?
6. **对标拆解配额**:closed beta 是否给对标拆解设次数/并发上限(成本敏感:共用 ASR/LLM/Trigger 预算)?建议:暂不设硬限,运行指示器+确认条已防误触,beta 观察用量
7. **统计口径**:对标产物**不计入**「我的账号」资产统计与 agent 卡计数(建议:不计入,工作台只算你的资产;对标数据看聚合详情页)
