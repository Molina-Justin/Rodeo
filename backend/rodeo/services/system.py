from sqlalchemy import text

from rodeo.config import Settings
from rodeo.db import get_engine
from rodeo.schemas.system import (
    AICapability,
    CapabilitiesResponse,
    ReadinessResponse,
    TranscriptionCapability,
)


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
        ai=AICapability(available=settings.anthropic_api_key is not None),
    )
