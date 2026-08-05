# 模型供应商

设置页支持 OpenAI、Anthropic、Google Generative AI、OpenAI-compatible 和本地 Mock Provider。Provider 详情负责连接、凭据、启停和 Headers；Model 详情负责模型发现、手动添加、启停、删除、默认和模型测试。一个 Provider 可以有多个 Model，只有一个已启用模型可以成为全局默认。

OpenAI-compatible 必填 Base URL；Model ID 可以从 `/models` 发现，也可以手动添加。页面只显示掩码 Key 和 Header；API Key、秘密 Header 使用 AES-GCM 加密，主密钥默认为 `data/.master-key`，也可由 `MODEL_ENCRYPTION_KEY` 提供。编辑 Provider 时可保留、替换或清除 API Key。

运行时按“认知功能 ModelConfig 绑定 → 全局默认 Model”解析，停用的 Provider 或 Model 不会被使用。`auto` 模式只使用解析到的配置；`mock` 模式是显式的演示选择；`real` 模式若凭据、模型或连接不可用会返回稳定错误码，不会回退。
