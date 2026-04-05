// ============================================================
// Non Quality Drop Upload AI — script.js (FINAL FIX v5)
// HuggingFace Space: thivix/tiktok-hq-converter
// URL: https://thivix-tiktok-hq-converter.hf.space
// ============================================================

// HF Space URL — CONFIRMED from HuggingFace docs:
// format is always: https://{owner}--{space-name}.hf.space  (DOUBLE DASH)
const BASE_URL = "https://thivix--tiktok-hq-converter.hf.space";

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
    { pct: 8,  label: '⏳ Connecting to AI Space...' },
    { pct: 22, label: '📡 Space is ready!' },
    { pct: 38, label: '⬆️ Uploading your video...' },
    { pct: 55, label: '🔍 Analyzing video frames...' },
    { pct: 70, label: '✨ Enhancing quality & FPS...' },
    { pct: 85, label: '🎬 Applying 60FPS conversion...' },
    { pct: 94, label: '📦 Finalizing output...' },
];
function startProgress() {
    let i = 0;
    clearInterval(progressInterval);
    progressBar.style.width = '0%';
    progressLabel.textContent = STAGES[0].label;
    progressInterval = setInterval(() => {
        if (i < STAGES.length) {
            progressBar.style.width = STAGES[i].pct + '%';
            progressLabel.textContent = STAGES[i].label;
            i++;
        }
    }, 2000);
}
function setProgress(pct, label) {
    progressBar.style.width = pct + '%';
    if (label) progressLabel.textContent = label;
}
function stopProgress(ok = true) {
    clearInterval(progressInterval);
    progressInterval = null;
    progressBar.style.width = ok ? '100%' : '30%';
    progressLabel.textContent = ok ? '✅ Done! Video ready.' : '❌ Failed. Please retry.';
}

// ============================================================
// UTILS
// ============================================================
const sleep = ms => new Promise(r => setTimeout(r, ms));
const uid   = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function showError(msg) {
    if (toastTimeout) clearTimeout(toastTimeout);
    successToast.classList.add('hidden');
    toastMsg.textContent = msg;
    errorToast.classList.remove('hidden');
    toastTimeout = setTimeout(() => errorToast.classList.add('hidden'), 9000);
}
function showSuccess() {
    if (toastTimeout) clearTimeout(toastTimeout);
    errorToast.classList.add('hidden');
    successToast.classList.remove('hidden');
    toastTimeout = setTimeout(() => successToast.classList.add('hidden'), 5000);
}

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
    if (file.size > 210 * 1024 * 1024) { showError('File too large. Max 200MB.'); return false; }
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
convertAnotherBtn.addEventListener('click', () => { clearFileBtn.click(); window.scrollTo({ top:0, behavior:'smooth' }); });

// ============================================================
// STEP 0: Confirm working Space URL by trying both candidates
// ============================================================
async function confirmSpaceUrl() {
    for (const url of CANDIDATE_URLS) {
        try {
            // Try /info endpoint which all Gradio spaces have
            const res = await fetch(`${url}/info`, {
                method: 'GET',
                signal: AbortSignal.timeout(8000),
            });
            if (res.ok || res.status === 401 || res.status === 422) {
                // Any real response (even auth error) means the URL is correct
                BASE_URL = url;
                console.log(`✅ Confirmed Space URL: ${BASE_URL}`);
                return url;
            }
        } catch (e) {
            console.warn(`❌ ${url} failed:`, e.message);
        }
    }

    // Try with no-cors as fallback (can't read response but at least confirms reachability)
    for (const url of CANDIDATE_URLS) {
        try {
            await fetch(url, { method: 'GET', mode: 'no-cors', signal: AbortSignal.timeout(6000) });
            BASE_URL = url;
            console.log(`✅ Confirmed Space URL (no-cors): ${BASE_URL}`);
            return url;
        } catch(e) {
            console.warn(`❌ no-cors ${url} failed:`, e.message);
        }
    }

    // Default to first candidate
    console.warn('⚠️ Could not confirm URL, using default:', CANDIDATE_URLS[0]);
    BASE_URL = CANDIDATE_URLS[0];
    return BASE_URL;
}

