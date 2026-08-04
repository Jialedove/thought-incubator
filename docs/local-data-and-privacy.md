# 本地数据与隐私

默认数据库位置是 ./data/thought-incubator.db，供应商凭据存储在 ./data/providers.enc，本地加密主密钥存储在 ./data/.master-key。这些路径均被 Git 忽略。

备份：停止应用后复制整个 data/ 目录。彻底删除：停止应用并删除 data/ 目录。应用不上传会话、思想节点或 API Key，也不默认启用遥测。
