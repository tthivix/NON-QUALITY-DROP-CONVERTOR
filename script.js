// Non Quality Drop Upload AI — script.js FINAL WORKING VERSION
// Uses @gradio/client from esm.sh CDN (no importmap needed)
// Space: thivix/tiktok-hq-converter

const SPACE = "thivix/tiktok-hq-converter";

// DOM
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

// PARTICLES
(function () {
    var c = document.getElementById('bgParticles');
    if (!c) return;
    var colors = ['#f72585','#7209b7','#4361ee','#4cc9f0','#06d6a0'];
    for (var i = 0; i < 35; i++) {
        var p = document.createElement('div');
        p.className = 'particle';
        var s = Math.random() * 5 + 2;
        p.style.cssText = 'width:'+s+'px;height:'+s+'px;left:'+(Math.random()*100)+'%;background:'+colors[~~(Math.random()*5)]+';animation-duration:'+(Math.random()*18+10)+'s;animation-delay:'+(Math.random()*10)+'s;';
        c.appendChild(p);
    }
})();

// PROGRESS
var STAGES = [
    { pct: 8,  label: 'Waking up AI Space...' },
    { pct: 22, label: 'Connecting to THIVIX AI...' },
    { pct: 38, label: 'Uploading your video...' },
    { pct: 54, label: 'Analyzing video frames...' },
    { pct: 70, label: 'Enhancing quality & FPS...' },
    { pct: 85, label: 'Applying 60FPS conversion...' },
    { pct: 94, label: 'Finalizing output...' },
];
function startProgress() {
    var i = 0;
    clearInterval(progressInterval);
    progressBar.style.width = '0%';
    progressLabel.textContent = STAGES[0].label;
    progressInterval = setInterval(function() {
        if (i < STAGES.length) { progressBar.style.width = STAGES[i].pct+'%'; progressLabel.textContent = STAGES[i].label; i++; }
    }, 2000);
}
function setProgress(pct, label) { progressBar.style.width = pct+'%'; progressLabel.textContent = label; }
function stopProgress(ok) {
    clearInterval(progressInterval); progressInterval = null;
    progressBar.style.width = ok ? '100%' : '30%';
    progressLabel.textContent = ok ? 'Done! Video ready.' : 'Failed. Please retry.';
}
function sleep(ms) { return new Promise(function(r){ setTimeout(r, ms); }); }

function showError(msg) {
    if (toastTimeout) clearTimeout(toastTimeout);
    successToast.classList.add('hidden');
    toastMsg.textContent = msg;
    errorToast.classList.remove('hidden');
    toastTimeout = setTimeout(function(){ errorToast.classList.add('hidden'); }, 9000);
}
function showSuccess() {
    if (toastTimeout) clearTimeout(toastTimeout);
    errorToast.classList.add('hidden');
    successToast.classList.remove('hidden');
    toastTimeout = setTimeout(function(){ successToast.classList.add('hidden'); }, 5000);
}