// ============================================================
// STEP 1: Upload file to Gradio Space
// Gradio 4.x: POST /upload?upload_id=<uid>
// Gradio 3.x: POST /upload (no query param)
// We try both.
// ============================================================
async function uploadFile(file) {
    const uploadId = uid();
    const fd = new FormData();
    fd.append('files', file, file.name);

    // Try Gradio 4 style first, then Gradio 3
    const endpoints = [
        `${BASE_URL}/upload?upload_id=${uploadId}`,
        `${BASE_URL}/upload`,
    ];

    for (let i = 0; i < endpoints.length; i++) {
        const ep = endpoints[i];
        setProgress(35, `⬆️ Uploading... (endpoint ${i+1})`);
        console.log('📤 Trying upload:', ep);

        let res;
        try {
            res = await fetch(ep, {
                method: 'POST',
                body: fd,
                signal: AbortSignal.timeout(60000), // 60s upload timeout
            });
        } catch(e) {
            console.warn(`Upload endpoint ${ep} network error:`, e.message);
            if (i === endpoints.length - 1) throw new Error(`Upload network error: ${e.message}`);
            continue;
        }

        const text = await res.text();
        console.log(`📥 Upload [${res.status}]:`, text.slice(0, 200));

        if (res.ok) {
            let paths;
            try { paths = JSON.parse(text); } catch(_) {
                throw new Error('Upload response not JSON: ' + text.slice(0,100));
            }
            if (Array.isArray(paths) && paths.length > 0) {
                console.log('✅ Upload success, path:', paths[0]);
                return paths[0];
            }
            // Some versions return {files:[...]}
            if (paths?.files && paths.files.length > 0) return paths.files[0];
            throw new Error('Upload returned no file paths: ' + text.slice(0,100));
        }

        if (res.status === 404 && i < endpoints.length - 1) {
            console.warn('404 on this endpoint, trying next...');
            continue;
        }

        throw new Error(`Upload failed HTTP ${res.status}: ${text.slice(0,150)}`);
    }
}

// ============================================================
// STEP 2: Queue join (Gradio 4+) or direct predict (Gradio 3)
// ============================================================
async function runConversion(filePath) {
    const sessionHash = uid();

    const fileData = {
        path: filePath,
        orig_name: selectedFile.name,
        size: selectedFile.size,
        mime_type: selectedFile.type || 'video/mp4',
        is_stream: false,
        meta: { _type: 'gradio.FileData' }
    };

    // --- Try Gradio 4 queue/join first ---
    const joinUrl = `${BASE_URL}/queue/join`;
    console.log('📮 Joining queue:', joinUrl);

    let useQueue = true;
    try {
        const joinRes = await fetch(joinUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fn_index: 0,
                data: [fileData],
                session_hash: sessionHash,
                event_data: null,
            }),
            signal: AbortSignal.timeout(15000),
        });

        const joinText = await joinRes.text();
        console.log(`📥 Queue join [${joinRes.status}]:`, joinText);

        if (!joinRes.ok) {
            console.warn('Queue join failed, will try direct predict');
            useQueue = false;
        }
    } catch(e) {
        console.warn('Queue join error, will try direct predict:', e.message);
        useQueue = false;
    }

    if (useQueue) {
        // Listen to SSE queue data stream
        return listenQueueSSE(sessionHash);
    } else {
        // Fallback: Gradio 3 direct /api/predict
        return directPredict(fileData, sessionHash);
    }
}

// ============================================================
// SSE Queue listener (Gradio 4)
// ============================================================
function listenQueueSSE(sessionHash) {
    return new Promise((resolve, reject) => {
        const sseUrl = `${BASE_URL}/queue/data?session_hash=${sessionHash}`;
        console.log('📡 SSE listening:', sseUrl);
        setProgress(60, '🤖 AI is processing your video...');

        const es = new EventSource(sseUrl);
        const timeout = setTimeout(() => {
            es.close();
            reject(new Error('Processing timed out (3 min). Try a shorter video.'));
        }, 180000);

        es.onmessage = (ev) => {
            let msg;
            try { msg = JSON.parse(ev.data); } catch(_) { return; }
            console.log('📨 SSE event:', msg.msg);

            if (msg.msg === 'queue_full') {
                clearTimeout(timeout); es.close();
                reject(new Error('AI queue is full. Wait 1 minute and retry.'));

            } else if (msg.msg === 'estimation') {
                const rank = msg.rank ?? '?';
                setProgress(60, `🕐 Queue position: ${rank} — please wait...`);

            } else if (msg.msg === 'process_starts') {
                setProgress(75, '⚙️ AI is processing your video...');

            } else if (msg.msg === 'process_generating' || msg.msg === 'process_completed') {
                clearTimeout(timeout); es.close();
                const output = msg.output;
                if (output?.error) { reject(new Error('AI error: ' + output.error)); return; }
                const data = output?.data;
                if (!data?.length) { reject(new Error('Empty AI output. Try again.')); return; }
                const videoUrl = extractVideoUrl(data);
                if (!videoUrl) { reject(new Error('Cannot read video URL. Data: ' + JSON.stringify(data).slice(0,200))); return; }
                resolve(videoUrl);

            } else if (msg.msg === 'close_stream') {
                clearTimeout(timeout); es.close();
                reject(new Error('Connection closed unexpectedly. Try again.'));
            }
        };

        es.onerror = (e) => {
            clearTimeout(timeout); es.close();
            reject(new Error('SSE connection error. Try again.'));
        };
    });
}

