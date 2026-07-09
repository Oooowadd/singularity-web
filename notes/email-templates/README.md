# 邮件模板

统一视觉（科技简约，Vercel / shadcn 一派）：纯白底、左对齐 480px 栏、中性灰阶、黑色主按钮；唯一品牌色是鹅喙橙 `#E8850C` 的 logo 小方块 + "Goooose" 字标（正文不出现"搬砖小鹅"，发件人栏已带）。全部 inline style + table 布局，兼容 Gmail / QQ 邮箱 / Apple Mail。

| 模板 | 用途 | 状态 |
|---|---|---|
| （代码内）`apps/web/lib/email.ts` `renderApprovalEmail` | 内测审批通过通知（Resend 发送） | 已上线 |
| `logto-verification-code.html` | Logto 登录验证码（`{{code}}` 为 Logto 模板变量） | 备用，尚未接入 |

## 接入 Logto 验证码模板（将来切换时）

前置：Logto Cloud → Connectors → Email connector 换成自定义（Resend SMTP 或 HTTP API），发件人 `noreply@goooose.com`（域名已在 Resend 验证）。将本模板填入 usageType `SignIn` / `Register` / `ForgotPassword` / `Generic` 的 template 字段，`{{code}}` 保留原样。切换风险：验证码是登录生死线，先在测试租户或低峰时段验证再切生产；切换时机见 beta.md（QQ/163 送达问题出现或公测前）。
