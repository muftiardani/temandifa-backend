# --- Tahap 1: Build Stage ---
FROM python:3.9-slim-bullseye AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && \
    rm -rf /var/lib/apt/lists/*
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --upgrade pip
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Tahap 2: Final/Production Stage ---
FROM python:3.9-slim-bullseye
WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY . .
RUN apt-get update && \
    apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-ind && \
    rm -rf /var/lib/apt/lists/*
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser
ENV PATH="/opt/venv/bin:$PATH"
EXPOSE 5003
CMD ["gunicorn", "--bind", "0.0.0.0:5003", "--workers", "${GUNICORN_WORKERS:-2}", "app:app"]