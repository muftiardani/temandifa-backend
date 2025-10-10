from flask import Flask, request, jsonify
from prometheus_flask_exporter import PrometheusMetrics
import whisper
import logging
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
    logging.info("Menerima permintaan /transcribe...")

    if model is None:
        logging.error("Model tidak tersedia saat permintaan diterima.")
        return jsonify({'error': 'Model tidak tersedia'}), 500

    if 'audio' not in request.files:
        logging.error("File audio tidak ditemukan dalam permintaan.")
        return jsonify({'error': 'File audio tidak ditemukan'}), 400

    audio_file = request.files['audio']
    logging.info(f"Menerima file: {audio_file.filename}")

    try:
        audio_bytes = audio_file.read()
        logging.info(f"Berhasil membaca {len(audio_bytes)} byte dari file audio.")
        
        logging.info("Memulai proses ffmpeg untuk konversi audio...")
        out, err = (
            ffmpeg
            .input('pipe:', threads=0)
            .output('pipe:', format='s16le', ac=1, ar=16000)
            .run(input=audio_bytes, capture_stdout=True, capture_stderr=True)
        )
        logging.info("Proses ffmpeg berhasil.")
        
        audio_np = np.frombuffer(out, np.int16).flatten().astype(np.float32) / 32768.0
        logging.info("Konversi ke array NumPy berhasil.")

        logging.info("Memulai transkripsi dengan model Whisper...")
        result = model.transcribe(audio_np)
        logging.info("Transkripsi berhasil.")
        
        return jsonify({'transcribedText': result['text']})
    except ffmpeg.Error as e:
        logging.error(f"Error dari ffmpeg saat memproses audio: {e.stderr.decode('utf8')}")
        return jsonify({'error': 'Gagal memproses audio, format mungkin tidak didukung.'}), 400
    except Exception as e:
        logging.error(f"Error saat transkripsi audio: {e}", exc_info=True)
        return jsonify({'error': 'Gagal memproses audio'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    if model:
        return jsonify({"status": "OK", "message": "Model is loaded."}), 200
    else:
        return jsonify({"status": "ERROR", "message": "Model is not loaded."}), 500