# --- Base Stage untuk semua layanan Python ---
FROM python:3.9-slim-bullseye
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

RUN useradd -m appuser && chown -R appuser:appuser /app && chown -R appuser:appuser /opt/venv
USER appuser