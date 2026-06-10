import { HttpResponse, http } from "msw"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DashboardOverview } from "@/components/dashboard/dashboard-overview"
import { CATALOG, NOW, makeAttempt } from "@/test/fixtures"
import { renderWithProviders, screen, waitFor } from "@/test/render"
import { resetStore, seed, server } from "@/test/server"

/**
 * The whole overview end to end: fetch the catalog and the attempts, run the
 * engine, and draw every card. This is the test that fails when a chart stops
 * rendering, which no type-check or service-level test would catch.
 */

const ORIGIN = "http://localhost:5199"

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(NOW)
  resetStore()
})

afterEach(() => {
  vi.useRealTimers()
})

function daysBeforeNow(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString()
}

function seedRecentHistory(): void {
  seed({
    problems: CATALOG,
    attempts: [
      makeAttempt({
        problemId: 1,
        completedAt: daysBeforeNow(6),
        outcome: "failed",
        durationMinutes: 47,
      }),
      makeAttempt({
        problemId: 1,
        completedAt: daysBeforeNow(2),
        outcome: "optimal",
        durationMinutes: 19,
      }),
      makeAttempt({
        problemId: 2,
        completedAt: daysBeforeNow(1),
        outcome: "hint",
        durationMinutes: 31,
      }),
      makeAttempt({
        problemId: 4,
        completedAt: daysBeforeNow(0),
        outcome: "optimal",
        durationMinutes: 58,
      }),
    ],
  })
}

describe("DashboardOverview", () => {
  it("renders every card once the catalog and attempts load", async () => {
    seedRecentHistory()
    const { container } = renderWithProviders(<DashboardOverview />)

    expect(await screen.findByText("Study next")).toBeInTheDocument()
    expect(screen.getByText("This cycle")).toBeInTheDocument()
    expect(screen.getByText("Topic mastery")).toBeInTheDocument()
    expect(screen.getByText("Interview readiness")).toBeInTheDocument()
    expect(screen.getByText(/Past 90 days/)).toBeInTheDocument()

    // Three chart cards sit in the bottom row; each must draw a real SVG.
    await waitFor(() =>
      expect(container.querySelectorAll("svg").length).toBeGreaterThan(3)
    )
  })

  it("shows a skeleton before the data arrives", () => {
    seedRecentHistory()
    const { container } = renderWithProviders(<DashboardOverview />)

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(
      0
    )
    expect(screen.queryByText("Study next")).not.toBeInTheDocument()
  })

  it("reports a failed catalog load rather than rendering empty charts", async () => {
    server.use(
      http.get(`${ORIGIN}/api/v1/problems`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 })
      )
    )
    seedRecentHistory()
    renderWithProviders(<DashboardOverview />)

    expect(await screen.findByText("Catalog unavailable")).toBeInTheDocument()
  })

  it("renders a coherent dashboard with no attempts logged", async () => {
    seed({ problems: CATALOG, attempts: [] })
    renderWithProviders(<DashboardOverview />)

    expect(await screen.findByText("Study next")).toBeInTheDocument()
    expect(screen.getByText("Topic mastery")).toBeInTheDocument()
    // Nothing drawn, but nothing thrown either.
    expect(screen.getByText(/Past 90 days/)).toBeInTheDocument()
  })

  it("resizes the activity window when the range is changed", async () => {
    seedRecentHistory()
    const { user } = renderWithProviders(<DashboardOverview />)

    await screen.findByText("This cycle")
    expect(screen.getByText(/Past 90 days/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "30d" }))

    await waitFor(() =>
      expect(screen.getByText(/Past 30 days/)).toBeInTheDocument()
    )
  })

  it("pages through the whole catalog rather than the first page only", async () => {
    const many = Array.from({ length: 250 }, (_, index) => ({
      ...CATALOG[index % CATALOG.length],
      id: index + 1,
      title: `Problem ${index + 1}`,
      slug: `problem-${index + 1}`,
    }))
    seed({ problems: many, attempts: [] })

    let pagesFetched = 0
    server.events.on("request:start", ({ request }) => {
      if (new URL(request.url).pathname === "/api/v1/problems") {
        pagesFetched += 1
      }
    })

    renderWithProviders(<DashboardOverview />)

    await screen.findByText("Study next")
    // 250 problems at 200 per page is two requests, not one.
    await waitFor(() => expect(pagesFetched).toBeGreaterThanOrEqual(2))
  })
})
