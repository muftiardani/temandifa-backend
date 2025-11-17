import logging
import os
from flask import Flask, jsonify, request
from werkzeug.exceptions import BadRequest, InternalServerError, UnsupportedMediaType
from prometheus_flask_exporter import PrometheusMetrics

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPTraceExporter
from opentelemetry.instrumentation.flask import FlaskInstrumentor

logger = logging.getLogger(__name__)

def setup_tracing(app_name):
    """Mengkonfigurasi OpenTelemetry untuk layanan ini."""
    try:
        resource = Resource(attributes={
            "service.name": app_name
        })

        provider = TracerProvider(resource=resource)
        trace.set_tracer_provider(provider)

        otlp_endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317")
        
        exporter = OTLPTraceExporter(endpoint=otlp_endpoint, insecure=True)
        processor = BatchSpanProcessor(exporter)
        provider.add_span_processor(processor)

        logger.info(f"OpenTelemetry Tracing diinisialisasi untuk [{app_name}]")
        logger.info(f"Mengirim trace ke OTLP collector di: {otlp_endpoint}")

    except Exception as e:
        logger.error(f"Gagal menginisialisasi OpenTelemetry Tracing: {e}", exc_info=True)


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

    setup_tracing(app_name.split('.')[-1])
    FlaskInstrumentor().instrument_app(app)

    metrics = PrometheusMetrics(app, group_by='endpoint')

    register_error_handlers(app)

    logger.info(f"Flask app '{app_name}' created with common factory (metrics, error handlers, tracing).")
    
    return app, metrics