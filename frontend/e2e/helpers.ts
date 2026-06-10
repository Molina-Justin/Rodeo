import type { APIRequestContext, Page } from "@playwright/test"
import { expect } from "@playwright/test"

import { WEB_ORIGIN } from "../playwright.config"

export const API = "/api/v1"

/** Unsafe requests carry an Origin, which is the app's only access control. */
const HEADERS = { Origin: WEB_ORIGIN }

/** Drops every attempt, recording, and session; the catalog survives. */
export async function clearWorkspace(
  request: APIRequestContext
): Promise<void> {
  const response = await request.post(`${API}/system/clear`, {
    headers: HEADERS,
  })
  expect(response.ok(), await response.text()).toBe(true)
}

export async function logAttempt(
  request: APIRequestContext,
  options: {
    problemId: number
    daysAgo?: number
    outcome?: "optimal" | "hint" | "solution" | "failed"
    effort?: "light" | "moderate" | "heavy" | "brutal"
    durationSeconds?: number
    notes?: string
  }
): Promise<{ id: string }> {
  const completedAt = new Date(
    Date.now() - (options.daysAgo ?? 0) * 86_400_000
  ).toISOString()

  const response = await request.post(
    `${API}/problems/${options.problemId}/attempts`,
    {
      headers: { ...HEADERS, "Idempotency-Key": crypto.randomUUID() },
      data: {
        completed_at: completedAt,
        duration_seconds: options.durationSeconds ?? 900,
        outcome: options.outcome ?? "optimal",
        effort: options.effort ?? "moderate",
        blocker: "none",
        notes: options.notes ?? "",
      },
    }
  )
  expect(response.ok(), await response.text()).toBe(true)
  return response.json()
}

export async function saveSessionPromptTemplate(
  request: APIRequestContext,
  template: string
): Promise<void> {
  const response = await request.put(
    `${API}/settings/prompt-templates/session`,
    {
      headers: HEADERS,
      data: { template },
    }
  )
  expect(response.ok(), await response.text()).toBe(true)
}

export async function gotoView(
  page: Page,
  view: "Dashboard" | "Problems" | "Review Queue" | "Settings"
): Promise<void> {
  await page.goto("/")
  await page.getByRole("button", { name: view, exact: false }).first().click()
}
