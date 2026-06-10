import { describe, expect, it } from "vitest"

import { buildAiReviewPrompt } from "@/lib/ai-review-export"
import { interpolatePromptTemplate } from "@/lib/prompt-templates"
import {
  DEFAULT_SESSION_OPTIONS,
  buildSessionPayload,
  toJson,
  type SessionContext,
} from "@/lib/session-prompt"
import { buildTopicFocuses } from "@/lib/dashboard"
import {
  CATALOG,
  HISTORY,
  NOW,
  makeAttempt,
  makeProblem,
} from "@/test/fixtures"

const CONTEXT: SessionContext = {
  readinessScore: 62,
  streak: 4,
  targetScore: 75,
  targetMinutes: 45,
}

describe("interpolatePromptTemplate", () => {
  it("substitutes named tokens, with or without inner spacing", () => {
    expect(
      interpolatePromptTemplate("{{topic}} in {{ minutes }} minutes", {
        topic: "Graphs",
        minutes: 60,
      })
    ).toBe("Graphs in 60 minutes")
  })

  it("leaves an unknown token untouched rather than printing undefined", () => {
    expect(
      interpolatePromptTemplate("{{topic}} / {{missing}}", { topic: "DP" })
    ).toBe("DP / {{missing}}")
  })

  it("returns a template with no tokens unchanged", () => {
    expect(interpolatePromptTemplate("plain text", {})).toBe("plain text")
  })
})

describe("buildSessionPayload", () => {
  const focus = buildTopicFocuses(CATALOG, HISTORY, NOW)[0]

  it("includes only completed problems from the selected topic", () => {
    const problems = [
      makeProblem({ id: 10, title: "Completed Array", topics: ["Array"] }),
      makeProblem({ id: 11, title: "Unanswered Array", topics: ["Array"] }),
      makeProblem({ id: 12, title: "Completed Graph", topics: ["Graph"] }),
    ]
    const attempts = [
      makeAttempt({ problemId: 10 }),
      makeAttempt({ problemId: 12 }),
    ]
    const arrayFocus = buildTopicFocuses(problems, attempts, NOW).find(
      (entry) => entry.topic === "Array"
    )

    expect(arrayFocus).toBeDefined()
    const payload = buildSessionPayload(arrayFocus!, CONTEXT)
    const serialized = JSON.stringify(payload)

    expect(payload.completedProblems.map((problem) => problem.title)).toEqual([
      "Completed Array",
    ])
    expect(serialized).not.toContain("Unanswered Array")
    expect(serialized).not.toContain("Completed Graph")
    expect(payload).not.toHaveProperty("unattempted")
  })

  it("carries the topic context the study card shows", () => {
    const payload = buildSessionPayload(focus, CONTEXT)

    expect(payload.topic).toBe(focus.topic)
    expect(payload.mastery).toEqual({ score: focus.score, target: 75 })
    expect(payload.coverage.total).toBe(focus.problemCount)
    expect(payload.readinessScore).toBe(62)
    expect(payload.streakDays).toBe(4)
    expect(payload.request).toEqual({
      minutes: DEFAULT_SESSION_OPTIONS.minutes,
      problemCount: DEFAULT_SESSION_OPTIONS.problemCount,
    })
  })

  it("withholds notes unless they are explicitly opted in", () => {
    const withheld = buildSessionPayload(focus, CONTEXT, {
      ...DEFAULT_SESSION_OPTIONS,
      includeNotes: false,
    })
    const shared = buildSessionPayload(focus, CONTEXT, {
      ...DEFAULT_SESSION_OPTIONS,
      includeNotes: true,
    })

    expect(
      withheld.completedProblems.every((problem) => problem.notes === "")
    ).toBe(true)
    expect(shared.completedProblems.length).toBe(
      withheld.completedProblems.length
    )
  })

  it("serializes to JSON carrying an interpolated task", () => {
    const payload = buildSessionPayload(focus, CONTEXT)
    const parsed = JSON.parse(
      toJson(
        payload,
        "Give me {{problem_count}} on {{topic}}, readiness {{readiness}}."
      )
    )

    expect(parsed.task).toBe(
      `Give me ${payload.request.problemCount} on ${payload.topic}, readiness 62%.`
    )
    expect(parsed.topic).toBe(payload.topic)
  })

  it("falls back to a built-in task before a template loads", () => {
    const parsed = JSON.parse(toJson(buildSessionPayload(focus, CONTEXT)))

    expect(parsed.task).toContain(focus.topic)
    expect(parsed.task.length).toBeGreaterThan(0)
  })

  it("uses a clean fallback when the selected topic has no completed problems", () => {
    const unanswered = makeProblem({
      id: 20,
      title: "Never Answered",
      topics: ["Dynamic Programming"],
    })
    const emptyFocus = buildTopicFocuses([unanswered], [], NOW)[0]
    const parsed = JSON.parse(toJson(buildSessionPayload(emptyFocus, CONTEXT)))

    expect(parsed.completedProblems).toEqual([])
    expect(parsed.task).toContain(
      "I have no completed problems in Dynamic Programming yet."
    )
    expect(JSON.stringify(parsed)).not.toContain("Never Answered")
  })

  it("still applies a Settings template to the no-history fallback", () => {
    const emptyFocus = buildTopicFocuses(
      [makeProblem({ id: 21, topics: ["Trees"] })],
      [],
      NOW
    )[0]
    const parsed = JSON.parse(
      toJson(
        buildSessionPayload(emptyFocus, CONTEXT),
        "CUSTOM: plan {{problem_count}} for {{topic}} at {{readiness}}."
      )
    )

    expect(parsed.task).toContain("I have no completed problems in Trees yet.")
    expect(parsed.task).toContain("CUSTOM: plan 3 for Trees at 62%.")
  })
})

