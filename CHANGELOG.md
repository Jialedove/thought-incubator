# Changelog

## 0.3.0 — Phase 3

- 分离 ProviderConnection 与 ModelConfig；一个 Provider 支持多个模型，并保证只有一个启用的全局默认模型。
- 增加 OpenAI、Anthropic、Google、OpenAI-compatible、Mock/Fake 适配器，支持发现模型、手动添加、连接/模型测试和结构化流式介入。
- 增加认知功能到 ModelConfig 的原子绑定、默认继承、上下文构建、候选审阅状态和自然语言决定路由。
- API Key 支持保留/替换/清除，列表只返回掩码；真实配置失败返回稳定错误码，不静默回退 Mock。
- 增加 Provider/Model 设置详情页、工作台运行模型显示、重试幂等键、浏览器和单元测试覆盖。

## 0.2.0 — Phase 2

- 接入真实 Provider 的结构化流式介入，并支持停止、错误保留和运行记录。
- 分离 UserMove、SpeechAct、ThoughtNode、ConversationEvent 与用户确认 provenance。
- 修复动作分类、连续关系、确认语义、跨会话决策保护和自环。
- 增加版本化 SQLite 迁移、Provider 编辑/启停/Headers、批量功能模型映射。
- 增加主题应用、移动导航、关系驱动思想地图、JSON 导入和语义 Markdown 导出。
- 增加集成/E2E 测试与 GitHub Actions CI。
