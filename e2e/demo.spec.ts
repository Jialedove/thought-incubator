import { expect, test } from "@playwright/test";

test("演示模式可以创建会话并确认候选观点", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: /新建思想/ }).click();
  await expect(page).toHaveURL(/\/app\/session\//);
  await page.getByPlaceholder(/继续说下去/).fill("我总觉得做得越多反而越没有前进");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByText(/哪一部分最想被认真看见|候选表达/)).toBeVisible();
});
