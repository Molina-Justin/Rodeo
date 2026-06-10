from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from rodeo.config import Settings
from rodeo.db import get_db_session
from rodeo.models import AIArtifact, Attempt, Recording, Transcription
from rodeo.schemas.ai import AIArtifactCreate, AIArtifactResponse

router = APIRouter(tags=["ai"])
DatabaseSession = Annotated[Session, Depends(get_db_session)]


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _response(artifact: AIArtifact) -> AIArtifactResponse:
    return AIArtifactResponse(
        id=artifact.id,
        attempt_id=artifact.attempt_id,
        kind=artifact.kind,
        provider=artifact.provider,
        model=artifact.model,
        prompt_version=artifact.prompt_version,
        content=artifact.content,
        created_at=_aware(artifact.created_at),
        updated_at=_aware(artifact.updated_at),
    )


@router.get(
    "/attempts/{attempt_id}/ai-artifacts", response_model=list[AIArtifactResponse]
)
def list_artifacts(
    attempt_id: str, database: DatabaseSession
) -> list[AIArtifactResponse]:
    return [
        _response(row)
        for row in database.scalars(
            select(AIArtifact)
            .where(AIArtifact.attempt_id == attempt_id)
            .order_by(AIArtifact.created_at)
        ).all()
    ]


@router.post("/attempts/{attempt_id}/ai-artifacts", response_model=AIArtifactResponse)
def create_artifact(
    attempt_id: str,
    payload: AIArtifactCreate,
    request: Request,
    database: DatabaseSession,
) -> AIArtifactResponse:
    settings: Settings = request.app.state.settings
    if settings.anthropic_api_key is None:
        raise HTTPException(status_code=501, detail="Anthropic is not configured")
    attempt = database.get(Attempt, attempt_id)
    if attempt is None:
        raise HTTPException(status_code=404, detail="Attempt not found")
    parts = [
        f"Attempt outcome: {attempt.outcome.value}",
        f"Duration: {attempt.duration_seconds} seconds",
    ]
    if payload.include_notes and attempt.notes.strip():
        parts.append(f"Notes:\n{attempt.notes}")
    if payload.include_transcript:
        transcription = database.scalar(
            select(Transcription)
            .join(Recording)
            .where(Recording.attempt_id == attempt_id)
        )
        if transcription is not None and (
            transcription.corrected_text or transcription.raw_text
        ):
            parts.append(
                f"Transcript:\n{transcription.corrected_text or transcription.raw_text}"
            )
    try:
        from anthropic import Anthropic

        message = Anthropic(
            api_key=settings.anthropic_api_key.get_secret_value()
        ).messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1_024,
            messages=[{"role": "user", "content": "\n\n".join(parts)}],
        )
        content = "".join(
            block.text for block in message.content if hasattr(block, "text")
        )
    except Exception as error:
        raise HTTPException(
            status_code=502, detail="Anthropic request failed"
        ) from error
    artifact = AIArtifact(
        attempt_id=attempt_id,
        kind=payload.kind,
        provider="anthropic",
        model="claude-sonnet-4-20250514",
        prompt_version="1",
        content=content,
    )
    database.add(artifact)
    database.commit()
    return _response(artifact)
