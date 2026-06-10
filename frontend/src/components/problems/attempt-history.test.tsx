import { describe, expect, it, vi } from "vitest"

import { AttemptHistory } from "@/components/problems/attempt-history"
import { makeAttempt } from "@/test/fixtures"
import { renderWithProviders, screen } from "@/test/render"

describe("AttemptHistory", () => {
  it("prompts to start the timer when there is no history", () => {
    renderWithProviders(<AttemptHistory attempts={[]} onOpenReport={vi.fn()} />)

    expect(screen.getByText(/No attempts logged yet/)).toBeInTheDocument()
  })

  it("renders one row per attempt in the order it is given", () => {
    const attempts = [
      makeAttempt({ id: "newest", outcome: "optimal", durationMinutes: 19 }),
      makeAttempt({ id: "middle", outcome: "hint", durationMinutes: 31 }),
      makeAttempt({ id: "oldest", outcome: "failed", durationMinutes: 47 }),
    ]
    renderWithProviders(
      <AttemptHistory attempts={attempts} onOpenReport={vi.fn()} />
    )

    const rows = screen.getAllByRole("listitem")
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent("Independent")
    expect(rows[0]).toHaveTextContent("19m")
    expect(rows[2]).toHaveTextContent("Failed")
    expect(rows[2]).toHaveTextContent("47m")
  })

  it("labels the outcome and the effort of each attempt", () => {
    renderWithProviders(
      <AttemptHistory
        attempts={[makeAttempt({ outcome: "solution", effort: "brutal" })]}
        onOpenReport={vi.fn()}
      />
    )

    expect(screen.getByText("Solution")).toBeInTheDocument()
    expect(screen.getByText("Brutal")).toBeInTheDocument()
  })

  it("marks the attempts that carry notes or audio", () => {
    const attempts = [
      makeAttempt({ id: "plain" }),
      makeAttempt({ id: "annotated", notes: "Monotonic stack." }),
      makeAttempt({ id: "recorded", audioUrl: "/api/v1/recordings/r-1/content" }),
    ]
    renderWithProviders(
      <AttemptHistory attempts={attempts} onOpenReport={vi.fn()} />
    )

    const rows = screen.getAllByRole("listitem")
    expect(rows[0].querySelectorAll("svg")).toHaveLength(0)
    expect(rows[1].querySelectorAll("svg")).toHaveLength(1)
    expect(rows[2].querySelectorAll("svg")).toHaveLength(1)
  })

  it("opens the report for the attempt that was clicked", async () => {
    const onOpenReport = vi.fn()
    const target = makeAttempt({ id: "wanted", durationMinutes: 42 })
    const { user } = renderWithProviders(
      <AttemptHistory
        attempts={[makeAttempt({ id: "other" }), target]}
        onOpenReport={onOpenReport}
      />
    )

    await user.click(screen.getAllByRole("button")[1])

    expect(onOpenReport).toHaveBeenCalledWith(target)
  })

  it("shows how long ago each attempt was", () => {
    renderWithProviders(
      <AttemptHistory
        attempts={[makeAttempt({ completedAt: new Date().toISOString() })]}
        onOpenReport={vi.fn()}
      />
    )

    expect(screen.getByText("Today")).toBeInTheDocument()
  })
})
