import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from rodeo.db import get_db_session
from rodeo.schemas.problems import CatalogSyncResponse
from rodeo.services.catalog import CatalogRefreshError, refresh_catalog

router = APIRouter(prefix="/catalog", tags=["catalog"])
DatabaseSession = Annotated[Session, Depends(get_db_session)]
logger = logging.getLogger(__name__)


@router.post("/refresh", response_model=CatalogSyncResponse)
def refresh(session: DatabaseSession) -> CatalogSyncResponse:
    try:
        return refresh_catalog(session)
    except CatalogRefreshError as error:
        logger.warning("Catalog refresh failed", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "message": str(error),
                "sync": error.sync.model_dump(mode="json"),
            },
        ) from error
