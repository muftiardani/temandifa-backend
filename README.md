# TemanDifa Backend

Selamat datang di repositori *backend* untuk aplikasi TemanDifa. Proyek ini dibangun dengan arsitektur *microservices* untuk menyediakan serangkaian layanan AI yang tangguh dan skalabel, dirancang untuk membantu penyandang disabilitas dalam aktivitas sehari-hari.

## 🚀 Arsitektur

Sistem ini terdiri dari beberapa layanan independen yang bekerja sama, diatur menggunakan Docker Compose.

  - **API Gateway**: Layanan utama yang ditulis dengan **Node.js (Express)** sebagai titik masuk tunggal untuk semua permintaan dari aplikasi klien. Bertugas untuk validasi, *rate limiting*, dan meneruskan permintaan ke layanan yang sesuai.
  - **YOLO Detector**: Layanan deteksi objek berbasis **Python (Flask)** yang menggunakan model **YOLOv8** untuk mengidentifikasi objek secara real-time.
  - **Voice Transcriber**: Layanan transkripsi suara ke teks berbasis **Python (Flask)** yang ditenagai oleh model **Whisper OpenAI**.
  - **OCR Service**: Layanan *Optical Character Recognition* (OCR) berbasis **Python (Flask)** yang menggunakan **Tesseract** untuk mengekstrak teks dari gambar.
  - **Prometheus & Grafana**: *Stack* pemantauan untuk mengumpulkan metrik kinerja dari semua layanan dan memvisualisasikannya dalam dasbor yang informatif.

## ✨ Fitur Utama

  - **Endpoint Deteksi Objek**: Menerima gambar dan mengembalikan daftar objek yang terdeteksi beserta tingkat kepercayaan dan koordinatnya.
  - **Endpoint Transkripsi Audio**: Menerima file audio dan mengembalikannya dalam format teks.
  - **Endpoint Pemindaian Teks (OCR)**: Menerima gambar dan mengembalikan teks yang diekstrak dari gambar tersebut.
  - **Terpusat & Aman**: Semua layanan diakses melalui API Gateway yang dilengkapi dengan *rate limiting* dan *security headers* (Helmet).
  - **Pemantauan Terintegrasi**: Metrik kinerja diekspor secara otomatis ke Prometheus untuk dianalisis.
  - **Otomatisasi CI/CD**: Alur kerja GitHub Actions untuk pengujian, pemindaian keamanan, *build* Docker, dan *deployment* otomatis.

## 🛠️ Tumpukan Teknologi

