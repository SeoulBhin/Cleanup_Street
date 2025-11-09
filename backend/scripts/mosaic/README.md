## Mosaic toolkit

This folder keeps every asset that powers the standalone mosaic pipeline used by the backend service.

### Layout
- `mosaic_processor.py` - YOLO-powered CLI that masks faces and plates
- `requirements.txt` - minimal dependency list for the script
- `.venv/` - optional local virtual environment (ignored in Docker builds)

### Local setup
```powershell
cd backend/scripts/mosaic
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

On macOS/Linux:
```bash
cd backend/scripts/mosaic
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Running the script manually
```bash
python mosaic_processor.py \
  path/to/image.jpg \
  --output outputs \
  --face-model ../../../models/face/yolov8n-face.pt \
  --plate-model ../../../models/plate/plate-detector.pt
```

During Docker builds the same `requirements.txt` is installed into `/app/.venv`, and the backend points to `/app/scripts/mosaic/mosaic_processor.py` via the `IMAGE_PROCESSING_*` environment variables.
