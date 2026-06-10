from fastapi import APIRouter

from rodeo.routers.attempts import router as attempts_router
from rodeo.routers.catalog import router as catalog_router
from rodeo.routers.dashboard import router as dashboard_router
from rodeo.routers.jobs import router as jobs_router
from rodeo.routers.problems import router as problems_router
from rodeo.routers.recordings import router as recordings_router
from rodeo.routers.sessions import router as sessions_router
from rodeo.routers.system import router as system_router
from rodeo.routers.transcriptions import router as transcriptions_router

api_router = APIRouter()
api_router.include_router(system_router)
api_router.include_router(problems_router)
api_router.include_router(attempts_router)
api_router.include_router(catalog_router)
api_router.include_router(dashboard_router)
api_router.include_router(jobs_router)
api_router.include_router(sessions_router)
api_router.include_router(recordings_router)
api_router.include_router(transcriptions_router)

__all__ = ["api_router"]
