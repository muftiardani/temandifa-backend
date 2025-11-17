# TemanDifa Backend

Selamat datang di repositori *backend* untuk aplikasi **TemanDifa**. Sistem ini memberdayakan aplikasi seluler TemanDifa dengan arsitektur *microservices* yang tangguh dan skalabel, dibangun menggunakan Node.js, Python, dan diorkestrasi dengan Docker. 🐳

## ✨ Arsitektur & Fitur Utama

Backend ini terdiri dari beberapa layanan independen yang bekerja sama untuk menyediakan fungsionalitas aplikasi:

- **API Gateway (Node.js & Express)**: Titik masuk tunggal untuk semua permintaan klien. Bertanggung jawab atas:
    * 🔑 Otentikasi Pengguna (JWT & Google OAuth)
    * 👤 Manajemen Sesi & Profil Pengguna
    * 🚦 Manajemen Rute & Validasi Permintaan (Zod)
    * 🛡️ *Rate Limiting* untuk Keamanan
    * 🔄 *Proxy* ke Layanan AI Internal
    * 📞 Manajemen Panggilan Video secara *Real-time* (Socket.IO & Redis)
    * 📝 Logging Kontekstual Terstruktur (Winston)
- **Layanan Machine Learning (Python & Flask)**:
    * 🖼️ **YOLO Detector**: Mendeteksi objek dari gambar menggunakan model YOLOv8.
    * 🎤 **Voice Transcriber**: Mengubah rekaman suara menjadi teks menggunakan model Whisper dari OpenAI.
    * 📄 **OCR Service**: Mengekstrak teks dari gambar menggunakan Tesseract OCR.
- **Database & Caching**:
    * 💾 **MongoDB**: Basis data utama untuk menyimpan data pengguna, kontak, dan sesi.
    * ⚡ **Redis**: Digunakan untuk manajemen status panggilan video secara *real-time*.
- **Pemantauan & Observability**:
    * 📊 **Prometheus**: Mengumpulkan metrik kinerja dari semua layanan.
    * 📈 **Grafana**: Memvisualisasikan metrik dari Prometheus.
- **CI/CD Otomatis**:
    * 🤖 **GitHub Actions**: Alur kerja otomatis untuk pengujian (Jest, Pytest), *linting*, audit keamanan dependensi (`npm audit`, `pip-audit`), pemindaian kerentanan *image* Docker (Trivy), pembangunan *image*, dan *deployment* otomatis ke server produksi.

## 🛠️ Tumpukan Teknologi

