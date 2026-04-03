// ----------------------------------------------
//  VelvetBoost AI – Secure Video Converter
//  (No visible HF reference, seamless Adsterra)
// ----------------------------------------------

// ---------- DOM Elements ----------
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
const adContainer = document.getElementById('adContainer');

let selectedFile = null;
let currentOutputUrl = null;
let popunderLoaded = false;
let nativeAdLoaded = false;

// ---------- Helper: Toast ----------
function showError(message) {
    errorToast.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;
    errorToast.classList.remove('hidden');
    setTimeout(() => errorToast.classList.add('hidden'), 5000);
}

// ---------- Load Adsterra Native Banner (inside overlay) ----------
function loadNativeAd() {
    if (nativeAdLoaded) return;
    // Clear placeholder and inject Adsterra native banner code
    adContainer.innerHTML = '';
    const invokeScript = document.createElement('script');
    invokeScript.src = 'https://pl29047080.profitablecpmratenetwork.com/cc751e76ba94e19cee6e3a94b56cb103/invoke.js';
    invokeScript.async = true;
    invokeScript.setAttribute('data-cfasync', 'false');
    const containerDiv = document.createElement('div');
    containerDiv.id = 'container-cc751e76ba94e19cee6e3a94b56cb103';
    adContainer.appendChild(containerDiv);
    adContainer.appendChild(invokeScript);
    nativeAdLoaded = true;
}

// ---------- Load Popunder (on convert click) ----------
function triggerPopunder() {
    if (popunderLoaded) return;
    const popScript = document.createElement('script');
    popScript.src = 'https://pl29047081.profitablecpmratenetwork.com/77/08/68/770868f68587939e9edcce4eec9fdc35.js';
    popScript.async = true;
    document.head.appendChild(popScript);
    popunderLoaded = true;
}

// ---------- Reset Output ----------
function resetOutput() {
    outputSection.classList.add('hidden');
    if (outputVideo.src) URL.revokeObjectURL(outputVideo.src);
    outputVideo.src = '';
    currentOutputUrl = null;
}

// ---------- File handling ----------
function handleFile(file) {
    if (!file || !file.type.startsWith('video/')) {
        showError('Please select a valid video file (MP4, MOV, WebM).');
        return false;
    }
    if (file.size > 210 * 1024 * 1024) {
        showError('Max file size is 200MB.');
        return false;
    }
    selectedFile = file;
    const url = URL.createObjectURL(file);
    originalPreview.src = url;
    previewSection.classList.remove('hidden');
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    fileInfo.innerText = `${file.name} (${sizeMB} MB)`;
    resetOutput();
    convertBtn.disabled = false;
    return true;
}

uploadZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
});

// Drag & drop
uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('upload-zone-drag');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('upload-zone-drag'));
uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('upload-zone-drag');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
});

clearFileBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    previewSection.classList.add('hidden');
    originalPreview.src = '';
    resetOutput();
    convertBtn.disabled = true;
});

// ---------- Gradio API Call (Hidden HF reference) ----------
async function sendVideoToAI(file) {
    const { Client } = await import('@gradio/client');
    // No explicit HF mention in logs or errors to the user
    const client = await Client.connect("thivix/tiktok-hq-converter");
    const result = await client.predict("/convert_video", {
        input_path: file
    });
    if (!result?.data?.length) throw new Error('Empty response from enhancement engine');
    let videoUrl = result.data[0];
    if (videoUrl && typeof videoUrl === 'object' && videoUrl.url) videoUrl = videoUrl.url;
    if (typeof videoUrl !== 'string' || (!videoUrl.startsWith('http') && !videoUrl.startsWith('blob:')))
        throw new Error('Invalid video output');
    return videoUrl;
}

// ---------- Download helper ----------
async function downloadVideo(videoUrl, filename = "velvetboost_60fps.mp4") {
    try {
        const resp = await fetch(videoUrl);
        if (!resp.ok) throw new Error();
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
    } catch {
        showError('Direct download failed. Right-click the video and select "Save video as".');
        window.open(videoUrl, '_blank');
    }
}

// ---------- Conversion Process with Ads ----------
convertBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        showError('Select a video first.');
        return;
    }
    // Show overlay & load ads
    processingOverlay.classList.remove('hidden');
    convertBtn.disabled = true;
    triggerPopunder();        // Popunder fires once
    loadNativeAd();           // Native banner inside overlay

    try {
        const processedUrl = await sendVideoToAI(selectedFile);
        currentOutputUrl = processedUrl;
        outputVideo.src = processedUrl;
        outputVideo.load();
        outputSection.classList.remove('hidden');
        // success toast
        const successMsg = document.createElement('div');
        successMsg.className = 'fixed top-6 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white px-5 py-2 rounded-full text-sm z-50 shadow-xl animate-fadeInUp';
        successMsg.innerText = '✨ Conversion complete! 60fps ready.';
        document.body.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 3000);
    } catch (err) {
        console.error(err); // silent for security but dev log
        let friendly = 'AI service is busy. Please try again in a moment.';
        if (err.message.includes('fetch')) friendly = 'Network unstable. Check your connection.';
        else if (err.message.includes('422')) friendly = 'Video format not supported by enhancer.';
        showError(friendly);
    } finally {
        processingOverlay.classList.add('hidden');
        convertBtn.disabled = false;
    }
});

downloadBtn.addEventListener('click', async () => {
    if (!currentOutputUrl) {
        showError('No converted video. Please convert first.');
        return;
    }
    const baseName = selectedFile ? selectedFile.name.split('.')[0] : 'enhanced';
    downloadBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Preparing...';
    downloadBtn.disabled = true;
    await downloadVideo(currentOutputUrl, `${baseName}_60fps.mp4`);
    downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download Ultra HD';
    downloadBtn.disabled = false;
});

// Cleanup blob URLs
window.addEventListener('beforeunload', () => {
    if (originalPreview.src?.startsWith('blob:')) URL.revokeObjectURL(originalPreview.src);
    if (outputVideo.src?.startsWith('blob:')) URL.revokeObjectURL(outputVideo.src);
});

// Initial button state
convertBtn.disabled = true;