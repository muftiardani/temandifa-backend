FROM python:3.9-slim

WORKDIR /app

RUN apt-get update && apt-get install -y tesseract-ocr tesseract-ocr-ind build-essential

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 5003
CMD ["gunicorn", "--bind", "0.0.0.0:5003", "app:app"]