import pytest
from app import app
import io

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_scan_image_success(client, mocker):
    """Test successful image scanning."""
    # Mock pytesseract agar tidak menjalankan Tesseract OCR asli
    mock_tesseract = mocker.patch('app.pytesseract.image_to_string')
    mock_tesseract.return_value = 'Ini adalah teks dari gambar.'
    
    # Mock Image.open
    mocker.patch('app.Image.open')

    data = {
        'image': (io.BytesIO(b"fakeimagedata"), 'test.png')
    }
    rv = client.post('/scan', content_type='multipart/form-data', data=data)

    assert rv.status_code == 200
    assert rv.json == {'scannedText': 'Ini adalah teks dari gambar.'}