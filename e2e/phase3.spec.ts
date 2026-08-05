import { expect, test } from "@playwright/test";

test("Provider 详情页按 Provider / Model 分开管理", async ({ page }) => {
  await page.goto("/settings/providers");
  await expect(page.getByRole("heading", { name: "Provider 与 Model 分开管理。" })).toBeVisible();
  await page.getByRole("link", { name: /新增 Provider/ }).click();
  await expect(page.getByRole("heading", { name: "连接与模型" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Model 配置" })).toBeVisible();
  await expect(page.getByPlaceholder("手动输入 Model ID")).toHaveCount(0);
  await page.getByRole("button", { name: "保存连接" }).click();
  await expect(page.getByPlaceholder("手动输入 Model ID")).toBeVisible();
});

test("真实模式缺少凭据时返回稳定错误，不静默切换 Mock", async ({ request }) => {
  await request.get("/api/providers");
  const providerResponse = await request.post("/api/providers", { data: { name: "E2E 未配置 Provider", kind: "openai", enabled: true, isDefault: false, headers: {} } });
  expect(providerResponse.ok()).toBeTruthy();
  const provider = (await providerResponse.json() as { provider: { id: string } }).provider;
  const modelResponse = await request.post(`/api/providers/${provider.id}/models`, { data: { modelId: "e2e-real-model", displayName: "E2E Real", enabled: true, isDefault: true, source: "manual" } });
  expect(modelResponse.ok()).toBeTruthy();
  const session = await request.post("/api/sessions", { data: {} });
  const sessionId = (await session.json() as { session: { id: string } }).session.id;
  const response = await request.post(`/api/sessions/${sessionId}/messages`, { data: { text: "测试真实配置", mode: "real" } });
  expect(response.ok()).toBeFalsy();
  expect((await response.json() as { code: string }).code).toBe("CREDENTIAL_MISSING");
});
