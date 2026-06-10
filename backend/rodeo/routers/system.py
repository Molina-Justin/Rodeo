import logging

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy.exc import SQLAlchemyError

from rodeo.schemas.system import CapabilitiesResponse, HealthResponse, ReadinessResponse
from rodeo.services.system import check_readiness, get_capabilities

router = APIRouter(tags=["system"])
logger = logging.getLogger(__name__)


@router.get("/health/live", response_model=HealthResponse)
def live() -> HealthResponse:
    return HealthResponse()


@router.get("/health/ready", response_model=ReadinessResponse)
def ready(request: Request) -> ReadinessResponse:
    try:
        return check_readiness(request.app.state.settings)
    except SQLAlchemyError as error:
        logger.exception("Database readiness check failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is unavailable",
        ) from error


@router.get("/capabilities", response_model=CapabilitiesResponse)
def capabilities(request: Request) -> CapabilitiesResponse:
    return get_capabilities(request.app.state.settings)
