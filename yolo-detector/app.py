from flask import Flask, request, jsonify
from detect import detect_objects_from_image
from ultralytics import YOLO
import logging

app = Flask(__name__)

logging.basicConfig(level=logging.INFO)

model = None
try:
    # Model dimuat sekali saat aplikasi dimulai
    model = YOLO('yolov8l.pt')
    logging.info("Model YOLO berhasil dimuat.")
except Exception as e:
    logging.error(f"Gagal memuat model YOLO: {e}")

@app.route('/detect', methods=['POST'])
def detect():
    if model is None:
        return jsonify({'error': 'Model tidak tersedia'}), 500
    
    if 'image' not in request.files:
        return jsonify({'error': 'File gambar tidak ditemukan'}), 400

    image_file = request.files['image']
    
    try:
        # Objek model yang sudah dimuat di-pass ke fungsi deteksi
        results = detect_objects_from_image(model, image_file)
        return jsonify(results)
    except Exception as e:
        logging.error(f"Error saat deteksi objek: {e}")
        return jsonify({'error': 'Gagal memproses gambar'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    # Health check yang lebih baik: periksa apakah model sudah dimuat
    if model:
        return jsonify({"status": "OK", "message": "Model is loaded."}), 200
    else:
        return jsonify({"status": "ERROR", "message": "Model is not loaded."}), 500