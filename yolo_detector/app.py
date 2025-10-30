from flask import request, jsonify
from werkzeug.exceptions import BadRequest, InternalServerError, UnsupportedMediaType
from PIL import Image
import io
import logging
import os

from common.app_factory import create_app
from detect import detect_objects_from_image, load_model

log_format = '%(asctime)s %(levelname)s [%(name)s] [%(filename)s:%(lineno)d] - %(message)s'
logging.basicConfig(level=logging.INFO, format=log_format)
logger = logging.getLogger(__name__)

app, metrics = create_app(__name__)

model = None
try:
    model = load_model()
    if model:
        logger.info("YOLO model loaded successfully.")
    else:
        logger.error("FATAL: load_model function returned None. Check detect.py.")
except Exception as e:
    logger.error(f"FATAL: Failed to load YOLO model during startup: {e}", exc_info=True)

try:
    dummy_image = Image.new('RGB', (10, 10), color='black')
    logger.info("Dummy image for health check created.")
except Exception as e:
    dummy_image = None
    logger.error(f"Failed to create dummy image for health check: {e}", exc_info=True)

metrics.info('app_info', 'YOLO Detector Service Information', version='1.0.0')

@app.route('/detect', methods=['POST'])
@metrics.counter('detect_requests_total', 'Total number of /detect requests')
@metrics.summary('detect_request_duration_seconds', 'Latency of /detect requests')
@metrics.gauge('detect_in_progress', 'Number of /detect requests in progress')
def detect_endpoint():
    """
    Endpoint untuk mendeteksi objek dalam gambar yang diunggah.
    Menerima file gambar melalui form-data dengan key 'image'.
    Mengembalikan hasil deteksi dalam format JSON.
    """
    if model is None:
        logger.error("Model is not loaded, cannot process /detect request.")
        raise InternalServerError("Object detection service is unavailable (model not loaded).")

    if 'image' not in request.files:
        logger.warning("Request to /detect missing 'image' file part.")
        raise BadRequest("Missing 'image' file part in form-data.")

    file = request.files['image']

    if not file.filename:
        logger.warning("Request to /detect submitted an empty filename.")
        raise BadRequest("No selected file or empty filename provided.")

    allowed_extensions = {'png', 'jpg', 'jpeg', 'bmp', 'webp'}
    content_type = file.content_type
    file_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else ''

    if not content_type or not content_type.startswith('image/') or file_ext not in allowed_extensions:
        logger.warning(f"Invalid content type or extension received: {content_type}, ext: {file_ext}")
        raise UnsupportedMediaType(
            f"Unsupported file type: '{content_type}' or extension: '{file_ext}'. "
            f"Allowed extensions: {', '.join(allowed_extensions)}"
        )

    try:
        image_bytes = file.read()
        logger.info(f"Received image '{file.filename}' ({len(image_bytes)} bytes) for detection.")

        try:
            img = Image.open(io.BytesIO(image_bytes))
            img.verify()
            img = Image.open(io.BytesIO(image_bytes))
            img.load()
            logger.debug(f"Image '{file.filename}' successfully opened and verified.")
        except (IOError, SyntaxError, ValueError) as img_err:
            logger.warning(f"Invalid or corrupted image file received ('{file.filename}'): {img_err}")
            raise BadRequest(f"Invalid or corrupted image file: {img_err}")

        logger.info(f"Processing image '{file.filename}' for object detection...")
        results = detect_objects_from_image(img, model)
        logger.info(f"Detection complete for '{file.filename}'. Found {len(results)} objects.")

        return jsonify(results)

    except (BadRequest, UnsupportedMediaType) as http_err:
        raise http_err

    except Exception as e:
        logger.error(f"Unexpected error during detection for file '{file.filename}': {e}", exc_info=True)
        raise InternalServerError("An unexpected error occurred during object detection.")

@app.route('/health', methods=['GET'])
@metrics.do_not_track()
def health_check():
    """
    Endpoint health check.
    Memeriksa model dimuat DAN dapat melakukan inferensi.
    """
    if model is None:
        logger.error("Health check failed: Model is not loaded.")
        return jsonify({"status": "unhealthy", "reason": "Model not loaded"}), 503
    
    if dummy_image is None:
         logger.error("Health check failed: Dummy image not created.")
         return jsonify({"status": "unhealthy", "reason": "Health check setup failed"}), 503

    try:
        _ = model(dummy_image, verbose=False)
        logger.debug("Health check inference successful.")
        return jsonify({"status": "healthy"}), 200
    except Exception as e:
        logger.error(f"Health check failed: Model inference error: {e}", exc_info=True)
        return jsonify({"status": "unhealthy", "reason": f"Model inference failed: {e}"}), 503

if __name__ == '__main__':
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', 5001))
    logger.info(f"Starting Flask development server on {host}:{port}")
    app.run(host=host, port=port, debug=os.environ.get('FLASK_DEBUG', 'false').lower() == 'true')