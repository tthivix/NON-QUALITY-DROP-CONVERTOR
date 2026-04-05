// ============================================================
// Non Quality Drop Upload AI — script.js (FIXED v3)
// Uses Gradio REST API directly — no @gradio/client import needed
// Space: thivix/tiktok-hq-converter
// ============================================================

const SPACE_ID      = "thivix/tiktok-hq-converter";
const SPACE_SLUG    = "thivix-tiktok-hq-converter";   // for URL building
const BASE_URL      = `https://${SPACE_SLUG}.hf.space`;
const UPLOAD_URL    = `${BASE_URL}/upload`;
const PREDICT_URL   = `${BASE_URL}/api/predict`;
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
(function createParticles() {
    const container = document.getElementById('bgParticles');
    if (!container) return;
    const colors = ['#f72585','#7209b7','#4361ee','#4cc9f0','#06d6a0'];
    for (let i = 0; i < 35; i++) {
        const p = document.createElement('div');
        p.classList.add('particle');
        const size = Math.random() * 5 + 2;
        p.style.cssText = `width:${size}px;height:${size}px;left:${Math.random()*100}%;background:${colors[Math.floor(Math.random()*colors.length)]};animation-duration:${Math.random()*18+10}s;animation-delay:${Math.random()*10}s;`;
        container.appendChild(p);
    }
})();

// ============================================================
// PROGRESS
// ============================================================
const STAGES = [
    { pct: 8,  label: '⏳ Waking up AI Space...' },
    { pct: 20, label: '📡 Connecting to THIVIX AI...' },
    { pct: 38, label: '⬆️ Uploading your video...' },
    { pct: 52, label: '🔍 Analyzing video frames...' },
    { pct: 68, label: '✨ Enhancing quality & FPS...' },
    { pct: 84, label: '🎬 Applying 60FPS conversion...' },
    { pct: 93, label: '📦 Finalizing output...' },
];

function startProgress() {
    let stage = 0;
    progressBar.style.width = '0%';
    progressLabel.textContent = STAGES[0].label;
    clearInterval(progressInterval);
    progressInterval = setInterval(() => {
        if (stage < STAGES.length) {
            progressBar.style.width = STAGES[stage].pct + '%';
            progressLabel.textContent = STAGES[stage].label;
            stage++;
        }
    }, 2000);
}

function setProgress(pct, label) {
    progressBar.style.width = pct + '%';
    progressLabel.textContent = label;
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
    toastTimeout = setTimeout(() => errorToast.classList.add('hidden'), 8000);
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
    originalPreview.src = URL.createObjectURL(file);
    previewSection.classList.remove('hidden');
    fileInfo.textContent = `${file.name} · ${(file.size/(1024*1024)).toFixed(2)} MB`;
    resetOutput();
    updateConvertButton();
    return true;
}

uploadZone.addEventListener('click', () => videoInput.click());
videoInput.addEventListener('change', e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); });
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => {
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
// GRADIO REST API — STEP 1: Upload file to Space
// ============================================================
async function uploadFileToSpace(file, attempt = 1) {
    setProgress(25, `⬆️ Uploading video... (attempt ${attempt}/${MAX_RETRIES})`);
    
    const formData = new FormData();
    formData.append('files', file, file.name);

    let response;
    try {
        response = await fetch(UPLOAD_URL, {
            method: 'POST',
            body: formData,
        });
    } catch (err) {
        if (attempt < MAX_RETRIES) {
            setProgress(15, `💤 Space waking up... retrying in 10s (${attempt}/${MAX_RETRIES})`);
            await sleep(10000);
            return uploadFileToSpace(file, attempt + 1);
        }
        throw new Error(`Upload failed after ${MAX_RETRIES} attempts. Space may be sleeping. Wait 30s and retry.\n\nDetail: ${err.message}`);
    }

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        if (attempt < MAX_RETRIES && (response.status === 503 || response.status === 502 || response.status === 500)) {
            setProgress(15, `🔄 Server busy (${response.status}), retry in 10s...`);
            await sleep(10000);
            return uploadFileToSpace(file, attempt + 1);
        }
        throw new Error(`Upload failed: HTTP ${response.status}. ${text.slice(0, 100)}`);
    }

    const paths = await response.json();
    // Returns array of file paths like ["/tmp/gradio/abc123/filename.mp4"]
    if (!Array.isArray(paths) || paths.length === 0) {
        throw new Error('Upload response was empty. Try again.');
    }
    
    console.log('✅ File uploaded, path:', paths[0]);
    return paths[0]; // server-side file path
}

