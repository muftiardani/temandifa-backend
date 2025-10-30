from ultralytics import YOLO
from PIL import Image
import logging

logger = logging.getLogger(__name__)

def load_model(model_name="yolov8n.pt"):
    """
    Memuat model YOLOv8 berdasarkan nama atau path.
    Library YOLO akan mencoba mengunduh jika nama model diberikan dan belum ada.
    Mengembalikan objek model atau None jika gagal.
    """
    try:
        logger.info(f"Loading YOLO model: {model_name}")
        model = YOLO(model_name)
        logger.info(f"YOLO model '{model_name}' successfully loaded and initialized.")
        return model
    except Exception as e:
        logger.error(f"Error loading YOLO model '{model_name}': {e}", exc_info=True)
        return None

def detect_objects_from_image(pil_image: Image.Image, model: YOLO):
    """
    Mendeteksi objek dalam gambar PIL menggunakan model YOLO yang sudah dimuat.
    Args:
        pil_image (PIL.Image.Image): Objek gambar PIL yang sudah divalidasi.
        model (YOLO): Objek model YOLO yang sudah dimuat.
    Returns:
        list: Daftar dictionary berisi hasil deteksi (class, confidence, bbox).
              Mengembalikan list kosong jika tidak ada objek terdeteksi.
    Raises:
        TypeError: Jika input pil_image bukan objek PIL Image.
        ValueError: Jika model tidak valid atau belum dimuat.
        RuntimeError: Jika terjadi error tak terduga selama proses inferensi.
    """
    if not isinstance(pil_image, Image.Image):
        logger.error("Invalid input: detect_objects_from_image expects a PIL Image object.")
        raise TypeError("Input must be a PIL Image object")
    if not model:
        logger.error("Model is not available for detection.")
        raise ValueError("YOLO model is not loaded or invalid.")

    detections = []
    try:
        logger.debug("Running YOLO model inference...")
        results = model(pil_image, verbose=False)
        logger.debug("Model inference completed.")

        for r in results:
            if r.boxes is None:
                logger.debug("No boxes found in this result.")
                continue

            width, height = pil_image.size
            if width == 0 or height == 0:
                 logger.warning("Image dimensions are zero, cannot normalize bounding box.")
                 continue

            for box in r.boxes:
                if box.xyxy is None or len(box.xyxy) == 0 or \
                   box.conf is None or len(box.conf) == 0 or \
                   box.cls is None or len(box.cls) == 0:
                    logger.warning(f"Incomplete box data skipped: {box}")
                    continue

                try:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    confidence = box.conf[0].item()
                    class_id = int(box.cls[0].item())
                    class_name = model.names.get(class_id, f"Unknown_ID_{class_id}")

                    normalized_bbox = [
                        max(0.0, float(x1) / width),
                        max(0.0, float(y1) / height),
                        min(1.0, float(x2 - x1) / width),
                        min(1.0, float(y2 - y1) / height)
                    ]
                    normalized_bbox = [max(0.0, min(1.0, val)) for val in normalized_bbox]

                    detections.append({
                        "class": class_name,
                        "confidence": float(confidence),
                        "bbox": normalized_bbox
                    })
                    logger.debug(f"Detected: {class_name} (Conf: {confidence:.2f})")

                except (IndexError, TypeError, KeyError, ValueError) as parse_err:
                     logger.warning(f"Error parsing detection box data: {parse_err}. Box data: {box}", exc_info=True)
                     continue

    except Exception as e:
        logger.error(f"Error during YOLO model inference: {e}", exc_info=True)
        raise RuntimeError(f"An error occurred during model prediction: {e}") from e

    return detections