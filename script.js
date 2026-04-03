// 1. CDN හරහා Gradio Client එක වෙබ් අඩවියට import කිරීම
import { Client } from "https://cdn.jsdelivr.net/npm/@gradio/client/+esm";

// HTML එකේ ඇති Button සහ File Input එක හඳුනා ගැනීම 
// (ඔබේ HTML එකේ ID වෙනස් නම් මෙතන වෙනස් කරන්න)
const convertBtn = document.getElementById('convertBtn'); 
const videoInput = document.getElementById('videoInput');
const resultDiv = document.getElementById('result'); // ප්‍රතිඵලය පෙන්වීමට තැනක්

convertBtn.addEventListener('click', async () => {
    // පරිශීලකයා ලබා දුන් වීඩියෝ ෆයිල් එක ලබා ගැනීම
    const file = videoInput.files[0];

    if (!file) {
        alert("කරුණාකර පළමුව වීඩියෝවක් තෝරන්න!");
        return;
    }

    try {
        // Button එක processing වෙන බව පෙන්වීම
        convertBtn.textContent = "Processing... කරුණාකර රැඳී සිටින්න";
        convertBtn.disabled = true;

        // 2. Hugging Face Space එකට Connect වීම
        const client = await Client.connect("thivix/tiktok-hq-converter");

        // 3. වීඩියෝව Convert කිරීමට යැවීම
        const result = await client.predict("/convert_video", {
            input_path: file, // අපි තෝරාගත් වීඩියෝව මෙතැනින් යවමු
        });

        console.log(result.data);

        // 4. සාර්ථකව Convert වූ පසු වීඩියෝව ලබා ගැනීම
        // Gradio එකෙන් එන URL එක ලබාගෙන Download ලින්ක් එකක් සෑදීම
        const outputVideoUrl = result.data[0].url; 
        
        resultDiv.innerHTML = `
            <p style="color: green;">Video Converted Successfully!</p>
            <a href="${outputVideoUrl}" download="Converted_Video.mp4" target="_blank">
                <button>Download High Quality Video</button>
            </a>
        `;

    } catch (error) {
        console.error("Error:", error);
        alert("වීඩියෝව Convert කිරීමේදී දෝෂයක් මතු විය. කරුණාකර නැවත උත්සාහ කරන්න.");
    } finally {
        // ක්‍රියාවලිය අවසන් වූ පසු Button එක නැවත තිබූ තත්ත්වයට පත් කිරීම
        convertBtn.textContent = "Convert Video";
        convertBtn.disabled = false;
    }
});
