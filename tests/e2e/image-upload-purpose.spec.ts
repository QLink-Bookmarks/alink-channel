import { type Page, expect, test } from "@playwright/test";

import { mockSignedInApi } from "./support/mock-save-flow-api";

// Issue #5, section 4 regression: profile image change and feedback image attach
// still work, and each upload now names its storage target (`purpose`).

const PNG_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkaPhfDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const UPLOADED_URL = "https://images.archivelink.app/dev-profile-test.png";

type Upload = { purpose: string | null; url: string | null; hasImagePart: boolean };

async function setUpUploads(page: Page) {
  const uploads: Upload[] = [];
  await mockSignedInApi(page, [
    async ({ path, request, respond }) => {
      if (path !== "/api/images" || request.method() !== "POST") {
        return false;
      }
      const query = new URL(request.url()).searchParams;
      uploads.push({
        purpose: query.get("purpose"),
        url: query.get("url"),
        hasImagePart: (request.postDataBuffer()?.toString("latin1") ?? "").includes('name="image"'),
      });
      await respond({ url: UPLOADED_URL }, 201);
      return true;
    },
  ]);
  await page.route("https://images.archivelink.app/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PNG_PIXEL }),
  );
  return uploads;
}

async function pickImage(page: Page, trigger: () => Promise<void>) {
  const chooser = page.waitForEvent("filechooser");
  await trigger();
  await (await chooser).setFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG_PIXEL });
}

test("profile image change uploads with purpose PROFILE", async ({ page }) => {
  const uploads = await setUpUploads(page);
  await page.goto("/settings");

  // The settings profile card (the wide sidebar also shows the username first).
  await page.getByText("tester", { exact: true }).last().click();
  await expect(page.getByText("프로필 수정").first()).toBeVisible();
  // The avatar camera button opens this hidden file input.
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG_PIXEL });

  await expect.poll(() => uploads.length).toBe(1);
  expect(uploads[0]).toEqual({ purpose: "PROFILE", url: null, hasImagePart: true });
  await expect(page.locator(`img[src="${UPLOADED_URL}"]`).first()).toBeVisible();
});

test("feedback image attach uploads with purpose POST", async ({ page }) => {
  const uploads = await setUpUploads(page);
  await page.goto("/settings");

  await page.getByText("피드백", { exact: true }).first().click();
  await pickImage(page, () => page.getByText("이미지 첨부").click());

  await expect.poll(() => uploads.length).toBe(1);
  expect(uploads[0]).toEqual({ purpose: "POST", url: null, hasImagePart: true });
  await expect(page.getByText("이미지 (1/", { exact: false })).toBeVisible();
});
