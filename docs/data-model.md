# 数据模型

SQLite 数据库包含：

- thought_sessions：会话、阶段、状态和当前焦点。
- thought_nodes：原始表达、候选解释、区分、例子、反例、证据、主张和开放问题。
- thought_edges：回答、例子、接受、部分接受、纠正、澄清、支持、挑战、修订和分支关系；数据库触发器拒绝自环。
- conversation_events：真实发生的用户/AI/确认/纠正事件，带 actor、speechAct、userAction 和 provider 元数据。
- intervention_runs：每轮模型运行的 provider、model、模式、状态和时间；不保存 Prompt 或秘密。
- provider_configs：供应商配置摘要；API Key 加密字段不会返回浏览器。
- cognitive_function_models：认知功能到供应商的分配。
- app_settings：主题、语言和导出设置。

AI 候选节点保持 system 来源；用户接受/修订/纠正创建新节点，并通过 provenance_node_id 与 accepted_by_user、partially_accepts 或 corrects 关联。JSON 数组字段用 SQLite TEXT 存储，读取失败时使用安全默认值。表结构变更统一放在按序执行的 drizzle/ 迁移文件。
