# Singularity 三大模块 · 逻辑链路（Working Flow）

> 目的：把网站底层运行逻辑梳理清楚，方便对齐与定位优化点。
>
> 怎么读：每个模块讲三件事 —— ① 用户在这里能做什么 ② 系统一步步怎么跑 ③ 每一步用哪个模型、哪个 prompt。
>
> Prompt 不内嵌正文，正文与文末「Prompt 索引」里的 prompt 名均为可点击链接，在 GitHub 上点开即跳转到对应源文件那一行。
>
> 状态：Clerk / Muse / Poet 三个模块均已覆盖（含 YouTube 与小红书分支）。

---

## 模型说明

| 代号 | 实际模型 | 特点 | 主要用途 |
|---|---|---|---|
| Pro | DeepSeek V4 Pro（推理模型）| 质量高，但慢、贵 | 视频拆解、SOP、写稿 |
| Flash | DeepSeek V4 Flash | 快、便宜 | 评论总结、轻量判断 |
| Vision | Claude Sonnet 4.6 | 看图 | 封面 / 封图分析 |
| ASR | Deepgram Nova-3 主 + Groq Whisper 备 | 语音转文字 | 无字幕视频转写 |

---

## 0. 频道接入（三个模块共用的起点）

用户先在「频道」里添加一个对标或自有频道：选平台（YouTube / 小红书）→ 粘贴频道主页链接 → 系统记录频道（平台 / 链接 / 语言）。

- 平台决定后续抓取链路：YouTube 走 yt-dlp + 住宅代理；小红书走 TikHub。
- 频道语言（中文 / 英文）决定后续大部分产出的输出语言。

添加好频道后，才能进入 Clerk / Muse / Poet 对它操作。

---

## 1. Clerk · 频道分析（看对标 → 出 SOP）

一句话：把一个频道最近 / 最热的若干条视频逐条拆解，再汇总成 3 份「频道 SOP」（创作手册）。

### 1.1 用户操作

点「开始分析」，弹出设置：

- 来源：最新发布 / 近期热门 / 指定链接（手动粘 URL，每行一个）
  - 「近期热门」= 近期发布里播放量（小红书为互动分）最高的 N 条，看不到很老的爆款。
- 数量：1–50 条（推荐 20）
- 分析模式：从头分析（覆盖已有结果）/ 仅新视频（跳过已分析过的）
- 时间范围（仅 YouTube 的「近期热门」生效）：不限 / 近 1 / 3 / 6 月
- SOP 语言：中文 / English（一般跟随频道语言）

开始后实时看进度面板（逐条进度 + 活动日志）。

### 1.2 流程（YouTube 频道）

```
拉列表 → 补数据筛选 → 逐条理解×N（并发4）→ 抓评论 → 出 3 份 SOP → 存库
```

