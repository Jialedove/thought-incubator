# 架构

项目使用 Next.js App Router。React 页面只负责交互和展示；src/domain 保存类型、Zod Schema 和纯协议；src/server 负责 SQLite/Drizzle、模型供应商和 API Route；drizzle/ 保存迁移。

一次用户回合的真实路径是：

浏览器提交 → Route 校验 → 领域协议分类/选择介入 → Drizzle 事务写入事件、节点、边 → 返回候选结果 → UI 更新

默认使用确定性的 Mock Provider，因此没有 API Key 也可以完整体验。真实供应商通过 Provider Registry 接入；它们不会改变领域对象。
