# 架构

项目使用 Next.js App Router。React 页面只负责交互和展示；src/domain 保存类型、Zod Schema 和纯协议；src/server 负责 SQLite/Drizzle、模型供应商和 API Route；drizzle/ 保存迁移。

一次用户回合的真实路径是：

浏览器提交 → Route/Zod 校验 → 领域协议分类/选择介入 → Model Resolver 按“功能映射 → 默认 Model”解析 → ThoughtContextBuilder 选择上下文 → Provider Adapter 结构化流 → 领域校验 → Drizzle 事务写入事件、节点、边和运行记录 → UI 更新。

`conversation_event` 记录发生过的对话，`thought_node` 只记录有思想语义的内容，`thought_edge` 记录不同节点之间的关系，`intervention_run` 记录运行状态但不记录秘密或完整 Prompt。AI 候选永远保留 system 来源；用户接受、部分接受或纠正创建带 provenance 的新用户节点。

ProviderConnection（连接、凭据、Headers）与 ModelConfig（Model ID、能力、启停和来源）分离。没有配置时由显式的本地演示 Provider 提供体验；真实模式缺失凭据、模型或连接失败会保留稳定错误，不会静默替换为 Mock。Decision Service 处理自然语言的接受、部分接受、纠正和拒绝，不再把决定文本当作普通用户思想节点。
