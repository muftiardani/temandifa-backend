from flask import Flask, request, jsonify
import whisper
import os
import logging

app = Flask(__name__)

# Konfigurasi logging
logging.basicConfig(level=logging.INFO)

# Muat model sekali saat aplikasi dimulai
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
    
    # Simpan file sementara untuk diproses
    temp_path = "temp_audio_file"
    audio_file.save(temp_path)

    try:
        result = model.transcribe(temp_path)
        # Hapus file sementara setelah selesai
        os.remove(temp_path)
        return jsonify({'transcribedText': result['text']})
    except Exception as e:
        logging.error(f"Error saat transkripsi audio: {e}")
        # Pastikan file sementara dihapus bahkan jika ada error
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({'error': 'Gagal memproses audio'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return "OK", 200

if __name__ == '__main__':
    # Gunakan Gunicorn atau server WSGI lain untuk produksi
    app.run(host='0.0.0.0', port=5002, debug=True)