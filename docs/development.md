# 开发

安装依赖、运行迁移并启动：

    pnpm install
    pnpm db:migrate
    pnpm dev

检查：

    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build
    pnpm test:e2e

E2E 测试使用本地 Mock Provider，不需要网络或 API Key；Playwright 使用一个 worker 共享一份临时数据库，避免 SQLite 并发写入相互污染。

开发服务器默认只监听 `127.0.0.1:3001`。仅在受信任网络中设置 `ALLOW_LAN=1` 才绑定 `0.0.0.0`；数据库迁移会按序记录在本地 `_app_migrations` 表中，升级时保留已有 `data/`。CI 会在独立临时数据库上执行迁移、lint、typecheck、unit、build 和 E2E。
