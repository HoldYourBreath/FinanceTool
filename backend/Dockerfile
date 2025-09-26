# ---- Base (deps cache) ----
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# system libs often needed by psycopg2/brotli/etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl ca-certificates git \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt

RUN python -m pip install --upgrade pip && \
    pip install -r /app/backend/requirements.txt


# ---- Runtime ----
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

# bring in installed packages from the base stage
COPY --from=base /usr/local /usr/local

# app source only (no attempt to install the repo itself)
COPY backend /app/backend

# sensible defaults; override in docker-compose for dev if needed
ENV FLASK_APP=backend.app:create_app \
    FLASK_RUN_HOST=0.0.0.0 \
    FLASK_DEBUG=0 \
    PORT=5000

EXPOSE 5000

# Single-line healthcheck (no heredoc)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; \
r=urllib.request.urlopen('http://127.0.0.1:5000/api/health', timeout=3); \
sys.exit(0 if r.getcode()==200 else 1)" || exit 1

# default to Gunicorn
CMD ["gunicorn", "-b", "0.0.0.0:5000", "backend.app:create_app"]
