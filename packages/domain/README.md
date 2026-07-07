# @goooose/domain

领域服务 + schemas:poet / muse / clerk 的业务逻辑(写稿、圣经、选题分析、事实核查、grounding、对标 key 推导)。

`src/services/`(领域服务)· `src/schemas/`(Zod 校验 + DB row 转换)。依赖 `@goooose/integrations`(外部调用)和 `@goooose/prompts`(提示词)。
