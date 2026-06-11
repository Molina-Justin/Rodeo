import {
  BLOCKER_LABELS,
  EFFORT_LABELS,
  OUTCOME_LABELS,
  formatDuration,
} from "@/lib/attempts"
import { interpolatePromptTemplate } from "@/lib/prompt-templates"
import type { CandidateGoals } from "@/lib/session-prompt"
import type { Attempt, Problem } from "@/types"

interface AiReviewExportInput {
  problem: Problem
  attempt: Attempt
  transcript?: string | null
  transcriptStatus?: Attempt["transcriptionStatus"]
  template?: string
  /** Interview Goals from Settings, when the candidate has filled them in. */
  candidateGoals?: CandidateGoals | null
}

function attemptDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

/** A ready-to-paste prompt for getting feedback on one saved attempt. */
export function buildAiReviewPrompt({
  problem,
  attempt,
  transcript,
  transcriptStatus,
  template,
  candidateGoals,
}: AiReviewExportInput): string {
  const templateUsesGoals =
    template !== undefined &&
    ["{{target_role}}", "{{target_date}}", "{{years_experience}}"].some(
      (variable) => template.includes(variable)
    )
  const hasGoals =
    candidateGoals &&
    (candidateGoals.targetRole ||
      candidateGoals.targetDate ||
      candidateGoals.yearsExperience !== null)
  const goalsSection =
    hasGoals && !templateUsesGoals
      ? `\n## Candidate profile\n\n- **Target role:** ${candidateGoals.targetRole || "Not specified"}\n- **Target timeline:** ${candidateGoals.targetDate || "Not specified"}\n- **Years of experience:** ${candidateGoals.yearsExperience ?? "Not specified"}\n`
      : ""

  const audioSection = attempt.audioUrl
    ? transcript?.trim()
      ? `## Audio memo transcript\n\n${transcript.trim()}\n\n> The original audio memo is attached separately. Use it to catch context or tone that the transcript misses.`
      : transcriptStatus === "queued" || transcriptStatus === "processing"
        ? "## Audio memo\n\nThe original audio memo is attached separately. Its transcript is still processing, so please review the audio directly."
        : "## Audio memo\n\nThe original audio memo is attached separately. Please review it directly; no transcript is available."
    : "## Audio memo\n\nNo audio memo was recorded for this attempt."

  const instructions = template
    ? interpolatePromptTemplate(template, {
        problem_title: problem.title,
        difficulty: problem.difficulty,
        outcome: OUTCOME_LABELS[attempt.outcome],
        notes: attempt.notes.trim() || "No written notes were recorded.",
        transcript: transcript?.trim() || "No transcript is available.",
        target_role: candidateGoals?.targetRole || "Not specified",
        target_date: candidateGoals?.targetDate || "Not specified",
        years_experience: candidateGoals?.yearsExperience ?? "Not specified",
      })
    : `Please act as a constructive technical-interview coach. Review this attempt without immediately giving me a full solution. First assess my reasoning from the notes and audio memo, then give targeted hints and concrete next steps. Focus on correctness, algorithm choice, complexity, edge cases, implementation risks, and how I communicated my thinking. Point out what I did well too.

Feedback I want:
1. Summarize the approach you think I took and identify any gaps in my reasoning.
2. Evaluate correctness and likely time/space complexity.
3. List the most important edge cases or failure modes I should test.
4. Give me the smallest useful hint or exercise to improve, before showing a complete solution.
5. Suggest how I could explain this more clearly in a real interview.`

  return `# Interview-practice attempt review

${instructions}

## Problem

- **Title:** #${problem.id} ${problem.title}
- **Difficulty:** ${problem.difficulty}
- **Topics:** ${problem.topics.length ? problem.topics.join(", ") : "Not tagged"}
- **Acceptance rate:** ${problem.acceptance}%

## Attempt details

- **Completed:** ${attemptDate(attempt.completedAt)}
- **Time spent:** ${formatDuration(attempt.durationMinutes)}
- **Outcome:** ${OUTCOME_LABELS[attempt.outcome]}
- **Effort:** ${EFFORT_LABELS[attempt.effort]}
- **Sticking point:** ${BLOCKER_LABELS[attempt.blocker]}

## My notes

${attempt.notes.trim() || "No written notes were recorded."}

${audioSection}
${goalsSection}`
}
