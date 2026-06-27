# @singularity/web

Next.js 16 应用:前端 UI + tRPC API + SSR + Logto 鉴权(短任务的后端也在这,< 800s)。部署成单个 Web Service。

```bash
pnpm --filter @singularity/web dev      # 本地开发
pnpm --filter @singularity/web build    # 构建(含 output:standalone)
```

代码结构与部署模型见仓库根 [`ARCHITECTURE.md`](../../ARCHITECTURE.md)。
