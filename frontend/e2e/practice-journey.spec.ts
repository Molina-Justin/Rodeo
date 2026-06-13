import { expect, test } from "@playwright/test"

import { clearWorkspace, logAttempt } from "./helpers"


test.beforeEach(async ({ request }) => {
  await clearWorkspace(request)
})

async function openProblems(page: import("@playwright/test").Page) {
  await page.goto("/")
  await page
    .getByRole("button", { name: "Problems", exact: false })
    .first()
    .click()
  await expect(page.getByRole("table")).toBeVisible()
}

test("times a problem, logs the attempt, and shows it in the history", async ({
  page,
}) => {
  await openProblems(page)

  await page.getByRole("row").filter({ hasText: "Two Sum" }).first().click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()

  await dialog.getByRole("button", { name: "Start without Audio" }).click()
  await expect(dialog.getByRole("button", { name: "Stop & log" })).toBeVisible()

  await dialog.getByRole("button", { name: "Stop & log" }).click()

  const logDialog = page.getByRole("dialog").filter({ hasText: "Log attempt" })
  await expect(logDialog).toBeVisible()

  await logDialog.getByText("Independent", { exact: true }).click()
  await logDialog.getByText("Manageable", { exact: true }).click()
  await logDialog
    .getByRole("button", { name: /Log attempt|Save/ })
    .last()
    .click()

  await expect(logDialog).toBeHidden()

  await page.reload()
  await page
    .getByRole("button", { name: "Problems", exact: false })
    .first()
    .click()
  await page.getByRole("row").filter({ hasText: "Two Sum" }).first().click()

  const reopened = page.getByRole("dialog")
  await expect(reopened.getByText("Attempt history")).toBeVisible()
  await expect(reopened.getByText("1 attempt").first()).toBeVisible()
  await expect(reopened.getByText("Independent")).toBeVisible()
  await expect(reopened.getByText("Today")).toBeVisible()
})

test("keeps an edited time spent when logging from the timer", async ({
  page,
}) => {
  await openProblems(page)

  await page.getByRole("row").filter({ hasText: "Two Sum" }).first().click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "Start without Audio" }).click()
  await dialog.getByRole("button", { name: "Stop & log" }).click()

  const logDialog = page.getByRole("dialog").filter({ hasText: "Log attempt" })
  const minutes = logDialog.getByLabel("Minutes spent")
  await minutes.fill("26")
  await expect(minutes).toHaveValue("26")
  await logDialog.getByText("Independent", { exact: true }).click()
  await logDialog.getByText("Manageable", { exact: true }).click()
  await logDialog
    .getByRole("button", { name: /Log attempt|Save/ })
    .last()
    .click()
  await expect(logDialog).toBeHidden()

  await expect(page.getByRole("dialog").getByText("26m")).toBeVisible()
})

test("moves a solved problem into the review queue once it comes due", async ({
  page,
  request,
}) => {
  await logAttempt(request, { problemId: 1, daysAgo: 35 })
  await logAttempt(request, { problemId: 2, daysAgo: 0 })

  await page.goto("/")
  await page
    .getByRole("button", { name: "Review Queue", exact: false })
    .first()
    .click()

  await expect(page.getByText("Review next")).toBeVisible()
  const lead = page
    .locator("section")
    .filter({ hasText: "Review next" })
    .first()
  await expect(lead.getByText("Two Sum").first()).toBeVisible()
  await expect(lead.getByText("Add Two Numbers")).toHaveCount(0)
})

test("shows an empty review queue on a fresh install", async ({ page }) => {
  await page.goto("/")
  await page
    .getByRole("button", { name: "Review Queue", exact: false })
    .first()
    .click()

  await expect(page.getByText("Queue is clear")).toBeVisible()
})

test("narrows the problem catalog with a search", async ({ page }) => {
  await openProblems(page)

  await expect(
    page.getByRole("row").filter({ hasText: "Add Two Numbers" })
  ).toHaveCount(1)

  await page.getByLabel("Search problems").fill("Two Sum")

  await expect(
    page.getByRole("row").filter({ hasText: "Add Two Numbers" })
  ).toHaveCount(0)
  await expect(
    page.getByRole("row").filter({ hasText: "Two Sum" }).first()
  ).toBeVisible()
})

test("reflects a logged attempt in the problem row's status", async ({
  page,
  request,
}) => {
  await logAttempt(request, { problemId: 1, outcome: "failed" })

  await openProblems(page)
  await page.getByLabel("Search problems").fill("Two Sum")

  const row = page.getByRole("row").filter({ hasText: "Two Sum" }).first()
  await expect(row).toBeVisible()
  await expect(row).toContainText(/Failed|Struggling|1m|15m/i)
})
