// ----------------------------------------------
// 🔧 CONFIGURATION: Hugging Face Space 
// ----------------------------------------------
// HTML එකේ ඇති importmap හරහා Gradio Client එක ගෙන්වා ගැනීම
import { Client } from "@gradio/client";

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

// Helper: Overlay එක ඉවත් කර Button එක ක්‍රියාකාරී කිරීම
function hideOverlayAndEnable() {
    processingOverlay.classList.add('hidden');
    convertBtn.disabled = false;
}

// Output එක Reset කිරීම
function resetOutput() {
    outputSection.classList.add('hidden');
    if (outputVideo.src) {
        URL.revokeObjectURL(outputVideo.src);
    }
    outputVideo.src = '';
    currentOutputUrl = null;
}

// File එකක් තෝරා ඇති විට පමණක් Convert Button එක Enable කිරීම
function updateConvertButton() {
    convertBtn.disabled = !selectedFile;
}

// තෝරාගත් File එක ඉවත් කිරීම
clearFileBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    previewSection.classList.add('hidden');
    originalPreview.src = '';
    resetOutput();
    updateConvertButton();
});

// File Selection හැසිරවීම
function handleFile(file) {
    if (!file || !file.type.startsWith('video/')) {
        showError('කරුණාකර නිවැරදි වීඩියෝවක් තෝරන්න (MP4, WebM, MOV).');
        return false;
    }
    if (file.size > 210 * 1024 * 1024) {
        showError('වීඩියෝව විශාල වැඩියි. උපරිමය 200MB විය යුතුයි.');
        return false;
    }
    selectedFile = file;
    
    // Preview කිරීම
    const url = URL.createObjectURL(file);
    originalPreview.src = url;
    previewSection.classList.remove('hidden');
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    fileInfo.innerText = `${file.name} (${sizeMB} MB)`;
    resetOutput();
    updateConvertButton();
    return true;
}

// Upload zone Click කිරීම
uploadZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
});

// Drag & drop ක්‍රියාකාරීත්වය
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

// ========== GRADIO INTEGRATION & CONVERSION ==========
async function sendVideoToHF(file) {
    try {
        // Hugging Face Space එකට Connect වීම
        const client = await Client.connect(HF_SPACE_ID);
        
        // AI API එකට වීඩියෝව යැවීම
        const result = await client.predict(ENDPOINT_NAME, {
            [INPUT_PARAM_NAME]: file
        });
        
        if (!result || !result.data || result.data.length === 0) {
            throw new Error('Server returned empty response.');
        }
        
        let outputVideoUrl = null;
        const firstOutput = result.data[0];
        
        // URL එක නිවැරදිව වෙන් කර ගැනීම
        if (typeof firstOutput === 'string') {
            outputVideoUrl = firstOutput;
        } else if (firstOutput && typeof firstOutput === 'object' && firstOutput.url) {
            outputVideoUrl = firstOutput.url;
        } else if (firstOutput && firstOutput.value && typeof firstOutput.value === 'string') {
            outputVideoUrl = firstOutput.value;
        } else {
            throw new Error('Unexpected response format from AI backend.');
        }
        
        if (!outputVideoUrl) {
            throw new Error('Processed video URL not found in response.');
        }
        
        return outputVideoUrl;
    } catch (err) {
        console.error('Gradio API error:', err);
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
            throw new Error('Server එක Sleep වී ඇත. කරුණාකර තත්පර 15කින් පමණ නැවත Convert ඔබන්න.');
        } else if (err.message.includes('404')) {
            throw new Error(`Endpoint ${ENDPOINT_NAME} not found on Space. Verify the Space's API.`);
        } else {
            throw err;
        }
    }
}

// Download ක්‍රියාකාරීත්වය
async function downloadVideoAsBlob(videoUrl, filename = "enhanced_video.mp4") {
    try {
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
    } catch (err) {
        console.error(err);
        showError('Download error. වීඩියෝව මත Right-click කර "Save video as" තෝරන්න.');
        window.open(videoUrl, '_blank');
    }
}

// MAIN CONVERT ACTION (බොත්තම එබූ විට)
convertBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        showError('කරුණාකර පළමුව වීඩියෝවක් තෝරන්න.');
        return;
    }
    
    resetOutput();
    processingOverlay.classList.remove('hidden');
    convertBtn.disabled = true;
    
    const handleError = (errMsg) => {
        hideOverlayAndEnable();
        showError(errMsg);
        console.error(errMsg);
    };
    
    try {
        const processedVideoUrl = await sendVideoToHF(selectedFile);
        currentOutputUrl = processedVideoUrl;
        outputVideo.src = processedVideoUrl;
        outputVideo.load();
        outputSection.classList.remove('hidden');
        processingOverlay.classList.add('hidden');
        convertBtn.disabled = false;
        
        const tempMsg = document.createElement('div');
        tempMsg.className = 'fixed top-20 right-6 bg-emerald-500 text-white px-4 py-2 rounded-full text-sm z-50 shadow-xl';
        tempMsg.innerText = '✅ Conversion complete! Video ready.';
        document.body.appendChild(tempMsg);
        setTimeout(() => tempMsg.remove(), 3000);
        
    } catch (error) {
        console.error('Conversion error:', error);
        let friendlyMsg = 'Server busy or API error. Please try again.';
        if (error.message.includes('Server එක Sleep')) friendlyMsg = error.message;
        else if (error.message.includes('fetch')) friendlyMsg = 'Network error. කරුණාකර නැවත උත්සාහ කරන්න.';
        handleError(friendlyMsg);
    }
});

// Download බොත්තම එබූ විට
downloadBtn.addEventListener('click', async () => {
    if (!currentOutputUrl) {
        showError('කරුණාකර වීඩියෝවක් Convert කරගන්න.');
        return;
    }
    const originalName = selectedFile ? selectedFile.name.split('.')[0] : 'enhanced';
    const filename = `${originalName}_converted.mp4`;
    downloadBtn.innerText = '⏳ Preparing download...';
    downloadBtn.disabled = true;
    try {
        await downloadVideoAsBlob(currentOutputUrl, filename);
    } catch (err) {
        showError('සෘජුව Download කිරීමට නොහැක. වීඩියෝව Right-click කර Save As දෙන්න.');
    } finally {
        downloadBtn.innerText = '⬇️ Download High Quality Video';
        downloadBtn.disabled = false;
    }
});

// පිටුවෙන් ඉවත් වීමේදී Memory Clear කිරීම
window.addEventListener('beforeunload', () => {
    if (originalPreview.src && originalPreview.src.startsWith('blob:')) URL.revokeObjectURL(originalPreview.src);
    if (outputVideo.src && outputVideo.src.startsWith('blob:')) URL.revokeObjectURL(outputVideo.src);
});

updateConvertButton();
console.log(`%c✅ Non Quality Drop AI | Connected to Space: ${HF_SPACE_ID}`, 'background: #ec489a; color: white; padding: 4px 8px; border-radius: 8px;');
