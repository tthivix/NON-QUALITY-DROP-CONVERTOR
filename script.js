// Non Quality Drop Upload AI — script.js CLEAN FINAL
// Space: thivix/tiktok-hq-converter
// URL:   https://thivix--tiktok-hq-converter.hf.space

const BASE_URL = "https://thivix--tiktok-hq-converter.hf.space";

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
    const c = document.getElementById('bgParticles');
    if (!c) return;
    const colors = ['#f72585','#7209b7','#4361ee','#4cc9f0','#06d6a0'];
    for (let i = 0; i < 35; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const s = Math.random() * 5 + 2;
        p.style.cssText = 'width:'+s+'px;height:'+s+'px;left:'+(Math.random()*100)+'%;background:'+colors[~~(Math.random()*5)]+';animation-duration:'+(Math.random()*18+10)+'s;animation-delay:'+(Math.random()*10)+'s;';
        c.appendChild(p);
    }
})();

// PROGRESS
const STAGES = [
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
        if (i < STAGES.length) {
            progressBar.style.width = STAGES[i].pct + '%';
            progressLabel.textContent = STAGES[i].label;
            i++;
        }
    }, 2000);
}
function setProgress(pct, label) {
    progressBar.style.width = pct + '%';
    progressLabel.textContent = label;
}
function stopProgress(ok) {
    clearInterval(progressInterval);
    progressInterval = null;
    progressBar.style.width = ok ? '100%' : '30%';
    progressLabel.textContent = ok ? 'Done! Video ready.' : 'Failed. Please retry.';
}

function sleep(ms) { return new Promise(function(r){ setTimeout(r, ms); }); }
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

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
    outputVideo.src = '';
    currentOutputUrl = null;
}
function updateConvertButton() { convertBtn.disabled = !selectedFile; }

function handleFile(file) {
    if (!file || !file.type.startsWith('video/')) {
        showError('Please select a valid video file (MP4, WebM, MOV).');
        return;
    }
    if (file.size > 210 * 1024 * 1024) {
        showError('File too large. Max 200MB.');
        return;
    }
    selectedFile = file;
    originalPreview.src = URL.createObjectURL(file);
    previewSection.classList.remove('hidden');
    fileInfo.textContent = file.name + ' - ' + (file.size/1048576).toFixed(2) + ' MB';
    resetOutput();
    updateConvertButton();
}

