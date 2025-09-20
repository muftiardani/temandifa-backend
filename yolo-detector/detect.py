import sys
import json
from ultralytics import YOLO
from PIL import Image

def detect_objects(image_path):
    # Muat model YOLOv8n yang sudah dilatih sebelumnya
    model = YOLO("yolov8n.pt")

    # Lakukan deteksi pada gambar
    results = model(image_path)

    detections = []
    for r in results:
        im_bgr = r.plot()
        im_rgb = Image.fromarray(im_bgr[..., ::-1])
        width, height = im_rgb.size
        
        for box in r.boxes:
            x1, y1, x2, y2 = box.xyxy[0]
            confidence = box.conf[0]
            class_id = int(box.cls[0])
            class_name = model.names[class_id]

            # Normalisasi koordinat (0-1) agar bisa diskalakan di frontend
            normalized_bbox = [
                float(x1) / width,
                float(y1) / height,
                float(x2-x1) / width,
                float(y2-y1) / height
            ]

            detections.append({
                "class": class_name,
                "confidence": float(confidence),
                "bbox": normalized_bbox
            })
            
    return json.dumps(detections)

if __name__ == "__main__":
    image_path_arg = sys.argv[1]
    result_json = detect_objects(image_path_arg)
    print(result_json)