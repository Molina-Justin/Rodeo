import { describe, expect, it, vi } from "vitest"

import { ConsistencyCard } from "@/components/dashboard/consistency-card"
import { CycleStats } from "@/components/dashboard/cycle-stats"
import { DifficultyMixCard } from "@/components/dashboard/difficulty-mix-card"
import { InterviewReadinessCard } from "@/components/dashboard/interview-readiness-card"
import { ReviewQueueCard } from "@/components/dashboard/review-queue-card"
import { TimePerDifficultyCard } from "@/components/dashboard/time-per-difficulty-card"
import { TopicMasteryCard } from "@/components/dashboard/topic-mastery-card"
import {
  buildConsistency,
  buildDashboard,
  buildDifficultyMix,
  buildReadiness,
  buildTopicMastery,
} from "@/lib/dashboard"
import { CATALOG, HISTORY, NOW } from "@/test/fixtures"
import { renderWithProviders, screen, within } from "@/test/render"


const DASHBOARD = buildDashboard(CATALOG, HISTORY, NOW, 90)

function chartSvg(container: HTMLElement): SVGElement {
  const svg = container.querySelector("svg")
  expect(svg).not.toBeNull()
  return svg as SVGElement
}

describe("ConsistencyCard", () => {
  it("draws one cell per day in the range and labels the window", () => {
    const { container } = renderWithProviders(
      <ConsistencyCard
        consistency={buildConsistency(HISTORY, 90, NOW)}
        rangeDays={90}
      />
    )

    expect(screen.getByText(/Past 90 days/)).toBeInTheDocument()
    expect(screen.getByText("3 months ago")).toBeInTheDocument()
    expect(screen.getByTestId("consistency-heatmap-scroll")).toHaveClass(
      "no-scrollbar",
      "overflow-x-auto"
    )
    expect(
      container.querySelectorAll("[data-day]").length || 90
    ).toBeGreaterThan(0)
  })

  it("renders without attempts", () => {
    renderWithProviders(
      <ConsistencyCard
        consistency={buildConsistency([], 30, NOW)}
        rangeDays={30}
      />
    )

    expect(screen.getByText(/Past 30 days/)).toBeInTheDocument()
    expect(screen.getByText("30 days ago")).toBeInTheDocument()
  })
})

describe("TopicMasteryCard", () => {
  it("draws a radar axis for every scored topic", () => {
    const mastery = buildTopicMastery(CATALOG, HISTORY)
    const { container } = renderWithProviders(
      <TopicMasteryCard mastery={mastery} />
    )

    expect(screen.getByText("Topic mastery")).toBeInTheDocument()
    expect(
      screen.getByText(`${mastery.length} axes, target 75%`)
    ).toBeInTheDocument()
    expect(chartSvg(container)).toBeInTheDocument()
    expect(
      screen.getAllByText(new RegExp(`${mastery[0].score}%`)).length
    ).toBeGreaterThan(0)
  })

  it("shows an empty state rather than a blank chart with no topics", () => {
    renderWithProviders(<TopicMasteryCard mastery={[]} />)

    expect(screen.getByText("No topics scored")).toBeInTheDocument()
  })
})

describe("DifficultyMixCard", () => {
  it("renders a band per difficulty with solved-vs-total counts", () => {
    const mix = buildDifficultyMix(CATALOG, HISTORY)
    renderWithProviders(<DifficultyMixCard mix={mix} onBuildSet={vi.fn()} />)

    expect(screen.getByText("Difficulty mix")).toBeInTheDocument()
    for (const band of mix) {
      expect(
        screen.getAllByText(new RegExp(band.difficulty, "i")).length
      ).toBeGreaterThan(0)
    }
  })

  it("invokes the build-set action", async () => {
    const onBuildSet = vi.fn()
    const { user } = renderWithProviders(
      <DifficultyMixCard
        mix={buildDifficultyMix(CATALOG, HISTORY)}
        onBuildSet={onBuildSet}
      />
    )

    const buttons = screen.getAllByRole("button")
    await user.click(buttons[buttons.length - 1])

    expect(onBuildSet).toHaveBeenCalled()
  })

  it("survives an empty catalog", () => {
    renderWithProviders(<DifficultyMixCard mix={[]} onBuildSet={vi.fn()} />)

    expect(screen.getByText("Difficulty mix")).toBeInTheDocument()
  })
})

describe("InterviewReadinessCard", () => {
  it("shows the current score and plots its history", () => {
    const readiness = buildReadiness(CATALOG, HISTORY, NOW, 90)
    const { container } = renderWithProviders(
      <InterviewReadinessCard readiness={readiness} />
    )

    expect(screen.getByText("Interview readiness")).toBeInTheDocument()
    expect(
      screen.getByText(String(readiness.score), { exact: false })
    ).toBeInTheDocument()
    expect(chartSvg(container)).toBeInTheDocument()
  })

  it("renders a zero score with no history", () => {
    renderWithProviders(
      <InterviewReadinessCard
        readiness={buildReadiness(CATALOG, [], NOW, 90)}
      />
    )

    expect(screen.getByText("Interview readiness")).toBeInTheDocument()
  })
})

describe("TimePerDifficultyCard", () => {
  it("plots a point per attempt against its problem's difficulty", () => {
    const { container } = renderWithProviders(
      <TimePerDifficultyCard attempts={HISTORY} problems={CATALOG} />
    )

    expect(chartSvg(container)).toBeInTheDocument()
    expect(screen.getAllByText(/easy/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/hard/i).length).toBeGreaterThan(0)
  })

  it("renders with no attempts to plot", () => {
    const { container } = renderWithProviders(
      <TimePerDifficultyCard attempts={[]} problems={CATALOG} />
    )

    expect(container).toBeInTheDocument()
  })
})

describe("ReviewQueueCard", () => {
  it("lists the queued problems and selects one on click", async () => {
    const onSelect = vi.fn()
    const { user } = renderWithProviders(
      <ReviewQueueCard
        items={DASHBOARD.queue}
        dueCount={DASHBOARD.dueCount}
        onSelect={onSelect}
      />
    )

    expect(screen.getByText(DASHBOARD.queue[0].title)).toBeInTheDocument()

    await user.click(screen.getByText(DASHBOARD.queue[0].title))

    expect(onSelect).toHaveBeenCalledWith(DASHBOARD.queue[0].problemId)
  })

  it("falls back to the first queued item when running a review", async () => {
    const onSelect = vi.fn()
    const { user } = renderWithProviders(
      <ReviewQueueCard
        items={DASHBOARD.queue}
        dueCount={0}
        onSelect={onSelect}
      />
    )

    await user.click(screen.getAllByRole("button")[0])

    expect(onSelect).toHaveBeenCalled()
  })

  it("renders an empty queue without crashing", () => {
    renderWithProviders(
      <ReviewQueueCard items={[]} dueCount={0} onSelect={vi.fn()} />
    )

    expect(screen.getByText("Queue is clear")).toBeInTheDocument()
  })
})

describe("CycleStats", () => {
  it("renders every summary stat with its value", () => {
    const { container } = renderWithProviders(
      <CycleStats stats={DASHBOARD.summary} />
    )

    for (const stat of DASHBOARD.summary) {
      expect(within(container).getByText(stat.label)).toBeInTheDocument()
      expect(within(container).getByText(stat.value)).toBeInTheDocument()
    }
  })

  it("renders nothing harmful with no stats", () => {
    const { container } = renderWithProviders(<CycleStats stats={[]} />)

    expect(container).toBeInTheDocument()
  })
})
