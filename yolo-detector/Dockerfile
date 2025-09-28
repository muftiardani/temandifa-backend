# --- Tahap 1: Build Stage ---
FROM python:3.9-slim-bullseye as builder

WORKDIR /app

RUN python -m venv /opt/venv

ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Tahap 2: Final/Production Stage ---
FROM python:3.9-slim-bullseye

WORKDIR /app

COPY --from=builder /opt/venv /opt/venv

COPY . .

RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

ENV PATH="/opt/venv/bin:$PATH"

EXPOSE 5001

CMD ["gunicorn", "--bind", "0.0.0.0:5001", "--workers", "${GUNICORN_WORKERS:-2}", "app:app"]