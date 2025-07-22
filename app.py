from flask import Flask, render_template, request, jsonify, flash, redirect, url_for, send_file
import speech_recognition as sr
import torch
from transformers import Wav2Vec2ForCTC, Wav2Vec2Tokenizer
import librosa
import soundfile as sf
import numpy as np
from pathlib import Path
import os
import tempfile
import uuid
from datetime import datetime
import logging
from werkzeug.utils import secure_filename
import io
import base64
import wave

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'  
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  
app.config['UPLOAD_FOLDER'] = 'static/uploads'

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

ALLOWED_EXTENSIONS = {'wav', 'mp3', 'flac', 'ogg', 'm4a', 'mp4', 'wma'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

class SpeechToTextSystem:
    def __init__(self):
        """Initialize the speech recognition system with pre-trained models."""
        try:
            self.recognizer = sr.Recognizer()
            self.microphone = sr.Microphone()
            
            logger.info("Loading Wav2Vec2 model...")
            self.tokenizer = Wav2Vec2Tokenizer.from_pretrained("facebook/wav2vec2-base-960h")
            self.model = Wav2Vec2ForCTC.from_pretrained("facebook/wav2vec2-base-960h")
            
            with self.microphone as source:
                self.recognizer.adjust_for_ambient_noise(source)
            
            logger.info("Speech-to-Text system initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing Speech-to-Text system: {str(e)}")
            raise
    
    def transcribe_audio_file(self, audio_file_path):
        """
        Transcribe audio from a file using Wav2Vec2.
        
        Args:
            audio_file_path (str): Path to the audio file
        
        Returns:
            dict: Dictionary containing transcription and metadata
        """
        try:
            audio_input, sample_rate = librosa.load(audio_file_path, sr=16000)
            duration = len(audio_input) / sample_rate
            
            input_values = self.tokenizer(audio_input, return_tensors="pt").input_values
            
            with torch.no_grad():
                logits = self.model(input_values).logits
            
            predicted_ids = torch.argmax(logits, dim=-1)
            transcription = self.tokenizer.decode(predicted_ids[0])
            
            return {
                'transcription': transcription.strip(),
                'duration': round(duration, 2),
                'sample_rate': sample_rate,
                'method': 'Wav2Vec2',
                'error': False
            }
            
        except Exception as e:
            logger.error(f"Error transcribing audio file: {str(e)}")
            return {
                'transcription': f"Error transcribing audio: {str(e)}",
                'duration': 0,
                'sample_rate': 0,
                'method': 'Wav2Vec2',
                'error': True
            }
    
    def transcribe_with_google(self, audio_file_path):
        """
        Transcribe audio using Google Speech Recognition as fallback.
        
        Args:
            audio_file_path (str): Path to the audio file
        
        Returns:
            dict: Dictionary containing transcription and metadata
        """
        try:
            with sr.AudioFile(audio_file_path) as source:
                audio = self.recognizer.record(source)
            
            with wave.open(audio_file_path, 'rb') as wav_file:
                duration = wav_file.getnframes() / wav_file.getframerate()
            
            transcription = self.recognizer.recognize_google(audio)
            
            return {
                'transcription': transcription,
                'duration': round(duration, 2),
                'sample_rate': 16000,
                'method': 'Google Speech Recognition',
                'error': False
            }
            
        except sr.UnknownValueError:
            return {
                'transcription': "Could not understand audio",
                'duration': 0,
                'sample_rate': 0,
                'method': 'Google Speech Recognition',
                'error': True
            }
        except sr.RequestError as e:
            return {
                'transcription': f"Error with speech recognition service: {str(e)}",
                'duration': 0,
                'sample_rate': 0,
                'method': 'Google Speech Recognition',
                'error': True
            }
        except Exception as e:
            return {
                'transcription': f"Error transcribing audio: {str(e)}",
                'duration': 0,
                'sample_rate': 0,
                'method': 'Google Speech Recognition',
                'error': True
            }
    
    def transcribe_recorded_audio(self, audio_data):
        """
        Transcribe recorded audio from the web interface.
        
        Args:
            audio_data (bytes): Raw audio data
        
        Returns:
            dict: Dictionary containing transcription and metadata
        """
        try:
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
                tmp_file.write(audio_data)
                tmp_file_path = tmp_file.name
            
            result = self.transcribe_audio_file(tmp_file_path)
            
            os.unlink(tmp_file_path)
            
            return result
            
        except Exception as e:
            logger.error(f"Error transcribing recorded audio: {str(e)}")
            return {
                'transcription': f"Error transcribing recorded audio: {str(e)}",
                'duration': 0,
                'sample_rate': 0,
                'method': 'Wav2Vec2',
                'error': True
            }

try:
    stt_system = SpeechToTextSystem()
except Exception as e:
    logger.error(f"Failed to initialize Speech-to-Text system: {str(e)}")
    stt_system = None

@app.route('/')
def index():
    """Main page with the speech-to-text interface."""
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    """Handle file upload and transcription."""
    if not stt_system:
        flash('Speech-to-Text system not available', 'error')
        return redirect(url_for('index'))
    
    if 'file' not in request.files:
        flash('No file selected', 'error')
        return redirect(url_for('index'))
    
    file = request.files['file']
    if file.filename == '':
        flash('No file selected', 'error')
        return redirect(url_for('index'))
    
    if file and allowed_file(file.filename):
        try:
            filename = secure_filename(file.filename)
            unique_filename = f"{uuid.uuid4()}_{filename}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            file.save(filepath)
            
            method = request.form.get('method', 'wav2vec2')
            
            if method == 'google':
                result = stt_system.transcribe_with_google(filepath)
            else:
                result = stt_system.transcribe_audio_file(filepath)
            
            result['filename'] = filename
            result['timestamp'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            os.remove(filepath)
            
            if result['error']:
                flash(result['transcription'], 'error')
                return redirect(url_for('index'))
            
            return render_template('result.html', result=result, source_type='file')
            
        except Exception as e:
            logger.error(f"Error processing uploaded file: {str(e)}")
            flash(f'Error processing file: {str(e)}', 'error')
            return redirect(url_for('index'))
    
    else:
        flash('Invalid file type. Please upload a valid audio file.', 'error')
        return redirect(url_for('index'))

@app.route('/record', methods=['POST'])
def record_audio():
    """Handle audio recording and transcription."""
    if not stt_system:
        return jsonify({'error': 'Speech-to-Text system not available'}), 500
    
    try:
        audio_data = request.files['audio'].read()
        
        method = request.form.get('method', 'wav2vec2')
        
        result = stt_system.transcribe_recorded_audio(audio_data)
        
        result['timestamp'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        result['source_type'] = 'recording'
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error processing recorded audio: {str(e)}")
        return jsonify({'error': f'Error processing audio: {str(e)}'}), 500

@app.route('/api/transcribe', methods=['POST'])
def api_transcribe():
    """API endpoint for transcription."""
    if not stt_system:
        return jsonify({'error': 'Speech-to-Text system not available'}), 500
    
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type'}), 400
        
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
            file.save(tmp_file.name)
            tmp_file_path = tmp_file.name
        
        method = request.form.get('method', 'wav2vec2')
        if method == 'google':
            result = stt_system.transcribe_with_google(tmp_file_path)
        else:
            result = stt_system.transcribe_audio_file(tmp_file_path)
        
        os.unlink(tmp_file_path)
        
        result['timestamp'] = datetime.now().isoformat()
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in API transcribe: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/health')
def health_check():
    """Health check endpoint."""
    status = {
        'status': 'healthy' if stt_system else 'unhealthy',
        'timestamp': datetime.now().isoformat(),
        'system_available': stt_system is not None
    }
    return jsonify(status)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)