FROM python:3.9-slim

WORKDIR /app

COPY ./yolo-detector/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ./yolo-detector .
COPY ./yolov8n.pt .

EXPOSE 5001

CMD ["gunicorn", "--bind", "0.0.0.0:5001", "app:app"]