// ----------------------------------------------
// CONFIGURATION: Hugging Face Space
// ----------------------------------------------
const HF_SPACE_ID = "thivix/tiktok-hq-converter";
const ENDPOINT_NAME = "/convert_video";
const INPUT_PARAM_NAME = "input_path";

// ----------------------------------------------
// DOM elements
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
    }, 5000);
}

// Helper: hide overlay and enable button
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

// Handle file selection from input or drop
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

// Upload zone events
uploadZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
});

// Drag & drop
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

// ----------------------------------------------
// GRADIO INTEGRATION (FIXED)
// ----------------------------------------------
async function sendVideoToHF(file) {
    const { Client } = await import('@gradio/client');
    
    // Connect to the Space (this may take a few seconds if it's sleeping)
    console.log(`Connecting to ${HF_SPACE_ID}...`);
    const client = await Client.connect(HF_SPACE_ID);
    console.log('Connected successfully.');
    
    // The Gradio client automatically uploads the file when we pass a File/Blob
    // It converts it to the required FileData structure internally.
    console.log('Sending video to endpoint:', ENDPOINT_NAME);
    const result = await client.predict(ENDPOINT_NAME, {
        [INPUT_PARAM_NAME]: file
    });
    console.log('Raw response:', result);
    
    if (!result || !result.data || result.data.length === 0) {
        throw new Error('Server returned an empty response.');
    }
    
    let outputVideoUrl = null;
    const firstOutput = result.data[0];
    
    // Handle different possible return types:
    // 1. Direct string URL (absolute or relative)
    // 2. Object with 'url' property (Gradio file object)
    // 3. Object with 'path' property (temporary file path)
    // 4. Blob URL (unlikely but possible)
    if (typeof firstOutput === 'string') {
        outputVideoUrl = firstOutput;
    } else if (firstOutput && typeof firstOutput === 'object') {
        if (firstOutput.url) {
            outputVideoUrl = firstOutput.url;
        } else if (firstOutput.path) {
            // If it's a relative path, construct full URL
            const baseUrl = `https://${HF_SPACE_ID}.hf.space`;
            outputVideoUrl = firstOutput.path.startsWith('http') 
                ? firstOutput.path 
                : `${baseUrl}${firstOutput.path}`;
        } else if (firstOutput.value && typeof firstOutput.value === 'string') {
            outputVideoUrl = firstOutput.value;
        }
    }
    
    // If still no URL, try to see if it's a file object with a blob
    if (!outputVideoUrl && firstOutput && firstOutput.blob) {
        outputVideoUrl = URL.createObjectURL(firstOutput.blob);
    }
    
    if (!outputVideoUrl) {
        throw new Error('Could not extract video URL from the response. Check the Space output format.');
    }
    
    // Ensure URL is absolute (if relative, prepend Space URL)
    if (outputVideoUrl.startsWith('/')) {
        const baseUrl = `https://${HF_SPACE_ID}.hf.space`;
        outputVideoUrl = baseUrl + outputVideoUrl;
    }
    
    console.log('Processed video URL:', outputVideoUrl);
    return outputVideoUrl;
}

// Download video (fallback to direct save)
async function downloadVideoAsBlob(videoUrl, filename = "enhanced_video.mp4") {
    try {
        // Try to fetch as blob (may fail due to CORS)
        const response = await fetch(videoUrl);
        if (!response.ok) throw new Error('Fetch failed');
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
        console.warn('Blob download failed, offering alternative:', err);
        showError('Direct download not available. Right-click the video and select "Save video as..."');
        // Still open the video in a new tab as fallback
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
    
    // Show a "waking up" hint if first try (optional)
    const isFirstAttempt = !window._conversionAttempted;
    if (isFirstAttempt) {
        const wakeMsg = document.createElement('div');
        wakeMsg.innerText = '⏳ Hugging Face Space may be sleeping. First conversion might take 15-20 seconds...';
        wakeMsg.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-yellow-600 text-white px-4 py-2 rounded-full text-sm z-50 shadow-xl';
        document.body.appendChild(wakeMsg);
        setTimeout(() => wakeMsg.remove(), 5000);
        window._conversionAttempted = true;
    }
    
    try {
        const processedVideoUrl = await sendVideoToHF(selectedFile);
        currentOutputUrl = processedVideoUrl;
        
        // Directly set video source (bypass CORS for <video> tag)
        outputVideo.src = processedVideoUrl;
        outputVideo.load();
        outputSection.classList.remove('hidden');
        
        // Success message
        const successMsg = document.createElement('div');
        successMsg.innerText = '✅ Conversion complete! Video ready.';
        successMsg.className = 'fixed top-20 right-6 bg-emerald-500 text-white px-4 py-2 rounded-full text-sm z-50 shadow-xl';
        document.body.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 3000);
        
    } catch (error) {
        console.error('Conversion error:', error);
        let friendlyMsg = 'Conversion failed. ';
        if (error.message.includes('Cannot reach') || error.message.includes('Failed to fetch')) {
            friendlyMsg += 'Unable to connect to Hugging Face Space. It might be sleeping or offline. Please try again in 30 seconds.';
        } else if (error.message.includes('404')) {
            friendlyMsg += `Endpoint "${ENDPOINT_NAME}" not found. Verify the Space's API.`;
        } else if (error.message.includes('422')) {
            friendlyMsg += 'Unsupported video format or backend error. Try a different MP4 file.';
        } else {
            friendlyMsg += error.message;
        }
        showError(friendlyMsg);
    } finally {
        hideOverlayAndEnable();
    }
});

// Download button logic
downloadBtn.addEventListener('click', async () => {
    if (!currentOutputUrl) {
        showError('No converted video found. Convert a video first.');
        return;
    }
    const originalName = selectedFile ? selectedFile.name.split('.')[0] : 'enhanced';
    const filename = `${originalName}_60fps.mp4`;
    downloadBtn.innerText = '⏳ Preparing...';
    downloadBtn.disabled = true;
    try {
        await downloadVideoAsBlob(currentOutputUrl, filename);
    } catch (err) {
        showError('Download failed. Right-click the video and save manually.');
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
console.log(`✅ Non Quality Drop AI | Connected to Space: ${HF_SPACE_ID} | Endpoint: ${ENDPOINT_NAME}`);