| Komponen            | Teknologi                                                                                                                                              |
| :------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API Gateway** | [Node.js](https://nodejs.org/), [Express](https://expressjs.com/), [JWT](https://jwt.io/), [Socket.IO](https://socket.io/), [Mongoose](https://mongoosejs.com/), [Zod](https://zod.dev/) |
| **Layanan AI** | [Python](https://www.python.org/), [Flask](https://flask.palletsprojects.com/), [Gunicorn](https://gunicorn.org/), [Whisper](https://openai.com/research/whisper), [Ultralytics (YOLO)](https://ultralytics.com/), [Pytesseract](https://pypi.org/project/pytesseract/) |
| **Database** | [MongoDB](https://www.mongodb.com/)                                                                                                                    |
| **Cache/Real-time** | [Redis](https://redis.io/)                                                                                                                             |
| **Infrastruktur** | [Docker](https://www.docker.com/), [Docker Compose](https://docs.docker.com/compose/)                                                                   |
| **Pemantauan** | [Prometheus](https://prometheus.io/), [Grafana](https://grafana.com/)                                                                                   |
| **CI/CD** | [GitHub Actions](https://github.com/features/actions), [Trivy](https://github.com/aquasecurity/trivy)                                                  |

## 🚀 Memulai

### Instalasi (Menggunakan Docker)

1.  **Clone repositori ini:**
    ```bash
    git clone https://github.com/TemanDifa/TemanDifa-Backend.git
    cd temandifa-backend
    ```

2.  **Konfigurasi Variabel Lingkungan:**
    Buat file `.env` di direktori *root*. Salin konten di bawah ini dan **isi semua nilai** `<...>` dengan kredensial yang sebenarnya. **Pastikan nama variabel sesuai dengan yang ada di sini.**

    ```env
    # Konfigurasi Server
    NODE_ENV=development # Ganti ke 'production' saat deployment

    # Database & Cache
    MONGO_URI=mongodb://mongo:27017/temandifa_db # Nama service 'mongo' dari docker-compose
    REDIS_URI=redis://redis:6379 # Nama service 'redis' dari docker-compose

    # JWT Secrets (Ganti dengan kunci rahasia yang SANGAT KUAT)
    JWT_SECRET=<YOUR_STRONG_JWT_SECRET>
    JWT_REFRESH_SECRET=<YOUR_DIFFERENT_STRONG_JWT_REFRESH_SECRET>

    # Google OAuth Credentials (Dari Google Cloud Console)
    GOOGLE_CLIENT_ID=<YOUR_GOOGLE_WEB_OR_MAIN_CLIENT_ID>
    GOOGLE_ANDROID_CLIENT_ID=<YOUR_GOOGLE_ANDROID_CLIENT_ID>
    GOOGLE_IOS_CLIENT_ID=<YOUR_GOOGLE_IOS_CLIENT_ID>

    # Email Service
    EMAIL_FROM_NAME="TemanDifa App" # Nama pengirim
    EMAIL_FROM="no-reply@yourdomain.com" # Email pengirim
    EMAIL_HOST=<YOUR_SMTP_HOST> # Contoh: smtp.gmail.com
    EMAIL_USER=<YOUR_SMTP_USERNAME_OR_EMAIL> # Username/Email SMTP
    EMAIL_PASS=<YOUR_SMTP_PASSWORD_OR_APP_PASSWORD> # Password/App Password SMTP

    # Agora Credentials (Dari Agora Console)
    AGORA_APP_ID=<YOUR_AGORA_APP_ID>
    AGORA_APP_CERTIFICATE=<YOUR_AGORA_APP_CERTIFICATE>
    ```

3.  **Jalankan Aplikasi:**
    Gunakan Docker Compose untuk membangun *image* (jika belum ada atau ada perubahan) dan menjalankan semua *container* di latar belakang.
    ```bash
    # Bangun base image Python terlebih dahulu
    docker-compose build python-base-builder
    
    # Jalankan semua layanan di background
    docker-compose up --build -d
    ```
    *(Flag `--build` memastikan image terbaru digunakan. Bisa dihilangkan jika tidak ada perubahan kode/Dockerfile).*

4.  **Akses Aplikasi:**
    * API Gateway: `http://localhost:3000`
    * Dokumentasi API (Swagger): `http://localhost:3000/api-docs`
    * Dasbor Monitoring (Grafana): `http://localhost:4000` (login *default* biasanya admin/admin).

5.  **Hentikan Aplikasi:**
    ```bash
    docker-compose down -v
    ```
    *(Tambahkan `-v` jika ingin menghapus volume data Mongo/Redis)*.

## 📜 Dokumentasi API & Endpoint (v1)

Dokumentasi interaktif OpenAPI (Swagger) tersedia setelah server berjalan di:

**`http://localhost:3000/api-docs`**

Semua *endpoint* berada di bawah *prefix* `/api/v1`. Rute yang ditandai dengan 🔒 memerlukan otentikasi JWT (*Bearer Token*).

| Metode   | Endpoint                      | Deskripsi                                             | Status      |
| :------- | :---------------------------- | :---------------------------------------------------- | :---------- |
| **Otentikasi & Sesi** |                  |                                                       |             |
| `POST`   | `/auth/register`              | Mendaftarkan pengguna baru.                             | ✅ Selesai    |
| `POST`   | `/auth/login`                 | Login dengan email/username dan password.               | ✅ Selesai    |
| `POST`   | `/auth/google/mobile`         | Login atau mendaftar menggunakan token Google ID.       | ✅ Selesai    |
| `POST`   | `/auth/refresh-token`         | Memperbarui *access token* menggunakan *refresh token*. | ✅ Selesai    |
| `POST`   | `/auth/forgotpassword`        | Mengirim email untuk reset kata sandi.                  | ✅ Selesai    |
| `POST`   | `/auth/resetpassword/:token`  | Mereset kata sandi menggunakan token.                   | ✅ Selesai    |
| `POST`   | `/auth/logout`                | Menghapus sesi berdasarkan *refresh token*.             | ✅ Selesai    |
| `GET`    | `/auth/profile` 🔒            | Mendapatkan profil pengguna yang sedang login.          | ✅ Selesai    |
| `GET`    | `/auth/sessions` 🔒           | Mendapatkan daftar sesi aktif pengguna.                 | ✅ Selesai    |
| `DELETE` | `/auth/sessions/:sessionId` 🔒| Menghapus (revoke) sesi spesifik.                       | ✅ Selesai    |
| **Pengguna** |                           |                                                         |                |
| `PUT`    | `/users/pushtoken` 🔒         | Memperbarui *push notification token* pengguna.         | ✅ Selesai    |
| **Fitur AI (Proxy)** |                   |                                                         |                |
| `POST`   | `/detect`                     | Mengunggah gambar untuk deteksi objek.                  | ✅ Selesai    |
| `POST`   | `/scan`                       | Mengunggah gambar untuk ekstraksi teks (OCR).           | ✅ Selesai    |
| `POST`   | `/transcribe`                 | Mengunggah audio untuk transkripsi suara.               | ✅ Selesai    |
| **Panggilan Video** |                    |                                                         |                |
| `POST`   | `/call/initiate` 🔒           | Memulai panggilan video ke pengguna lain (via no. telp).| ✅ Selesai    |
| `POST`   | `/call/:callId/answer` 🔒     | Menjawab panggilan yang masuk.                          | ✅ Selesai    |
| `POST`   | `/call/:callId/end` 🔒        | Mengakhiri/menolak/membatalkan panggilan.               | ✅ Selesai    |
| `GET`    | `/call/status` 🔒             | Memeriksa status panggilan aktif pengguna.              | ✅ Selesai    |
| **Kontak Darurat** |                     |                                                         |                |
| `GET`    | `/contacts` 🔒                | Mendapatkan daftar kontak darurat pengguna.             | ✅ Selesai    |
| `POST`   | `/contacts` 🔒                | Menambahkan kontak darurat baru.                        | ✅ Selesai    |
| `GET`    | `/contacts/:id` 🔒            | Mendapatkan detail kontak darurat spesifik.             | ✅ Selesai    |
| `PUT`    | `/contacts/:id` 🔒            | Memperbarui kontak darurat.                             | ✅ Selesai    |
| `DELETE` | `/contacts/:id` 🔒            | Menghapus kontak darurat.                               | ✅ Selesai    |
