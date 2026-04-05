// ============================================================
// Non Quality Drop Upload AI — script.js
// Gradio API: thivix/tiktok-hq-converter
// ============================================================

// ===== CONFIG =====
const HF_SPACE_ID    = "thivix/tiktok-hq-converter";
const ENDPOINT_NAME  = "/convert_video";
const INPUT_PARAM    = "input_path";

// ===== DOM REFS =====
const uploadZone        = document.getElementById('uploadZone');
const videoInput        = document.getElementById('videoInput');
const convertBtn        = document.getElementById('convertBtn');
const previewSection    = document.getElementById('previewSection');
const originalPreview   = document.getElementById('originalPreview');
const fileInfo          = document.getElementById('fileInfo');
const clearFileBtn      = document.getElementById('clearFileBtn');
const outputSection     = document.getElementById('outputSection');
const outputVideo       = document.getElementById('outputVideo');
const downloadBtn       = document.getElementById('downloadBtn');
const convertAnotherBtn = document.getElementById('convertAnotherBtn');
const processingOverlay = document.getElementById('processingOverlay');
const errorToast        = document.getElementById('errorToast');
const successToast      = document.getElementById('successToast');
const toastMsg          = document.getElementById('toastMsg');
const progressBar       = document.getElementById('progressBar');
const progressLabel     = document.getElementById('progressLabel');

// ===== STATE =====
let selectedFile     = null;
let currentOutputUrl = null;
let progressInterval = null;
let toastTimeout     = null;

// ============================================================
// BACKGROUND PARTICLES
// ============================================================
function createParticles() {
    const container = document.getElementById('bgParticles');
    if (!container) return;
    const colors = ['#f72585', '#7209b7', '#4361ee', '#4cc9f0', '#06d6a0'];
    for (let i = 0; i < 35; i++) {
        const p = document.createElement('div');
        p.classList.add('particle');
        const size = Math.random() * 5 + 2;
        p.style.cssText = `
            width:${size}px; height:${size}px;
            left:${Math.random() * 100}%;
            background:${colors[Math.floor(Math.random()*colors.length)]};
            animation-duration:${Math.random() * 18 + 10}s;
            animation-delay:${Math.random() * 10}s;
            filter: blur(${Math.random() * 1}px);
            box-shadow: 0 0 ${size*2}px currentColor;
        `;
        container.appendChild(p);
    }
}
createParticles();

// ============================================================
// PROGRESS BAR SIMULATION
// ============================================================
const progressStages = [
    { pct: 10, label: 'Uploading to AI Cloud...' },
    { pct: 25, label: 'AI Model Warming Up...' },
    { pct: 45, label: 'Analyzing Video Frames...' },
    { pct: 65, label: 'Converting Quality & FPS...' },
    { pct: 80, label: 'Applying Non Quality Drop...' },
    { pct: 92, label: 'Finalizing Output...' },
];

function startProgress() {
    let stage = 0;
    progressBar.style.width = '0%';
    progressLabel.textContent = 'Uploading to AI ...';

    progressInterval = setInterval(() => {
        if (stage < progressStages.length) {
            const { pct, label } = progressStages[stage];
            progressBar.style.width = pct + '%';
            progressLabel.textContent = label;
            stage++;
        }
    }, 1800);
}

function stopProgress(success = true) {
    clearInterval(progressInterval);
    progressInterval = null;
    progressBar.style.width = success ? '100%' : '0%';
    progressLabel.textContent = success ? '✅ Complete!' : '❌ Failed';
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showError(msg) {
    if (toastTimeout) clearTimeout(toastTimeout);
    successToast.classList.add('hidden');
    toastMsg.textContent = msg;
    errorToast.classList.remove('hidden');
    toastTimeout = setTimeout(() => errorToast.classList.add('hidden'), 5000);
}

function showSuccess() {
    if (toastTimeout) clearTimeout(toastTimeout);
    errorToast.classList.add('hidden');
    successToast.classList.remove('hidden');
    toastTimeout = setTimeout(() => successToast.classList.add('hidden'), 4000);
}

// ============================================================
// FILE HANDLING
// ============================================================
function resetOutput() {
    outputSection.classList.add('hidden');
    if (outputVideo.src && outputVideo.src.startsWith('blob:')) {
        URL.revokeObjectURL(outputVideo.src);
    }
    outputVideo.src = '';
    currentOutputUrl = null;
}

function updateConvertButton() {
    convertBtn.disabled = !selectedFile;
}

function handleFile(file) {
    if (!file || !file.type.startsWith('video/')) {
        showError('Please select a valid video file (MP4, WebM, MOV, MKV).');
        return false;
    }
    if (file.size > 110 * 1024 * 1024) {
        showError('File too large. Max 100MB recommended.');
        return false;
    }

    selectedFile = file;
    const url = URL.createObjectURL(file);
    originalPreview.src = url;
    previewSection.classList.remove('hidden');

    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    fileInfo.textContent = `${file.name} · ${sizeMB} MB`;

    resetOutput();
    updateConvertButton();

    // Scroll to upload card
    uploadZone.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
}

// Upload zone click
uploadZone.addEventListener('click', () => videoInput.click());

// File input change
videoInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
});