1. **拉视频列表** — yt-dlp（走住宅代理）抓频道视频，被 YouTube 拦截时自动换 IP 重试。产出：候选视频列表。
2. **补数据 + 筛选** — yt-dlp 列表不带播放量 / 日期，用 YouTube Data API 补齐；按「近期热门」排序或「时间范围」过滤，挑出 Top N。产出：待分析清单。
3. **逐条理解** — 最多同时 4 条，每条依次：
   1. 取文字稿 — 字幕优先；没字幕才下载音频转写（ASR：Deepgram 主 / Groq 备；超 60 分钟跳过转写）。
   2. 拆解视频 — Pro，prompt [`buildVideoAnalysisPrompt`](../packages/shared/src/prompts/clerk.ts#L58)。产出结构化拆解（开头钩子 / 框架 / 节奏 / 选题角度，带 [mm:ss] 时间戳引用）。
   3. 看封面 — Vision，与上一步并行。
   - 产出：每条一份「视频拆解」（文字稿洞察 + 封面洞察）。
4. **抓热门评论** — 仅对播放量第一的视频：抓前 100 条评论 → Flash 总结，prompt [`buildCommentsSummaryPrompt`](../packages/shared/src/prompts/clerk-comments.ts#L7)，结果喂给「爆款版」SOP。评论少于 5 条或失败则跳过；小红书不抓评论。
5. **生成 3 份 SOP** — 三份并行，各一次 Pro 调用：
   - 真人版 [`buildHumanSopPrompt`](../packages/shared/src/prompts/clerk.ts#L156) —— 创作者本人看的创作手册，跟随频道语言。
   - AI 参考版 [`buildAiSopReferencePrompt`](../packages/shared/src/prompts/clerk.ts#L231) —— 给 Poet 写稿 AI 读的结构化参考，强制英文。
   - 爆款版 [`buildHottestSopPrompt`](../packages/shared/src/prompts/clerk.ts#L329) —— 拆解最高播放视频的套路，跟随频道语言（需该视频有文字稿，否则跳过）。
6. **存库** — 3 份 SOP 入库，前端展示。

### 1.3 小红书频道的差异

走 TikHub，不走 yt-dlp / 代理，差异主要在「取文字稿」：

- 图文笔记：直接用「标题 + 正文」当文字稿，不做语音转写。
- 视频笔记：从小红书 CDN 取音频做语音转写（CDN 不限制，无需代理）。

之后同样 Pro 拆解（[`buildVideoAnalysisPrompt`](../packages/shared/src/prompts/clerk.ts#L58)）+ Vision 封图分析（多图用图集分析、单图 / 视频封面用单图分析），最终同样汇总成 3 份 SOP（与 1.2 第 5–6 步一致）。

### 1.4 系列检测（独立按钮，可选）

不在「开始分析」主流程里，是 Clerk 页上一个单独按钮，用户手动触发。作用：判断频道是否有「系列栏目」（固定选题 / 固定结构）。模型：Flash 主，空结果回退 Pro。Prompt [`buildSeriesDetectPrompt`](../packages/shared/src/prompts/clerk-series.ts#L7)。

### 1.5 待优化点（内部参考）

| 类型 | 位置 | 说明 |
|---|---|---|
| 性能 / 成本 | 逐条拆解（步骤 3.2）| 每条都用 Pro（16K）是速度与成本主因；拆解输出是结构化 JSON，可评估降级或换模型 |
| 性能 | 并发度 | 目前只同时处理 4 条，条数多时排队叠加 |
| 性能 | 音频转写 | 无字幕视频要下载 MB 级音频走代理，较慢 |
| 质量 | 翻译腔 | 英文源「读英文 → 出中文」一步到位，易翻译腔（逻辑正确，需单独优化写法）|
| 质量 | 中文转写 | 中文音频转写偶有乱码，会污染后续产出 |
| 成本 | 3 份 SOP | 三份都用 Pro 各 12K，可评估部分降级 |

> 具体耗时占比需结合后端真实运行记录确认，本表先标出嫌疑位置。

---

## 2. Muse · 竞品监控（看竞品 → 出选题）

一句话：扫描对标频道的最新视频，挑出"有可借鉴爆款机制"的，提炼套路，再为本频道生成选题。

### 2.1 用户操作

点「开始巡视」，弹出设置：

- 每个对标频道拉取视频数：5 / 10 / 20 / 50（推荐 10）
- 每个相关视频生成选题数：3 / 5 / 10（推荐 5）
- 选题语言：中文 / English

对标频道列表来自「频道」里维护的竞品清单。

### 2.2 流程

```
扫竞品视频 → 去重 → 取文字稿 → 相关性判断 → 提炼爆款触发器 → 生成选题 → 存库
```

1. **扫竞品视频** — 逐个对标频道抓最新 N 条：YouTube 走 yt-dlp（被拦截换 IP 重试），小红书走 TikHub。产出：候选视频。
2. **去重** — 跳过之前已处理过的视频（按频道 + 视频 id）。产出：新视频。
3. **取文字稿** — 与 Clerk 相同：YouTube 字幕优先、无则音频转写；小红书取音频或用标题正文。
4. **相关性判断** — Flash，prompt [`buildClassificationPrompt`](../packages/shared/src/prompts/muse.ts#L15)。判断这条视频有没有"可迁移的爆款机制"（看的是钩子 / 情绪 / 叙事结构能不能借，不是题材是否相同）。不相关或文字稿过短则到此为止。
5. **提炼爆款触发器** — Pro，prompt [`buildViralTriggerPrompt`](../packages/shared/src/prompts/muse.ts#L61)。读完整文字稿，提炼"点击 / 观看 / 转发"三类触发点。
6. **生成选题** — Pro，prompt [`buildIdeaGenerationPrompt`](../packages/shared/src/prompts/muse.ts#L101)。基于触发器为本频道生成 N 条选题（故事角度 / 事实数据 / 为何相似 / 封面概念 / 钩子类型 / 风险点）。
7. **存库** — 选题入库，前端展示供挑选。

> 理论上限 = 对标频道数 × 每频道视频数 × 每视频选题数；但相关性筛选会砍掉很多，实际产出远低于上限。

### 2.3 待优化点（内部参考）

| 类型 | 位置 | 说明 |
|---|---|---|
| 性能 / 成本 | 触发器 + 选题生成 | 两步都用 Pro，且每条视频顺序处理（间隔 1.5s），视频多时很慢 |
| 质量 | 翻译腔 | 英文竞品 → 中文选题，同样有翻译腔风险 |
| 性能 | 任务时长 | 单次最长 4 小时，竞品多 + 视频多时可能跑很久 |

---

## 3. Poet · 写稿（选题 → 成稿）

Poet 有三条独立流程：频道圣经（写稿前置）、选题分析、写稿。

### 3.1 频道圣经（Channel Bible）— 写稿的前置基准

一句话：把"频道是做什么的"固化成一份基准文档，后续写稿都围绕它，防跑题。

用户操作：填频道定位 / 想法（一段话）→ 起名字 → 选语言 → 生成。

流程：

1. **补频道简介** — 若频道还没简介，用 Flash 从播放量前 8 的视频提炼一份。
2. **生成圣经** — Pro，prompt [`buildChannelBiblePrompt`](../packages/shared/src/prompts/poet.ts#L9)。产出：TOPIC + 频道定位 / 信息源 / 选题框架 三节。
3. **跑题检测** — 程序算法（非 AI）：比对"用户填的想法"与"圣经声称的主题"的词汇重叠，并检测是否凭空冒出 AI 相关词。判定跑题则该圣经标记为未启用，并记录一次跑题事件。
4. **存库** — 新圣经设为启用（同时停用旧的）。

### 3.2 选题分析（Custom Topic）— 自定义选题入口

一句话：用户自己给一个选题 + 参考资料，系统拆成可写稿的结构化选题（与 Muse 产出的选题同构）。

用户操作：填选题（一段话）+ 最多 10 个参考（YouTube / 小红书链接，或直接贴文本）→ 选语言 → 分析。

流程：

1. **抓参考资料** — YouTube 走 yt-dlp + 转写、小红书走 TikHub、纯文本直接用。
2. **拆解选题** — Pro，prompt [`buildTopicAnalysisPrompt`](../packages/shared/src/prompts/poet.ts#L274)。结合参考 + 圣经 + AI 参考 SOP，产出：故事角度 / 事实数据 / 原文事实（保留原语言，数字专名不翻）/ 为何契合 / 爆款触发点。
3. **存库** — 选题状态置为"已分析"，参考资料一并存下供写稿用。

### 3.3 写稿（Generate Script）

一句话：拿一个选题（来自 Muse 或选题分析），结合圣经 + AI 参考 SOP，写成可拍脚本。

用户操作：选一个已批准的选题 → 设目标时长（1–60 分钟，默认 5）→ 选语言 → 生成。

- 目标字数：中文约 200 字 / 分钟，英文约 150 词 / 分钟。
- 长短分流阈值：**中文 ≥2000 字 / 英文 ≥1500 词 走长稿**，否则短稿。

加载上下文（两条路共用）：启用中的圣经（必需）+ AI 参考 SOP（`ai_reference`）+ 选题来源的文字稿 / 参考。

短稿：

1. **写稿** — Pro，prompt [`buildScriptWritingPrompt`](../packages/shared/src/prompts/poet.ts#L84)（一次出全文）。
2. **品牌口头禅校验** — 若圣经里的标志性话术没出现在稿子里，补提示重写一次。
3. **口语化（仅中文）** — Pro，prompt [`buildChineseHumanizerPrompt`](../packages/shared/src/prompts/poet.ts#L327)，改写成真人开口的口语。
4. **存库**。

长稿：

1. **列大纲** — Pro，prompt [`buildLongFormOutlinePrompt`](../packages/shared/src/prompts/poet.ts#L166)。按比例分配各段字数（钩子 / 铺垫 / 正文 / CTA / 高潮 / 收尾），产出分段大纲。
2. **逐段扩写** — Pro，prompt [`buildSectionExpandPrompt`](../packages/shared/src/prompts/poet.ts#L226)，按大纲一段一段写（每段一次调用），最后拼接。
3. **品牌口头禅校验 + 口语化（仅中文）+ 存库**（同短稿）。

### 3.4 待优化点（内部参考）

| 类型 | 位置 | 说明 |
|---|---|---|
| 性能 / 成本 | 写稿全程 Pro | 短稿 1 次 Pro；长稿 = 1 次大纲 + N 段 × Pro +（中文）1 次口语化，串行，长稿很慢很贵 |
| 质量 | 翻译腔 | 英文 SOP / 参考 → 中文稿一步到位；口语化只修表面，修不掉概念层翻译腔 |
| 质量 | 上游依赖 | 写稿质量强依赖圣经与 AI 参考 SOP；上游 SOP 的翻译腔会传导到稿子 |

---

## Prompt 索引（可在 GitHub 直接打开）

> 所有 prompt 为 `.ts` 文件里的模板函数（静态指令正文 + 变量插值 + 中英 / 可选段落等条件）。点函数名即跳转到源文件对应行。
>
> 行号为参考，以函数名为准（代码改动后行号可能轻微偏移）。

| Prompt 函数 | 位置 | 作用 |
|---|---|---|
| [`buildVideoAnalysisPrompt`](../packages/shared/src/prompts/clerk.ts#L58) | clerk.ts:58 | 单条视频 / 笔记：文字稿 + 元数据 → 结构化拆解 |
| [`buildHumanSopPrompt`](../packages/shared/src/prompts/clerk.ts#L156) | clerk.ts:156 | 汇总拆解 → 创作者版 SOP（手册）|
| [`buildAiSopReferencePrompt`](../packages/shared/src/prompts/clerk.ts#L231) | clerk.ts:231 | 汇总拆解 → AI 写稿参考 SOP（英文）|
| [`buildHottestSopPrompt`](../packages/shared/src/prompts/clerk.ts#L329) | clerk.ts:329 | 最高播放视频 → 爆款深拆 SOP |
| [`buildCommentsSummaryPrompt`](../packages/shared/src/prompts/clerk-comments.ts#L7) | clerk-comments.ts:7 | top 视频热门评论 → 观众反馈总结 |
| [`buildSeriesDetectPrompt`](../packages/shared/src/prompts/clerk-series.ts#L7) | clerk-series.ts:7 | 视频列表 → 系列栏目聚类（系列检测，独立触发）|
| [`buildClassificationPrompt`](../packages/shared/src/prompts/muse.ts#L15) | muse.ts:15 | 竞品视频 → 是否有可迁移爆款机制（相关性）|
| [`buildViralTriggerPrompt`](../packages/shared/src/prompts/muse.ts#L61) | muse.ts:61 | 相关视频 → 点击 / 观看 / 转发触发器 |
| [`buildIdeaGenerationPrompt`](../packages/shared/src/prompts/muse.ts#L101) | muse.ts:101 | 触发器 → 本频道 N 条选题 |
| [`buildChannelBiblePrompt`](../packages/shared/src/prompts/poet.ts#L9) | poet.ts:9 | 频道想法 → 频道圣经（基准文档）|
| [`buildTopicAnalysisPrompt`](../packages/shared/src/prompts/poet.ts#L274) | poet.ts:274 | 选题 + 参考 → 结构化选题 |
| [`buildScriptWritingPrompt`](../packages/shared/src/prompts/poet.ts#L84) | poet.ts:84 | 选题 + 圣经 + SOP → 短稿全文 |
| [`buildLongFormOutlinePrompt`](../packages/shared/src/prompts/poet.ts#L166) | poet.ts:166 | 长稿：选题 → 分段大纲 |
| [`buildSectionExpandPrompt`](../packages/shared/src/prompts/poet.ts#L226) | poet.ts:226 | 长稿：单段大纲 → 成段正文 |
| [`buildChineseHumanizerPrompt`](../packages/shared/src/prompts/poet.ts#L327) | poet.ts:327 | 中文稿 → 真人口语化改写 |

---

## 附：成本测算

详见独立文档 [cost_analysis.md](./cost_analysis.md)：真实单价（逐家查证 + 来源）× 真实用量（生产库 + Trigger.dev 运行记录），含单次运行明细、轻/中/重度用户月度估算、成本大头与优化方向。

一句话：固定月费约 $55（+ TikHub / Logto 待确认），单次 Clerk 分析 20 条 YouTube 视频按量约 $1.7，最大成本来源是 DeepSeek Pro 的 token。
