import logging
from flask import Flask, jsonify, request
from werkzeug.exceptions import BadRequest, InternalServerError, UnsupportedMediaType
from prometheus_flask_exporter import PrometheusMetrics

logger = logging.getLogger(__name__)

def register_error_handlers(app):
    """Mendaftarkan error handler umum ke aplikasi Flask."""

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
    def handle_internal_server_error(error):
        original_exception = getattr(error, "original_exception", error)
        error_message = getattr(error, "description", str(original_exception))
        logger.error(f"Internal Server Error: {error_message} (Path: {request.path})", exc_info=True)
        response = jsonify(message=error_message or "Internal Server Error")
        response.status_code = 500
        return response

    @app.errorhandler(Exception)
    def handle_generic_exception(error):
        if isinstance(error, (BadRequest, UnsupportedMediaType, InternalServerError)):
             return error

        error_message = str(error)
        logger.error(f"Unhandled Exception: {error_message} (Path: {request.path})", exc_info=True)
        response = jsonify(message="An unexpected internal server error occurred.")
        response.status_code = 500
        return response

def create_app(app_name):
    """
    Factory untuk membuat instance aplikasi Flask dengan konfigurasi umum.
    """
    app = Flask(app_name)
    app.url_map.strict_slashes = False

    metrics = PrometheusMetrics(app, group_by='endpoint')

    register_error_handlers(app)

    logger.info(f"Flask app '{app_name}' created with common factory (metrics, error handlers).")
    
    return app, metrics