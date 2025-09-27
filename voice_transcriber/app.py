from flask import Flask, request, jsonify
from prometheus_flask_exporter import PrometheusMetrics
import whisper
import os
import logging
import io
import numpy as np
import ffmpeg

app = Flask(__name__)

metrics = PrometheusMetrics(app)

logging.basicConfig(level=logging.INFO)

try:
    model = whisper.load_model("base")
    logging.info("Model Whisper berhasil dimuat.")
except Exception as e:
    logging.error(f"Gagal memuat model Whisper: {e}")
    model = None

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
    return "OK", 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)