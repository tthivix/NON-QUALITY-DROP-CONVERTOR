// ============================================================
// Non Quality Drop Upload AI — script.js (FIXED v2)
// Space: thivix/tiktok-hq-converter
// ============================================================

const HF_SPACE_ID   = "thivix/tiktok-hq-converter";
const ENDPOINT_NAME = "/convert_video";
const INPUT_PARAM   = "input_path";
const MAX_RETRIES   = 3;

// ===== DOM =====
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

let selectedFile     = null;
let currentOutputUrl = null;
let progressInterval = null;
let toastTimeout     = null;

// ============================================================
// PARTICLES
// ============================================================
function createParticles() {
    const container = document.getElementById('bgParticles');
    if (!container) return;
    const colors = ['#f72585','#7209b7','#4361ee','#4cc9f0','#06d6a0'];
    for (let i = 0; i < 35; i++) {
        const p = document.createElement('div');
        p.classList.add('particle');
        const size = Math.random() * 5 + 2;
        p.style.cssText = `
            width:${size}px;height:${size}px;
            left:${Math.random()*100}%;
            background:${colors[Math.floor(Math.random()*colors.length)]};
            animation-duration:${Math.random()*18+10}s;
            animation-delay:${Math.random()*10}s;
        `;
        container.appendChild(p);
    }
}
createParticles();

// ============================================================
// PROGRESS
// ============================================================
const STAGES = [
    { pct: 8,  label: '⏳ Waking up AI Space...' },
    { pct: 20, label: '📡 Connecting to THIVIX AI...' },
    { pct: 35, label: '⬆️ Uploading your video...' },
    { pct: 50, label: '🔍 Analyzing video frames...' },
    { pct: 68, label: '✨ Enhancing quality & FPS...' },
    { pct: 82, label: '🎬 Applying 60FPS conversion...' },
    { pct: 93, label: '📦 Finalizing output...' },
];

function startProgress() {
    let stage = 0;
    progressBar.style.width = '0%';
    progressLabel.textContent = STAGES[0].label;
    progressInterval = setInterval(() => {
        if (stage < STAGES.length) {
            progressBar.style.width = STAGES[stage].pct + '%';
            progressLabel.textContent = STAGES[stage].label;
            stage++;
        }
    }, 2200);
}

function stopProgress(success = true) {
    clearInterval(progressInterval);
    progressInterval = null;
    progressBar.style.width = success ? '100%' : '30%';
    progressLabel.textContent = success ? '✅ Done! Video ready.' : '❌ Failed. Please retry.';
}

// ============================================================
// TOASTS
// ============================================================
function showError(msg) {
    if (toastTimeout) clearTimeout(toastTimeout);
    successToast.classList.add('hidden');
    toastMsg.textContent = msg;
    errorToast.classList.remove('hidden');
    toastTimeout = setTimeout(() => errorToast.classList.add('hidden'), 7000);
}
function showSuccess() {
    if (toastTimeout) clearTimeout(toastTimeout);
    errorToast.classList.add('hidden');
    successToast.classList.remove('hidden');
    toastTimeout = setTimeout(() => successToast.classList.add('hidden'), 5000);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// FILE HANDLING
// ============================================================
function resetOutput() {
    outputSection.classList.add('hidden');
    if (outputVideo.src?.startsWith('blob:')) URL.revokeObjectURL(outputVideo.src);
    outputVideo.src = '';
    currentOutputUrl = null;
}
function updateConvertButton() { convertBtn.disabled = !selectedFile; }

function handleFile(file) {
    if (!file || !file.type.startsWith('video/')) {
        showError('Please select a valid video file (MP4, WebM, MOV, MKV).');
        return false;
    }
    if (file.size > 210 * 1024 * 1024) {
        showError('File too large. Max 200MB.');
        return false;
    }
    selectedFile = file;
    const url = URL.createObjectURL(file);
    originalPreview.src = url;
    previewSection.classList.remove('hidden');
    fileInfo.textContent = `${file.name} · ${(file.size/(1024*1024)).toFixed(2)} MB`;
    resetOutput();
    updateConvertButton();
    return true;
}

uploadZone.addEventListener('click', () => videoInput.click());
videoInput.addEventListener('change', (e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); });
uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', (e) => {
    e.preventDefault(); uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
