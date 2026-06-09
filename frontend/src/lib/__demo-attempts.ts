import type { Attempt, AttemptBlocker, AttemptEffort, AttemptOutcome } from "@/types"

const OUTCOMES: AttemptOutcome[] = ["optimal", "hint", "solution", "failed"]
const EFFORTS: AttemptEffort[] = ["light", "moderate", "heavy", "brutal"]
const BLOCKERS: AttemptBlocker[] = ["none", "pattern", "edge-cases", "complexity", "implementation", "debugging", "time"]

const PROBLEM_IDS = [1, 2, 3, 4, 5, 11, 15, 20, 21, 23, 33, 42, 53, 62, 70, 76, 121, 139, 140, 141, 146, 155, 200, 206, 207, 208, 226, 236, 238, 253, 295, 297, 300, 322, 347, 424, 543, 704, 875, 1143]

let seed = 20260828
const rnd = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return (seed >>> 16) % 1000 / 1000
}

export function demoAttempts(): Attempt[] {
  const attempts: Attempt[] = []
  const now = new Date()

  for (let day = 89; day >= 0; day -= 1) {
    const roll = rnd()
    if (roll < 0.32) continue
    const sessions = roll > 0.85 ? 3 : roll > 0.6 ? 2 : 1

    for (let s = 0; s < sessions; s += 1) {
      const date = new Date(now)
      date.setDate(date.getDate() - day)
      date.setHours(9 + s * 3, 20, 0, 0)
      const pick = Math.floor(rnd() * PROBLEM_IDS.length)
      const outcomeRoll = rnd()
      attempts.push({
        id: `demo-${day}-${s}`,
        problemId: PROBLEM_IDS[pick],
        completedAt: date.toISOString(),
        durationMinutes: 14 + Math.round(rnd() * 52),
        outcome: outcomeRoll < 0.42 ? OUTCOMES[0] : outcomeRoll < 0.72 ? OUTCOMES[1] : outcomeRoll < 0.9 ? OUTCOMES[2] : OUTCOMES[3],
        effort: EFFORTS[Math.floor(rnd() * EFFORTS.length)],
        blocker: BLOCKERS[Math.floor(rnd() * BLOCKERS.length)],
        notes: "",
      })
    }
  }

  return attempts
}