// ============================================================
// GRADIO REST API — STEP 2: Predict using uploaded file path
// ============================================================
async function predictWithPath(filePath, attempt = 1) {
    setProgress(60, `🔍 AI processing... (attempt ${attempt}/${MAX_RETRIES})`);

    const payload = {
        fn_index: 0,         // first function in the Space
        data: [
            {
                path: filePath,
                orig_name: selectedFile.name,
                size: selectedFile.size,
                mime_type: selectedFile.type || "video/mp4",
                is_stream: false,
                meta: { _type: "gradio.FileData" }
            }
        ],
        session_hash: Math.random().toString(36).slice(2),
    };

    let response;
    try {
        response = await fetch(PREDICT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (err) {
        if (attempt < MAX_RETRIES) {
            setProgress(50, `🔄 AI busy, retrying in 8s... (${attempt}/${MAX_RETRIES})`);
            await sleep(8000);
            return predictWithPath(filePath, attempt + 1);
        }
        throw new Error(`Prediction request failed: ${err.message}`);
    }

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.error('Predict response error:', response.status, text);
        if (attempt < MAX_RETRIES && response.status >= 500) {
            setProgress(50, `🔄 Server error, retrying in 8s...`);
            await sleep(8000);
            return predictWithPath(filePath, attempt + 1);
        }
        throw new Error(`AI processing failed: HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Predict result:', result);
    return result;
}

// ============================================================
// EXTRACT VIDEO URL from Gradio response
// ============================================================
function extractVideoUrl(result) {
    // result.data is an array, first item is the output
    const data = result?.data;
    if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error('Empty data in AI response.');
    }

    const item = data[0];
    let path = null;

    if (typeof item === 'string') {
        path = item;
    } else if (item?.path) {
        path = item.path;
    } else if (item?.url) {
        const u = item.url;
        return u.startsWith('http') ? u : BASE_URL + u;
    } else if (item?.value && typeof item.value === 'string') {
        path = item.value;
    }

    if (!path) {
        console.error('Unknown result format:', JSON.stringify(data));
        throw new Error('Cannot extract video URL from response.');
    }

    // Build full URL
    if (path.startsWith('http')) return path;
    if (path.startsWith('/file=')) return BASE_URL + path;
    return `${BASE_URL}/file=${path}`;
}

// ============================================================
// MAIN CONVERT FLOW
// ============================================================
convertBtn.addEventListener('click', async () => {
    if (!selectedFile) { showError('Please select a video file first.'); return; }

    resetOutput();
    processingOverlay.classList.remove('hidden');
    convertBtn.disabled = true;
    startProgress();

    try {
        // Step 1: Upload file
        const filePath = await uploadFileToSpace(selectedFile);

        // Step 2: Run prediction
        const result = await predictWithPath(filePath);

        // Step 3: Extract URL
        const videoUrl = extractVideoUrl(result);
        console.log('🎬 Final video URL:', videoUrl);
        currentOutputUrl = videoUrl;

        // Done!
        stopProgress(true);
        await sleep(400);

        outputVideo.src = videoUrl;
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

        // Make messages friendlier
        if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror') || msg.toLowerCase().includes('load failed')) {
            msg = '🌐 Cannot reach the AI Space. Check your internet or try again in 20 seconds.';
        } else if (msg.includes('sleeping') || msg.includes('503') || msg.includes('502')) {
            msg = '💤 The AI Space is starting up. Wait 30 seconds and click Convert again.';
        } else if (msg.includes('422')) {
            msg = '⚠️ Unsupported format. Please use an MP4 file.';
        } else if (msg.includes('429')) {
            msg = '⏱️ Too many requests. Wait 30 seconds and retry.';
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
        const a = Object.assign(document.createElement('a'), { href: blobUrl, download: filename });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch (err) {
        console.error('Download error:', err);
        showError('Direct download failed. Right-click the video → "Save video as..."');
        window.open(url, '_blank');
    }
}

downloadBtn.addEventListener('click', async () => {
    if (!currentOutputUrl) { showError('No video found. Please convert first.'); return; }
    const base = selectedFile?.name.replace(/\.[^.]+$/, '') || 'video';
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

console.log(`%c🎬 Non Quality Drop AI | REST API Mode | ${BASE_URL}`, 'background:#7209b7;color:#fff;padding:4px 12px;border-radius:6px;font-weight:bold;');
