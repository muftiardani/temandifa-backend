import pytest
import io
from voice_transcriber.app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_transcribe_success(client, mocker):
    """Test successful audio transcription."""
    mock_model = mocker.patch('voice_transcriber.app.get_whisper_model')
    mock_model.return_value.transcribe.return_value = {'text': 'Ini adalah hasil transkripsi.'}

    mock_process = mocker.Mock()
    mock_process.run.return_value = (b'fake_processed_audio_bytes', None)

    mocker.patch('voice_transcriber.app.ffmpeg.input').return_value.output.return_value = mock_process

    data = {
        'audio': (io.BytesIO(b"fakeaudiodata"), 'test.mp3')
    }
    rv = client.post('/transcribe', content_type='multipart/form-data', data=data)

    assert rv.status_code == 200
    assert rv.json == {'transcribedText': 'Ini adalah hasil transkripsi.'}