# Base image pinned by tag AND digest (refresh via Dependabot / `docker buildx imagetools inspect`).
FROM python:3.15-slim@sha256:65a65fc7b30b06cb6df4930fd4650697cb23f4c2698ab81fc87e4b031bc36928

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /srv/backend

# 1) Dependencies first (cached layer): hash-locked, generated from uv.lock.
COPY requirements.lock.txt ./
RUN pip install --require-hashes --no-deps -r requirements.lock.txt

# 2) Application code (runs from source; the package itself is not pip-installed).
COPY alembic.ini docker-entrypoint.sh ./
COPY alembic ./alembic
COPY app ./app

# DejaVu covers German and Turkish in exported PDFs. Arabic still needs a fluent review.
RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin openkita
USER openkita

EXPOSE 8000
# Liveness only: the process answers. A database outage must not mark the container unhealthy.
# 6s leaves headroom over the 4s socket timeout for a cold interpreter.
HEALTHCHECK --interval=10s --timeout=6s --start-period=60s --retries=6 \
    CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health/live', timeout=4).status == 200 else 1)"]

# Waits for the database, applies migrations, then serves (see docker-entrypoint.sh).
CMD ["./docker-entrypoint.sh"]
