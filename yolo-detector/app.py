import os
import json
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from detect import detect_objects
import traceback

app = Flask(__name__)

UPLOAD_FOLDER = 'temp_uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/detect', methods=['POST'])
def detect_api():
    if 'image' not in request.files:
        return jsonify({"error": "Tidak ada bagian file gambar"}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "Tidak ada file yang dipilih"}), 400

    if file:
        filename = secure_filename(file.filename)
        temp_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(temp_path)

        try:
            # Panggil fungsi deteksi
            result_json_str = detect_objects(temp_path)
            detections = json.loads(result_json_str)
            
            os.remove(temp_path)
            return jsonify(detections)
            
        except Exception as e:
            # Tangkap error apa pun, cetak ke terminal, dan kirim sebagai respons
            print("--- TRACEBACK ERROR ---")
            traceback.print_exc()
            print("-----------------------")
            
            if os.path.exists(temp_path):
                os.remove(temp_path)
                
            return jsonify({"error": "Gagal memproses gambar", "details": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)