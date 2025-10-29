from flask import Flask, request, jsonify
from werkzeug.exceptions import BadRequest, InternalServerError, UnsupportedMediaType
import io
import logging
import os
import tempfile
import numpy as np
import whisper
import ffmpeg
from prometheus_flask_exporter import PrometheusMetrics

log_format = '%(asctime)s %(levelname)s [%(name)s] [%(filename)s:%(lineno)d] - %(message)s'
logging.basicConfig(level=logging.INFO, format=log_format)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.url_map.strict_slashes = False
metrics = PrometheusMetrics(app, group_by='endpoint')
logger.info("Flask app (Voice Transcriber) initialized with Prometheus metrics.")

model = None
MODEL_TYPE = os.environ.get("WHISPER_MODEL", "base")
try:
    logger.info(f"Loading Whisper model: {MODEL_TYPE}")
    model = whisper.load_model(MODEL_TYPE)
    logger.info(f"Whisper model '{MODEL_TYPE}' loaded successfully.")
except Exception as e:
    logger.error(f"FATAL: Failed to load Whisper model '{MODEL_TYPE}': {e}", exc_info=True)

metrics.info('app_info', 'Voice Transcriber Service Information', version='1.0.0', model_type=MODEL_TYPE)

def convert_audio_to_pcm(input_bytes: bytes) -> np.ndarray:
    """
    Mengkonversi byte audio input ke format PCM 16kHz mono float32 NumPy array
    menggunakan FFmpeg.
    """
    try:
        logger.debug("Starting audio conversion with FFmpeg...")
        out, err = (
            ffmpeg
            .input('pipe:0', format='m4a')
            .output('pipe:1', format='s16le', acodec='pcm_s16le', ac=1, ar='16k')
            .run(input=input_bytes, capture_stdout=True, capture_stderr=True, quiet=True)
        )
        logger.debug("FFmpeg conversion finished.")

        if err:
             logger.warning(f"FFmpeg stderr during conversion: {err.decode('utf-8', errors='ignore')}")

        if not out:
             raise ValueError("FFmpeg produced no output.")

        audio_np = np.frombuffer(out, np.int16).astype(np.float32) / 32768.0
        logger.debug(f"Audio converted to NumPy array, shape: {audio_np.shape}")
        return audio_np

    except ffmpeg.Error as e:
        stderr_output = e.stderr.decode('utf-8', errors='ignore') if e.stderr else "No stderr"
        logger.error(f"FFmpeg error during audio conversion: {e}. Stderr: {stderr_output}", exc_info=True)
        raise RuntimeError(f"FFmpeg failed: {stderr_output}") from e
    except Exception as e:
        logger.error(f"Error converting audio to PCM: {e}", exc_info=True)
        raise RuntimeError(f"Audio conversion failed: {e}") from e


@app.route('/transcribe', methods=['POST'])
@metrics.counter('transcribe_requests_total', 'Total number of /transcribe requests')
@metrics.summary('transcribe_request_duration_seconds', 'Latency of /transcribe requests')
@metrics.gauge('transcribe_in_progress', 'Number of /transcribe requests in progress')
def transcribe_endpoint():
    """
    Endpoint untuk mentranskripsi file audio yang diunggah.
    Menerima file audio melalui form-data dengan key 'audio'.
    Mengembalikan teks hasil transkripsi dalam format JSON.
    """
    if model is None:
        logger.error("Model is not loaded, cannot process /transcribe request.")
        raise InternalServerError("Transcription service is unavailable (model not loaded).")

    if 'audio' not in request.files:
        logger.warning("Request to /transcribe missing 'audio' file part.")
        raise BadRequest("Missing 'audio' file part in form-data.")

    file = request.files['audio']

    if not file.filename:
        logger.warning("Request to /transcribe submitted an empty filename.")
        raise BadRequest("No selected file or empty filename provided.")

    allowed_content_types = {'audio/m4a', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'}
    content_type = file.content_type
    if not content_type or not content_type.lower() in allowed_content_types:
         logger.warning(f"Potentially unsupported content type received: {content_type}")

    try:
        audio_bytes = file.read()
        logger.info(f"Received audio file '{file.filename}' ({len(audio_bytes)} bytes) for transcription.")

        logger.info(f"Converting audio '{file.filename}' to required format...")
        try:
            audio_np = convert_audio_to_pcm(audio_bytes)
        except RuntimeError as conversion_err:
             logger.error(f"Audio conversion failed for '{file.filename}': {conversion_err}", exc_info=True)
             raise InternalServerError(f"Failed to process audio file: {conversion_err}")

        logger.info(f"Performing transcription on audio '{file.filename}' using model '{MODEL_TYPE}'...")
        try:
            result = model.transcribe(audio_np)
            transcribed_text = result.get("text", "")
            detected_language = result.get("language", "unknown")
            logger.info(f"Transcription complete for '{file.filename}'. Detected language: {detected_language}. Text length: {len(transcribed_text)}")
        except Exception as whisper_err:
             logger.error(f"Error during Whisper transcription for '{file.filename}': {whisper_err}", exc_info=True)
             raise InternalServerError(f"Transcription failed: {whisper_err}")

        return jsonify({
             "transcribedText": transcribed_text.strip(),
             "language": detected_language
        })

    except (BadRequest, UnsupportedMediaType) as http_err:
        raise http_err

    except Exception as e:
        logger.error(f"Unexpected error during transcription for file '{file.filename}': {e}", exc_info=True)
        raise InternalServerError("An unexpected error occurred during audio transcription.")


@app.route('/health', methods=['GET'])
@metrics.do_not_track()
def health_check():
    """
    Endpoint health check dasar. Memeriksa apakah model Whisper sudah dimuat.
    """
    if model is None:
        logger.error("Health check failed: Whisper model is not loaded.")
        return jsonify({"status": "unhealthy", "reason": "Whisper model not loaded"}), 503
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
    port = int(os.environ.get('PORT', 5002))
    debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    logger.info(f"Starting Flask development server (Voice Transcriber) on {host}:{port}, Debug: {debug_mode}")
    app.run(host=host, port=port, debug=debug_mode)