from flask import Flask, request, jsonify
from prometheus_flask_exporter import PrometheusMetrics
import pytesseract
from PIL import Image
import logging
import io

app = Flask(__name__)

metrics = PrometheusMetrics(app)

logging.basicConfig(level=logging.INFO)

@app.route('/scan', methods=['POST'])
def scan_image():
    if 'image' not in request.files:
        return jsonify({'error': 'File gambar tidak ditemukan'}), 400

    image_file = request.files['image']

    try:
        image_bytes = image_file.read()
        image = Image.open(io.BytesIO(image_bytes))

        # Menggunakan Tesseract untuk mengekstrak teks dengan bahasa Indonesia
        text = pytesseract.image_to_string(image, lang='ind')

        logging.info("Proses OCR berhasil.")
        return jsonify({'scannedText': text})
    except Exception as e:
        logging.error(f"Error saat proses OCR: {e}")
        return jsonify({'error': 'Gagal memproses gambar'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return "OK", 200