# Tahap 1: Menggunakan base image yang sudah berisi Python & dependensi umum
FROM temandifa-python-base:latest AS builder
WORKDIR /app

USER root

RUN apt-get update && \
    apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-ind && \
    rm -rf /var/lib/apt/lists/*

USER appuser

COPY ocr_service/requirements.txt requirements.txt
COPY common/ /app/common/

RUN pip install --no-cache-dir -r requirements.txt


# Tahap 2: Final/Production Stage
FROM temandifa-python-base:latest
WORKDIR /app

USER root

RUN apt-get update && \
    apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-ind && \
    rm -rf /var/lib/apt/lists/*

USER appuser

COPY --from=builder /opt/venv /opt/venv
COPY ocr_service/ /app/
COPY common/ /app/common/ 

EXPOSE 5003

CMD gunicorn --bind 0.0.0.0:5003 --workers ${GUNICORN_WORKERS:-2} --timeout 300 --preload app:app