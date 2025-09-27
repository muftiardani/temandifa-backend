FROM python:3.9-slim

WORKDIR /app

RUN apt-get update && apt-get install -y ffmpeg

COPY ./voice_transcriber/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ./voice_transcriber .

EXPOSE 5002

CMD ["gunicorn", "--bind", "0.0.0.0:5002", "app:app"]