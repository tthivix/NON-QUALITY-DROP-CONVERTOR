// Non Quality Drop Upload AI — script.js FIXED
// Space: thivix/tiktok-hq-converter
// Fix: client.upload() format corrected

const SPACE = "thivix/tiktok-hq-converter";

const uploadZone=document.getElementById('uploadZone'),videoInput=document.getElementById('videoInput'),convertBtn=document.getElementById('convertBtn'),previewSection=document.getElementById('previewSection'),originalPreview=document.getElementById('originalPreview'),fileInfo=document.getElementById('fileInfo'),clearFileBtn=document.getElementById('clearFileBtn'),outputSection=document.getElementById('outputSection'),outputVideo=document.getElementById('outputVideo'),downloadBtn=document.getElementById('downloadBtn'),convertAnotherBtn=document.getElementById('convertAnotherBtn'),processingOverlay=document.getElementById('processingOverlay'),errorToast=document.getElementById('errorToast'),successToast=document.getElementById('successToast'),toastMsg=document.getElementById('toastMsg'),progressBar=document.getElementById('progressBar'),progressLabel=document.getElementById('progressLabel');
let selectedFile=null,currentOutputUrl=null,progressInterval=null,toastTimeout=null;

(function(){var c=document.getElementById('bgParticles');if(!c)return;var cols=['#f72585','#7209b7','#4361ee','#4cc9f0','#06d6a0'];for(var i=0;i<35;i++){var p=document.createElement('div');p.className='particle';var s=Math.random()*5+2;p.style.cssText='width:'+s+'px;height:'+s+'px;left:'+(Math.random()*100)+'%;background:'+cols[~~(Math.random()*5)]+';animation-duration:'+(Math.random()*18+10)+'s;animation-delay:'+(Math.random()*10)+'s;';c.appendChild(p);}})();

var STAGES=[{pct:8,label:'Waking up AI...'},{pct:20,label:'Connecting...'},{pct:35,label:'Uploading video...'},{pct:55,label:'AI processing...'},{pct:72,label:'Enhancing FPS...'},{pct:88,label:'Finalizing...'}];
function startProgress(){var i=0;clearInterval(progressInterval);progressBar.style.width='0%';progressLabel.textContent=STAGES[0].label;progressInterval=setInterval(function(){if(i<STAGES.length){progressBar.style.width=STAGES[i].pct+'%';progressLabel.textContent=STAGES[i].label;i++;}},2500);}
function setProgress(p,l){progressBar.style.width=p+'%';progressLabel.textContent=l;}
function stopProgress(ok){clearInterval(progressInterval);progressInterval=null;progressBar.style.width=ok?'100%':'30%';progressLabel.textContent=ok?'Done! Video ready.':'Failed. Please retry.';}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
function showError(msg){if(toastTimeout)clearTimeout(toastTimeout);successToast.classList.add('hidden');toastMsg.textContent=msg;errorToast.classList.remove('hidden');toastTimeout=setTimeout(function(){errorToast.classList.add('hidden');},10000);}
function showSuccess(){if(toastTimeout)clearTimeout(toastTimeout);errorToast.classList.add('hidden');successToast.classList.remove('hidden');toastTimeout=setTimeout(function(){successToast.classList.add('hidden');},5000);}
function resetOutput(){outputSection.classList.add('hidden');if(outputVideo.src&&outputVideo.src.startsWith('blob:'))URL.revokeObjectURL(outputVideo.src);outputVideo.src='';currentOutputUrl=null;}
function updateConvertButton(){convertBtn.disabled=!selectedFile;}
function handleFile(file){if(!file||!file.type.startsWith('video/')){showError('Please select a valid video file.');return;}if(file.size>210*1024*1024){showError('File too large. Max 200MB.');return;}selectedFile=file;originalPreview.src=URL.createObjectURL(file);previewSection.classList.remove('hidden');fileInfo.textContent=file.name+' - '+(file.size/1048576).toFixed(2)+' MB';resetOutput();updateConvertButton();}
uploadZone.addEventListener('click',function(){videoInput.click();});
videoInput.addEventListener('change',function(e){if(e.target.files&&e.target.files[0])handleFile(e.target.files[0]);});
uploadZone.addEventListener('dragover',function(e){e.preventDefault();uploadZone.classList.add('dragover');});
uploadZone.addEventListener('dragleave',function(){uploadZone.classList.remove('dragover');});
uploadZone.addEventListener('drop',function(e){e.preventDefault();uploadZone.classList.remove('dragover');if(e.dataTransfer.files[0])handleFile(e.dataTransfer.files[0]);});
clearFileBtn.addEventListener('click',function(){selectedFile=null;videoInput.value='';if(originalPreview.src&&originalPreview.src.startsWith('blob:'))URL.revokeObjectURL(originalPreview.src);originalPreview.src='';previewSection.classList.add('hidden');resetOutput();updateConvertButton();});
convertAnotherBtn.addEventListener('click',function(){clearFileBtn.click();window.scrollTo({top:0,behavior:'smooth'});});

