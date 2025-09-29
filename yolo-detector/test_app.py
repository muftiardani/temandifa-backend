import pytest
from app import app
import io

@pytest.fixture
def client():
    app.config['TESTING'] = True
    # Matikan model loading saat testing
    app.config['MODEL'] = None 
    with app.test_client() as client:
        yield client

def test_health_check(client, mocker):
    """Test the health check endpoint."""
    # Mock model agar dianggap sudah di-load
    mocker.patch('app.model', 'mock_model')
    rv = client.get('/health')
    assert rv.status_code == 200
    assert rv.json == {"status": "OK", "message": "Model is loaded."}

def test_detect_no_file(client):
    """Test detect endpoint without a file."""
    rv = client.post('/detect')
    assert rv.status_code == 400
    assert 'error' in rv.json

def test_detect_success(client, mocker):
    """Test successful object detection."""
    # Mock fungsi detect_objects_from_image agar tidak menjalankan model asli
    mock_detect = mocker.patch('app.detect_objects_from_image')
    mock_detect.return_value = [{'class': 'person', 'confidence': 0.9}]

    data = {
        'image': (io.BytesIO(b"fakeimagedata"), 'test.jpg')
    }
    rv = client.post('/detect', content_type='multipart/form-data', data=data)

    assert rv.status_code == 200
    assert rv.json == [{'class': 'person', 'confidence': 0.9}]
    mock_detect.assert_called_once()