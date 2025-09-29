# Tahap 1: Menggunakan base image yang sudah berisi Python & dependensi umum
FROM temandifa-python-base:latest AS builder

# Menyalin dan menginstal dependensi khusus untuk layanan ini
WORKDIR /app
COPY ./yolo_detector/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# Tahap 2: Final/Production Stage
FROM temandifa-python-base:latest
WORKDIR /app

# Menyalin dependensi yang sudah terinstal dari tahap builder
COPY --from=builder /opt/venv /opt/venv

# Menyalin kode aplikasi
COPY ./yolo_detector/ .

# Expose port dan jalankan aplikasi
EXPOSE 5001

# Menjalankan Gunicorn sebagai modul untuk mendukung impor relatif
CMD ["gunicorn", "--bind", "0.0.0.0:5001", "--workers", "${GUNICORN_WORKERS:-2}", "app:app"]