// FILE HANDLING
function resetOutput() {
    outputSection.classList.add('hidden');
    if (outputVideo.src && outputVideo.src.startsWith('blob:')) URL.revokeObjectURL(outputVideo.src);
    outputVideo.src = ''; currentOutputUrl = null;
}
function updateConvertButton() { convertBtn.disabled = !selectedFile; }
function handleFile(file) {
    if (!file || !file.type.startsWith('video/')) { showError('Please select a valid video file.'); return; }
    if (file.size > 210*1024*1024) { showError('File too large. Max 200MB.'); return; }
    selectedFile = file;
    originalPreview.src = URL.createObjectURL(file);
    previewSection.classList.remove('hidden');
    fileInfo.textContent = file.name + ' - ' + (file.size/1048576).toFixed(2) + ' MB';
    resetOutput(); updateConvertButton();
}
uploadZone.addEventListener('click', function(){ videoInput.click(); });
videoInput.addEventListener('change', function(e){ if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]); });
uploadZone.addEventListener('dragover', function(e){ e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', function(){ uploadZone.classList.remove('dragover'); });
uploadZone.addEventListener('drop', function(e){ e.preventDefault(); uploadZone.classList.remove('dragover'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
clearFileBtn.addEventListener('click', function(){
    selectedFile = null; videoInput.value = '';
    if (originalPreview.src && originalPreview.src.startsWith('blob:')) URL.revokeObjectURL(originalPreview.src);
    originalPreview.src = ''; previewSection.classList.add('hidden'); resetOutput(); updateConvertButton();
});
convertAnotherBtn.addEventListener('click', function(){ clearFileBtn.click(); window.scrollTo({top:0,behavior:'smooth'}); });

// ============================================================
// CORE: Load @gradio/client dynamically from esm.sh
// esm.sh always has the latest version — no version number needed
// ============================================================
var gradioClient = null;

async function loadGradioClient() {
    if (gradioClient) return gradioClient;
    setProgress(10, 'Loading AI connector...');
    console.log('Loading @gradio/client from esm.sh...');
    try {
        var mod = await import('https://esm.sh/@gradio/client');
        gradioClient = mod.Client || mod.default || mod;
        console.log('Gradio client loaded:', typeof gradioClient);
        return gradioClient;
    } catch(e) {
        console.error('esm.sh failed, trying unpkg...', e);
        try {
            var mod2 = await import('https://unpkg.com/@gradio/client/dist/index.min.js');
            gradioClient = mod2.Client || mod2.default || mod2;
            console.log('Gradio client loaded via unpkg');
            return gradioClient;
        } catch(e2) {
            throw new Error('Could not load Gradio connector. Check your internet connection.');
        }
    }
}

// ============================================================
// CONVERT using @gradio/client (correct way — handles URL internally)
// ============================================================
async function convertVideo(file) {
    var ClientClass = await loadGradioClient();

    setProgress(20, 'Connecting to Space...');
    console.log('Connecting to Space:', SPACE);

    var client;
    try {
        // Client.connect() handles the correct .hf.space URL internally
        client = await ClientClass.connect(SPACE);
        console.log('Connected!', client);
    } catch(e) {
        console.error('Connect error:', e);
        throw new Error('Cannot connect to Space. It may be sleeping. Wait 30 seconds and try again. (' + e.message + ')');
    }

    setProgress(40, 'Uploading video to AI...');
    console.log('Sending predict request...');

    var result;
    try {
        result = await client.predict('/convert_video', {
            input_path: file
        });
        console.log('Predict result:', result);
    } catch(e) {
        console.error('Predict error:', e);
        throw new Error('AI processing failed: ' + e.message);
    }

    if (!result || !result.data || result.data.length === 0) {
        throw new Error('Empty response from AI. Try again.');
    }

    var item = result.data[0];
    console.log('Output item:', JSON.stringify(item).slice(0, 300));

    var videoUrl = null;
    if (typeof item === 'string') {
        videoUrl = item;
    } else if (item && item.url) {
        videoUrl = item.url;
    } else if (item && item.path) {
        videoUrl = item.path;
    } else if (item && item.value) {
        videoUrl = typeof item.value === 'string' ? item.value : (item.value.url || item.value.path);
    }

    if (!videoUrl) throw new Error('Cannot get video URL from response: ' + JSON.stringify(item).slice(0,200));
    console.log('Video URL:', videoUrl);
    return videoUrl;
}

// MAIN CONVERT BUTTON
convertBtn.addEventListener('click', async function() {
    if (!selectedFile) { showError('Please select a video file first.'); return; }
    resetOutput();
    processingOverlay.classList.remove('hidden');
    convertBtn.disabled = true;
    startProgress();

    try {
        var url = await convertVideo(selectedFile);
        currentOutputUrl = url;
        stopProgress(true);
        await sleep(300);
        outputVideo.src = url;
        outputVideo.load();
        outputSection.classList.remove('hidden');
        processingOverlay.classList.add('hidden');
        convertBtn.disabled = false;
        showSuccess();
        setTimeout(function(){ outputSection.scrollIntoView({behavior:'smooth',block:'start'}); }, 400);
    } catch(err) {
        console.error('Conversion error:', err);
        stopProgress(false);
        processingOverlay.classList.add('hidden');
        convertBtn.disabled = false;
        var msg = err.message || 'Unknown error. Try again.';
        showError(msg);
    }
});

// DOWNLOAD
downloadBtn.addEventListener('click', async function() {
    if (!currentOutputUrl) { showError('No video. Convert first.'); return; }
    var base = selectedFile ? selectedFile.name.replace(/\.[^.]+$/, '') : 'video';
    var orig = downloadBtn.innerHTML;
    downloadBtn.innerHTML = 'Preparing...'; downloadBtn.disabled = true;
    try {
        var r = await fetch(currentOutputUrl);
        if (!r.ok) throw new Error(r.status);
        var b = await r.blob();
        var u = URL.createObjectURL(b);
        var a = document.createElement('a');
        a.href = u; a.download = base + '_60fps.mp4';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function(){ URL.revokeObjectURL(u); }, 5000);
    } catch(e) {
        showError('Download failed. Right-click video and Save video as...');
        window.open(currentOutputUrl, '_blank');
    } finally { downloadBtn.innerHTML = orig; downloadBtn.disabled = false; }
});

window.addEventListener('beforeunload', function(){
    if (originalPreview.src && originalPreview.src.startsWith('blob:')) URL.revokeObjectURL(originalPreview.src);
    if (outputVideo.src && outputVideo.src.startsWith('blob:')) URL.revokeObjectURL(outputVideo.src);
    clearInterval(progressInterval);
});

updateConvertButton();
console.log('%c Non Quality Drop AI | Space: ' + SPACE, 'background:#7209b7;color:#fff;padding:5px 14px;border-radius:8px;font-weight:900;');
