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
  candidateGoals?: CandidateGoals | null
}

function attemptDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

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
        : "## Audio memo\n\nThe original audio memo is attached separately. Please review it directly. No transcript is available."
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
    : `Review this technical interview attempt. Do not give the full solution right away. Start by evaluating the reasoning in my notes and audio memo. Then give focused hints and practical next steps. Cover correctness, algorithm choice, complexity, edge cases, implementation risks, and communication. Include what went well.

Feedback I want:
1. Summarize my approach and identify gaps in the reasoning.
2. Evaluate correctness and likely time/space complexity.
3. List the most important edge cases to test.
4. Give one useful hint or exercise before showing a complete solution.
5. Explain how I could present the approach more clearly in an interview.`

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
