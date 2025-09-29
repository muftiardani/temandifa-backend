import pytest
import io
from yolo_detector.app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_health_check(client, mocker):
    mocker.patch('yolo_detector.app.get_yolo_model', return_value='mock_model')
    rv = client.get('/health')
    assert rv.status_code == 200
    assert rv.json == {"status": "OK", "message": "Model is loaded."}

def test_detect_no_file(client):
    rv = client.post('/detect')
    assert rv.status_code == 400
    assert 'error' in rv.json

def test_detect_success(client, mocker):
    mocker.patch('yolo_detector.app.get_yolo_model', return_value='mock_model')
    mock_detect = mocker.patch('yolo_detector.app.detect_objects_from_image')
    mock_detect.return_value = [{'class': 'person', 'confidence': 0.9}]

    data = {
        'image': (io.BytesIO(b"fakeimagedata"), 'test.jpg')
    }
    rv = client.post('/detect', content_type='multipart/form-data', data=data)

    assert rv.status_code == 200
    assert rv.json == [{'class': 'person', 'confidence': 0.9}]
    mock_detect.assert_called_once()