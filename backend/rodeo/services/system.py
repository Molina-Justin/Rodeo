from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from rodeo.config import Settings
from rodeo.db import get_engine
from rodeo.models.catalog import Problem
from rodeo.models.operations import AppSetting, Job
from rodeo.models.practice import (
    Attempt,
    PracticeSession,
    Recording,
    ReviewState,
    Transcription,
)
from rodeo.schemas.system import (
    CapabilitiesResponse,
    ExportAttempt,
    ExportResponse,
    ExportReviewState,
    PromptTemplatesResponse,
    ReadinessResponse,
    TranscriptionCapability,
)

PromptTemplateKey = Literal["session", "review"]

SESSION_TEMPLATE_DEFAULT = (
    "Pick {{problem_count}} problems for a {{minutes}}-minute session on "
    "{{topic}}.\n"
    "Weigh overdue reviews against new coverage.\n"
    "Account for the recurring blocker above.\n"
    "For each pick, give one sentence on why it earns the slot and what to\n"
    "watch for. Order them for the session."
)

REVIEW_TEMPLATE_DEFAULT = (
    "Please act as a constructive technical-interview coach. Review this attempt "
    "without immediately giving me a full solution. First assess my reasoning from "
    "the notes and audio memo, then give targeted hints and concrete next steps. "
    "Focus on correctness, algorithm choice, complexity, edge cases, implementation "
    "risks, and how I communicated my thinking. Point out what I did well too.\n\n"
    "Feedback I want:\n"
    "1. Summarize the approach you think I took and identify any gaps in my "
    "reasoning.\n"
    "2. Evaluate correctness and likely time/space complexity.\n"
    "3. List the most important edge cases or failure modes I should test.\n"
    "4. Give me the smallest useful hint or exercise to improve, before showing a "
    "complete solution.\n"
    "5. Suggest how I could explain this more clearly in a real interview."
)

PROMPT_TEMPLATE_DEFAULTS: dict[PromptTemplateKey, str] = {
    "session": SESSION_TEMPLATE_DEFAULT,
    "review": REVIEW_TEMPLATE_DEFAULT,
}


def _prompt_template_setting_key(template_key: PromptTemplateKey) -> str:
    return f"prompt_template.{template_key}"


def get_prompt_templates(session: Session) -> PromptTemplatesResponse:
    rows = session.scalars(
        select(AppSetting).where(
            AppSetting.key.in_(
                [
                    _prompt_template_setting_key("session"),
                    _prompt_template_setting_key("review"),
                ]
            )
        )
    ).all()
    values = {row.key: row.value for row in rows}

    def template(template_key: PromptTemplateKey) -> str:
        value = values.get(_prompt_template_setting_key(template_key))
        return (
            value if isinstance(value, str) else PROMPT_TEMPLATE_DEFAULTS[template_key]
        )

    return PromptTemplatesResponse(
        session_template=template("session"),
        review_template=template("review"),
    )


def update_prompt_template(
    session: Session,
    *,
    template_key: PromptTemplateKey,
    template: str,
    now: datetime,
) -> PromptTemplatesResponse:
    setting_key = _prompt_template_setting_key(template_key)
    setting = session.get(AppSetting, setting_key)
    if setting is None:
        session.add(AppSetting(key=setting_key, value=template, updated_at=now))
    else:
        setting.value = template
        setting.updated_at = now
    session.flush()
    return get_prompt_templates(session)


def reset_prompt_template(
    session: Session, *, template_key: PromptTemplateKey
) -> PromptTemplatesResponse:
    setting = session.get(AppSetting, _prompt_template_setting_key(template_key))
    if setting is not None:
        session.delete(setting)
        session.flush()
    return get_prompt_templates(session)


def check_readiness(settings: Settings) -> ReadinessResponse:
    with get_engine(settings).connect() as connection:
        connection.execute(text("SELECT 1")).scalar_one()
    return ReadinessResponse()


def get_capabilities(settings: Settings) -> CapabilitiesResponse:
    model_path = settings.installed_transcription_model_path()
    return CapabilitiesResponse(
        transcription=TranscriptionCapability(
            enabled=settings.transcription_enabled,
            available=settings.transcription_enabled and model_path is not None,
            model=settings.transcription_model,
        ),
    )


def export_workspace(session: Session, *, now: datetime) -> ExportResponse:
    attempt_rows = session.execute(
        select(
            Attempt,
            Problem.title,
            Problem.slug,
            Transcription.corrected_text,
            Transcription.raw_text,
        )
        .join(Problem, Problem.id == Attempt.problem_id)
        .join(Recording, Recording.attempt_id == Attempt.id, isouter=True)
        .join(Transcription, Transcription.recording_id == Recording.id, isouter=True)
        .order_by(Attempt.completed_at)
    ).all()
    attempts = [
        ExportAttempt(
            id=attempt.id,
            problem_id=attempt.problem_id,
            problem_title=title,
            problem_slug=slug,
            completed_at=attempt.completed_at,
            duration_seconds=attempt.duration_seconds,
            outcome=attempt.outcome,
            effort=attempt.effort,
            blocker=attempt.blocker,
            notes=attempt.notes,
            transcript=corrected_text or raw_text,
            created_at=attempt.created_at,
        )
        for attempt, title, slug, corrected_text, raw_text in attempt_rows
    ]

    review_rows = session.execute(
        select(ReviewState, Problem.title)
        .join(Problem, Problem.id == ReviewState.problem_id)
        .where(ReviewState.attempt_count > 0)
        .order_by(Problem.title)
    ).all()
    review_state = [
        ExportReviewState(
            problem_id=state.problem_id,
            problem_title=title,
            status=state.status,
            attempt_count=state.attempt_count,
            best_duration_seconds=state.best_duration_seconds,
            interval_days=state.interval_days,
            lapses=state.lapses,
            confidence=state.confidence,
            due_at=state.due_at,
        )
        for state, title in review_rows
    ]

    return ExportResponse(
        generated_at=now,
        attempts=attempts,
        review_state=review_state,
        prompt_templates=get_prompt_templates(session),
    )


@dataclass
class ClearWorkspaceResult:
    attempts_deleted: int
    practice_sessions_deleted: int
    settings_deleted: int
    storage_keys: list[str]


def clear_workspace_data(session: Session) -> ClearWorkspaceResult:
    attempts_deleted = session.scalar(select(func.count()).select_from(Attempt)) or 0
    practice_sessions_deleted = (
        session.scalar(select(func.count()).select_from(PracticeSession)) or 0
    )
    settings_deleted = session.scalar(select(func.count()).select_from(AppSetting)) or 0
    storage_keys = list(session.scalars(select(Recording.storage_key)))

    session.execute(delete(Transcription))
    session.execute(delete(Recording))
    session.execute(delete(ReviewState))
    session.execute(delete(Attempt))
    session.execute(delete(PracticeSession))
    session.execute(delete(Job))
    session.execute(delete(AppSetting))
    session.flush()

    return ClearWorkspaceResult(
        attempts_deleted=attempts_deleted,
        practice_sessions_deleted=practice_sessions_deleted,
        settings_deleted=settings_deleted,
        storage_keys=storage_keys,
    )
