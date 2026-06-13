import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ReviewQueuePage } from "@/components/review-queue/review-queue-page"
import { CATALOG, NOW, makeAttempt } from "@/test/fixtures"
import { renderWithProviders, screen, waitFor, within } from "@/test/render"
import { resetStore, seed } from "@/test/server"


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

describe("ReviewQueuePage", () => {
  it("invites the user to browse problems when nothing has been logged", async () => {
    seed({ problems: CATALOG, attempts: [] })
    renderWithProviders(<ReviewQueuePage />)

    expect(await screen.findByText("Queue is clear")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Browse problems/ })
    ).toBeInTheDocument()
  })

  it("lists the problems the engine has scheduled, soonest first", async () => {
    seed({
      problems: CATALOG,
      attempts: [
        makeAttempt({ problemId: 1, completedAt: daysBeforeNow(40) }),
        makeAttempt({ problemId: 2, completedAt: daysBeforeNow(1) }),
        makeAttempt({
          problemId: 4,
          completedAt: daysBeforeNow(7),
          outcome: "failed",
        }),
      ],
    })
    renderWithProviders(<ReviewQueuePage />)

    expect(await screen.findByText("Review next")).toBeInTheDocument()
    expect(screen.getAllByText("Two Sum").length).toBeGreaterThan(0)
    expect(screen.getByText("ordered by due date")).toBeInTheDocument()
  })

  it("selects a different problem when one is clicked", async () => {
    seed({
      problems: CATALOG,
      attempts: [
        makeAttempt({ problemId: 1, completedAt: daysBeforeNow(40) }),
        makeAttempt({
          problemId: 4,
          completedAt: daysBeforeNow(30),
          outcome: "failed",
        }),
      ],
    })
    const { user } = renderWithProviders(<ReviewQueuePage />)

    await screen.findByText("Review next")

    const target = screen.getAllByText("Median of Two Sorted Arrays")[0]
    await user.click(target)

    await waitFor(() =>
      expect(
        screen.getAllByText("Median of Two Sorted Arrays").length
      ).toBeGreaterThan(0)
    )
  })

  it("filters the queue by a search term", async () => {
    seed({
      problems: CATALOG,
      attempts: [
        makeAttempt({ problemId: 1, completedAt: daysBeforeNow(40) }),
        makeAttempt({ problemId: 2, completedAt: daysBeforeNow(40) }),
      ],
    })
    const { user } = renderWithProviders(<ReviewQueuePage />)

    await screen.findByText("Review next")
    expect(screen.getAllByText("Add Two Numbers").length).toBeGreaterThan(0)

    const search = screen.getByRole("textbox")
    await user.type(search, "Two Sum")

    await waitFor(() =>
      expect(screen.queryByText("Add Two Numbers")).not.toBeInTheDocument()
    )
    expect(screen.getAllByText("Two Sum").length).toBeGreaterThan(0)
  })

  it("counts what is overdue separately from what is due today", async () => {
    seed({
      problems: CATALOG,
      attempts: [
        makeAttempt({ problemId: 1, completedAt: daysBeforeNow(40) }),
        makeAttempt({ problemId: 2, completedAt: daysBeforeNow(60) }),
      ],
    })
    const { container } = renderWithProviders(<ReviewQueuePage />)

    await screen.findByText("Review next")

    expect(within(container).getAllByText("Overdue").length).toBeGreaterThan(0)
    expect(within(container).getAllByText("Due today").length).toBeGreaterThan(0)
    expect(within(container).getAllByText("Upcoming").length).toBeGreaterThan(0)
  })

  it("ignores history for problems that are no longer in the catalog", async () => {
    seed({
      problems: CATALOG,
      attempts: [
        makeAttempt({ problemId: 1, completedAt: daysBeforeNow(40) }),
        makeAttempt({ problemId: 999_999, completedAt: daysBeforeNow(40) }),
      ],
    })
    renderWithProviders(<ReviewQueuePage />)

    await screen.findByText("Review next")

    expect(screen.queryByText(/999999/)).not.toBeInTheDocument()
  })
})