describe("buildAiReviewPrompt", () => {
  const problem = CATALOG[0]

  it("includes the problem, the attempt, and the written notes", () => {
    const prompt = buildAiReviewPrompt({
      problem,
      attempt: makeAttempt({
        problemId: 1,
        durationMinutes: 95,
        outcome: "hint",
        effort: "heavy",
        blocker: "edge-cases",
        notes: "Missed the empty-array case.",
      }),
    })

    expect(prompt).toContain("#1 Two Sum")
    expect(prompt).toContain("Array, Hash Table")
    expect(prompt).toContain("1h 35m")
    expect(prompt).toContain("Hint")
    expect(prompt).toContain("Heavy")
    expect(prompt).toContain("Edge cases")
    expect(prompt).toContain("Missed the empty-array case.")
  })

  it("says plainly when nothing was written or recorded", () => {
    const prompt = buildAiReviewPrompt({
      problem,
      attempt: makeAttempt({ notes: "  " }),
    })

    expect(prompt).toContain("No written notes were recorded.")
    expect(prompt).toContain("No audio memo was recorded for this attempt.")
  })

  it("embeds the transcript when one exists", () => {
    const prompt = buildAiReviewPrompt({
      problem,
      attempt: makeAttempt({ audioUrl: "/api/v1/recordings/r-1/content" }),
      transcript: "I started with the brute force.",
    })

    expect(prompt).toContain("## Audio memo transcript")
    expect(prompt).toContain("I started with the brute force.")
  })

  it("explains that a transcript is still processing", () => {
    const prompt = buildAiReviewPrompt({
      problem,
      attempt: makeAttempt({ audioUrl: "/api/v1/recordings/r-1/content" }),
      transcriptStatus: "processing",
    })

    expect(prompt).toContain("still processing")
  })

  it("uses a custom template for the instructions when given one", () => {
    const prompt = buildAiReviewPrompt({
      problem,
      attempt: makeAttempt({ outcome: "failed", notes: "Ran out of ideas." }),
      template:
        "Review {{problem_title}} ({{difficulty}}) — I got {{outcome}}.",
    })

    expect(prompt).toContain("Review Two Sum (easy) — I got Failed.")
    expect(prompt).not.toContain("constructive technical-interview coach")
  })
})
