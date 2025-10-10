from flask import Flask, request, jsonify
from prometheus_flask_exporter import PrometheusMetrics
from detect import detect_objects_from_image
from ultralytics import YOLO
import logging
from PIL import UnidentifiedImageError

app = Flask(__name__)
metrics = PrometheusMetrics(app)
logging.basicConfig(level=logging.INFO)

try:
    model = YOLO('yolov8n.pt')
    logging.info("Model YOLO berhasil dimuat.")
except Exception as e:
    logging.error(f"Gagal memuat model YOLO: {e}")
    model = None

@app.route('/detect', methods=['POST'])
def detect():
    if model is None:
        return jsonify({'error': 'Model tidak tersedia'}), 500
    
    if 'image' not in request.files:
        return jsonify({'error': 'File gambar tidak ditemukan'}), 400

    image_file = request.files['image']
    
    try:
        results = detect_objects_from_image(model, image_file)
        return jsonify(results)
    except UnidentifiedImageError:
        logging.error("File yang diunggah bukan format gambar yang dikenali.")
        return jsonify({'error': 'Format gambar tidak valid'}), 400
    except Exception as e:
        logging.error(f"Error saat deteksi objek: {e}")
        return jsonify({'error': 'Gagal memproses gambar'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    if model:
        return jsonify({"status": "OK", "message": "Model is loaded."}), 200
    else:
        return jsonify({"status": "ERROR", "message": "Model is not loaded."}), 500