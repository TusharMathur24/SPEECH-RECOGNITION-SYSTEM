# Speech-to-Text Transcription Web Application

A web application for converting speech (audio files or microphone recordings) to text using state-of-the-art deep learning models (Wav2Vec2) and Google Speech Recognition as a fallback. Built with Flask, HuggingFace Transformers, and NLTK.

## Features

- **Upload Audio Files**: Supports WAV, MP3, FLAC, OGG, M4A, MP4, and WMA formats.
- **Record Audio**: Record directly from your browser and transcribe.
- **Deep Learning Model**: Uses Facebook's Wav2Vec2 for high-quality transcription.
- **Google Speech Recognition**: Optional fallback for transcription.
- **REST API**: Programmatic access for file transcription.
- **Health Check Endpoint**: For service monitoring.

## Requirements

- Python 3.7+
- Flask
- torch
- transformers
- librosa
- soundfile
- numpy
- SpeechRecognition
- wave

## Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/yourusername/flask-speech-to-text.git
   cd flask-speech-to-text
   ```

2. **Create a virtual environment (optional):**
   ```sh
   python -m venv venv
   venv\Scripts\activate  # On Windows
   # or
   source venv/bin/activate  # On Linux/Mac
   ```

3. **Install dependencies:**
   ```sh
   pip install -r requirements.txt
   ```
   If `requirements.txt` is missing, install manually:
   ```sh
   pip install flask torch transformers librosa soundfile numpy SpeechRecognition
   ```

## Usage

### Run the Application

```sh
python app.py
```

The app will be available at [http://localhost:5000](http://localhost:5000).

### Web Interface

- Go to [http://localhost:5000](http://localhost:5000)
- Upload an audio file or record your voice.
- Choose the transcription method (Wav2Vec2 or Google).
- View and copy the transcribed text.

### API Usage

Send a POST request to `/api/transcribe` with an audio file:

```sh
curl -X POST http://localhost:5000/api/transcribe \
     -F "file=@your_audio.wav" \
     -F "method=wav2vec2"
```

- `method` can be `wav2vec2` (default) or `google`.

### Health Check

Check if the service is running:

```sh
curl http://localhost:5000/health
```

## Project Structure

```
app.py
templates/
    index.html
    result.html
static/
    uploads/
```

## Notes

- The first run may take time as the Wav2Vec2 model is downloaded.
- For Google Speech Recognition, an internet connection is required.
- Uploaded files are deleted after processing for privacy.

## License

MIT License

---

**Author:** Tushar Mathur