clearFileBtn.addEventListener('click', () => {
    selectedFile = null; videoInput.value = '';
    if (originalPreview.src?.startsWith('blob:')) URL.revokeObjectURL(originalPreview.src);
    originalPreview.src = '';
    previewSection.classList.add('hidden');
    resetOutput(); updateConvertButton();
});
convertAnotherBtn.addEventListener('click', () => { clearFileBtn.click(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

// ============================================================
// GRADIO API — WITH RETRY + BETTER URL PARSING
// ============================================================

// Extract a usable video URL from Gradio result
function extractVideoUrl(data) {
    const first = data[0];
    const spaceSlug = HF_SPACE_ID.replace('/', '-');
    const baseUrl = `https://${spaceSlug}.hf.space`;

    // Case 1: plain string URL
    if (typeof first === 'string') {
        if (first.startsWith('http')) return first;
        if (first.startsWith('/file=')) return baseUrl + first;
        if (first.startsWith('/')) return baseUrl + first;
        return baseUrl + '/file=' + first;
    }

    // Case 2: object with .url
    if (first?.url) {
        const u = first.url;
        if (u.startsWith('http')) return u;
        return baseUrl + u;
    }

    // Case 3: object with .path
    if (first?.path) {
        return baseUrl + '/file=' + first.path;
    }

    // Case 4: object with .value
    if (first?.value && typeof first.value === 'string') {
        const v = first.value;
        if (v.startsWith('http')) return v;
        return baseUrl + '/file=' + v;
    }

    console.error('Unknown result format:', JSON.stringify(data));
    return null;
}

async function connectWithRetry(attempt = 1) {
    const { Client } = await import('@gradio/client');
    try {
        progressLabel.textContent = attempt > 1
            ? `🔄 Retrying connection (${attempt}/${MAX_RETRIES})...`
            : '📡 Connecting to THIVIX AI...';

        const client = await Client.connect(HF_SPACE_ID);
        console.log(`✅ Connected on attempt ${attempt}`);
        return client;
    } catch (err) {
        console.warn(`Connection attempt ${attempt} failed:`, err.message);
        if (attempt < MAX_RETRIES) {
            progressLabel.textContent = `💤 Space waking up... retry ${attempt}/${MAX_RETRIES} in 8s`;
            await sleep(8000);
            return connectWithRetry(attempt + 1);
        }
        throw new Error(`Cannot connect to Space after ${MAX_RETRIES} attempts. The Space may be sleeping or down. Please wait 30 seconds and try again.`);
    }
}

async function sendVideoToHF(file) {
    // Wake ping
    try {
        await fetch(`https://huggingface.co/api/spaces/${HF_SPACE_ID}`, { method: 'GET' });
        await sleep(1500);
    } catch(_) {}

    const client = await connectWithRetry();

    progressLabel.textContent = '⬆️ Uploading video to AI...';

    let result;
    let predictAttempt = 0;
    while (predictAttempt < MAX_RETRIES) {
        predictAttempt++;
        try {
            result = await client.predict(ENDPOINT_NAME, { [INPUT_PARAM]: file });
            break; // success
        } catch (err) {
            console.warn(`Predict attempt ${predictAttempt} failed:`, err.message);
            if (predictAttempt >= MAX_RETRIES) {
                throw new Error('AI model error after retries: ' + err.message);
            }
            progressLabel.textContent = `🔄 AI busy, retrying... (${predictAttempt}/${MAX_RETRIES})`;
            await sleep(7000);
        }
    }

    if (!result?.data?.length) {
        throw new Error('Empty response from server. Try again.');
    }

    const videoUrl = extractVideoUrl(result.data);
    if (!videoUrl) throw new Error('Could not extract video URL from response.');

    return videoUrl;
}

// ============================================================
// CONVERT
// ============================================================
convertBtn.addEventListener('click', async () => {
    if (!selectedFile) { showError('Please select a video file first.'); return; }

    resetOutput();
    processingOverlay.classList.remove('hidden');
    convertBtn.disabled = true;
    startProgress();

    try {
        const processedUrl = await sendVideoToHF(selectedFile);
        currentOutputUrl = processedUrl;

        stopProgress(true);
        await sleep(500);

        outputVideo.src = processedUrl;
        outputVideo.load();
        outputSection.classList.remove('hidden');
        processingOverlay.classList.add('hidden');
        convertBtn.disabled = false;
        showSuccess();

        setTimeout(() => outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);

    } catch (error) {
        console.error('❌ Conversion failed:', error);
        stopProgress(false);
        processingOverlay.classList.add('hidden');
        convertBtn.disabled = false;

        let msg = error.message || 'Unknown error. Please try again.';
        if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('load failed')) {
            msg = '🌐 Network error. Check internet or try again in 10 seconds.';
        } else if (msg.includes('422')) {
            msg = '⚠️ Unsupported video format. Please use MP4.';
        } else if (msg.includes('429')) {
            msg = '⏱️ Too many requests. Wait 30 seconds and try again.';
        } else if (msg.includes('500')) {
            msg = '🔧 Server error. The AI Space may be restarting. Try in 1 minute.';
        }

        showError(msg);
    }
});

// ============================================================
// DOWNLOAD
// ============================================================
async function downloadVideoAsBlob(url, filename) {
    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch (err) {
        console.error('Download error:', err);
        showError('Direct download failed. Right-click the video → "Save video as..."');
        window.open(url, '_blank');
    }
}

downloadBtn.addEventListener('click', async () => {
    if (!currentOutputUrl) { showError('No video found. Please convert first.'); return; }
    const base = selectedFile ? selectedFile.name.replace(/\.[^.]+$/, '') : 'video';
    const orig = downloadBtn.innerHTML;
    downloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing...';
    downloadBtn.disabled = true;
    try { await downloadVideoAsBlob(currentOutputUrl, `${base}_60fps_enhanced.mp4`); }
    finally { downloadBtn.innerHTML = orig; downloadBtn.disabled = false; }
});

// ============================================================
// CLEANUP
// ============================================================
window.addEventListener('beforeunload', () => {
    if (originalPreview.src?.startsWith('blob:')) URL.revokeObjectURL(originalPreview.src);
    if (outputVideo.src?.startsWith('blob:'))    URL.revokeObjectURL(outputVideo.src);
    clearInterval(progressInterval);
});

updateConvertButton();
console.log(`%c🎬 Non Quality Drop AI | ${HF_SPACE_ID}`, 'background:#7209b7;color:#fff;padding:4px 10px;border-radius:6px;font-weight:bold;');
