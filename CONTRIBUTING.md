# 参与贡献

1. 安装 Node 20+ 与 pnpm。
2. 运行 pnpm install。
3. 运行 pnpm db:migrate、pnpm lint、pnpm typecheck 和 pnpm test。
4. 保持领域协议位于 src/domain，不要把数据库逻辑写进 React 组件。
5. 提交前不要加入 .env、data/ 或构建产物。

请在 Issue 中描述问题和复现步骤，再提交小而可审阅的 Pull Request。