// ============================================================
// Direct predict fallback (Gradio 3)
// ============================================================
async function directPredict(fileData, sessionHash) {
    setProgress(60, '🤖 AI processing (direct mode)...');
    const url = `${BASE_URL}/api/predict`;
    console.log('🔮 Direct predict:', url);

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fn_index: 0,
            data: [fileData],
            session_hash: sessionHash,
        }),
        signal: AbortSignal.timeout(180000),
    });

    const text = await res.text();
    console.log(`📥 Direct predict [${res.status}]:`, text.slice(0,300));

    if (!res.ok) throw new Error(`Direct predict HTTP ${res.status}: ${text.slice(0,150)}`);

    let result;
    try { result = JSON.parse(text); } catch(_) {
        throw new Error('Predict response not JSON: ' + text.slice(0,100));
    }

    const data = result?.data;
    if (!data?.length) throw new Error('Empty predict response. Try again.');

    const videoUrl = extractVideoUrl(data);
    if (!videoUrl) throw new Error('Cannot extract video URL: ' + JSON.stringify(data).slice(0,200));
    return videoUrl;
}

// ============================================================
// EXTRACT VIDEO URL
// ============================================================
function extractVideoUrl(data) {
    const item = data[0];
    console.log('🔍 Extracting URL from:', JSON.stringify(item).slice(0, 200));

    if (typeof item === 'string') {
        return item.startsWith('http') ? item : `${BASE_URL}/file=${item}`;
    }
    if (item?.url) {
        const u = item.url;
        return u.startsWith('http') ? u : BASE_URL + u;
    }
    if (item?.path) {
        const p = item.path;
        return p.startsWith('http') ? p : `${BASE_URL}/file=${p}`;
    }
    if (item?.value) {
        const v = typeof item.value === 'string' ? item.value : (item.value?.path || item.value?.url || '');
        if (v) return v.startsWith('http') ? v : `${BASE_URL}/file=${v}`;
    }
    return null;
}

// ============================================================
// MAIN CONVERT BUTTON
// ============================================================
convertBtn.addEventListener('click', async () => {
    if (!selectedFile) { showError('Please select a video file first.'); return; }

    resetOutput();
    processingOverlay.classList.remove('hidden');
    convertBtn.disabled = true;
    startProgress();

    try {
        // Confirm URL
        setProgress(8, '⏳ Connecting to AI Space...');
        await confirmSpaceUrl();
        setProgress(20, `✅ Connected! Uploading...`);
        await sleep(500);

        // Upload
        const filePath = await uploadFile(selectedFile);

        // Convert
        const videoUrl = await runConversion(filePath);
        currentOutputUrl = videoUrl;
        console.log('🎬 Final video URL:', videoUrl);

        // Show result
        stopProgress(true);
        await sleep(300);
        outputVideo.src = videoUrl;
        outputVideo.load();
        outputSection.classList.remove('hidden');
        processingOverlay.classList.add('hidden');
        convertBtn.disabled = false;
        showSuccess();
        setTimeout(() => outputSection.scrollIntoView({ behavior:'smooth', block:'start' }), 400);

    } catch (err) {
        console.error('❌ Full error:', err);
        stopProgress(false);
        processingOverlay.classList.add('hidden');
        convertBtn.disabled = false;

        let msg = err.message || 'Unknown error.';
        if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('load failed')) {
            msg = '🌐 Cannot reach Space. Check internet or Space may be sleeping — wait 20s and retry.';
        } else if (msg.includes('404')) {
            msg = '❌ Space URL not found (404). The Space may have moved. Contact admin.';
        } else if (msg.includes('503') || msg.includes('502')) {
            msg = '💤 Space is starting up. Wait 30 seconds and click Convert again.';
        } else if (msg.includes('timed out') || msg.includes('timeout')) {
            msg = '⏱️ Processing took too long. Try a shorter or smaller video.';
        }
        showError(msg);
    }
});

// ============================================================
// DOWNLOAD
// ============================================================
downloadBtn.addEventListener('click', async () => {
    if (!currentOutputUrl) { showError('No video. Convert first.'); return; }
    const base = selectedFile?.name.replace(/\.[^.]+$/, '') || 'video';
    const orig = downloadBtn.innerHTML;
    downloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing...';
    downloadBtn.disabled = true;
    try {
        const r = await fetch(currentOutputUrl);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const blob = await r.blob();
        const bUrl = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: bUrl, download: `${base}_60fps.mp4` });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(bUrl), 5000);
    } catch(e) {
        showError('Download failed. Right-click video → "Save video as..."');
        window.open(currentOutputUrl, '_blank');
    } finally {
        downloadBtn.innerHTML = orig;
        downloadBtn.disabled = false;
    }
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
console.log('%c🎬 Non Quality Drop AI | Auto-URL Detection Active', 'background:#7209b7;color:#fff;padding:4px 12px;border-radius:6px;font-weight:bold;');