// ============================================================
// CONVERT — upload via FormData directly to HF space, then predict
// ============================================================
convertBtn.addEventListener('click', async function() {
    if (!selectedFile) { showError('Please select a video file first.'); return; }
    resetOutput();
    processingOverlay.classList.remove('hidden');
    convertBtn.disabled = true;
    startProgress();

    try {
        // Step 1: Load @gradio/client
        setProgress(5, 'Loading AI connector...');
        var mod = await import('https://esm.sh/@gradio/client');
        var Client = mod.Client;
        console.log('✅ Client loaded');

        // Step 2: Connect
        setProgress(15, 'Connecting to Space...');
        var client = await Client.connect(SPACE);
        var spaceRoot = client.config && client.config.root
            ? client.config.root
            : 'https://thivix--tiktok-hq-converter.hf.space';
        console.log('✅ Connected. Root:', spaceRoot);

        // Step 3: Upload file manually via FormData to /upload endpoint
        setProgress(30, 'Uploading video to AI...');
        console.log('📤 Uploading via FormData to:', spaceRoot + '/upload');

        var fd = new FormData();
        fd.append('files', selectedFile, selectedFile.name);

        var uploadRes = await fetch(spaceRoot + '/upload', {
            method: 'POST',
            body: fd
        });

        var uploadText = await uploadRes.text();
        console.log('Upload response [' + uploadRes.status + ']:', uploadText.slice(0, 300));

        if (!uploadRes.ok) throw new Error('Upload failed: HTTP ' + uploadRes.status);

        var uploadedPaths;
        try { uploadedPaths = JSON.parse(uploadText); }
        catch(e) { throw new Error('Upload bad JSON: ' + uploadText.slice(0, 100)); }

        if (!Array.isArray(uploadedPaths) || !uploadedPaths[0]) {
            throw new Error('Upload returned no path: ' + uploadText.slice(0, 100));
        }

        var filePath = uploadedPaths[0];
        console.log('✅ File uploaded to path:', filePath);

        // Step 4: Predict with the uploaded file path as FileData object
        setProgress(55, 'AI converting your video...');
        console.log('🔮 Predicting with path:', filePath);

        var result = await client.predict('/convert_video', {
            input_path: {
                path: filePath,
                orig_name: selectedFile.name,
                size: selectedFile.size,
                mime_type: selectedFile.type || 'video/mp4',
                is_stream: false,
                meta: { _type: 'gradio.FileData' }
            }
        });

        console.log('✅ Result:', JSON.stringify(result).slice(0, 800));

        // Step 5: Extract URL
        var data = result && result.data;
        if (!data || !data.length) throw new Error('Empty AI response. data=' + JSON.stringify(result));

        var videoUrl = null;
        for (var i = 0; i < data.length; i++) {
            var item = data[i];
            console.log('item['+i+']:', JSON.stringify(item).slice(0,200));
            if (!item) continue;
            if (typeof item === 'string' && item.length > 3)        { videoUrl = item; break; }
            if (item.url  && typeof item.url  === 'string')         { videoUrl = item.url;  break; }
            if (item.path && typeof item.path === 'string')         { videoUrl = item.path; break; }
            if (typeof item.value === 'string' && item.value.length){ videoUrl = item.value; break; }
            if (item.value && item.value.url)                       { videoUrl = item.value.url; break; }
            if (item.value && item.value.path)                      { videoUrl = item.value.path; break; }
            if (item.name && typeof item.name === 'string')         { videoUrl = spaceRoot + '/file=' + item.name; break; }
        }

        if (!videoUrl) throw new Error('No URL in response: ' + JSON.stringify(data).slice(0,400));

        // Fix relative
        if (!videoUrl.startsWith('http') && !videoUrl.startsWith('blob:')) {
            videoUrl = spaceRoot + (videoUrl.startsWith('/') ? videoUrl : '/file=' + videoUrl);
        }

        console.log('🎬 Video URL:', videoUrl);
        currentOutputUrl = videoUrl;

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
        console.error('❌ Error:', err);
        stopProgress(false);
        processingOverlay.classList.add('hidden');
        convertBtn.disabled = false;
        var msg = err.message || 'Unknown error.';
        if (/fetch|network/i.test(msg)) msg = 'Network error. Check internet.';
        else if (/503|502|sleep/i.test(msg)) msg = 'Space starting up. Wait 30s and retry.';
        showError(msg);
    }
});

// DOWNLOAD
downloadBtn.addEventListener('click', async function(){
    if (!currentOutputUrl) { showError('No video. Convert first.'); return; }
    var base = selectedFile ? selectedFile.name.replace(/\.[^.]+$/,'') : 'video';
    var orig = downloadBtn.innerHTML;
    downloadBtn.innerHTML = 'Preparing...'; downloadBtn.disabled = true;
    try {
        var r = await fetch(currentOutputUrl);
        if (!r.ok) throw new Error(r.status);
        var b = await r.blob();
        var u = URL.createObjectURL(b);
        var a = document.createElement('a');
        a.href=u; a.download=base+'_60fps.mp4';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function(){URL.revokeObjectURL(u);},5000);
    } catch(e) {
        showError('Download failed. Right-click video → Save video as...');
        window.open(currentOutputUrl,'_blank');
    } finally { downloadBtn.innerHTML=orig; downloadBtn.disabled=false; }
});

window.addEventListener('beforeunload',function(){
    if(originalPreview.src&&originalPreview.src.startsWith('blob:'))URL.revokeObjectURL(originalPreview.src);
    if(outputVideo.src&&outputVideo.src.startsWith('blob:'))URL.revokeObjectURL(outputVideo.src);
    clearInterval(progressInterval);
});

updateConvertButton();
console.log('%c🎬 Non Quality Drop AI | Space: '+SPACE,'background:#7209b7;color:#fff;padding:5px 14px;border-radius:8px;font-weight:900;');
