"""
Eleni Shepherd Vision Microservice
Navigation (obstacle detection) + OCR for visually impaired users.
Run: pip install -r requirements.txt
     python app.py
Listens on http://localhost:5000
"""
import base64
import io
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# --- YOLO Object Detection (obstacles for navigation) ---
OBSTACLE_LABELS = {'person', 'chair', 'couch', 'table', 'bottle', 'cup', 'car', 'bicycle', 'motorcycle', 'bus', 'truck', 'stairs', 'door', 'tv', 'laptop', 'keyboard', 'cell phone', 'backpack', 'umbrella', 'handbag', 'bench', 'traffic light', 'fire hydrant', 'stop sign', 'potted plant', 'bed', 'dining table', 'toilet', 'books', 'clock', 'vase'}

def mock_detect(image_bytes):
    """Placeholder - replace with real YOLO inference"""
    return [
        {"label": "person", "confidence": 0.92, "bbox": {"x": 100, "y": 50, "w": 80, "h": 180}},
        {"label": "chair", "confidence": 0.87, "bbox": {"x": 200, "y": 120, "w": 60, "h": 90}},
    ]

def run_yolo_detect(image_bytes):
    try:
        # from ultralytics import YOLO
        # model = YOLO('yolov8n.pt')
        # results = model(image_bytes)
        # return [...]
        pass
    except Exception:
        pass
    return mock_detect(image_bytes)

def get_obstacles_from_detections(detections):
    """Filter detections to navigation-relevant obstacles"""
    obstacles = []
    for d in detections:
        label = (d.get('label') or '').lower()
        if label in OBSTACLE_LABELS or any(x in label for x in ('person', 'chair', 'table', 'stair', 'door')):
            obstacles.append({
                "label": d.get('label', 'object'),
                "confidence": d.get('confidence', 0),
                "bbox": d.get('bbox"),
                "hint": _obstacle_hint(d.get('label', 'object')),
            })
    return obstacles

def _obstacle_hint(label):
    """Human-readable navigation hint for TTS"""
    hints = {
        'person': 'Person ahead, proceed with caution',
        'chair': 'Chair in path',
        'couch': 'Furniture ahead',
        'table': 'Table in path',
        'stairs': 'Stairs detected',
        'door': 'Door detected',
        'car': 'Vehicle in area',
        'bicycle': 'Bicycle in path',
    }
    return hints.get((label or '').lower(), f'{label} detected ahead')

# --- OCR ---
_ocr_reader = None

def run_ocr(image_bytes):
    """Extract text from image using pytesseract or easyocr"""
    global _ocr_reader
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes))
        text = pytesseract.image_to_string(img)
        return (text or '').strip()
    except ImportError:
        pass
    except Exception as e:
        if 'tesseract' in str(e).lower():
            pass  # fall through to easyocr
        else:
            return f'[OCR error: {str(e)}]'
    try:
        import easyocr
        if _ocr_reader is None:
            _ocr_reader = easyocr.Reader(['en'], gpu=False)
        img = _bytes_to_cv(image_bytes)
        if img is None:
            return ''
        result = _ocr_reader.readtext(img)
        return ' '.join([r[1] for r in result])
    except ImportError:
        return '[OCR not configured: pip install pytesseract Pillow AND install tesseract-ocr, or pip install easyocr opencv-python]'

def _bytes_to_cv(image_bytes):
    try:
        import cv2
        import numpy as np
        nparr = np.frombuffer(image_bytes, np.uint8)
        return cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    except Exception:
        return None

def _read_image_from_request():
    """Extract image bytes from multipart or JSON base64"""
    image = request.files.get('image')
    if image and hasattr(image, 'read'):
        return image.read()
    b64 = request.json.get('imageBase64') if request.is_json else None
    if b64:
        return base64.b64decode(b64)
    return None

# --- Routes ---
@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "vision", "features": ["detect", "ocr", "navigate"]})

@app.route('/detect', methods=['POST'])
def detect():
    data = _read_image_from_request()
    if not data:
        return jsonify({"error": "image required (multipart 'image' or JSON imageBase64)"}), 400
    detections = run_yolo_detect(data)
    return jsonify({"detections": detections})

@app.route('/ocr', methods=['POST'])
def ocr():
    """Extract text from image (papers, documents) for TTS reading"""
    data = _read_image_from_request()
    if not data:
        return jsonify({"error": "image required (multipart 'image' or JSON imageBase64)"}), 400
    text = run_ocr(data)
    return jsonify({"text": text})

@app.route('/navigate', methods=['POST'])
def navigate():
    """Obstacle detection for navigation - returns objects + spoken hints"""
    data = _read_image_from_request()
    if not data:
        return jsonify({"error": "image required"}), 400
    detections = run_yolo_detect(data)
    obstacles = get_obstacles_from_detections(detections)
    hints = [o['hint'] for o in obstacles]
    return jsonify({
        "obstacles": obstacles,
        "hints": hints,
        "speech": '. '.join(hints) if hints else 'Path appears clear',
    })

@app.route('/analyze', methods=['POST'])
def analyze():
    """Full analysis: OCR + obstacles - for comprehensive scene understanding"""
    data = _read_image_from_request()
    if not data:
        return jsonify({"error": "image required"}), 400
    text = run_ocr(data)
    detections = run_yolo_detect(data)
    obstacles = get_obstacles_from_detections(detections)
    hints = [o['hint'] for o in obstacles]
    return jsonify({
        "ocr": {"text": text},
        "obstacles": obstacles,
        "hints": hints,
        "speech": ('. '.join(hints) + '. ' + text) if (hints or text) else 'No text or obstacles detected',
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
