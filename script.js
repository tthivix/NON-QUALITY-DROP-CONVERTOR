// ----------------------------------------------
// CONFIGURATION
// ----------------------------------------------
const HF_SPACE_ID = "thivix/tiktok-hq-converter";
const SPACE_URL = `https://${HF_SPACE_ID}.hf.space`;
const API_URL = `${SPACE_URL}/gradio_api/call/convert_video`;

// ----------------------------------------------
// DOM elements (keep as before)
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

function showError(message) {
    errorToast.innerText = message;
    errorToast.classList.remove('hidden');
    setTimeout(() => errorToast.classList.add('hidden'), 8000);
}

function hideOverlayAndEnable() {
    processingOverlay.classList.add('hidden');
    convertBtn.disabled = false;
}

function resetOutput() {
    outputSection.classList.add('hidden');
    if (outputVideo.src) URL.revokeObjectURL(outputVideo.src);
    outputVideo.src = '';
    currentOutputUrl = null;
}

function updateConvertButton() {
    convertBtn.disabled = !selectedFile;
}

clearFileBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    previewSection.classList.add('hidden');
    originalPreview.src = '';
    resetOutput();
    updateConvertButton();
});

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
    const url = URL.createObjectURL(file);
    originalPreview.src = url;
    previewSection.classList.remove('hidden');
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    fileInfo.innerText = `${file.name} (${sizeMB} MB)`;
    resetOutput();
    updateConvertButton();
    return true;
}

uploadZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
});

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

// --------------------------------------------------------------
// CHECK IF SPACE IS PUBLIC AND REACHABLE
// --------------------------------------------------------------
async function checkSpaceAvailability() {
    try {
        // Try to fetch the Space homepage - if 200, it's public
        const response = await fetch(SPACE_URL, { mode: 'no-cors' }); // no-cors gives opaque but still reachable
        // Alternative: try to fetch a simple endpoint
        const testApi = await fetch(`${SPACE_URL}/gradio_api/info`, { method: 'HEAD' });
        if (testApi.ok || testApi.type === 'opaque') return true;
        return false;
    } catch (e) {
        console.warn('Space check failed:', e);
        return false;
    }
}

// --------------------------------------------------------------
// DIRECT GRADIO API CALL (works for public spaces)
// --------------------------------------------------------------
async function uploadAndConvert(file) {
    const formData = new FormData();
    formData.append('data', file);

    console.log(`Sending request to ${API_URL} ...`);
    const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
        mode: 'cors',
        headers: {
            // No extra headers needed for public spaces
        }
    });

    if (!response.ok) {
        let errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText}. ${errorText.substring(0, 100)}`);
    }

    const result = await response.json();
    const eventId = result.event_id;
    if (!eventId) throw new Error('No event_id returned.');

    const pollUrl = `${SPACE_URL}/gradio_api/call/convert_video/${eventId}`;
    let outputUrl = null;
    let attempts = 0;
    const maxAttempts = 90; // 90 seconds timeout

    while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const pollRes = await fetch(pollUrl);
        if (!pollRes.ok) continue;

        const data = await pollRes.json();
        if (data.event_status === 'COMPLETE' && data.data && data.data.length > 0) {
            const outputFile = data.data[0];
            if (typeof outputFile === 'string') {
                outputUrl = outputFile;
            } else if (outputFile && outputFile.url) {
                outputUrl = outputFile.url;
            } else if (outputFile && outputFile.path) {
                outputUrl = outputFile.path.startsWith('http') ? outputFile.path : `${SPACE_URL}${outputFile.path}`;
            }
            if (outputUrl) break;
        } else if (data.event_status === 'ERROR') {
            throw new Error('Space processing error: ' + (data.error || 'unknown'));
        }
        attempts++;
    }

    if (!outputUrl) throw new Error('Processing timeout after 90 seconds.');
    return outputUrl;
}

// --------------------------------------------------------------
// CONVERT BUTTON
// --------------------------------------------------------------
convertBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        showError('Please select a video file first.');
        return;
    }

    resetOutput();
    processingOverlay.classList.remove('hidden');
    convertBtn.disabled = true;

    // Show a "waking up" message
    const wakeMsg = document.createElement('div');
    wakeMsg.innerText = '⏳ Connecting to Hugging Face Space... This may take up to 30 seconds if the Space is sleeping.';
    wakeMsg.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full text-sm z-50 shadow-xl';
    document.body.appendChild(wakeMsg);
    setTimeout(() => wakeMsg.remove(), 10000);

    try {
        // First, check if space is reachable (optional)
        const isReachable = await checkSpaceAvailability();
        if (!isReachable) {
            console.warn('Space may be private or offline. Still attempting...');
        }

        const outputVideoUrl = await uploadAndConvert(selectedFile);
        currentOutputUrl = outputVideoUrl;
        outputVideo.src = outputVideoUrl;
        outputVideo.load();
        outputSection.classList.remove('hidden');

        const successMsg = document.createElement('div');
        successMsg.innerText = '✅ Conversion complete! Video ready.';
        successMsg.className = 'fixed top-20 right-6 bg-emerald-500 text-white px-4 py-2 rounded-full text-sm z-50 shadow-xl';
        document.body.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 3000);
    } catch (error) {
        console.error('Conversion error:', error);
        let friendlyMsg = 'Conversion failed. ';
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            friendlyMsg += 'Cannot reach Hugging Face Space. Please ensure the Space is PUBLIC and running. Go to Settings → Change visibility to Public. Then try again.';
        } else if (error.message.includes('401') || error.message.includes('403')) {
            friendlyMsg += 'The Space requires authentication. Make it PUBLIC in the Space settings.';
        } else if (error.message.includes('404')) {
            friendlyMsg += 'API endpoint not found. Check that your Space has an endpoint named "/convert_video".';
        } else {
            friendlyMsg += error.message;
        }
        showError(friendlyMsg);
    } finally {
        hideOverlayAndEnable();
    }
});

// Download handler
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
        const response = await fetch(currentOutputUrl);
        if (response.ok) {
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } else {
            throw new Error('Fetch failed');
        }
    } catch (err) {
        showError('Direct download not available. Right-click the video and select "Save video as..."');
        window.open(currentOutputUrl, '_blank');
    } finally {
        downloadBtn.innerText = '⬇️ Download High Quality Video';
        downloadBtn.disabled = false;
    }
});

window.addEventListener('beforeunload', () => {
    if (originalPreview.src && originalPreview.src.startsWith('blob:')) URL.revokeObjectURL(originalPreview.src);
    if (outputVideo.src && outputVideo.src.startsWith('blob:')) URL.revokeObjectURL(outputVideo.src);
});

updateConvertButton();
console.log(`✅ Non Quality Drop AI | Using API: ${API_URL}`);
