from typing import Literal

from pydantic import BaseModel, ConfigDict


class APIModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class HealthResponse(APIModel):
    status: Literal["ok"] = "ok"


class ReadinessResponse(APIModel):
    status: Literal["ready"] = "ready"
    database: Literal["ready"] = "ready"


class TranscriptionCapability(APIModel):
    enabled: bool
    available: bool
    model: str


class AICapability(APIModel):
    provider: Literal["anthropic"] = "anthropic"
    available: bool


class CapabilitiesResponse(APIModel):
    transcription: TranscriptionCapability
    ai: AICapability
