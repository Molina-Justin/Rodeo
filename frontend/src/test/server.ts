import { HttpResponse, http, type HttpHandler } from "msw"
import { setupServer } from "msw/node"

import { CATALOG, HISTORY, NOW } from "@/test/fixtures"
import type { Attempt, Problem } from "@/types"


interface TranscriptionRecord {
  id: string
  recording_id: string
  status: "queued" | "processing" | "completed" | "failed"
  raw_text: string | null
  corrected_text: string | null
  error_message: string | null
}

interface InterviewGoalsRecord {
  target_role: string
  target_date: string
  years_experience: number | null
}

interface Store {
  problems: Problem[]
  attempts: Attempt[]
  transcriptions: Map<string, TranscriptionRecord>
  interviewGoals: InterviewGoalsRecord
}

const ORIGIN = "http://localhost:5199"

function route(path: string): string {
  return `${ORIGIN}${path}`
}

const EMPTY_INTERVIEW_GOALS: InterviewGoalsRecord = {
  target_role: "",
  target_date: "",
  years_experience: null,
}

export const store: Store = {
  problems: [],
  attempts: [],
  transcriptions: new Map(),
  interviewGoals: { ...EMPTY_INTERVIEW_GOALS },
}

export function seed(options: Partial<Store> = {}): void {
  store.problems = options.problems ?? CATALOG.map((row) => ({ ...row }))
  store.attempts = options.attempts ?? HISTORY.map((row) => ({ ...row }))
  store.transcriptions = options.transcriptions ?? new Map()
  store.interviewGoals = options.interviewGoals ?? { ...EMPTY_INTERVIEW_GOALS }
}

export function resetStore(): void {
  store.problems = []
  store.attempts = []
  store.transcriptions = new Map()
  store.interviewGoals = { ...EMPTY_INTERVIEW_GOALS }
}

const OUTCOME_STATUS: Record<Attempt["outcome"], Problem["status"]> = {
  optimal: "solved",
  hint: "review",
  solution: "struggling",
  failed: "struggling",
}

function attemptsFor(problemId: number): Attempt[] {
  return store.attempts
    .filter((attempt) => attempt.problemId === problemId)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
}

function toAttemptResponse(attempt: Attempt) {
  return {
    id: attempt.id,
    problem_id: attempt.problemId,
    practice_session_id: null,
    completed_at: attempt.completedAt,
    duration_seconds: attempt.durationMinutes * 60,
    outcome: attempt.outcome,
    effort: attempt.effort,
    blocker: attempt.blocker,
    notes: attempt.notes,
    recording_id: attempt.recordingId ?? null,
    transcription_id: attempt.transcriptionId ?? null,
    transcription_status: attempt.transcriptionStatus ?? null,
    has_audio: Boolean(attempt.audioUrl ?? attempt.recordingId),
    has_transcript: Boolean(attempt.hasTranscript),
    created_at: attempt.completedAt,
    updated_at: attempt.completedAt,
  }
}

function toProblemListItem(problem: Problem) {
  const history = attemptsFor(problem.id)
  const latest = history[0]
  return {
    id: problem.id,
    title: problem.title,
    slug: problem.slug,
    difficulty: problem.difficulty,
    premium: problem.premium,
    acceptance: problem.acceptance,
    active: true,
    topics: problem.topics,
    status: latest ? OUTCOME_STATUS[latest.outcome] : "not-started",
    attempt_count: history.length,
    last_attempt: latest
      ? {
          id: latest.id,
          completed_at: latest.completedAt,
          duration_seconds: latest.durationMinutes * 60,
          outcome: latest.outcome,
          effort: latest.effort,
          blocker: latest.blocker,
        }
      : null,
    best_duration_seconds: history.length
      ? Math.min(...history.map((row) => row.durationMinutes)) * 60
      : null,
    due_at: null,
    has_notes: history.some((row) => row.notes.trim() !== ""),
    has_audio: history.some((row) => Boolean(row.audioUrl ?? row.recordingId)),
    has_transcript: history.some((row) => Boolean(row.hasTranscript)),
  }
}

