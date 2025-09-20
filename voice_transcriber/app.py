import os
import whisper
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import traceback

app = Flask(__name__)

UPLOAD_FOLDER = 'temp_audio_uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Muat model Whisper saat server dimulai. 'base' adalah model yang cepat dan ringan.
# Untuk akurasi lebih tinggi, bisa menggunakan 'small' atau 'medium'.
print("Memuat model Whisper...")
model = whisper.load_model("base")
print("Model Whisper berhasil dimuat.")

# Definisikan endpoint API untuk transkripsi
@app.route('/transcribe', methods=['POST'])
def transcribe_api():
    if 'audio' not in request.files:
        return jsonify({"error": "Tidak ada bagian file audio"}), 400

    file = request.files['audio']
    if file.filename == '':
        return jsonify({"error": "Tidak ada file yang dipilih"}), 400

    if file:
        filename = secure_filename(file.filename)
        temp_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        try:
            file.save(temp_path)
            
            # Lakukan transkripsi menggunakan Whisper
            result = model.transcribe(temp_path, language="id") # Set bahasa ke Indonesia
            transcribed_text = result["text"]
            
            os.remove(temp_path)
            
            return jsonify({"transcribedText": transcribed_text})
            
        except Exception as e:
            traceback.print_exc()
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return jsonify({"error": "Gagal memproses audio", "details": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)