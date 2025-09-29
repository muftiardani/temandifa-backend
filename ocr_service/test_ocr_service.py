import pytest
import io
from ocr_service.app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_scan_image_success(client, mocker):
    mock_tesseract = mocker.patch('ocr_service.app.pytesseract.image_to_string')
    mock_tesseract.return_value = 'Ini adalah teks dari gambar.'
    mocker.patch('ocr_service.app.Image.open')

    data = {
        'image': (io.BytesIO(b"fakeimagedata"), 'test.png')
    }
    rv = client.post('/scan', content_type='multipart/form-data', data=data)

    assert rv.status_code == 200
    assert rv.json == {'scannedText': 'Ini adalah teks dari gambar.'}