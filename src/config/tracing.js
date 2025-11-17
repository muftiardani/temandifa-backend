const {
  OTLPTraceExporter,
} = require("@opentelemetry/exporter-trace-otlp-grpc");
const {
  getNodeAutoInstrumentations,
} = require("@opentelemetry/auto-instrumentations-node");
const { NodeSDK } = require("@opentelemetry/sdk-node");
const { Resource } = require("@opentelemetry/resources");
const {
  SemanticResourceAttributes,
} = require("@opentelemetry/semantic-conventions");
const { logger } = require("./logger");

const otelExporterOtlpEndpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4317";

const traceExporter = new OTLPTraceExporter({
  url: otelExporterOtlpEndpoint,
});

/**
 * Menginisialisasi OpenTelemetry SDK
 * @param {string} serviceName - Nama layanan ini (misal: 'api-gateway')
 */
const initTracing = (serviceName) => {
  try {
    const sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      }),
      traceExporter,
      instrumentations: [getNodeAutoInstrumentations()],
    });

    sdk
      .start()
      .then(() => {
        logger.info(
          `OpenTelemetry Tracing berhasil diinisialisasi untuk [${serviceName}]`
        );
        logger.info(
          `Mengirim trace ke OTLP collector di: ${otelExporterOtlpEndpoint}`
        );
      })
      .catch((error) => {
        logger.error("Gagal memulai OpenTelemetry SDK:", error);
      });

    process.on("SIGTERM", () => {
      sdk
        .shutdown()
        .then(() => logger.info("Tracing SDK dimatikan."))
        .catch((error) => logger.error("Error mematikan tracing SDK:", error))
        .finally(() => process.exit(0));
    });

    return sdk;
  } catch (error) {
    logger.error("Gagal menginisialisasi OpenTelemetry Tracing:", error);
  }
};

module.exports = { initTracing };
