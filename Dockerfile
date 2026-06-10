FROM node:22-bookworm-slim AS web-build

WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim-bookworm AS runtime

ARG WHISPER_MODEL=base.en

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HUB_DISABLE_TELEMETRY=1 \
    RODEO_ENVIRONMENT=production \
    RODEO_DATA_DIR=/data \
    RODEO_BUNDLED_MODELS_DIR=/opt/rodeo-models \
    RODEO_STATIC_DIR=/app/static \
    RODEO_TRANSCRIPTION_MODEL=${WHISPER_MODEL}

RUN apt-get update \
    && apt-get install --yes --no-install-recommends curl ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/ ./
RUN pip install --no-cache-dir '.[ai,transcription]' \
    && python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='Systran/faster-whisper-${WHISPER_MODEL}', local_dir='/opt/rodeo-models/${WHISPER_MODEL}')"

COPY --from=web-build /build/frontend/dist/ /app/static/

RUN mkdir -p /data/recordings /data/tmp /data/models /data/backups

EXPOSE 8000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl --fail --silent http://127.0.0.1:8000/api/v1/health/ready || exit 1

CMD ["sh", "-c", "alembic upgrade head && exec uvicorn rodeo.main:app --host 0.0.0.0 --port 8000 --workers 1"]
