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

E2E 测试使用本地 Mock Provider，不需要网络或 API Key。
