# 邮件模板

统一视觉（科技简约，Vercel / shadcn 一派）：纯白底、左对齐 480px 栏、中性灰阶、黑色主按钮；唯一品牌色是鹅喙橙 `#E8850C` 的 logo 小方块 + "Goooose" 字标（正文不出现"搬砖小鹅"，发件人栏已带）。全部 inline style + table 布局，兼容 Gmail / QQ 邮箱 / Apple Mail。

| 模板 | 用途 | 状态 |
|---|---|---|
| （代码内）`apps/web/lib/email.ts` `renderApprovalEmail` | 内测审批通过通知（Resend REST 发送） | 已上线 |
| `logto-verification-code.html` | Logto 验证码（`{{code}}` 为 Logto 模板变量） | 已接入（2026-07-09） |

## Logto 验证码接线现状

Logto 邮件连接器已从内置 logto-email 换成 **SMTP → Resend**（`smtp.resend.com:587`，user `resend`，pass 为 Resend API key），发件人 `搬砖小鹅 Goooose <noreply@goooose.com>`。本模板按 6 个 usageType（SignIn / Register / ForgotPassword / Generic / OrganizationInvitation / UserPermissionValidation）生成变体写入连接器 config，只有标题 / 动作行 / 主题不同。改模板后重新接入：改本文件 → 用 Logto Management API `PATCH /api/connectors/{id}` 更新 config（当时的构建脚本思路：读本文件做三处文本替换生成变体）。

注意：验证码与审批邮件共享 Resend 免费档额度（100 封/天）；验证码是登录生死线，改动连接器前先用 `POST /api/connectors/simple-mail-transfer-protocol/test` 验证配置。回滚 = 删除 SMTP 连接器后重建 `logto-email`（内置服务无需 config）。
