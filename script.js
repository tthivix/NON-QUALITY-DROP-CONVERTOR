// ----------------------------------------------
// 🔧 CONFIGURATION: Hugging Face Space
// ----------------------------------------------
import { Client } from "https://cdn.jsdelivr.net/npm/@gradio/client/+esm";

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

// Helper: Error පණිවිඩ පෙන්වීම
function showError(message) {
    errorToast.innerText = message;
    errorToast.classList.remove('hidden');
    setTimeout(() => {
        errorToast.classList.add('hidden');
    }, 4500);
}

// Helper: Overlay එක ඉවත් කිරීම
function hideOverlayAndEnable() {
    processingOverlay.classList.add('hidden');
    convertBtn.disabled = false;
}

// Output එක Reset කිරීම
function resetOutput() {
    outputSection.classList.add('hidden');
    if (outputVideo.src && outputVideo.src.startsWith('blob:')) {
        URL.revokeObjectURL(outputVideo.src);
    }
    outputVideo.src = '';
    currentOutputUrl = null;
}

// Convert Button එකේ තත්ත්වය වෙනස් කිරීම[cite: 5]
function updateConvertButton() {
    convertBtn.disabled = !selectedFile;
}

// තෝරාගත් වීඩියෝව ඉවත් කිරීම[cite: 5]
clearFileBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Upload zone එක click වීම වැළැක්වීමට
    selectedFile = null;
    fileInput.value = '';
    previewSection.classList.add('hidden');
    originalPreview.src = '';
    resetOutput();
    updateConvertButton();
});

// වීඩියෝවක් තෝරාගත් විට ක්‍රියාත්මක වන ප්‍රධාන ශ්‍රිතය[cite: 5]
function handleFile(file) {
    if (!file || !file.type.startsWith('video/')) {
        showError('කරුණාකර වලංගු වීඩියෝ ගොනුවක් තෝරන්න (MP4, WebM, MOV).[cite: 5]');
        return false;
    }
    if (file.size > 210 * 1024 * 1024) {
        showError('ගොනුව විශාල වැඩියි. උපරිමය 200MB විය යුතුයි.[cite: 5]');
        return false;
    }
    selectedFile = file;
    
    // Preview පෙන්වීම[cite: 5]
    const url = URL.createObjectURL(file);
    originalPreview.src = url;
    previewSection.classList.remove('hidden');
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    fileInfo.innerText = `${file.name} (${sizeMB} MB)[cite: 5]`;
    resetOutput();
    updateConvertButton();
    return true;
}

// Click කිරීමෙන් වීඩියෝ තේරීම[cite: 5]
uploadZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0]);
    }
});

// Drag & Drop පහසුකම[cite: 5]
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

// API එකට වීඩියෝව යැවීම[cite: 5]
async function sendVideoToHF(file) {
    try {
        const client = await Client.connect(HF_SPACE_ID);
        const result = await client.predict(ENDPOINT_NAME, {
            [INPUT_PARAM_NAME]: file
        });
        
        if (!result || !result.data || result.data.length === 0) {
            throw new Error('Server එකෙන් ප්‍රතිචාරයක් නැත.[cite: 5]');
        }
        
        let outputVideoUrl = null;
        const firstOutput = result.data[0];
        
        if (typeof firstOutput === 'string') {
            outputVideoUrl = firstOutput;
        } else if (firstOutput?.url) {
            outputVideoUrl = firstOutput.url;
        } else {
            throw new Error('වීඩියෝ URL එක සොයාගත නොහැක.[cite: 5]');
        }
        
        return outputVideoUrl;
    } catch (err) {
        console.error('API Error:', err);
        throw err;
    }
}

// Convert බොත්තම එබූ විට[cite: 5]
convertBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    
    resetOutput();
    processingOverlay.classList.remove('hidden');
    convertBtn.disabled = true;
    
    try {
        const processedVideoUrl = await sendVideoToHF(selectedFile);
        currentOutputUrl = processedVideoUrl;
        outputVideo.src = processedVideoUrl;
        outputVideo.load();
        outputSection.classList.remove('hidden');
        processingOverlay.classList.add('hidden');
        convertBtn.disabled = false;
    } catch (error) {
        hideOverlayAndEnable();
        showError('සර්වර් එක කාර්යබහුලයි. කරුණාකර නැවත උත්සාහ කරන්න.[cite: 5]');
    }
});

// Download කිරීමේ පහසුකම[cite: 5]
downloadBtn.addEventListener('click', async () => {
    if (!currentOutputUrl) return;
    
    downloadBtn.innerText = '⏳ Preparing...';
    try {
        const response = await fetch(currentOutputUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = "enhanced_video.mp4";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
    } catch (err) {
        showError('Download කිරීමට නොහැක. වීඩියෝව මත Right-click කර Save කරන්න.[cite: 5]');
    } finally {
        downloadBtn.innerText = '⬇️ Download High Quality Video';
    }
});

updateConvertButton();
