FROM python:3.12-slim@sha256:2f17fc044b579bab302c2e8054d3a686e2cb9a83de48e70534b94cd8ebbe06a9

ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/home/appuser/.cache/huggingface

WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir pip==25.0.1 \
    && pip install --no-cache-dir -r /app/requirements.txt

RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin appuser \
    && mkdir -p /home/appuser/.cache/huggingface \
    && chown -R appuser:appuser /home/appuser /app

# Pre-download SentenceTransformer model weights into HF_HOME cache during build
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('intfloat/multilingual-e5-base')" \
    && chown -R appuser:appuser /home/appuser/.cache

COPY --chown=appuser:appuser backend/app /app/app
COPY --chown=appuser:appuser backend/data /app/data
COPY --chown=appuser:appuser package.json /app/package.json

# Pre-compile Python bytecode (.pyc) for faster startup
RUN python -m compileall -q /app/app

USER appuser

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-${BACKEND_PORT:-8000}} --no-proxy-headers"]
