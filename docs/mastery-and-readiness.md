# Mastery and Readiness

## Purpose

Topic Mastery and the Readiness Score answer different questions. Mastery asks
"how much of this topic have I actually solved?" Readiness asks "if the
interview were today, how would I do?" Readiness is therefore built *from*
Mastery rather than alongside it: it takes the same catalog-weighted signal,
enriches each attempt with difficulty and pace, and discounts it for problems
that have gone stale.

## Topic Mastery

The Topic Mastery chart measures evidence across distinct problems, using only
the latest result for each problem. Solved contributes 1, review 0.6,
struggling 0.25, and not-started 0. For topics with at least 50 catalog
problems, the denominator is 50; smaller topics use their full catalog size.

This makes mastery meaningful without making it unreachable in large topics:
two clean solves are 4%, 25 are 50%, and 38 are 76% (just over the 75% target).
Repeating one problem cannot manufacture breadth. The scheduling engine's
overall `mastery_score` remains full-catalog weighted and is a separate input
to readiness. See `backend/rodeo/services/scheduling.py`.

## Readiness Score

### The bug this replaces

The previous readiness formula blended four signals at near-equal weight:

| Signal | Weight | Definition |
| --- | ---: | --- |
| Coverage | 40% | `solved / catalogSize` |
| Mastery | 35% | `masteryScore(attempts, catalogSize)` |
| Activity | 15% | `activeDays / rangeDays` |
| Pace | 10% | `TARGET_MINUTES / averageDuration`, one flat target regardless of difficulty |

Coverage and Mastery are not independent signals. For a problem that goes from
unattempted to solved, both move by exactly `1 / catalogSize` in the same
direction. They are one underlying fact ("problems solved") counted twice
under different names, carrying 75% of the total weight between them. On a
catalog small enough for `1 / catalogSize` to be a meaningful step, such as a fresh
install, a curated subset, or a filtered view, that duplication turned a single
attempt into a double-digit swing. Pace compounded this on a per-difficulty
catalog by measuring every attempt against one flat target, so a fast Easy
solve looked slow and a slow Hard solve looked fine.

### The replacement

Readiness blends three signals, weighted so no single attempt can dominate:

| Signal | Weight | Definition |
| --- | ---: | --- |
| Discounted mastery | 70% | catalog-weighted average of `attempt_quality(latest attempt) × overdue_factor(problem)` |
| Coverage | 20% | `solved / catalogSize` |
| Cadence | 10% | `activeDaysInWindow / windowDays` |

Discounted mastery is now the dominant term instead of one of two ~40% terms
riding the same fact, which is what removes the duplication above.

#### Attempt quality

Each attempt's quality is on the same 0 to 1 scale mastery already uses, scaled
by difficulty and pace:

```
attempt_quality = STATUS_WEIGHT[outcome] × DIFFICULTY_WEIGHT[difficulty] × time_factor
```

| Difficulty | Weight |
| --- | ---: |
| Easy | 0.8 |
| Medium | 1.0 |
| Hard | 1.2 |

`time_factor = clamp(target_minutes / actual_minutes, 0.5, 1.0)`, using the
same per-difficulty target minutes as the review queue (20 / 30 / 45). Finishing
at or under target earns full credit; running over tapers credit down to a
0.5 floor rather than to zero. A correct, slow solve is still worth far more
than not solving it at all. Hint and solution usage are not a new axis: they
are already captured in `STATUS_WEIGHT`, the same place mastery reads them.

#### Overdue discount

A problem not yet due for review keeps full credit. One that is overdue
decays smoothly rather than dropping out. The attempt still counts, but its
value moves toward a floor of 0.4:

```
overdue_factor = 1                                     if not due, or not yet due
                = max(0.4, 14 / (14 + days_overdue))   otherwise
```

#### Cadence

The fraction of the dashboard's selected window (default 90 days) that
carried at least one attempt, unchanged from the previous "activity" term.

### Worked example

One clean, on-time Medium solve against a four-problem catalog, logged the
same day (not yet due):

- `attempt_quality = 1.0 (optimal) × 1.0 (medium) × 1.0 (on-time) = 1.0`
- `overdue_factor = 1.0` (not due)
- `discounted_mastery = min(1, 1.0 / 4) = 0.25`
- `coverage = 1 / 4 = 0.25`
- `cadence = 1 / 90`
- `score = round((0.25 × 0.7 + 0.25 × 0.2 + (1/90) × 0.1) × 100) = 23`

Compare against the old formula's `round(25×0.4 + 25×0.35 + 1.1×0.15 + 100×0.1)
= 29` for the same scenario. Against a 20-problem catalog, the old
formula jumped from 0 to 14 on the very first attempt while this one moves
from 0 to 3.

## Implementation

`attempt_quality` and `readiness_score` are pure functions in
`backend/rodeo/services/scheduling.py`, mirroring the engine-version
constraints the review queue already follows: no I/O, no randomness, callers
inject `now`. `readiness_score` is not cached in `review_state`. Like
`mastery_score`, it is recomputed on every `GET /api/v1/dashboard` from
attempt history, so there is nothing to invalidate.

`frontend/src/lib/dashboard.ts` carries a mirror of this formula
(`readinessAt`) for the dashboard views that still compute client-side ahead
of their move to the API response's `readiness_score` field. Keep the two in
sync until that cutover happens.