uploadZone.addEventListener('click', function(){ videoInput.click(); });
videoInput.addEventListener('change', function(e){ if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]); });
uploadZone.addEventListener('dragover', function(e){ e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', function(){ uploadZone.classList.remove('dragover'); });
uploadZone.addEventListener('drop', function(e){
    e.preventDefault(); uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
clearFileBtn.addEventListener('click', function(){
    selectedFile = null; videoInput.value = '';
    if (originalPreview.src && originalPreview.src.startsWith('blob:')) URL.revokeObjectURL(originalPreview.src);
    originalPreview.src = '';
    previewSection.classList.add('hidden');
    resetOutput(); updateConvertButton();
});
convertAnotherBtn.addEventListener('click', function(){ clearFileBtn.click(); window.scrollTo({top:0,behavior:'smooth'}); });

// UPLOAD FILE
async function uploadFile(file) {
    var uploadUrl = BASE_URL + '/upload?upload_id=' + uid();
    setProgress(30, 'Uploading video...');
    console.log('Upload URL:', uploadUrl);

    var fd = new FormData();
    fd.append('files', file, file.name);

    var res;
    try {
        res = await fetch(uploadUrl, { method: 'POST', body: fd });
    } catch(e) {
        throw new Error('Cannot reach Space. Wait 30s and retry. (' + e.message + ')');
    }

    var text = await res.text();
    console.log('Upload response [' + res.status + ']:', text.slice(0, 300));

    if (!res.ok) throw new Error('Upload HTTP ' + res.status + ': ' + text.slice(0, 120));

    var paths;
    try { paths = JSON.parse(text); } catch(_){ throw new Error('Upload bad JSON: ' + text.slice(0,80)); }
    if (!Array.isArray(paths) || !paths[0]) throw new Error('Upload returned no file path.');

    console.log('File on server:', paths[0]);
    return paths[0];
}

// QUEUE + WAIT (Gradio 4 SSE)
function queueAndWait(filePath) {
    var sessionHash = uid();
    var joinUrl = BASE_URL + '/queue/join';
    var sseUrl  = BASE_URL + '/queue/data?session_hash=' + sessionHash;

    var payload = {
        fn_index: 0,
        session_hash: sessionHash,
        event_data: null,
        data: [{
            path: filePath,
            orig_name: selectedFile.name,
            size: selectedFile.size,
            mime_type: selectedFile.type || 'video/mp4',
            is_stream: false,
            meta: { _type: 'gradio.FileData' }
        }]
    };

    console.log('Queue join:', joinUrl);
    setProgress(50, 'AI is processing...');

    return fetch(joinUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(function(jr) {
        return jr.text().then(function(jt) {
            console.log('Join [' + jr.status + ']:', jt);
            if (!jr.ok) throw new Error('Queue join HTTP ' + jr.status + ': ' + jt.slice(0,120));
            return jt;
        });
    }).then(function() {
        setProgress(65, 'AI converting your video...');
        console.log('SSE:', sseUrl);

        return new Promise(function(resolve, reject) {
            var es = new EventSource(sseUrl);
            var timer = setTimeout(function() {
                es.close();
                reject(new Error('Timed out (3 min). Try a smaller video.'));
            }, 180000);

            es.onmessage = function(evt) {
                var msg;
                try { msg = JSON.parse(evt.data); } catch(_){ return; }
                console.log('SSE:', msg.msg, msg);

                if (msg.msg === 'queue_full') {
                    clearTimeout(timer); es.close();
                    reject(new Error('AI queue full. Wait 1 min and retry.'));

                } else if (msg.msg === 'estimation') {
                    setProgress(65, 'Queue position: ' + (msg.rank || '?') + ' — waiting...');

                } else if (msg.msg === 'process_starts') {
                    setProgress(78, 'AI enhancing your video...');

                } else if (msg.msg === 'process_completed' || msg.msg === 'process_generating') {
                    clearTimeout(timer); es.close();
                    var out = msg.output;
                    if (out && out.error) { reject(new Error('AI error: ' + out.error)); return; }
                    var data = out && out.data;
                    if (!data || !data.length) { reject(new Error('Empty AI response. Try again.')); return; }
                    var url = extractUrl(data);
                    if (!url) { reject(new Error('No video URL in response: ' + JSON.stringify(data).slice(0,200))); return; }
                    resolve(url);

                } else if (msg.msg === 'close_stream') {
                    clearTimeout(timer); es.close();
                    reject(new Error('Stream closed. Try again.'));
                }
            };
            es.onerror = function() {
                clearTimeout(timer); es.close();
                reject(new Error('Connection lost. Try again.'));
            };
        });
    });
}

// EXTRACT URL from Gradio output
function extractUrl(data) {
    var item = data[0];
    console.log('Output item:', JSON.stringify(item).slice(0,300));
    if (!item) return null;
    if (typeof item === 'string') return item.startsWith('http') ? item : BASE_URL + '/file=' + item;
    if (item.url)  return item.url.startsWith('http')  ? item.url  : BASE_URL + item.url;
    if (item.path) return item.path.startsWith('http') ? item.path : BASE_URL + '/file=' + item.path;
    if (typeof item.value === 'string') return item.value.startsWith('http') ? item.value : BASE_URL + '/file=' + item.value;
    if (item.value && item.value.url)  return item.value.url;
    if (item.value && item.value.path) return BASE_URL + '/file=' + item.value.path;
    return null;
}

// CONVERT
convertBtn.addEventListener('click', async function() {
    if (!selectedFile) { showError('Please select a video file first.'); return; }

    resetOutput();
    processingOverlay.classList.remove('hidden');
    convertBtn.disabled = true;
    startProgress();

    try {
        setProgress(8, 'Waking up AI Space...');
        try { await fetch(BASE_URL, { method: 'GET', mode: 'no-cors' }); } catch(_){}
        await sleep(1000);

        var filePath = await uploadFile(selectedFile);
        var videoUrl = await queueAndWait(filePath);

        currentOutputUrl = videoUrl;
        console.log('Video URL:', videoUrl);

        stopProgress(true);
        await sleep(300);

        outputVideo.src = videoUrl;
        outputVideo.load();
        outputSection.classList.remove('hidden');
        processingOverlay.classList.add('hidden');
        convertBtn.disabled = false;
        showSuccess();
        setTimeout(function(){ outputSection.scrollIntoView({behavior:'smooth',block:'start'}); }, 400);

    } catch(err) {
        console.error('Error:', err);
        stopProgress(false);
        processingOverlay.classList.add('hidden');
        convertBtn.disabled = false;

        var msg = err.message || 'Unknown error.';
        if (/fetch|network|reach/i.test(msg))  msg = 'Network error. Check internet and retry.';
        else if (/404/.test(msg))              msg = 'Space not found (404). Make sure it is public and running.';
        else if (/503|502/.test(msg))          msg = 'Space booting up. Wait 30 seconds and retry.';
        else if (/timed out/i.test(msg))       msg = 'Timed out. Try a smaller video file.';
        else if (/queue.*full/i.test(msg))     msg = 'AI is busy. Wait 60 seconds and retry.';

        showError(msg);
    }
});

// DOWNLOAD
downloadBtn.addEventListener('click', async function() {
    if (!currentOutputUrl) { showError('No video. Convert first.'); return; }
    var base = selectedFile ? selectedFile.name.replace(/\.[^.]+$/, '') : 'video';
    var orig = downloadBtn.innerHTML;
    downloadBtn.innerHTML = 'Preparing...';
    downloadBtn.disabled = true;
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
        showError('Download failed. Right-click video > Save video as...');
        window.open(currentOutputUrl, '_blank');
    } finally {
        downloadBtn.innerHTML = orig; downloadBtn.disabled = false;
    }
});

window.addEventListener('beforeunload', function(){
    if (originalPreview.src && originalPreview.src.startsWith('blob:')) URL.revokeObjectURL(originalPreview.src);
    if (outputVideo.src && outputVideo.src.startsWith('blob:')) URL.revokeObjectURL(outputVideo.src);
    clearInterval(progressInterval);
});

updateConvertButton();
console.log('%c Non Quality Drop AI | ' + BASE_URL, 'background:#7209b7;color:#fff;padding:5px 14px;border-radius:8px;font-weight:900;');
