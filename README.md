# 思想孵化器

一个本地优先、开源的思想工作台：你带来模糊的直觉、经验或问题，认知功能通过镜像、澄清、区分、经验、挑战、延展和重述，帮助你逐渐获得自己的语言。AI 输出永远保持为候选，只有你明确确认后才会成为用户观点。

产品不是什么：普通聊天机器人、多个 AI 并排回答、AI 委员会、自动辩论、投票系统、角色扮演聊天室或替你生成结论的写作工具。

## 功能

- 三栏思想工作台：会话、共同思考、思想演化。
- 确定性的本地 Mock Provider：没有 API Key 也能体验和跑 E2E；配置真实 Provider 后会进入主会话。
- 思想节点、认识论状态、边关系和真实交互事件持久化到 SQLite。
- 用户确认、部分接受、误解和拒绝会真实改变节点状态。
- 当前思想摘要和 React Flow 思想地图。
- Markdown / JSON 导出。
- OpenAI、Anthropic、Google Generative AI、OpenAI-compatible 和本地模拟模型设置。
- API Key 与秘密 Headers 服务端使用、本地 AES-GCM 加密、浏览器只看到掩码。
- 简体中文、键盘操作、浅色/深色/跟随系统设置。

## 界面截图

![思想孵化器首页](docs/screenshot.png)

## 环境与启动

需要 Node 20+、pnpm 10+ 和 Git。

    pnpm install
    pnpm db:migrate
    pnpm dev

浏览器打开 http://localhost:3001（本机 Plane 占用 3000）。没有供应商时可直接进入演示模式；真实模型在“设置 → 模型服务”中配置。

默认只绑定 `127.0.0.1`。只有在受信任局域网中明确设置 `ALLOW_LAN=1` 才会绑定 `0.0.0.0`；这不会增加身份认证，请自行承担局域网访问风险。

## 检查

    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm test:e2e
    pnpm build

## 本地数据与隐私

默认数据库：./data/thought-incubator.db。加密凭据与本地密钥：./data/。这些内容被 Git 忽略。备份时停止应用并复制整个 data/ 目录；彻底删除时停止应用并删除该目录。应用不需要产品账号、不默认启用遥测，也不会上传会话、思想节点或 API Key。

## 目录结构

    src/domain       类型、Zod Schema、思想孵化协议
    src/server       Drizzle/SQLite、仓库、模型 Provider Registry
    src/app          App Router 页面与 API Route
    src/components   工作台、思想地图和 UI primitives
    drizzle          SQLite Migration
    docs             原则、架构、数据模型与隐私说明

## 运行说明

- 真实模型使用 AI SDK 的结构化输出，服务端 Zod 校验后才写入思想节点；模型不可用时会保留用户消息并显示错误，不会写入半成品候选。
- 每轮支持停止生成；停止只保留用户表达，刷新后仍可继续。
- 候选接受、部分接受、纠正和拒绝都建立独立用户节点并保留 AI 候选 provenance，不使用自环。
- 数据库迁移按 `drizzle/0000_*.sql`、`drizzle/0001_*.sql` 顺序执行，不需要删除已有 `data/`。

## 开源

MIT License。贡献方式见 CONTRIBUTING.md，安全问题见 SECURITY.md。
