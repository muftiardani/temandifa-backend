# Tahap 1: Menggunakan base image
FROM temandifa-python-base:latest AS builder

# Menyalin dan menginstal dependensi khusus untuk layanan ini
WORKDIR /app
COPY ./ocr_service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# Tahap 2: Final/Production Stage
FROM temandifa-python-base:latest
WORKDIR /app

# Menginstal Tesseract OCR dan paket bahasa Indonesia
RUN apt-get update && \
    apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-ind && \
    rm -rf /var/lib/apt/lists/*

# Menyalin dependensi yang sudah terinstal dari tahap builder
COPY --from=builder /opt/venv /opt/venv

# Menyalin kode aplikasi
COPY ./ocr_service/ .

# Expose port dan jalankan aplikasi
EXPOSE 5003
CMD ["gunicorn", "--bind", "0.0.0.0:5003", "--workers", "${GUNICORN_WORKERS:-2}", "app:app"]