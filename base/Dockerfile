# --- Base Stage untuk semua layanan Python ---
FROM python:3.9-slim-bullseye
WORKDIR /app

# Install build-essentials untuk kompilasi beberapa package python
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && \
    rm -rf /var/lib/apt/lists/*

# Setup virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade pip dan install common dependencies
COPY base/requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Salin semua kode aplikasi
COPY . .

# Buat user non-root
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser