import { chromium, expect, test } from "@playwright/test";
import { WEB_URL, chromiumLaunch } from "./env";
test("owner invitations require sign-in and can be revoked", async () => {
  const browser = await chromium.launch(chromiumLaunch()),
    context = await browser.newContext(),
    guest = await browser.newContext();
  try {
    await context.request.post(`${WEB_URL}/api/dev/demo-session`);
    const saved = await context.request.post(`${WEB_URL}/api/applications`, {
      data: {
        posting: {
          title: "Coach Review Engineer",
          company: "Bramblecrest Analytics",
          sourceUrl: "https://bramblecrest.example/jobs/coach-review",
          source: "generic",
          descriptionText: "",
          parsedBy: "test",
        },
      },
    });
    expect(saved.ok()).toBe(true);
    const app = (await saved.json()).application;
    const page = await context.newPage();
    await page.goto(`${WEB_URL}/dashboard`);
    await page
      .getByRole("row", { name: /Coach Review Engineer/ })
      .getByRole("button", { name: /Details/ })
      .click();
    const drawer = page.getByRole("dialog", { name: "Coach Review Engineer" });
    const sharing = drawer.getByRole("region", { name: "Coach sharing" });
    await sharing.getByRole("button", { name: "Create single-use invitation" }).click();
    const input = sharing.getByLabel("Invitation link", { exact: true });
    await expect(input).toHaveValue(/\/coach#invite=/);
    const link = await input.inputValue();
    const token = new URLSearchParams(new URL(link).hash.slice(1)).get("invite")!;
    const guestPage = await guest.newPage();
    await guestPage.goto(link);
    await expect(
      guestPage.getByRole("link", { name: "Sign in to accept an invitation" }),
    ).toBeVisible();
    await expect(guestPage.getByRole("button", { name: "Review invitation" })).toBeDisabled();
    expect(new URL(guestPage.url()).hash).toBe("");
    expect(
      (
        await guest.request.post(`${WEB_URL}/api/coach-shares`, {
          data: { action: "preview", token },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await context.request.post(`${WEB_URL}/api/coach-shares`, {
          data: { action: "accept", token },
        })
      ).status(),
    ).toBe(400);
    await sharing.getByRole("button", { name: "Revoke share" }).click();
    await expect(sharing).toContainText("Share revoked");
    await expect(input).toBeHidden();
    const managed = await context.request.get(
      `${WEB_URL}/api/coach-shares?applicationId=${app.id}`,
    );
    expect((await managed.json()).shares[0].revokedAt).toBeTruthy();
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "Coach workspace", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Coach workspace", exact: true })).toBeVisible();
  } finally {
    await context.close();
    await guest.close();
    await browser.close();
  }
});
