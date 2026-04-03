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
let gradioClient = null;

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
// INIT GRADIO CLIENT (once)
// --------------------------------------------------------------
async function initGradioClient() {
    if (gradioClient) return gradioClient;
    const { Client } = await import('@gradio/client');
    console.log(`Connecting to ${HF_SPACE_ID} ...`);
    gradioClient = await Client.connect(HF_SPACE_ID);
    console.log('Connected to Space');
    return gradioClient;
}

// --------------------------------------------------------------
// CONVERT USING GRADIO CLIENT (CORS handled internally)
// --------------------------------------------------------------
async function sendVideoToHF(file) {
    const client = await initGradioClient();
    
    console.log(`Calling ${ENDPOINT_NAME} with file:`, file.name);
    const result = await client.predict(ENDPOINT_NAME, {
        [INPUT_PARAM_NAME]: file
    });
    
    console.log('Raw result:', result);
    
    if (!result || !result.data || result.data.length === 0) {
        throw new Error('Empty response from Space');
    }
    
    let outputUrl = null;
    const first = result.data[0];
    
    if (typeof first === 'string') {
        outputUrl = first;
    } else if (first && first.url) {
        outputUrl = first.url;
    } else if (first && first.path) {
        outputUrl = first.path.startsWith('http') ? first.path : `https://${HF_SPACE_ID}.hf.space${first.path}`;
    } else if (first && first.value && typeof first.value === 'string') {
        outputUrl = first.value;
    }
    
    if (!outputUrl) throw new Error('Could not extract video URL from response');
    
    // Ensure absolute URL
    if (outputUrl.startsWith('/')) {
        outputUrl = `https://${HF_SPACE_ID}.hf.space${outputUrl}`;
    }
    
    return outputUrl;
}

// --------------------------------------------------------------
// CONVERT BUTTON HANDLER
// --------------------------------------------------------------
convertBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        showError('Please select a video file first.');
        return;
    }

    resetOutput();
    processingOverlay.classList.remove('hidden');
    convertBtn.disabled = true;

    // Show wake-up hint
    const statusMsg = document.createElement('div');
    statusMsg.innerText = '⏳ Contacting Hugging Face Space... This may take 15-30s if sleeping.';
    statusMsg.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full text-sm z-50 shadow-xl';
    document.body.appendChild(statusMsg);
    setTimeout(() => statusMsg.remove(), 12000);

    try {
        const outputVideoUrl = await sendVideoToHF(selectedFile);
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
            friendlyMsg += 'CORS or network issue. Make sure the Space is public and the endpoint name is correct. Try again in a few seconds.';
        } else if (error.message.includes('404')) {
            friendlyMsg += `Endpoint "${ENDPOINT_NAME}" not found. Verify the Space's API.`;
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
console.log(`✅ Non Quality Drop AI | Space: ${HF_SPACE_ID} | Endpoint: ${ENDPOINT_NAME}`);
