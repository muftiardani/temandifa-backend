from flask import Flask, request, jsonify
from werkzeug.exceptions import BadRequest, InternalServerError, UnsupportedMediaType
from PIL import Image
import io
import logging
import os
from prometheus_flask_exporter import PrometheusMetrics

from detect import detect_objects_from_image, load_model

log_format = '%(asctime)s %(levelname)s [%(name)s] [%(filename)s:%(lineno)d] - %(message)s'
logging.basicConfig(level=logging.INFO, format=log_format)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.url_map.strict_slashes = False
metrics = PrometheusMetrics(app, group_by='endpoint')
logger.info("Flask app initialized with Prometheus metrics.")

model = None
try:
    model = load_model()
    if model:
        logger.info("YOLO model loaded successfully.")
    else:
        logger.error("FATAL: load_model function returned None. Check detect.py.")
except Exception as e:
    logger.error(f"FATAL: Failed to load YOLO model during startup: {e}", exc_info=True)

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
    Endpoint health check dasar. Memeriksa apakah model sudah dimuat.
    """
    if model is None:
        logger.error("Health check failed: Model is not loaded.")
        return jsonify({"status": "unhealthy", "reason": "Model not loaded"}), 503
    logger.debug("Health check successful.")
    return jsonify({"status": "healthy"}), 200

@app.errorhandler(BadRequest)
def handle_bad_request(error):
    logger.warning(f"Bad Request: {error.description} (Path: {request.path})")
    response = jsonify(message=error.description or "Bad Request")
    response.status_code = 400
    return response

@app.errorhandler(UnsupportedMediaType)
def handle_unsupported_media_type(error):
    logger.warning(f"Unsupported Media Type: {error.description} (Path: {request.path})")
    response = jsonify(message=error.description or "Unsupported Media Type")
    response.status_code = 415
    return response

@app.errorhandler(InternalServerError)
@app.errorhandler(Exception)
def handle_internal_error(error):
    original_exception = getattr(error, "original_exception", error)
    error_message = getattr(error, "description", str(original_exception))

    logger.error(f"Internal Server Error: {error_message} (Path: {request.path})", exc_info=True)

    response = jsonify(message=error_message or "Internal Server Error")
    response.status_code = getattr(error, "code", 500)
    if not (500 <= response.status_code < 600):
        response.status_code = 500
        response.set_data(jsonify(message="Internal Server Error").get_data())


    return response

if __name__ == '__main__':
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', 5001))
    logger.info(f"Starting Flask development server on {host}:{port}")
    app.run(host=host, port=port, debug=os.environ.get('FLASK_DEBUG', 'false').lower() == 'true')