| Komponen            | Teknologi                                                                                                                                                                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API Gateway** | [Node.js](https://nodejs.org/), [Express.js](https://expressjs.com/), [Winston](https://github.com/winstonjs/winston), [Helmet](https://helmetjs.github.io/), [Multer](https://github.com/expressjs/multer)                                                                                         |
| **Layanan ML** | [Python](https://www.python.org/), [Flask](https://flask.palletsprojects.com/), [Gunicorn](https://gunicorn.org/)                                                                                                                                                                                  |
| **Deteksi Objek** | [Ultralytics (YOLOv8)](https://docs.ultralytics.com/models/yolov8/)                                                                                                                                                                                                                                                |
| **Transkripsi Suara** | [OpenAI Whisper](https://openai.com/research/whisper)                                                                                                                                                                                                                                           |
| **OCR** | [Tesseract](https://github.com/tesseract-ocr/tesseract)                                                                                                                                                                                                                                         |
| **Kontainerisasi** | [Docker](https://www.docker.com/), [Docker Compose](https://docs.docker.com/compose/)                                                                                                                                                                                                            |
| **CI/CD** | [GitHub Actions](https://github.com/features/actions)                                                                                                                                                                                                                                           |
| **Pengujian** | [Jest](https://jestjs.io/), [Supertest](https://github.com/visionmedia/supertest), [Pytest](https://docs.pytest.org/)                                                                                                                                                                            |
| **Pemantauan** | [Prometheus](https://prometheus.io/), [Grafana](https://grafana.com/)                                                                                                                                                                                                                            |

## 📋 Prasyarat

Sebelum memulai, pastikan perangkat Anda telah terinstal:

  - [Git](https://git-scm.com/)
  - [Node.js](https://nodejs.org/en/) (v18 atau lebih baru)
  - [Python](https://www.python.org/downloads/) (v3.9 atau lebih baru)
  - [Docker](https://docs.docker.com/get-docker/)
  - [Docker Compose](https://docs.docker.com/compose/install/)

## 🚀 Memulai

1.  **Clone repositori ini:**

    ```bash
    git clone https://github.com/muftiardani/temandifa-backend.git
    cd temandifa-backend
    ```

2.  **Konfigurasi Variabel Lingkungan:**
    Buat file `.env` di direktori utama. Anda bisa menyalin dari contoh jika tersedia, atau membuat file baru dengan konten berikut:

    ```env
    # Ganti dengan username Docker Hub Anda
    DOCKERHUB_USERNAME=username_anda

    # Port untuk API Gateway
    PORT=3000

    # Jumlah worker untuk Gunicorn (Rekomendasi: 2 * CPU Cores + 1)
    GUNICORN_WORKERS=5

    # URL Layanan Internal (Jangan diubah)
    DETECTOR_URL=http://yolo-detector:5001/detect
    TRANSCRIBER_URL=http://voice-transcriber:5002/transcribe
    SCANNER_URL=http://ocr-service:5003/scan
    ```

3.  **Jalankan Semua Layanan:**
    Gunakan Docker Compose untuk membangun dan menjalankan semua layanan.

    ```bash
    docker-compose up --build
    ```

    Tambahkan flag `-d` untuk menjalankannya di latar belakang.

Setelah semua kontainer berjalan, sistem siap digunakan.

## 📡 Endpoint API

Semua *endpoint* diakses melalui API Gateway.

| Metode | Endpoint             | Deskripsi                               | Body (form-data)    |
| ------ | -------------------- | --------------------------------------- | ------------------- |
| `POST` | `/api/v1/detect`     | Mendeteksi objek dari sebuah gambar.    | `image`: file gambar |
| `POST` | `/api/v1/scan`       | Mengekstrak teks dari sebuah gambar.    | `image`: file gambar |
| `POST` | `/api/v1/transcribe` | Mentranskripsi teks dari sebuah audio.  | `audio`: file audio  |
| `GET`  | `/health`            | Memeriksa status kesehatan API Gateway. | -                   |
| `GET`  | `/metrics`           | Mengekspos metrik untuk Prometheus.     | -                   |

## 🧪 Pengujian

Proyek ini dilengkapi dengan pengujian otomatis untuk memastikan kualitas kode.

  - **Menjalankan Tes Node.js (API Gateway):**

    ```bash
    npm install
    npm test
    ```

  - **Menjalankan Tes Python (Layanan ML):**

    ```bash
    # Pastikan semua dependensi terinstal
    pip install -r base/requirements.txt
    pip install -r yolo_detector/requirements.txt
    pip install -r voice_transcriber/requirements.txt
    pip install -r ocr_service/requirements.txt

    # Jalankan pytest
    pytest
    ```

## ⚙️ CI/CD

Pipeline CI/CD diatur menggunakan **GitHub Actions**. Setiap *push* ke cabang `main` akan memicu alur kerja berikut:

1.  **Test**: Menjalankan semua tes untuk Node.js dan Python.
2.  **Build, Scan, and Push**: Membangun *image* Docker untuk setiap layanan, memindai kerentanan menggunakan Trivy, dan mendorongnya ke Docker Hub.
3.  **Deploy**: Melakukan *deployment* otomatis ke server produksi menggunakan SSH.

## 📊 Pemantauan

  - **Prometheus**: Akses dasbor Prometheus di `http://localhost:9090`.
  - **Grafana**: Akses dasbor Grafana di `http://localhost:4000` (login default: `admin`/`admin`). Grafana sudah terkonfigurasi dengan Prometheus sebagai sumber data.