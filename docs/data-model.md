# 数据模型

SQLite 数据库包含：

- thought_sessions：会话、阶段、状态和当前焦点。
- thought_nodes：原始表达、候选解释、区分、例子、反例、证据、主张和开放问题。
- thought_edges：澄清、支持、挑战、修订和分支关系。
- conversation_events：真实发生的用户/AI/确认/纠正事件。
- provider_configs：供应商配置摘要；API Key 加密字段不会返回浏览器。
- cognitive_function_models：认知功能到供应商的分配。
- app_settings：主题、语言和导出设置。

JSON 数组字段用 SQLite TEXT 存储。表结构变更统一放在 drizzle/ 迁移文件。
