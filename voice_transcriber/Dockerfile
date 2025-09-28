# Tahap 1: Menggunakan base image
FROM temandifa-python-base:latest AS builder

# Menyalin dan menginstal dependensi khusus untuk layanan ini
WORKDIR /app
COPY ./voice_transcriber/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# Tahap 2: Final/Production Stage
FROM temandifa-python-base:latest
WORKDIR /app

# Menginstal ffmpeg yang dibutuhkan oleh openai-whisper
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Menyalin dependensi yang sudah terinstal dari tahap builder
COPY --from=builder /opt/venv /opt/venv

# Menyalin kode aplikasi
COPY ./voice_transcriber/ .

# Expose port dan jalankan aplikasi
EXPOSE 5002
CMD ["gunicorn", "--bind", "0.0.0.0:5002", "--workers", "${GUNICORN_WORKERS:-2}", "app:app"]