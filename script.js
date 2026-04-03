// ----------------------------------------------
// CONFIGURATION: Replace with your Hugging Face Space ID
// ----------------------------------------------
const HF_SPACE_ID = "YOUR_USERNAME/YOUR_SPACE_NAME";  // <-- UPDATE THIS
const ENDPOINT_NAME = "/convert_video";
const INPUT_PARAM_NAME = "input_path";

// ----------------------------------------------
// DOM Elements
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
let popunderTriggered = false;   // ensure popunder fires only once per session

// Helper: show error toast
function showError(message) {
    errorToast.innerText = message;
    errorToast.classList.remove('hidden');
    setTimeout(() => errorToast.classList.add('hidden'), 4500);
}

function hideOverlayAndEnable() {
    processingOverlay.classList.add('hidden');
    convertBtn.disabled = false;
}

function resetOutput() {
    outputSection.classList.add('hidden');
    if (outputVideo.src) {
        URL.revokeObjectURL(outputVideo.src);
    }
    outputVideo.src = '';
    currentOutputUrl = null;
}

function updateConvertButton() {
    convertBtn.disabled = !selectedFile;
}

// Clear file
clearFileBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    previewSection.classList.add('hidden');
    originalPreview.src = '';
    resetOutput();
    updateConvertButton();
});

// Handle file selection
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
// ADSTERRA INTEGRATION
// ----------------------------------------------
function loadNativeAd() {
    const adContainer = document.getElementById('adContainer');
    if (!adContainer) return;
    // Clear container and inject Adsterra native banner code
    adContainer.innerHTML = '';  // remove previous content/loader
    // Create container div required by script
    const containerDiv = document.createElement('div');
    containerDiv.id = 'container-cc751e76ba94e19cee6e3a94b56cb103';
    adContainer.appendChild(containerDiv);
    // Load the native banner script
    const script = document.createElement('script');
    script.src = 'https://pl29047080.profitablecpmratenetwork.com/cc751e76ba94e19cee6e3a94b56cb103/invoke.js';
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    adContainer.appendChild(script);
}

function triggerPopunder() {
    if (popunderTriggered) return;
    popunderTriggered = true;
    const popScript = document.createElement('script');
    popScript.src = 'https://pl29047081.profitablecpmratenetwork.com/77/08/68/770868f68587939e9edcce4eec9fdc35.js';
    document.head.appendChild(popScript);
}

// ----------------------------------------------
// GRADIO CONVERSION (unchanged but with better error handling)
// ----------------------------------------------
async function sendVideoToHF(file) {
    const { Client } = await import('@gradio/client');
    const client = await Client.connect(HF_SPACE_ID);
    const result = await client.predict(ENDPOINT_NAME, {
        [INPUT_PARAM_NAME]: file
    });
    if (!result?.data?.length) throw new Error('Empty response from server');
    let outputUrl = result.data[0];
    if (typeof outputUrl === 'object' && outputUrl.url) outputUrl = outputUrl.url;
    if (!outputUrl || (!outputUrl.startsWith('http') && !outputUrl.startsWith('blob:'))) {
        throw new Error('Invalid video URL received');
    }
    return outputUrl;
}

async function downloadVideoAsBlob(videoUrl, filename = "enhanced_video.mp4") {
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
}

// ----------------------------------------------
// CONVERT ACTION WITH ADS
// ----------------------------------------------
convertBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        showError('Please select a video file first.');
        return;
    }

    resetOutput();
    // Show overlay and load ads
    processingOverlay.classList.remove('hidden');
    loadNativeAd();         // load native banner inside overlay
    triggerPopunder();      // fire popunder (once per session)
    convertBtn.disabled = true;

    try {
        const processedVideoUrl = await sendVideoToHF(selectedFile);
        currentOutputUrl = processedVideoUrl;
        outputVideo.src = processedVideoUrl;
        outputVideo.load();
        outputSection.classList.remove('hidden');
        processingOverlay.classList.add('hidden');
        convertBtn.disabled = false;

        const successMsg = document.createElement('div');
        successMsg.className = 'fixed top-20 right-6 bg-emerald-500 text-white px-4 py-2 rounded-full text-sm z-50 shadow-xl';
        successMsg.innerText = '✅ Conversion complete! Video ready.';
        document.body.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 3000);
    } catch (error) {
        console.error('Conversion error:', error);
        let friendlyMsg = 'Server busy or API error. Please try again.';
        if (error.message.includes('fetch')) friendlyMsg = 'Network error. The Space might be waking up. Wait and retry.';
        else if (error.message.includes('422')) friendlyMsg = 'Unsupported video format or backend error.';
        showError(friendlyMsg);
        processingOverlay.classList.add('hidden');
        convertBtn.disabled = false;
    }
});

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
        showError('Direct download failed. Right-click video and Save As.');
    } finally {
        downloadBtn.innerText = '⬇️ Download High Quality Video';
        downloadBtn.disabled = false;
    }
});

window.addEventListener('beforeunload', () => {
    if (originalPreview.src?.startsWith('blob:')) URL.revokeObjectURL(originalPreview.src);
    if (outputVideo.src?.startsWith('blob:')) URL.revokeObjectURL(outputVideo.src);
});

updateConvertButton();