# Tahap 1: Menggunakan base image yang sudah berisi Python & dependensi umum
FROM temandifa-python-base:latest AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# Tahap 2: Final/Production Stage
FROM temandifa-python-base:latest
WORKDIR /app

COPY --from=builder /opt/venv /opt/venv

COPY . .

EXPOSE 5001
CMD gunicorn --bind 0.0.0.0:5001 --workers ${GUNICORN_WORKERS:-2} --timeout 300 --preload yolo_detector.app:app