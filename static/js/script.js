// Speech-to-Text Web App JavaScript
class SpeechToTextApp {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.audioBlob = null;
        
        this.initializeElements();
        this.setupEventListeners();
    }
    
    initializeElements() {
        this.recordBtn = document.getElementById('recordBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.recordingStatus = document.getElementById('recordingStatus');
        this.audioPlayer = document.getElementById('audioPlayer');
        this.audioPlayback = document.getElementById('audioPlayback');
        this.transcribeBtn = document.getElementById('transcribeRecordingBtn');
        this.fileInput = document.getElementById('file');
        this.fileInfo = document.getElementById('fileInfo');
        this.uploadForm = document.getElementById('uploadForm');
    }
    
    setupEventListeners() {
        // Recording controls
        if (this.recordBtn) {
            this.recordBtn.addEventListener('click', () => this.startRecording());
        }
        
        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', () => this.stopRecording());
        }
        
        if (this.transcribeBtn) {
            this.transcribeBtn.addEventListener('click', () => this.transcribeRecording());
        }
        
        // File upload
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }
        
        if (this.uploadForm) {
            this.uploadForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }
    }
    
    async startRecording() {
        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Create MediaRecorder
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            // Handle data available
            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };
            
            // Handle recording stop
            this.mediaRecorder.onstop = () => {
                this.audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(this.audioBlob);
                this.audioPlayback.src = audioUrl;
                this.audioPlayer.style.display = 'block';
                this.transcribeBtn.style.display = 'block';
                
                // Stop all audio tracks
                stream.getTracks().forEach(track => track.stop());
            };
            
            // Start recording
            this.mediaRecorder.start();
            this.isRecording = true;
            
            // Update UI
            this.updateRecordingUI();
            
        } catch (error) {
            console.error('Error starting recording:', error);
            this.showToast('Error accessing microphone. Please check permissions.', 'error');
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.updateRecordingUI();
        }
    }
    
    updateRecordingUI() {
        if (this.isRecording) {
            this.recordBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.recordingStatus.innerHTML = `
                <div class="text-danger">
                    <span class="recording-indicator"></span>
                    Recording in progress...
                </div>
            `;
        } else {
            this.recordBtn.disabled = false;
            this.stopBtn.disabled = true;
            this.recordingStatus.innerHTML = '<p class="text-success">Recording completed. You can now transcribe or record again.</p>';
        }
    }
    
    async transcribeRecording() {
        if (!this.audioBlob) {
            this.showToast('No recording available to transcribe.', 'error');
            return;
        }
        
        try {
            // Show loading state
            this.transcribeBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Transcribing...';
            this.transcribeBtn.disabled = true;
            
            // Prepare form data
            const formData = new FormData();
            formData.append('audio', this.audioBlob, 'recording.wav');
            formData.append('method', document.getElementById('recordMethod').value);
            
            // Send to server
            const response = await fetch('/record', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok && !result.error) {
                // Redirect to results page
                this.displayRecordingResult(result);
            } else {
                this.showToast(result.error || 'Error transcribing recording', 'error');
            }
            
        } catch (error) {
            console.error('Error transcribing recording:', error);
            this.showToast('Error transcribing recording. Please try again.', 'error');
        } finally {
            // Reset button
            this.transcribeBtn.innerHTML = '<i class="fas fa-magic me-2"></i>Transcribe Recording';
            this.transcribeBtn.disabled = false;
        }
    }
    
    displayRecordingResult(result) {
        // Create result page content
        const resultHTML = `
            <div class="card shadow-lg mt-4">
                <div class="card-header bg-success text-white">
                    <h3 class="card-title mb-0">
                        <i class="fas fa-file-alt me-2"></i>Transcription Result
                    </h3>
                </div>
                <div class="card-body">
                    <div class="transcription-text p-3 bg-light rounded">
                        ${result.transcription}
                    </div>
                    <div class="mt-3">
                        <button class="btn btn-outline-primary" onclick="copyToClipboard('${result.transcription}')">
                            <i class="fas fa-copy me-2"></i>Copy Text
                        </button>
                        <button class="btn btn-outline-success" onclick="downloadText('${result.transcription}', 'transcription.txt')">
                            <i class="fas fa-download me-2"></i>Download
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Insert result after recording section
        const recordingCard = document.querySelector('.card');
        recordingCard.insertAdjacentHTML('afterend', resultHTML);
        
        // Scroll to result
        setTimeout(() => {
            const resultCard = document.querySelector('.card:last-child');
            resultCard.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }
    
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            const fileSize = (file.size / 1024 / 1024).toFixed(2);
            const fileType = file.type || 'Unknown';
            
            this.fileInfo.innerHTML = `
                <strong>File:</strong> ${file.name}<br>
                <strong>Size:</strong> ${fileSize} MB<br>
                <strong>Type:</strong> ${fileType}
            `;
            
            // Validate file size
            if (file.size > 16 * 1024 * 1024) {
                this.showToast('File size exceeds 16MB limit.', 'error');
                event.target.value = '';
                this.fileInfo.textContent = 'No file selected';
            }
        } else {
            this.fileInfo.textContent = 'No file selected';
        }
    }
    
    handleFormSubmit(event) {
        const submitBtn = event.target.querySelector('button[type="submit"]');
        const fileInput = event.target.querySelector('input[type="file"]');
        
        if (!fileInput.files.length) {
            event.preventDefault();
            this.showToast('Please select a file to upload.', 'error');
            return;
        }
        
        // Show loading state
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';
        submitBtn.disabled = true;
        
        // Add loading class
        this.uploadForm.classList.add('loading');
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `alert alert-${type === 'error' ? 'danger' : 'success'} position-fixed`;
        toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        toast.innerHTML = `
            ${message}
            <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
        `;
        
        document.body.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }
}

// Utility functions
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Text copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Could not copy text: ', err);
        showToast('Failed to copy text', 'error');
    });
}

function downloadText(text, filename) {
    const timestamp = new Date().toLocaleString();
    const content = `Speech-to-Text Transcription
Generated on: ${timestamp}

TRANSCRIPTION:
${text}

---
Generated by AI Speech-to-Text Converter
`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showToast('Transcription downloaded!', 'success');
}

function downloadTranscription() {
    const transcriptionText = document.getElementById('transcriptionText').textContent;
    const audioInfo = document.getElementById('audioInfo').textContent;
    const timestamp = new Date().toLocaleString();
    
    const content = `Speech-to-Text Transcription Report
Generated on: ${timestamp}

TRANSCRIPTION:
${transcriptionText}

AUDIO INFORMATION:
${audioInfo}

---
Generated by AI Speech-to-Text Converter
`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showToast('Transcription downloaded!', 'success');
}

function shareTranscription() {
    const transcriptionText = document.getElementById('transcriptionText').textContent;
    
    if (navigator.share) {
        navigator.share({
            title: 'Speech-to-Text Transcription',
            text: transcriptionText,
        }).then(() => {
            showToast('Transcription shared successfully!', 'success');
        }).catch(err => {
            console.error('Error sharing:', err);
            copyToClipboard(transcriptionText);
        });
    } else {
        // Fallback to copy
        copyToClipboard(transcriptionText);
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type === 'error' ? 'danger' : 'success'} position-fixed`;
    toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    toast.innerHTML = `
        ${message}
        <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
    `;
    
    document.body.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 3000);
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SpeechToTextApp();
});
