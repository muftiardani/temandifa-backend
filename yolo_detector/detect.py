from ultralytics import YOLO
from PIL import Image

def detect_objects_from_image(model, image_file_stream):
    img = Image.open(image_file_stream)
    
    results = model(img)

    detections = []
    for r in results:
        width, height = img.size
        
        for box in r.boxes:
            x1, y1, x2, y2 = box.xyxy[0]
            confidence = box.conf[0]
            class_id = int(box.cls[0])
            class_name = model.names[class_id]

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
            
    return detections