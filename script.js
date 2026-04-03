// ----------------------------------------------
// 🔧 CONFIGURATION: Hugging Face Space (UPDATED)
// ----------------------------------------------
const HF_SPACE_ID = "thivix/tiktok-hq-converter";
const ENDPOINT_NAME = "/convert_video";      // ✅ correct endpoint from your Space
const INPUT_PARAM_NAME = "input_path";       // ✅ correct parameter name

// ----------------------------------------------
// DOM elements (unchanged)
// ----------------------------------------------
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('videoInput');
const convertBtn = document.getElementById('convertBtn');
const previewSection = document.getElementById('previewSection');
const originalPreview = document.getElementById('originalPreview');
const fileInfo = document.getElementById('fileInfo');
const clearFileBtn = document.getElementById('clearFileBtn');
const outputSection = document.getElementById('outputSection');
const outputVideo = document.getElementById('outputVideo');
const downloadBtn = document.getElementById('downloadBtn');
const processingOverlay = document.getElementById('processingOverlay');
const errorToast = document.getElementById('errorToast');

let selectedFile = null;
let currentOutputUrl = null;

// Helper: show temporary error message
function showError(message) {
    errorToast.innerText = message;
    errorToast.classList.remove('hidden');
    setTimeout(() => {
        errorToast.classList.add('hidden');
    }, 4500);
}

// Helper: hide overlay and enable button after process finish
function hideOverlayAndEnable() {
    processingOverlay.classList.add('hidden');
    convertBtn.disabled = false;
}

// Reset output section
function resetOutput() {
    outputSection.classList.add('hidden');
    if (outputVideo.src) {
        URL.revokeObjectURL(outputVideo.src);
    }
    outputVideo.src = '';
    currentOutputUrl = null;
}

// Enable/disable convert based on file selection
function updateConvertButton() {
    convertBtn.disabled = !selectedFile;
}

// Clear selected file & preview
clearFileBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    previewSection.classList.add('hidden');
    originalPreview.src = '';
    resetOutput();
    updateConvertButton();
});

// handle file selection from input or drop
function handleFile(file) {
    if (!file || !file.type.startsWith('video/')) {
        showError('Please select a valid video file (MP4, WebM, MOV).');
        return false;
    }
    if (file.size > 210 * 1024 * 1024) {
        showError('File too large. Max 200MB recommended.');
        return false;
    }
    selectedFile = file;
    // Preview
    const url = URL.createObjectURL(file);
    originalPreview.src = url;
    previewSection.classList.remove('hidden');
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    fileInfo.innerText = `${file.name} (${sizeMB} MB)`;
    resetOutput();
    updateConvertButton();
    return true;
}

// Upload zone: click triggers hidden file input
uploadZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
});

// Drag & drop functionality
uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('upload-zone-drag');
});
uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('upload-zone-drag');
});
uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('upload-zone-drag');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
});

// ========== GRADIO INTEGRATION & CONVERSION (FIXED) ==========
async function sendVideoToHF(file) {
    const { Client } = await import('@gradio/client');
    
    try {
        // Connect to your Hugging Face Space
        const client = await Client.connect(HF_SPACE_ID);
        
        // Prepare the correct payload: { input_path: file }
        const result = await client.predict(ENDPOINT_NAME, {
            [INPUT_PARAM_NAME]: file
        });
        
        // Check response structure
        if (!result || !result.data || result.data.length === 0) {
            throw new Error('Server returned empty response.');
        }
        
        let outputVideoUrl = null;
        const firstOutput = result.data[0];
        
        // Handle different possible return types (string URL or object with url property)
        if (typeof firstOutput === 'string') {
            outputVideoUrl = firstOutput;
        } else if (firstOutput && typeof firstOutput === 'object' && firstOutput.url) {
            outputVideoUrl = firstOutput.url;
        } else if (firstOutput && firstOutput.value && typeof firstOutput.value === 'string') {
            outputVideoUrl = firstOutput.value;
        } else {
            throw new Error('Unexpected response format from AI backend.');
        }
        
        if (!outputVideoUrl || (!outputVideoUrl.startsWith('http') && !outputVideoUrl.startsWith('blob:'))) {
            throw new Error('Processed video URL not found in response.');
        }
        
        return outputVideoUrl;
    } catch (err) {
        console.error('Gradio API error:', err);
        // Provide user-friendly messages
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
            throw new Error('Cannot reach Hugging Face Space. Check your internet or the Space may be sleeping. Try again.');
        } else if (err.message.includes('404')) {
            throw new Error(`Endpoint ${ENDPOINT_NAME} not found on Space. Verify the Space's API.`);
        } else {
            throw err;
        }
    }
}

