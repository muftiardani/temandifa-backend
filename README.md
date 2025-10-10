# TemanDifa Backend

Selamat datang di repositori *backend* untuk aplikasi **TemanDifa**. Sistem ini dibangun dengan arsitektur *microservices* menggunakan Node.js dan Python, dirancang untuk menjadi tangguh, skalabel, dan mudah dikelola menggunakan Docker.

## ✨ Arsitektur & Fitur Utama

Backend ini terdiri dari beberapa layanan independen yang bekerja sama untuk menyediakan fungsionalitas aplikasi:

  - **API Gateway (Node.js & Express)**: Titik masuk tunggal untuk semua permintaan dari klien. Bertanggung jawab atas:

      - Otentikasi pengguna (JWT & Google OAuth).
      - Manajemen rute dan validasi permintaan.
      - *Proxy* ke layanan *machine learning* internal.
      - Manajemen panggilan video secara *real-time* dengan Socket.IO.

  - **Layanan Machine Learning (Python & Flask)**:

      - **YOLO Detector**: Mendeteksi objek dari gambar menggunakan model YOLOv8.
      - **Voice Transcriber**: Mengubah rekaman suara menjadi teks menggunakan model Whisper dari OpenAI.
      - **OCR Service**: Mengekstrak teks dari gambar menggunakan Tesseract OCR.

  - **Database & Caching**:

      - **MongoDB**: Basis data utama untuk menyimpan data pengguna, kontak, dan token.
      - **Redis**: Digunakan untuk manajemen status panggilan video secara *real-time*, memastikan persistensi dan keandalan sesi.

  - **Pemantauan & Observability**:

      - **Prometheus**: Mengumpulkan metrik kinerja dari semua layanan secara periodik.
      - **Grafana**: Memvisualisasikan metrik dari Prometheus dalam dasbor yang mudah dibaca.

  - **CI/CD Otomatis**:

      - Alur kerja **GitHub Actions** untuk pengujian, pemindaian keamanan (*vulnerability scanning*), pembangunan *image* Docker, dan *deployment* otomatis ke server produksi.

## 🛠️ Tumpukan Teknologi

| Komponen | Teknologi |
| --- | --- |
| **API Gateway** | [Node.js](https://nodejs.org/), [Express](https://expressjs.com/), [JWT](https://jwt.io/), [Socket.IO](https://socket.io/), [Mongoose](https://mongoosejs.com/) |
| **Layanan AI** | [Python](https://www.python.org/), [Flask](https://flask.palletsprojects.com/), [PyTorch](https://pytorch.org/) (YOLOv8), [Whisper](https://openai.com/research/whisper), [Tesseract](https://github.com/tesseract-ocr/tesseract) |
| **Database** | [MongoDB](https://www.mongodb.com/), [Redis](https://redis.io/) |
| **Infrastruktur** | [Docker](https://www.docker.com/), [Docker Compose](https://docs.docker.com/compose/) |
| **Pemantauan** | [Prometheus](https://prometheus.io/), [Grafana](https://grafana.com/) |
| **CI/CD** | [GitHub Actions](https://github.com/features/actions) |

## 🚀 Memulai

1.  **Clone repositori ini:**

    ```bash
    git clone https://github.com/muftiardani/temandifa-backend.git
    cd temandifa-backend
    ```

2.  **Konfigurasi Variabel Lingkungan:**
    Salin file `.env.example` menjadi `.env` dan isi semua variabel yang diperlukan.

    ```bash
    cp .env.example .env
    ```

    Pastikan Anda mengisi semua nilai, terutama untuk `JWT_SECRET`, kredensial Google, Agora, dan layanan email.

3.  **Jalankan Aplikasi:**
    Gunakan Docker Compose untuk membangun dan menjalankan semua layanan.

    ```bash
    # (Opsional tapi direkomendasikan) Bangun base image Python terlebih dahulu
    docker-compose build python-base-builder

    # Jalankan semua layanan di background
    docker-compose up -d --build
    ```

    Aplikasi sekarang akan berjalan dan API Gateway akan tersedia di `http://localhost:3000` (atau *port* yang Anda tentukan di `.env`).

4.  **Hentikan Aplikasi:**

    ```bash
    docker-compose down
    ```

## 📜 Endpoint API (v1)

Semua *endpoint* berada di bawah *prefix* `/api/v1`. Rute yang ditandai dengan 🔒 memerlukan otentikasi JWT (*Bearer Token*).

| Metode | Endpoint | Deskripsi | Status |
| :--- | :--- | :--- | :--- |
| **Otentikasi** | | | |
| `POST` | `/auth/register` | Mendaftarkan pengguna baru. | ✅ Selesai |
| `POST` | `/auth/login` | Login dengan email/username dan password. | ✅ Selesai |
| `POST` | `/auth/google/mobile` | Login atau mendaftar menggunakan token Google. | ✅ Selesai |
| `POST` | `/auth/refresh-token` | Memperbarui *access token* menggunakan *refresh token*. | ✅ Selesai |
| `POST` | `/auth/forgotpassword` | Mengirim email untuk reset kata sandi. | ✅ Selesai |
| `PUT` | `/auth/resetpassword/:token`| Mereset kata sandi menggunakan token. | ✅ Selesai |
| `POST` | `/auth/logout` | Menghapus *refresh token* dari database. | ✅ Selesai |
| **Pengguna** | | | |
| `PUT` | `/users/pushtoken` 🔒 | Memperbarui *push notification token* pengguna. | ✅ Selesai |
| **Fitur AI** | | | |
| `POST` | `/detect` 🔒 | Mengunggah gambar untuk deteksi objek. | ✅ Selesai |
| `POST` | `/scan` 🔒 | Mengunggah gambar untuk ekstraksi teks (OCR). | ✅ Selesai |
| `POST` | `/transcribe` 🔒 | Mengunggah audio untuk transkripsi suara. | ✅ Selesai |
| **Panggilan Video** | | | |
| `POST` | `/call/initiate` 🔒 | Memulai panggilan video ke pengguna lain. | ✅ Selesai |
| `POST` | `/call/:callId/answer` 🔒 | Menjawab panggilan yang masuk. | ✅ Selesai |
| `POST` | `/call/:callId/end` 🔒 | Mengakhiri/menolak/membatalkan panggilan. | ✅ Selesai |
| `GET` | `/call/status` 🔒 | Memeriksa status panggilan aktif pengguna. | ✅ Selesai |
| **Kontak Darurat** | | | |
| `GET` | `/contacts` 🔒 | Mendapatkan daftar kontak darurat pengguna. | ✅ Selesai |
| `POST` | `/contacts` 🔒 | Menambahkan kontak darurat baru. | ✅ Selesai |
| `DELETE`| `/contacts/:id` 🔒 | Menghapus kontak darurat. | ✅ Selesai |