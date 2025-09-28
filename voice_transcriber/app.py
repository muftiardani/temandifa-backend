from flask import Flask, request, jsonify
import whisper
import os
import logging
import numpy as np
import ffmpeg

app = Flask(__name__)

logging.basicConfig(level=logging.INFO)

model = None
try:
    model = whisper.load_model("medium") # Menggunakan model 'base' untuk inisialisasi lebih cepat jika turbo tidak ada
    logging.info("Model Whisper berhasil dimuat.")
except Exception as e:
    logging.error(f"Gagal memuat model Whisper: {e}")

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    if model is None:
        return jsonify({'error': 'Model tidak tersedia'}), 500

    if 'audio' not in request.files:
        return jsonify({'error': 'File audio tidak ditemukan'}), 400

    audio_file = request.files['audio']
    
    try:
        audio_bytes = audio_file.read()
        
        out, _ = (
            ffmpeg
            .input('pipe:', threads=0)
            .output('pipe:', format='s16le', ac=1, ar=16000)
            .run(input=audio_bytes, capture_stdout=True, capture_stderr=True)
        )
        
        audio_np = np.frombuffer(out, np.int16).flatten().astype(np.float32) / 32768.0

        result = model.transcribe(audio_np)
        return jsonify({'transcribedText': result['text']})
    except Exception as e:
        logging.error(f"Error saat transkripsi audio: {e}")
        return jsonify({'error': 'Gagal memproses audio'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    # Health check yang lebih baik: periksa apakah model sudah dimuat
    if model:
        return jsonify({"status": "OK", "message": "Model is loaded."}), 200
    else:
        return jsonify({"status": "ERROR", "message": "Model is not loaded."}), 500