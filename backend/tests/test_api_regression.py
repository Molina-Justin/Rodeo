"""End-to-end regression coverage over the HTTP surface.

The other test modules exercise services directly with a frozen clock. This one
drives the real application the way the browser does -- migrations, the seeded
catalog, the origin check, and every router -- so a feature that breaks only
once the pieces are wired together still fails a test instead of a click.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

from rodeo.config import Settings

ORIGIN_HEADERS = {"Origin": "http://testserver"}
API = "/api/v1"

# Seeded catalog rows, chosen for a spread of difficulty and topic.
TWO_SUM = 1
ADD_TWO_NUMBERS = 2
LONGEST_SUBSTRING = 3


def log_attempt(
    client: TestClient,
    problem_id: int,
    *,
    idempotency_key: str,
    completed_at: datetime,
    outcome: str = "optimal",
    effort: str = "moderate",
    blocker: str = "none",
    duration_seconds: int = 900,
    notes: str = "",
) -> dict[str, Any]:
    response = client.post(
        f"{API}/problems/{problem_id}/attempts",
        json={
            "completed_at": completed_at.isoformat(),
            "duration_seconds": duration_seconds,
            "outcome": outcome,
            "effort": effort,
            "blocker": blocker,
            "notes": notes,
        },
        headers={**ORIGIN_HEADERS, "Idempotency-Key": idempotency_key},
    )
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def dashboard(client: TestClient, range_days: int | None = None) -> dict[str, Any]:
    params = {} if range_days is None else {"range_days": range_days}
    response = client.get(f"{API}/dashboard", params=params)
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def test_catalog_is_seeded_and_an_empty_dashboard_is_all_zeroes(
    client: TestClient,
) -> None:
    problems = client.get(f"{API}/problems", params={"page_size": 1})

    assert problems.status_code == 200
    assert problems.json()["total"] > 3_000

    body = dashboard(client)

    assert body["attempt_count"] == 0
    assert body["solved_count"] == 0
    assert body["logged_today"] == 0
    assert body["mastery_score"] == 0
    assert body["readiness_score"] == 0
    assert body["due_count"] == 0
    assert body["review_queue"] == []
    assert body["consistency"]["streak"] == 0
    assert body["consistency"]["minutes"] == 0
    # The heatmap is dense: every day in the range is present even at zero.
    assert len(body["consistency"]["days"]) == 90
    assert {day["activity_level"] for day in body["consistency"]["days"]} == {0}


def test_timed_session_finalizes_into_an_attempt_the_dashboard_counts(
    client: TestClient,
) -> None:
    started = client.post(
        f"{API}/practice-sessions",
        json={"problem_id": TWO_SUM},
        headers=ORIGIN_HEADERS,
    )
    assert started.status_code == 201, started.text
    session_id = started.json()["id"]
    assert started.json()["status"] == "active"

    current = client.get(f"{API}/practice-sessions/current")
    assert current.status_code == 200
    assert current.json()["id"] == session_id

    paused = client.post(
        f"{API}/practice-sessions/{session_id}/pause", headers=ORIGIN_HEADERS
    )
    assert paused.status_code == 200
    assert paused.json()["status"] == "paused"
    parked_ms = paused.json()["active_duration_ms"]

    # A paused clock does not advance, which is the whole point of the pause.
    still_parked = client.get(f"{API}/practice-sessions/current").json()
    assert still_parked["active_duration_ms"] == parked_ms

    resumed = client.post(
        f"{API}/practice-sessions/{session_id}/resume", headers=ORIGIN_HEADERS
    )
    assert resumed.status_code == 200
    assert resumed.json()["status"] == "active"

    stopped = client.post(
        f"{API}/practice-sessions/{session_id}/stop", headers=ORIGIN_HEADERS
    )
    assert stopped.status_code == 200
    assert stopped.json()["status"] == "awaiting_details"

    payload = {
        "duration_seconds": 26 * 60,
        "outcome": "optimal",
        "effort": "moderate",
        "blocker": "none",
        "notes": "Hash map in one pass.",
    }
    headers = {**ORIGIN_HEADERS, "Idempotency-Key": "regression-finalize"}
    finalized = client.post(
        f"{API}/practice-sessions/{session_id}/finalize", json=payload, headers=headers
    )
    assert finalized.status_code == 200, finalized.text
    assert finalized.json()["created"] is True
    attempt_id = finalized.json()["attempt"]["id"]
    assert finalized.json()["attempt"]["duration_seconds"] == 26 * 60

    # Replaying the same finalize must not double-count the attempt.
    replay = client.post(
        f"{API}/practice-sessions/{session_id}/finalize", json=payload, headers=headers
    )
    assert replay.status_code == 200
    assert replay.json()["created"] is False
    assert replay.json()["attempt"]["id"] == attempt_id

    assert client.get(f"{API}/practice-sessions/current").json() is None

    body = dashboard(client)
    assert body["attempt_count"] == 1
    assert body["solved_count"] == 1
    assert body["logged_today"] == 1
    assert body["consistency"]["streak"] == 1
    assert body["consistency"]["problem_count"] == 1

    detail = client.get(f"{API}/problems/{TWO_SUM}").json()
    assert detail["status"] == "solved"
    assert detail["attempt_count"] == 1
    assert detail["last_attempt"]["id"] == attempt_id
    assert detail["has_notes"] is True
    assert detail["due_at"] is not None


def test_attempt_history_edit_and_delete_rewrite_derived_state(
    client: TestClient,
) -> None:
    now = datetime.now(UTC)
    older = log_attempt(
        client,
        TWO_SUM,
        idempotency_key="history-1",
        completed_at=now - timedelta(days=4),
        outcome="failed",
        duration_seconds=2_400,
    )
    newer = log_attempt(
        client,
        TWO_SUM,
        idempotency_key="history-2",
        completed_at=now - timedelta(hours=2),
        outcome="optimal",
        duration_seconds=780,
    )

    history = client.get(f"{API}/problems/{TWO_SUM}/attempts").json()
    assert history["total"] == 2
    # Newest first, so the history panel reads top-down.
    assert [item["id"] for item in history["items"]] == [newer["id"], older["id"]]

    paged = client.get(
        f"{API}/problems/{TWO_SUM}/attempts", params={"offset": 1, "limit": 1}
    ).json()
    assert paged["total"] == 2
    assert [item["id"] for item in paged["items"]] == [older["id"]]

    solved = client.get(f"{API}/problems/{TWO_SUM}").json()
    assert solved["status"] == "solved"
    assert solved["best_duration_seconds"] == 780

    # Editing the latest attempt's outcome must replay the whole history.
    patched = client.patch(
        f"{API}/attempts/{newer['id']}",
        json={"outcome": "failed", "notes": "Blanked on the index math."},
        headers=ORIGIN_HEADERS,
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["outcome"] == "failed"

    relapsed = client.get(f"{API}/problems/{TWO_SUM}").json()
    assert relapsed["status"] == "struggling"
    assert relapsed["has_notes"] is True

    deleted = client.delete(f"{API}/attempts/{newer['id']}", headers=ORIGIN_HEADERS)
    assert deleted.status_code == 204

    # With only the original failure left the problem stays unsolved.
    after_delete = client.get(f"{API}/problems/{TWO_SUM}").json()
    assert after_delete["attempt_count"] == 1
    assert after_delete["last_attempt"]["id"] == older["id"]
    assert after_delete["status"] == "struggling"

    regone = client.delete(f"{API}/attempts/{newer['id']}", headers=ORIGIN_HEADERS)
    assert regone.status_code == 404

    final = client.delete(f"{API}/attempts/{older['id']}", headers=ORIGIN_HEADERS)
    assert final.status_code == 204

    # Deleting the last attempt clears the derived state entirely.
    reset = client.get(f"{API}/problems/{TWO_SUM}").json()
    assert reset["attempt_count"] == 0
    assert reset["status"] == "not-started"
    assert reset["last_attempt"] is None
    assert reset["due_at"] is None
    assert dashboard(client)["attempt_count"] == 0


def test_attempt_writes_are_idempotent_and_reject_a_changed_payload(
    client: TestClient,
) -> None:
    now = datetime.now(UTC)
    body = {
        "completed_at": now.isoformat(),
        "duration_seconds": 900,
        "outcome": "optimal",
        "effort": "moderate",
        "blocker": "none",
        "notes": "",
    }
    headers = {**ORIGIN_HEADERS, "Idempotency-Key": "double-submit"}

    first = client.post(
        f"{API}/problems/{TWO_SUM}/attempts", json=body, headers=headers
    )
    assert first.status_code == 201

    # A retried submit returns 200 with the original row, never a second attempt.
    second = client.post(
        f"{API}/problems/{TWO_SUM}/attempts", json=body, headers=headers
    )
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]

    conflicting = client.post(
        f"{API}/problems/{TWO_SUM}/attempts",
        json={**body, "duration_seconds": 60},
        headers=headers,
    )
    assert conflicting.status_code == 409

    assert client.get(f"{API}/problems/{TWO_SUM}/attempts").json()["total"] == 1


def test_review_queue_surfaces_due_work_and_matches_the_dashboard(
    client: TestClient,
) -> None:
    now = datetime.now(UTC)
    # Solved a while ago, so its three-day interval has long since elapsed.
    log_attempt(
        client,
        TWO_SUM,
        idempotency_key="queue-overdue",
        completed_at=now - timedelta(days=30),
    )
    # Solved today, so it is scheduled into the future and is not yet due.
    log_attempt(
        client,
        ADD_TWO_NUMBERS,
        idempotency_key="queue-fresh",
        completed_at=now - timedelta(hours=1),
    )
    # Failed today, which the engine schedules for tomorrow.
    log_attempt(
        client,
        LONGEST_SUBSTRING,
        idempotency_key="queue-failed",
        completed_at=now - timedelta(hours=3),
        outcome="failed",
        duration_seconds=3_000,
    )

    queue = client.get(f"{API}/review-queue")
    assert queue.status_code == 200
    items = queue.json()
    queued = {item["problem_id"] for item in items}

    assert TWO_SUM in queued
    assert ADD_TWO_NUMBERS not in queued
    # Soonest first, so the top of the queue is the most overdue.
    assert [item["due_in_days"] for item in items] == sorted(
        item["due_in_days"] for item in items
    )
    for item in items:
        assert item["title"]
        assert item["topic"]
        assert item["status"] in {"not-started", "solved", "review", "struggling"}

    body = dashboard(client)
    assert body["review_queue"] == items
    assert body["due_count"] >= 1
    assert body["attempt_count"] == 3
    assert body["solved_count"] == 2
    assert body["logged_today"] == 2


def test_dashboard_charts_carry_the_data_every_card_reads(
    client: TestClient,
) -> None:
    now = datetime.now(UTC)
    for offset, (problem_id, outcome, seconds) in enumerate(
        [
            (TWO_SUM, "optimal", 600),
            (ADD_TWO_NUMBERS, "hint", 1_500),
            (LONGEST_SUBSTRING, "failed", 2_700),
        ]
    ):
        log_attempt(
            client,
            problem_id,
            idempotency_key=f"chart-{offset}",
            completed_at=now - timedelta(days=offset),
            outcome=outcome,
            duration_seconds=seconds,
        )

    body = dashboard(client)

    consistency = body["consistency"]
    assert len(consistency["days"]) == 90
    keys = [day["key"] for day in consistency["days"]]
    assert keys == sorted(keys), "heatmap days must be chronological"
    assert len(set(keys)) == len(keys), "heatmap must not repeat a day"
    assert consistency["minutes"] == pytest.approx((600 + 1_500 + 2_700) / 60)
    assert consistency["problem_count"] == 3
    assert consistency["streak"] == 3
    assert consistency["best_streak"] >= 3
    active_days = [day for day in consistency["days"] if day["problem_count"] > 0]
    assert len(active_days) == 3
    assert all(1 <= day["activity_level"] <= 4 for day in active_days)

    assert body["focuses"], "topic carousel needs at least one focus"
    for focus in body["focuses"]:
        assert focus["topic"]
        assert 0 <= focus["score"] <= 100
        assert focus["attempted"] <= focus["problem_count"]
        assert focus["due_count"] >= 0
    # Ordered the way the carousel leads: due work first, then topics that have
    # been touched, then the weakest score inside each of those bands.
    bands = [
        (0 if focus["due_count"] else 1 if focus["attempted"] else 2, focus["score"])
        for focus in body["focuses"]
    ]
    assert [band for band, _ in bands] == sorted(band for band, _ in bands)
    for band in (0, 1, 2):
        in_band = [score for group, score in bands if group == band]
        assert in_band == sorted(in_band)

    assert 0 <= body["readiness_score"] <= 100
    assert 0 <= body["mastery_score"] <= 100


@pytest.mark.parametrize("range_days", [30, 60, 90, 180])
def test_dashboard_range_selector_resizes_the_heatmap(
    client: TestClient, range_days: int
) -> None:
    body = dashboard(client, range_days)

    assert len(body["consistency"]["days"]) == range_days


def test_dashboard_rejects_a_range_outside_the_selector(client: TestClient) -> None:
    assert client.get(f"{API}/dashboard", params={"range_days": 45}).status_code == 422


def test_ai_endpoints_are_disabled_without_a_key_but_still_readable(
    client: TestClient,
) -> None:
    assert client.get(f"{API}/capabilities").json()["ai"]["available"] is False

    attempt = log_attempt(
        client,
        TWO_SUM,
        idempotency_key="ai-attempt",
        completed_at=datetime.now(UTC),
    )

    listed = client.get(f"{API}/attempts/{attempt['id']}/ai-artifacts")
    assert listed.status_code == 200
    assert listed.json() == []

    created = client.post(
        f"{API}/attempts/{attempt['id']}/ai-artifacts",
        json={"kind": "review", "include_notes": True, "include_transcript": False},
        headers=ORIGIN_HEADERS,
    )
    assert created.status_code == 501
    assert created.json() == {"detail": "Anthropic is not configured"}


def test_unknown_ids_return_404_rather_than_a_server_error(
    client: TestClient,
) -> None:
    assert client.get(f"{API}/problems/999999").status_code == 404
    assert client.get(f"{API}/attempts/missing-attempt").status_code == 404
    assert client.get(f"{API}/jobs/missing-job").status_code == 404
    assert client.get(f"{API}/recordings/missing-recording/content").status_code == 404
    assert (
        client.post(
            f"{API}/practice-sessions",
            json={"problem_id": 999999},
            headers=ORIGIN_HEADERS,
        ).status_code
        == 404
    )


def test_export_and_clear_round_trip_the_whole_workspace(
    client: TestClient, settings: Settings
) -> None:
    now = datetime.now(UTC)
    log_attempt(
        client,
        TWO_SUM,
        idempotency_key="export-1",
        completed_at=now,
        notes="Worth re-reading.",
    )

    exported = client.get(f"{API}/system/export")
    assert exported.status_code == 200
    payload = exported.json()
    assert len(payload["attempts"]) == 1
    assert payload["attempts"][0]["notes"] == "Worth re-reading."

    cleared = client.post(f"{API}/system/clear", headers=ORIGIN_HEADERS)
    assert cleared.status_code == 200

    # User data goes; the catalog the app needs to function stays.
    assert dashboard(client)["attempt_count"] == 0
    assert client.get(f"{API}/system/export").json()["attempts"] == []
    assert client.get(f"{API}/problems", params={"page_size": 1}).json()["total"] > 0
