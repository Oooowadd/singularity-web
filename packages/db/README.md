# @singularity/db

Drizzle ORM schema + 迁移 + 复用查询。Supabase Postgres 的 single source of truth。被 `apps/web`、`apps/worker` 共用。

`src/schema/`(表)· `src/queries/`(跨处复用的领域查询)· `drizzle/`(迁移)· `scripts/`(smoke / ops / 诊断脚本)。
