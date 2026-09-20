import { test, expect } from "@playwright/test";
import path from "node:path";

test.describe("VYRAL production browser flow", () => {
  test("public routes and auth boundaries", async ({ page, request, baseURL }) => {
    const health = await request.get(`${baseURL}/api/health`);
    expect(health.ok()).toBeTruthy();
    expect((await health.json()).ok).toBe(true);

    await page.goto("/");
    await expect(page).toHaveTitle(/VYRAL/i);
    await expect(page.getByText(/Your world\. Connected\./i)).toBeVisible();
    await page.goto("/stories");
    await expect(page.getByText(/Sign in to view Stories/i)).toBeVisible();
    await page.goto("/reels");
    await expect(page.getByText(/Sign in to watch Reels/i)).toBeVisible();
    const oauth = await request.get(`${baseURL}/api/auth/google`);
    expect([302, 503]).toContain(oauth.status());
  });

  test("register, create post/story/reel and visit protected product surfaces", async ({ page }) => {
    const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await page.goto("/register");
    await page.getByLabel("Display name").fill("VYRAL E2E");
    await page.getByLabel("Username").fill(`e2e_${id}`.slice(0, 24));
    await page.getByLabel("Email").fill(`e2e_${id}@example.test`);
    await page.getByLabel("Password").fill("VyralE2E!2026Secure");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/$/);

    for (const route of ["/", "/explore", "/stories", "/reels", "/messages", "/search", "/notifications", "/saved", "/circles", "/analytics", "/settings"]) {
      await page.goto(route);
      await expect(page.locator("body")).toBeVisible();
    }

    await page.goto("/create");
    await page.getByRole("button", { name: "Post" }).click();
    await page.locator("textarea").fill("E2E post from VYRAL.");
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/create?type=story");
    await page.locator("textarea").fill("E2E story from VYRAL.");
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page).toHaveURL(/\/stories$/);
    await expect(page.getByText("E2E story from VYRAL.")).toBeVisible();

    await page.goto("/create?type=reel");
    await page.locator('input[type="file"]').setInputFiles(path.join(process.cwd(), "e2e", "fixtures", "reel.mp4"));
    await page.locator("textarea").fill("E2E Reel from VYRAL.");
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page).toHaveURL(/\/reels$/);
    await expect(page.getByText("E2E Reel from VYRAL.")).toBeVisible();
  });
});