// Drag & drop
uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

// Clear file
clearFileBtn.addEventListener('click', () => {
    selectedFile = null;
    videoInput.value = '';
    if (originalPreview.src && originalPreview.src.startsWith('blob:')) {
        URL.revokeObjectURL(originalPreview.src);
    }
    originalPreview.src = '';
    previewSection.classList.add('hidden');
    resetOutput();
    updateConvertButton();
});

// Convert another
convertAnotherBtn.addEventListener('click', () => {
    clearFileBtn.click();
    uploadZone.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// ============================================================
// GRADIO API — MAIN CONVERT
// ============================================================
async function sendVideoToHF(file) {
    const { Client } = await import('@gradio/client');
    const client = await Client.connect(HF_SPACE_ID);

    const result = await client.predict(ENDPOINT_NAME, {
        [INPUT_PARAM]: file
    });

    if (!result || !result.data || result.data.length === 0) {
        throw new Error('Server returned empty response.');
    }

    const first = result.data[0];
    let videoUrl = null;

    if (typeof first === 'string') {
        videoUrl = first;
    } else if (first && first.url) {
        videoUrl = first.url;
    } else if (first && first.value && typeof first.value === 'string') {
        videoUrl = first.value;
    } else {
        throw new Error('Unexpected response format from AI.');
    }

    if (!videoUrl || (!videoUrl.startsWith('http') && !videoUrl.startsWith('blob:'))) {
        throw new Error('Processed video URL missing in response.');
    }

    return videoUrl;
}

// Convert button click
convertBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        showError('Please select a video file first.');
        return;
    }

    resetOutput();
    processingOverlay.classList.remove('hidden');
    convertBtn.disabled = true;
    startProgress();

    try {
        const processedUrl = await sendVideoToHF(selectedFile);
        currentOutputUrl = processedUrl;

        stopProgress(true);
        await new Promise(r => setTimeout(r, 600));

        outputVideo.src = processedUrl;
        outputVideo.load();
        outputSection.classList.remove('hidden');
        processingOverlay.classList.add('hidden');
        convertBtn.disabled = false;

        showSuccess();

        // Scroll to output
        setTimeout(() => {
            outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);

    } catch (error) {
        console.error('Conversion error:', error);
        stopProgress(false);

        let msg = 'Server busy. Please try again.';
        if (error.message.includes('Cannot reach') || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            msg = 'Cannot Converting. The AI is Busy — wait 10s and retry.';
        } else if (error.message.includes('404')) {
            msg = `Endpoint "${ENDPOINT_NAME}" not found. Video Not Supported.`;
        } else if (error.message.includes('422')) {
            msg = 'Unsupported video format error.';
        } else if (error.message) {
            msg = error.message;
        }

        processingOverlay.classList.add('hidden');
        convertBtn.disabled = false;
        showError(msg);
    }
});

// ============================================================
// DOWNLOAD
// ============================================================
async function downloadVideoAsBlob(url, filename) {
    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Download response failed');
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch (err) {
        console.error('Download blob error:', err);
        // Fallback: open in new tab
        showError('Direct download failed. Right-click the video → Save video as.');
        window.open(url, '_blank');
    }
}

downloadBtn.addEventListener('click', async () => {
    if (!currentOutputUrl) {
        showError('No converted video found. Please convert a video first.');
        return;
    }

    const baseName = selectedFile ? selectedFile.name.replace(/\.[^.]+$/, '') : 'video';
    const filename  = `${baseName}_60fps_Upload_Method.mp4`;

    const originalText = downloadBtn.innerHTML;
    downloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing Download...';
    downloadBtn.disabled = true;

    try {
        await downloadVideoAsBlob(currentOutputUrl, filename);
    } finally {
        downloadBtn.innerHTML = originalText;
        downloadBtn.disabled = false;
    }
});

// ============================================================
// CLEANUP ON UNLOAD
// ============================================================
window.addEventListener('beforeunload', () => {
    if (originalPreview.src?.startsWith('blob:')) URL.revokeObjectURL(originalPreview.src);
    if (outputVideo.src?.startsWith('blob:'))    URL.revokeObjectURL(outputVideo.src);
    clearInterval(progressInterval);
});

// ============================================================
// INIT
// ============================================================
updateConvertButton();

console.log(
    `%c🎬 Non Quality Drop Upload AI | Space: ${HF_SPACE_ID} | Endpoint: ${ENDPOINT_NAME}`,
    'background: linear-gradient(135deg,#f72585,#7209b7); color: white; padding: 5px 12px; border-radius: 8px; font-weight: bold;'
);
