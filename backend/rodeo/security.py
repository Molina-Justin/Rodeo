from urllib.parse import urlsplit

from starlette.datastructures import URL
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


class OriginCheckMiddleware:
    def __init__(self, app: ASGIApp, *, allowed_origins: list[str]) -> None:
        self.app = app
        self.allowed_origins = frozenset(
            origin.rstrip("/") for origin in allowed_origins
        )

    async def __call__(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        origin = request.headers.get("origin")
        if origin is None and request.method not in SAFE_METHODS:
            response = JSONResponse(
                {"detail": "Origin header is required"},
                status_code=403,
            )
            await response(scope, receive, send)
            return

        if origin is None or self._is_allowed(origin, request.url):
            await self.app(scope, receive, send)
            return

        response = JSONResponse(
            {"detail": "Origin is not allowed"},
            status_code=403,
        )
        await response(scope, receive, send)

    def _is_allowed(self, origin: str, request_url: URL) -> bool:
        normalized_origin = origin.rstrip("/")
        if normalized_origin in self.allowed_origins:
            return True

        parsed_origin = urlsplit(normalized_origin)
        return (
            parsed_origin.scheme == request_url.scheme
            and parsed_origin.netloc == request_url.netloc
        )
