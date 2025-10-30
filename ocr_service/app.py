from flask import request, jsonify
from werkzeug.exceptions import BadRequest, InternalServerError, UnsupportedMediaType
from PIL import Image
import io
import logging
import os
import pytesseract

from common.app_factory import create_app

log_format = '%(asctime)s %(levelname)s [%(name)s] [%(filename)s:%(lineno)d] - %(message)s'
logging.basicConfig(level=logging.INFO, format=log_format)
logger = logging.getLogger(__name__)

app, metrics = create_app(__name__)

try:
    dummy_image = Image.new('RGB', (10, 10), color='black')
    logger.info("Dummy image for health check created.")
except Exception as e:
    dummy_image = None
    logger.error(f"Failed to create dummy image for health check: {e}", exc_info=True)

metrics.info('app_info', 'OCR Service Information', version='1.0.0')

@app.route('/scan', methods=['POST'])
@metrics.counter('scan_requests_total', 'Total number of /scan requests')
@metrics.summary('scan_request_duration_seconds', 'Latency of /scan requests')
@metrics.gauge('scan_in_progress', 'Number of /scan requests in progress')
def scan_endpoint():
    """
    Endpoint untuk melakukan OCR pada gambar yang diunggah.
    Menerima file gambar melalui form-data dengan key 'image'.
    Mengembalikan teks hasil OCR dalam format JSON.
    """
    if 'image' not in request.files:
        logger.warning("Request to /scan missing 'image' file part.")
        raise BadRequest("Missing 'image' file part in form-data.")

    file = request.files['image']

    if not file.filename:
        logger.warning("Request to /scan submitted an empty filename.")
        raise BadRequest("No selected file or empty filename provided.")

    allowed_extensions = {'png', 'jpg', 'jpeg', 'bmp', 'tiff', 'webp'}
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
        logger.info(f"Received image '{file.filename}' ({len(image_bytes)} bytes) for OCR.")

        pil_image = None
        try:
            pil_image = Image.open(io.BytesIO(image_bytes))
            pil_image.verify()
            pil_image = Image.open(io.BytesIO(image_bytes))
            pil_image.load()
            logger.debug(f"Image '{file.filename}' successfully opened and verified.")
        except (IOError, SyntaxError, ValueError) as img_err:
            logger.warning(f"Invalid or corrupted image file received ('{file.filename}'): {img_err}")
            raise BadRequest(f"Invalid or corrupted image file: {img_err}")

        logger.info(f"Performing OCR on image '{file.filename}'...")
        try:
            lang_code = 'ind'
            scanned_text = pytesseract.image_to_string(pil_image, lang=lang_code)
            logger.info(f"OCR complete for '{file.filename}'. Extracted text length: {len(scanned_text)}")
        except pytesseract.TesseractError as tess_err:
            logger.error(f"Error during Tesseract processing for '{file.filename}': {tess_err}", exc_info=True)
            raise InternalServerError(f"Error occurred during OCR processing: {tess_err}")

        return jsonify({"scannedText": scanned_text.strip()})

    except (BadRequest, UnsupportedMediaType) as http_err:
        raise http_err

    except Exception as e:
        logger.error(f"Unexpected error during OCR for file '{file.filename}': {e}", exc_info=True)
        raise InternalServerError("An unexpected error occurred during OCR processing.")

@app.route('/health', methods=['GET'])
@metrics.do_not_track()
def health_check():
    """
    Endpoint health check.
    Memeriksa Tesseract dapat dieksekusi pada gambar dummy.
    """
    if dummy_image is None:
         logger.error("Health check failed: Dummy image not created.")
         return jsonify({"status": "unhealthy", "reason": "Health check setup failed"}), 503
    
    try:
        _ = pytesseract.image_to_string(dummy_image, lang='ind', timeout=5)
        logger.debug("Health check Tesseract execution successful.")
        return jsonify({"status": "healthy"}), 200
    except Exception as e:
        logger.error(f"Health check failed: Tesseract execution error: {e}", exc_info=True)
        return jsonify({"status": "unhealthy", "reason": f"Tesseract execution failed: {e}"}), 503

if __name__ == '__main__':
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', 5003))
    logger.info(f"Starting Flask development server (OCR Service) on {host}:{port}")
    app.run(host=host, port=port, debug=os.environ.get('FLASK_DEBUG', 'false').lower() == 'true')