# 模型供应商

设置页支持 OpenAI、Anthropic、Google Generative AI、OpenAI-compatible 和本地 Mock Provider。Provider 支持新增、编辑、启停、默认、删除确认、连接测试和自定义 Headers；认知功能映射一次性事务保存 Provider + Model ID。

OpenAI-compatible 必填 Base URL 和 Model ID。页面只显示掩码 Key 和 Header；API Key、秘密 Header 使用 AES-GCM 加密，主密钥默认为 `data/.master-key`，也可由 `MODEL_ENCRYPTION_KEY` 提供。运行时按“功能映射 → 默认 Provider → Mock”解析，停用 Provider 不会被使用。
