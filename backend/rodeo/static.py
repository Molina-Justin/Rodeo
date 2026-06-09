from __future__ import annotations

from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope


class SPAStaticFiles(StaticFiles):
    """Serve built assets and fall back to index.html for client-side routes."""

    async def get_response(self, path: str, scope: Scope) -> Response:
        try:
            return await super().get_response(path, scope)
        except HTTPException as error:
            is_api_path = path == "api" or path.startswith("api/")
            if error.status_code != 404 or is_api_path:
                raise
            return await super().get_response("index.html", scope)
