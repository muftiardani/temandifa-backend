import pytest
from app import app
import io

@pytest.fixture
def client():
    app.config['TESTING'] = True
    app.config['MODEL'] = None
    with app.test_client() as client:
        yield client

def test_transcribe_success(client, mocker):
    """Test successful audio transcription."""
    # Mock model whisper agar tidak perlu di-load
    mocker.patch('app.model')
    mocker.patch('app.model.transcribe', return_value={'text': 'Ini adalah hasil transkripsi.'})

    # Mock ffmpeg
    mocker.patch('ffmpeg.run', return_value=(b'fake_audio_bytes', None))

    data = {
        'audio': (io.BytesIO(b"fakeaudiodata"), 'test.mp3')
    }
    rv = client.post('/transcribe', content_type='multipart/form-data', data=data)

    assert rv.status_code == 200
    assert rv.json == {'transcribedText': 'Ini adalah hasil transkripsi.'}