// download logic: fetch & save as blob (works cross-origin with CORS enabled on HF)
async function downloadVideoAsBlob(videoUrl, filename = "enhanced_video.mp4") {
    try {
        const response = await fetch(videoUrl);
        if (!response.ok) throw new Error('Download failed');
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
    } catch (err) {
        console.error(err);
        showError('Download error. Try right-click on video player and "Save video as".');
        window.open(videoUrl, '_blank');
    }
}

// MAIN CONVERT ACTION
convertBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        showError('Please select a video file first.');
        return;
    }
    
    resetOutput();
    processingOverlay.classList.remove('hidden');
    convertBtn.disabled = true;
    
    const handleError = (errMsg) => {
        hideOverlayAndEnable();
        showError(errMsg);
        console.error(errMsg);
    };
    
    try {
        const processedVideoUrl = await sendVideoToHF(selectedFile);
        currentOutputUrl = processedVideoUrl;
        outputVideo.src = processedVideoUrl;
        outputVideo.load();
        outputSection.classList.remove('hidden');
        processingOverlay.classList.add('hidden');
        convertBtn.disabled = false;
        
        const tempMsg = document.createElement('div');
        tempMsg.className = 'fixed top-20 right-6 bg-emerald-500 text-white px-4 py-2 rounded-full text-sm z-50 shadow-xl';
        tempMsg.innerText = '✅ Conversion complete! Video ready.';
        document.body.appendChild(tempMsg);
        setTimeout(() => tempMsg.remove(), 3000);
        
    } catch (error) {
        console.error('Conversion error:', error);
        let friendlyMsg = 'Server busy or API error. Please try again.';
        if (error.message.includes('Cannot reach Hugging Face')) friendlyMsg = error.message;
        else if (error.message.includes('fetch')) friendlyMsg = 'Network error. The Space might be waking up. Wait 10 seconds and retry.';
        else if (error.message.includes('422')) friendlyMsg = 'Unsupported video format or backend error.';
        handleError(friendlyMsg);
    }
});

// Download button logic
downloadBtn.addEventListener('click', async () => {
    if (!currentOutputUrl) {
        showError('No converted video found. Convert a video first.');
        return;
    }
    const originalName = selectedFile ? selectedFile.name.split('.')[0] : 'enhanced';
    const filename = `${originalName}_converted.mp4`;
    downloadBtn.innerText = '⏳ Preparing download...';
    downloadBtn.disabled = true;
    try {
        await downloadVideoAsBlob(currentOutputUrl, filename);
    } catch (err) {
        showError('Could not download directly. Right-click video and Save As.');
    } finally {
        downloadBtn.innerText = '⬇️ Download High Quality Video';
        downloadBtn.disabled = false;
    }
});

// Clean up object URLs on page unload
window.addEventListener('beforeunload', () => {
    if (originalPreview.src && originalPreview.src.startsWith('blob:')) URL.revokeObjectURL(originalPreview.src);
    if (outputVideo.src && outputVideo.src.startsWith('blob:')) URL.revokeObjectURL(outputVideo.src);
});

updateConvertButton();

console.log(`%c✅ Non Quality Drop AI | Connected to Space: ${HF_SPACE_ID} | Endpoint: ${ENDPOINT_NAME}`, 'background: #ec489a; color: white; padding: 4px 8px; border-radius: 8px;');