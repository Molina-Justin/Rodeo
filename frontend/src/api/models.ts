import type { components } from "@/api/schema"
import type { Attempt, Problem } from "@/types"

export type AttemptResponse = components["schemas"]["AttemptResponse"]
export type AttemptCreate = components["schemas"]["AttemptCreate"]
export type AttemptUpdate = components["schemas"]["AttemptUpdate"]
export type ProblemListItem = components["schemas"]["ProblemListItem"]
export type PracticeSessionResponse =
  components["schemas"]["PracticeSessionResponse"]

export function toProblem(problem: ProblemListItem): Problem {
  return {
    id: problem.id,
    title: problem.title,
    slug: problem.slug,
    difficulty: problem.difficulty,
    premium: problem.premium,
    acceptance: problem.acceptance,
    topics: problem.topics,
    status: problem.status,
    attemptCount: problem.attempt_count,
    hasNotes: problem.has_notes,
    hasAudio: problem.has_audio,
    hasTranscript: problem.has_transcript,
    lastAttempt: problem.last_attempt
      ? {
          id: problem.last_attempt.id,
          problemId: problem.id,
          completedAt: problem.last_attempt.completed_at,
          durationMinutes: Math.max(
            1,
            Math.round(problem.last_attempt.duration_seconds / 60)
          ),
          outcome: problem.last_attempt.outcome,
          effort: problem.last_attempt.effort,
          blocker: problem.last_attempt.blocker,
          notes: "",
        }
      : undefined,
  }
}

export function toAttempt(attempt: AttemptResponse): Attempt {
  return {
    id: attempt.id,
    problemId: attempt.problem_id,
    completedAt: attempt.completed_at,
    durationMinutes: Math.max(1, Math.round(attempt.duration_seconds / 60)),
    outcome: attempt.outcome,
    effort: attempt.effort,
    blocker: attempt.blocker,
    notes: attempt.notes,
    recordingId: attempt.recording_id ?? undefined,
    audioUrl: attempt.recording_id
      ? `/api/v1/recordings/${attempt.recording_id}/content`
      : undefined,
    transcriptionId: attempt.transcription_id ?? undefined,
    transcriptionStatus: attempt.transcription_status ?? undefined,
    hasTranscript: attempt.has_transcript,
  }
}
