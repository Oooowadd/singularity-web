# @goooose/worker

Trigger.dev v4 长任务(Class B,≥ 800s):频道分析、对标巡视、长稿、圣经生成。任务定义在 `trigger/`,消费 `packages/domain`、`packages/integrations`、`packages/db`。

```bash
pnpm --filter @goooose/worker dev   # 本地 worker
cd apps/worker && pnpm exec trigger deploy --env prod   # 部署到 Trigger.dev cloud
```

改完本目录或 `packages/{domain,integrations,prompts}` 后必须重新部署 Trigger.dev。
