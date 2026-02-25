# Eleni Shepherd Vision Microservice

Python service for OCR and object detection (navigation/obstacles). Used by the NestJS backend.

## Setup

```bash
cd vision-service
pip install -r requirements.txt
```

### OCR (pytesseract)

1. Install Tesseract OCR on your system:
   - **Windows**: Download from https://github.com/UB-Mannheim/tesseract/wiki
   - **Ubuntu**: `sudo apt install tesseract-ocr`
   - **macOS**: `brew install tesseract`
2. `pip install pytesseract Pillow`

### OCR (alternative: easyocr)

```bash
pip install easyocr opencv-python
```

## Run

```bash
python app.py
# Listens on http://localhost:5000
```

## Endpoints

| Endpoint | Description |
|----------|-------------|
| GET /health | Health check |
| POST /detect | YOLO object detection |
| POST /ocr | Extract text from image |
| POST /navigate | Obstacle detection + spoken hints |
| POST /analyze | Full: OCR + obstacles |

Accepts: `multipart/form-data` with `image` file, or JSON `{"imageBase64": "..."}`.
