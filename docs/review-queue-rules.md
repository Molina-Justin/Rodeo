# Review Queue Rules

## Purpose

The review queue schedules **retrieval practice**, not repeated exposure. A
problem returns only after enough time has passed for recalling its approach to
be useful. This applies the spacing and testing effects: distributed retrieval
practice is more durable than immediate re-study, and the useful gap grows with
the desired retention horizon.[^distributed-practice][^testing-effect]

This is intentionally a deterministic, history-replayable policy. It is a
better product fit than adopting a trained memory model before Rodeo has enough
of one user's review data. FSRS is the future upgrade path: its target
retention controls the trade-off between recall and daily review volume, and it
can be personalized from review history.[^fsrs][^fsrs-retention]

## Terms

- **Attempt:** a completed problem session. Its outcome, duration, and date are
  recorded.
- **Clean and quick:** `outcome = optimal` (solved independently, without a
  hint) and `duration_minutes <= target_minutes` for the problem difficulty.
- **Lapse:** `outcome = solution` or `failed`. Looking up the solution is a
  lapse because the solution was not retrieved independently.
- **Due date:** the local calendar date on which an active problem enters the
  queue. Due dates use `RODEO_TIMEZONE`, not rolling 24-hour windows.
- **Graduated:** excluded from the automatic queue. It remains in history and
  can re-enter only after a later non-clean attempt.

## Target time

The target is deliberately broad: it measures whether the approach was
available promptly, not whether a user typed at contest speed.

| Difficulty | Target minutes |
| --- | ---: |
| Easy | 20 |
| Medium | 30 |
| Hard | 45 |

The stored duration is compared with the target. The self-reported difficulty
field is retained for analytics; it does not change scheduling in v1.

## Scheduling rules

### 1. Every completion gets a cooldown

The first logged attempt creates an active review state with `interval = 1
day`. It is therefore never due again on the same local calendar day. Any
attempt logged before its scheduled due date is voluntary practice; it must not
make the problem appear again earlier than its existing due date.

### 2. Each attempt is classified

| Class | Condition | Next interval |
| --- | --- | --- |
| Lapse | Used/reviewed solution or did not finish | `1 day` |
| Assisted recall | Used a hint | `max(2, round(previous_interval × 0.7))` days |
| Independent, not quick | Solved independently but exceeded its target | `max(3, round(previous_interval × 1.8))` days |
| Clean and quick | Solved independently within its target | `max(3, round(previous_interval × 2.5))` days |

For a first attempt, `previous_interval = 1`. `round` is ordinary half-up
rounding, and the interval cap is 365 days. The next due date is the completion
date plus the calculated interval. An early successful attempt leaves its
existing due date unchanged; an early hint may pull the date earlier, and an
early lapse resets it to the next day. This preserves the spacing benefit while
still responding quickly to evidence that recall was incomplete.

The clean-and-quick path therefore grows approximately as `1 → 3 → 8 → 20`.
It gives a new solve a one-day cooldown, then asks for increasingly convincing
evidence before removing the problem from routine review.

### 3. A problem graduates only on demonstrated retention

A problem graduates when all of these are true after an attempt:

1. The current attempt is clean and quick.
2. It has **four consecutive** clean-and-quick attempts.
3. At least the last three of those attempts were taken on or after one day
   before their due date. This prevents several same-day attempts from
   simulating long-term retention.
4. The newly calculated interval is at least 20 days (the fourth clean review
   calculates a 50-day interval).

Graduation clears `next_due_on` and removes the problem from automatic queue
and badge counts. It does not delete the review state or attempt history.

### 4. A graduated problem can return

A later manual attempt on a graduated problem reactivates it when it is not
clean and quick:

- a lapse schedules a one-day review;
- a hint or slow independent solve schedules the matching interval from the
  table, beginning from one day;
- a clean-and-quick manual solve keeps it graduated.

This protects the promise that reliable, fast independent solves leave the
queue, while still allowing a real regression to be captured.

### 5. Queue membership and ordering

- Active problems appear when `due_on <= today`.
- Sort overdue items first by oldest due date, then items due today, then by
  larger lapse count and lower interval. This surfaces fragile knowledge first.
- Future items are shown only in the queue's planning view; they do not count
  toward the sidebar badge.
- A skipped item remains due. Skipping only moves the UI selection; it does not
  reschedule the problem.

## Required derived state

`review_state` should remain a cache replayed from immutable attempts and carry
the engine version. The v1 engine needs these derived fields:

- `interval_days`, `next_due_on`, `lapses`, and `clean_quick_streak`
- `graduated` and `graduated_at`

Each new attempt also snapshots the problem difficulty and target minutes. The
remaining per-attempt decision details (the previous due date, classification,
and early/on-time flags) are replayed deterministically from that immutable
history, so a stale review-state cache can always be rebuilt.

No browser storage, randomness, or clock access belongs in the scheduling
function. The caller supplies `now` and the configured timezone. Every write
replays/recomputes the state inside the same database transaction.

## Future evolution to FSRS

Do not tune individual multipliers ad hoc. Once the user has at least 500
eligible, timestamped review events, evaluate an FSRS migration offline against
held-out history. Start with 90% desired retention, which FSRS documents as a
reasonable default; higher targets trade more reviews for better recall.[^fsrs]
Keep graduation as a product-level rule until user data demonstrates an equally
clear retention threshold.

## Implementation status

Policy v2 is implemented by the deterministic backend scheduler. The review
state cache is rebuilt automatically when its engine version is stale.

[^distributed-practice]: Cepeda et al., [Distributed practice in verbal recall tasks: A review and quantitative synthesis](https://pubmed.ncbi.nlm.nih.gov/16719566/).
[^testing-effect]: Binks, [Testing enhances learning: A review of the literature](https://pubmed.ncbi.nlm.nih.gov/29929801/).
[^fsrs]: Open Spaced Repetition, [FSRS tutorial](https://github.com/open-spaced-repetition/fsrs4anki/blob/main/docs/tutorial.md?plain=1).
[^fsrs-retention]: Open Spaced Repetition, [The optimal retention](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-optimal-retention).