export const handlers: HttpHandler[] = [
  http.get(route("/api/v1/problems"), ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get("page") ?? 1)
    const pageSize = Number(url.searchParams.get("page_size") ?? 50)
    const difficulty = url.searchParams.get("difficulty")
    const access = url.searchParams.get("access") ?? "all"
    const search = url.searchParams.get("search")?.toLowerCase() ?? ""

    const matching = store.problems.filter((problem) => {
      if (difficulty && problem.difficulty !== difficulty) return false
      if (access === "free" && problem.premium) return false
      if (access === "premium" && !problem.premium) return false
      if (search && !problem.title.toLowerCase().includes(search)) return false
      return true
    })

    const start = (page - 1) * pageSize
    return HttpResponse.json({
      items: matching.slice(start, start + pageSize).map(toProblemListItem),
      page,
      page_size: pageSize,
      total: matching.length,
      page_count: Math.max(1, Math.ceil(matching.length / pageSize)),
    })
  }),

  http.get(route("/api/v1/problems/:problemId"), ({ params }) => {
    const problem = store.problems.find(
      (row) => row.id === Number(params.problemId)
    )
    if (!problem) {
      return HttpResponse.json({ detail: "Problem not found" }, { status: 404 })
    }
    return HttpResponse.json({
      ...toProblemListItem(problem),
      catalog_updated_at: null,
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
    })
  }),

  http.get(route("/api/v1/attempts"), ({ request }) => {
    const url = new URL(request.url)
    const problemId = url.searchParams.get("problem_id")
    const offset = Number(url.searchParams.get("offset") ?? 0)
    const limit = Number(url.searchParams.get("limit") ?? 200)

    const matching = (
      problemId ? attemptsFor(Number(problemId)) : [...store.attempts]
    ).sort((a, b) => b.completedAt.localeCompare(a.completedAt))

    return HttpResponse.json({
      items: matching.slice(offset, offset + limit).map(toAttemptResponse),
      total: matching.length,
      offset,
      limit,
    })
  }),

  http.get(
    route("/api/v1/problems/:problemId/attempts"),
    ({ params, request }) => {
      const url = new URL(request.url)
      const offset = Number(url.searchParams.get("offset") ?? 0)
      const limit = Number(url.searchParams.get("limit") ?? 200)
      const matching = attemptsFor(Number(params.problemId))
      return HttpResponse.json({
        items: matching.slice(offset, offset + limit).map(toAttemptResponse),
        total: matching.length,
        offset,
        limit,
      })
    }
  ),

  http.post(
    route("/api/v1/problems/:problemId/attempts"),
    async ({ params, request }) => {
      const body = (await request.json()) as Record<string, never>
      const attempt: Attempt = {
        id: `created-${store.attempts.length + 1}`,
        problemId: Number(params.problemId),
        completedAt: String(body.completed_at),
        durationMinutes: Math.round(Number(body.duration_seconds) / 60),
        outcome: body.outcome,
        effort: body.effort,
        blocker: body.blocker,
        notes: String(body.notes ?? ""),
      }
      store.attempts.push(attempt)
      return HttpResponse.json(toAttemptResponse(attempt), { status: 201 })
    }
  ),

  http.patch(
    route("/api/v1/attempts/:attemptId"),
    async ({ params, request }) => {
      const body = (await request.json()) as Record<string, never>
      const attempt = store.attempts.find((row) => row.id === params.attemptId)
      if (!attempt) {
        return HttpResponse.json(
          { detail: "Attempt not found" },
          { status: 404 }
        )
      }
      if (body.outcome) attempt.outcome = body.outcome
      if (body.effort) attempt.effort = body.effort
      if (body.blocker) attempt.blocker = body.blocker
      if (body.notes !== undefined) attempt.notes = String(body.notes)
      if (body.duration_seconds) {
        attempt.durationMinutes = Math.round(Number(body.duration_seconds) / 60)
      }
      return HttpResponse.json(toAttemptResponse(attempt))
    }
  ),

  http.delete(route("/api/v1/attempts/:attemptId"), ({ params }) => {
    store.attempts = store.attempts.filter((row) => row.id !== params.attemptId)
    return new HttpResponse(null, { status: 204 })
  }),

  http.delete(route("/api/v1/attempts/:attemptId/recording"), ({ params }) => {
    const attempt = store.attempts.find((row) => row.id === params.attemptId)
    if (attempt) {
      delete attempt.audioUrl
      delete attempt.recordingId
      delete attempt.transcriptionId
      delete attempt.transcriptionStatus
      attempt.hasTranscript = false
    }
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(route("/api/v1/attempts/:attemptId/transcription"), ({ params }) => {
    const record = store.transcriptions.get(String(params.attemptId))
    if (!record) {
      return HttpResponse.json(
        { detail: "Transcription not found" },
        { status: 404 }
      )
    }
    return HttpResponse.json(record)
  }),

  http.post(
    route("/api/v1/attempts/:attemptId/transcription"),
    ({ params }) => {
      const attemptId = String(params.attemptId)
      const existing = store.transcriptions.get(attemptId)
      if (existing) {
        return HttpResponse.json(existing)
      }
      const record: TranscriptionRecord = {
        id: `transcription-${attemptId}`,
        recording_id: `recording-${attemptId}`,
        status: "queued",
        raw_text: null,
        corrected_text: null,
        error_message: null,
      }
      store.transcriptions.set(attemptId, record)
      return HttpResponse.json(record)
    }
  ),

  http.patch(
    "/api/v1/attempts/:attemptId/transcription",
    async ({ params, request }) => {
      const body = (await request.json()) as { corrected_text: string }
      const record = store.transcriptions.get(String(params.attemptId))
      if (!record) {
        return HttpResponse.json(
          { detail: "Transcription not found" },
          { status: 404 }
        )
      }
      record.corrected_text = body.corrected_text
      return HttpResponse.json(record)
    }
  ),

  http.post(
    route("/api/v1/attempts/:attemptId/transcription/retry"),
    ({ params }) => {
      const record = store.transcriptions.get(String(params.attemptId))
      if (!record) {
        return HttpResponse.json(
          { detail: "Transcription not found" },
          { status: 404 }
        )
      }
      record.status = "queued"
      record.error_message = null
      return HttpResponse.json(record)
    }
  ),

  http.get(route("/api/v1/capabilities"), () =>
    HttpResponse.json({
      transcription: { available: true, provider: "faster-whisper" },
    })
  ),

  http.get(route("/api/v1/settings/prompt-templates"), () =>
    HttpResponse.json({
      session_template:
        "Pick {{problem_count}} problems for a {{minutes}}-minute session on {{topic}}.",
      review_template: "Review {{problem_title}}.",
    })
  ),

  http.get(route("/api/v1/settings/interview-goals"), () =>
    HttpResponse.json(store.interviewGoals)
  ),

  http.put(route("/api/v1/settings/interview-goals"), async ({ request }) => {
    const body = (await request.json()) as InterviewGoalsRecord
    store.interviewGoals = body
    return HttpResponse.json(store.interviewGoals)
  }),
]

export const server = setupServer(...handlers)
