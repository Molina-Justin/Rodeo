import { expect, test } from "@playwright/test"

import {
  clearWorkspace,
  logAttempt,
  saveSessionPromptTemplate,
} from "./helpers"
import { WEB_ORIGIN } from "../playwright.config"

/**
 * The dashboard against the real backend and a real browser: the charts get
 * laid out, measured, and painted, which is the one thing neither pytest nor
 * jsdom can vouch for.
 */

test.beforeEach(async ({ request }) => {
  await clearWorkspace(request)
})

test("renders every card and draws real charts", async ({ page, request }) => {
  await logAttempt(request, { problemId: 1, daysAgo: 6, outcome: "failed" })
  await logAttempt(request, {
    problemId: 1,
    daysAgo: 2,
    durationSeconds: 1_140,
  })
  await logAttempt(request, { problemId: 2, daysAgo: 1, outcome: "hint" })
  await logAttempt(request, {
    problemId: 4,
    daysAgo: 0,
    durationSeconds: 3_480,
  })

  await page.goto("/")

  await expect(page.getByText("Study next")).toBeVisible()
  await expect(page.getByText("This cycle")).toBeVisible()
  await expect(page.getByText("Topic mastery")).toBeVisible()
  await expect(page.getByText("Interview readiness")).toBeVisible()
  await expect(page.getByText(/Past 90 days/)).toBeVisible()

  // A chart that failed to lay out is an SVG with no height.
  const charts = page.locator("svg.recharts-surface")
  await expect(charts.first()).toBeVisible()
  const count = await charts.count()
  expect(count).toBeGreaterThan(0)
  for (let index = 0; index < count; index += 1) {
    const box = await charts.nth(index).boundingBox()
    expect(box?.width ?? 0).toBeGreaterThan(0)
    expect(box?.height ?? 0).toBeGreaterThan(0)
  }
})

test("resizes the activity window from the range selector", async ({
  page,
  request,
}) => {
  await logAttempt(request, { problemId: 1 })
  await page.goto("/")

  await expect(page.getByText(/Past 90 days/)).toBeVisible()

  await page.getByRole("button", { name: "30d", exact: true }).click()

  await expect(page.getByText(/Past 30 days/)).toBeVisible()
})

test("keeps the heatmap scrollable without showing a scrollbar", async ({
  page,
  request,
}) => {
  await logAttempt(request, { problemId: 1 })
  await page.setViewportSize({ width: 900, height: 800 })
  await page.goto("/")
  await page.getByRole("button", { name: "1 Year", exact: true }).click()
  await expect(page.getByText(/Past 365 days/)).toBeVisible()

  const heatmap = page.getByTestId("consistency-heatmap-scroll")
  await expect(heatmap).toHaveCSS("scrollbar-width", "none")

  const dimensions = await heatmap.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth)

  await heatmap.evaluate((element) => {
    element.scrollLeft = element.scrollWidth
  })
  expect(
    await heatmap.evaluate((element) => element.scrollLeft)
  ).toBeGreaterThan(0)
})

test("shows a coherent dashboard on a fresh install", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByText("Study next")).toBeVisible()
  await expect(page.getByText("Topic mastery")).toBeVisible()
  // No history, but the page still lays out rather than erroring.
  await expect(page.getByText("Catalog unavailable")).toHaveCount(0)
})

test("copies only completed problems for the active topic with the Settings template", async ({
  context,
  page,
  request,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: WEB_ORIGIN,
  })
  await logAttempt(request, { problemId: 1, notes: "Completed array work." })
  await saveSessionPromptTemplate(
    request,
    "CUSTOM SESSION: {{problem_count}} for {{topic}} in {{minutes}} minutes."
  )

  const templatesLoaded = page.waitForResponse((response) =>
    response.url().endsWith("/api/v1/settings/prompt-templates")
  )
  await page.goto("/")
  await templatesLoaded

  await page.getByRole("button", { name: "Array", exact: true }).click()
  await page.getByRole("button", { name: "Copy session prompt" }).click()

  const completed = JSON.parse(
    await page.evaluate(() => navigator.clipboard.readText())
  )
  expect(completed.topic).toBe("Array")
  expect(
    completed.completedProblems.map(
      (problem: { title: string }) => problem.title
    )
  ).toEqual(["Two Sum"])
  expect(JSON.stringify(completed)).not.toContain("Median of Two Sorted Arrays")
  expect(completed.task).toContain("CUSTOM SESSION: 3 for Array in 60 minutes.")

  await page.getByRole("button", { name: "Binary Search", exact: true }).click()
  await page.getByRole("button", { name: "Copy session prompt" }).click()

  const untouched = JSON.parse(
    await page.evaluate(() => navigator.clipboard.readText())
  )
  expect(untouched.topic).toBe("Binary Search")
  expect(untouched.completedProblems).toEqual([])
  expect(untouched.task).toContain(
    "I have no completed problems in Binary Search yet."
  )
  expect(untouched.task).toContain(
    "CUSTOM SESSION: 3 for Binary Search in 60 minutes."
  )
  expect(JSON.stringify(untouched)).not.toContain("Median of Two Sorted Arrays")
})

test("loads every shipped navigation destination", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("button", { name: "Schedule" })).toHaveCount(0)

  await page.getByRole("button", { name: "Settings" }).click()
  await expect(
    page.getByRole("heading", { name: "AI prompt templates" })
  ).toBeVisible()

  await page.getByRole("button", { name: "Problems" }).click()
  await expect(page.getByRole("table")).toBeVisible()

  await page.getByRole("button", { name: "Review Queue" }).click()
  await expect(page.getByText("Queue is clear")).toBeVisible()

  await page.getByRole("button", { name: "Dashboard" }).click()
  await expect(page.getByText("Study next")).toBeVisible()
})

test("reports no console errors while the dashboard renders", async ({
  page,
  request,
}) => {
  const errors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text())
    }
  })
  page.on("pageerror", (error) => errors.push(error.message))

  await logAttempt(request, { problemId: 1 })
  await page.goto("/")
  await expect(page.getByText("Topic mastery")).toBeVisible()

  expect(errors).toEqual([])
})
