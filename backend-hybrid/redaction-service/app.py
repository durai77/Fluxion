"""
CoverUP-Inspired Redaction Microservice
Converts PDF/PNG/JPG files to image-based PDFs, removing all text layers.
This ensures no text can be copied without OCR, mirroring CoverUP's functionality.

Uses the same core libraries as CoverUP:
- pypdfium2 for PDF rendering
- fpdf2 for PDF creation
- Pillow for image processing
"""

import os
import io
import tempfile
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

try:
    import pypdfium2 as pdfium
except ImportError:
    pdfium = None

try:
    from fpdf import FPDF
except ImportError:
    FPDF = None

try:
    from PIL import Image
except ImportError:
    Image = None

app = Flask(__name__)
frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:5173')
CORS(app, origins=[frontend_url], supports_credentials=True)

# Config
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
SUPPORTED_EXTENSIONS = {'.pdf', '.png', '.jpg', '.jpeg'}
DEFAULT_DPI = 200  # Resolution for PDF-to-image conversion
COMPRESS_QUALITY = 85  # JPEG quality for compressed mode


def check_dependencies():
    """Verify all required libraries are available."""
    missing = []
    if pdfium is None:
        missing.append('pypdfium2')
    if FPDF is None:
        missing.append('fpdf2')
    if Image is None:
        missing.append('Pillow')
    return missing


def pdf_to_images(pdf_bytes, dpi=DEFAULT_DPI):
    """Convert each page of a PDF to PIL Image objects using pypdfium2."""
    pdf = pdfium.PdfDocument(pdf_bytes)
    images = []
    for i in range(len(pdf)):
        page = pdf[i]
        scale = dpi / 72  # 72 is the default PDF DPI
        bitmap = page.render(scale=scale)
        pil_image = bitmap.to_pil()
        # Ensure RGB mode (remove alpha if present)
        if pil_image.mode == 'RGBA':
            background = Image.new('RGB', pil_image.size, (255, 255, 255))
            background.paste(pil_image, mask=pil_image.split()[3])
            pil_image = background
        elif pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')
        images.append(pil_image)
    pdf.close()
    return images


def images_to_pdf(images, compress=True):
    """Convert a list of PIL Image objects to an image-based PDF using fpdf2."""
    pdf = FPDF()
    pdf.set_auto_page_break(auto=False)
    
    for img in images:
        # Save image to temp buffer
        img_buffer = io.BytesIO()
        if compress:
            img.save(img_buffer, format='JPEG', quality=COMPRESS_QUALITY, optimize=True)
        else:
            img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        # Add page with image dimensions
        width_mm = img.width * 25.4 / DEFAULT_DPI
        height_mm = img.height * 25.4 / DEFAULT_DPI
        
        pdf.add_page(orientation='P' if height_mm >= width_mm else 'L',
                     format=(width_mm, height_mm))
        
        ext = 'JPEG' if compress else 'PNG'
        pdf.image(img_buffer, x=0, y=0, w=width_mm, h=height_mm, type=ext)
    
    return pdf.output()


def redact_pdf(pdf_bytes, compress=True):
    """
    Redact a PDF by converting all pages to images.
    This removes all text layers, metadata, hidden elements.
    """
    images = pdf_to_images(pdf_bytes)
    result = images_to_pdf(images, compress=compress)
    
    # Clean up
    for img in images:
        img.close()
    
    return result


def redact_image(image_bytes, filename, compress=True):
    """
    Convert a single image (PNG/JPG) to an image-based PDF.
    """
    img = Image.open(io.BytesIO(image_bytes))
    
    # Ensure RGB
    if img.mode == 'RGBA':
        background = Image.new('RGB', img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[3])
        img = background
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    
    result = images_to_pdf([img], compress=compress)
    img.close()
    
    return result


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    missing = check_dependencies()
    return jsonify({
        'status': 'ok' if not missing else 'degraded',
        'service': 'CoverUP Redaction Service',
        'supported_formats': list(SUPPORTED_EXTENSIONS),
        'missing_dependencies': missing,
    })


@app.route('/redact', methods=['POST'])
def redact():
    """
    Redact an uploaded file.
    
    POST /redact
    Content-Type: multipart/form-data
    Body: file (PDF, PNG, JPG)
    Query params: compress=true|false (default: true)
    
    Returns: redacted PDF file
    """
    # Check dependencies
    missing = check_dependencies()
    if missing:
        return jsonify({
            'error': f'Missing dependencies: {", ".join(missing)}. Install with: pip install {" ".join(missing)}'
        }), 500
    
    # Validate file
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'No filename provided'}), 400
    
    # Check extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        return jsonify({
            'error': f'Unsupported format: {ext}. Supported: {", ".join(SUPPORTED_EXTENSIONS)}'
        }), 400
    
    # Read file
    file_bytes = file.read()
    
    # Check size
    if len(file_bytes) > MAX_FILE_SIZE:
        return jsonify({'error': f'File too large. Max: {MAX_FILE_SIZE // (1024*1024)}MB'}), 400
    
    # Get compression preference
    compress = request.args.get('compress', 'true').lower() == 'true'
    
    try:
        if ext == '.pdf':
            result_bytes = redact_pdf(file_bytes, compress=compress)
        else:
            result_bytes = redact_image(file_bytes, file.filename, compress=compress)
        
        # Create output filename
        base_name = os.path.splitext(file.filename)[0]
        output_filename = f'{base_name}_redacted.pdf'
        
        # Return as PDF download
        result_buffer = io.BytesIO(result_bytes)
        result_buffer.seek(0)
        
        return send_file(
            result_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=output_filename
        )
        
    except Exception as e:
        app.logger.error(f'Redaction failed: {str(e)}')
        return jsonify({'error': f'Redaction failed: {str(e)}'}), 500


if __name__ == '__main__':
    missing = check_dependencies()
    if missing:
        print(f'WARNING: Missing dependencies: {", ".join(missing)}')
        print(f'Install with: pip install {" ".join(missing)}')
    else:
        print('All dependencies loaded successfully')
    
    print('CoverUP Redaction Service starting...')
    print(f'Supported formats: {", ".join(SUPPORTED_EXTENSIONS)}')
    
    port = int(os.environ.get('PORT', '5000'))
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(host='0.0.0.0', port=port, debug=debug)
