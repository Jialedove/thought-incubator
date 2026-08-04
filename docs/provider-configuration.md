# 模型供应商

设置页支持 OpenAI、Anthropic、Google Generative AI、OpenAI-compatible 和本地 Mock Provider。第一版可直接用 Mock Provider；真实供应商配置需要服务端 API Key。

OpenAI-compatible 必填 Base URL 和 Model ID，可选自定义 Headers。页面只显示掩码 Key；当前本地实现使用 MODEL_ENCRYPTION_KEY 保护本地凭据，生产使用前请设置一个仅保存在本机的数据目录中的密钥。
