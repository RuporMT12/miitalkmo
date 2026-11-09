// API & Core UI Elements
const apiUrl = '/tts';
const textInput = document.getElementById('textInput');
const generateBtn = document.getElementById('generateBtn');
const status = document.getElementById('status');
const audioPlayer = document.getElementById('audioPlayer');
const audioContainer = document.getElementById('audioContainer');
const toggleControls = document.getElementById('toggleControls');
const controlsContainer = document.getElementById('controlsContainer');
const downloadButton = document.getElementById('downloadButton');

// Dialogs & Selects
const voicesSelect = document.getElementById('voicesSelect');
const manageVoicesList = document.getElementById('manageVoicesList');
const manageVoicesDialog = document.getElementById('manageVoicesDialog');
const manageVoicesBtn = document.getElementById('manageVoicesBtn');
const voiceLanguageSelect = document.getElementById('languageSelect');
const otherSitesBtn = document.getElementById('otherSitesBtn');
const otherSitesDialog = document.getElementById('otherSitesDialog');

// Preset Defaults (Miitomo/Wii-style default voice configurations)
const presetVoices = {
    'standard': { pitch: 50, speed: 50, depth: 50, energy: 50, accent: 50, intonation: "1", lang: "en" },
    'high_pitch': { pitch: 80, speed: 60, depth: 30, energy: 70, accent: 50, intonation: "1", lang: "en" },
    'deep_voice': { pitch: 20, speed: 45, depth: 80, energy: 40, accent: 50, intonation: "1", lang: "en" }
};

// Pentagon Dot Sliders / Voice Parameter Controls
// Mapped for: Pitch, Speed, Depth, Energy, Accent (Miitomo Spec)
const pentagonVoiceControls = {
    'pitch': document.getElementById('pitchDot'),
    'speed': document.getElementById('speedDot'),
    'depth': document.getElementById('depthDot'),   // Replaces Quality
    'energy': document.getElementById('energyDot'), // Replaces Tone
    'accent': document.getElementById('accentDot')
};

// Reset Voice Select dropdown on manually adjusting any parameter dot/slider
for (const key in pentagonVoiceControls) {
    if (pentagonVoiceControls[key]) {
        pentagonVoiceControls[key].addEventListener('input', function() {
            if (voicesSelect) voicesSelect.value = "";
        });
    }
}

// Toggle controls container visibility
if (toggleControls && controlsContainer) {
    toggleControls.addEventListener('click', function() {
        if (controlsContainer.hasAttribute('hidden')) {
            controlsContainer.removeAttribute('hidden');
            toggleControls.textContent = 'Hide Controls';
        } else {
            controlsContainer.setAttribute('hidden', 'true');
            toggleControls.textContent = 'Show Controls';
        }
    });
}

// Toggle "Other Sites" Dialog Modal
function toggleOtherSites() {
    if (!otherSitesDialog) return;
    if (otherSitesDialog.hasAttribute('open')) {
        otherSitesDialog.removeAttribute('open');
    } else {
        otherSitesDialog.setAttribute('open', 'true');
    }
}

if (otherSitesBtn) {
    otherSitesBtn.addEventListener('click', toggleOtherSites);
}

// LocalStorage Voice Management Helpers
function loadVoices() {
    try {
        return JSON.parse(localStorage.getItem('savedMiiVoices')) || [];
    } catch (e) {
        return [];
    }
}

function saveVoices(voices) {
    localStorage.setItem('savedMiiVoices', JSON.stringify(voices));
}

function populateManageVoices() {
    if (!manageVoicesList) return;
    const voices = loadVoices();
    manageVoicesList.innerHTML = '';
    voices.forEach(v => {
        const li = document.createElement('li');
        li.textContent = v.name;
        manageVoicesList.appendChild(li);
    });
}

// Save custom voice preset
function savePreset() {
    const presetName = prompt("Enter a name for the preset:");
    if (!presetName) return; // User cancelled

    const voiceParams = getVoiceParameters();
    
    // Create hash ID from parameter values
    let voiceId = 0;
    for (const key in voiceParams) {
        if (voiceParams.hasOwnProperty(key)) {
            const val = String(voiceParams[key]);
            for (let i = 0; i < val.length; i++) {
                voiceId = (voiceId << 5) - voiceId + val.charCodeAt(i);
                voiceId |= 0;
            }
        }
    }

    const presetVoice = {
        name: presetName,
        voice: voiceParams,
        id: voiceId,
    };

    let voices = loadVoices();
    // Replace if ID collision occurs
    voices = voices.filter(voice => voice.id !== presetVoice.id);
    voices.push(presetVoice);
    saveVoices(voices);
    populateManageVoices();
}

// Handle voice dropdown selection change
if (voicesSelect) {
    voicesSelect.addEventListener('change', function() {
        const selectedVoice = voicesSelect.value;
        if (selectedVoice.startsWith("default:")) {
            const voiceKey = selectedVoice.split(":")[1];
            if (presetVoices[voiceKey]) {
                loadVoiceParameters(presetVoices[voiceKey]);
            }
        } else if (selectedVoice.startsWith("mii:")) {
            const miiId = selectedVoice.split(":")[1];
            const voices = loadVoices();
            const voice = voices.find(v => v.id == miiId);
            if (voice) {
                loadVoiceParameters(voice.voice);
            }
        }
    });
}

// Extract current parameters from Pentagon interface
function getVoiceParameters() {
    const checkedIntonation = document.querySelector('input[type=radio][name=intonation]:checked') 
                            || document.querySelector('input[type=radio][name=delivery]:checked');
    
    return {
        pitch: pentagonVoiceControls.pitch ? parseFloat(pentagonVoiceControls.pitch.value) : 50,
        speed: pentagonVoiceControls.speed ? parseFloat(pentagonVoiceControls.speed.value) : 50,
        depth: pentagonVoiceControls.depth ? parseFloat(pentagonVoiceControls.depth.value) : 50,
        energy: pentagonVoiceControls.energy ? parseFloat(pentagonVoiceControls.energy.value) : 50,
        accent: pentagonVoiceControls.accent ? parseFloat(pentagonVoiceControls.accent.value) : 50,
        intonation: checkedIntonation ? checkedIntonation.value : "1",
        lang: voiceLanguageSelect ? voiceLanguageSelect.value : "en"
    };
}

// Load external parameters back onto Pentagon controls & options
function loadVoiceParameters(voice) {
    for (const key in pentagonVoiceControls) {
        if (pentagonVoiceControls[key] && voice.hasOwnProperty(key)) {
            pentagonVoiceControls[key].value = voice[key];
        }
    }
    
    // Set Intonation / Delivery Radio Option
    const intonationValue = voice.intonation || voice.delivery || "1";
    const intonationRadios = document.querySelectorAll('input[type=radio][name=intonation], input[type=radio][name=delivery]');
    intonationRadios.forEach(radio => {
        radio.checked = (radio.value == intonationValue);
    });

    // Set Target Language
    if (voice.lang && voiceLanguageSelect) {
        voiceLanguageSelect.value = voice.lang;
    }
}

// Randomize pentagon attributes
function randomizeVoiceParameters() {
    if (voicesSelect) voicesSelect.value = "";
    for (const key in pentagonVoiceControls) {
        const ctrl = pentagonVoiceControls[key];
        if (ctrl) {
            const min = ctrl.min ? parseFloat(ctrl.min) : 0;
            const max = ctrl.max ? parseFloat(ctrl.max) : 100;
            ctrl.value = Math.floor(Math.random() * (max - min + 1)) + min;
        }
    }
}

// Generate Speech API Request
function generateSpeech() {
    const text = textInput.value.trim();
    
    if (!text) {
        alert('Please enter some text to convert to speech.');
        return;
    }
    
    const voiceParams = getVoiceParameters();
    const requestData = {
        text: text,
        ...voiceParams
    };
    
    if (generateBtn) generateBtn.disabled = true;
    
    const outputElem = document.getElementById('output');
    if (outputElem) outputElem.removeAttribute('hidden');
    if (status) status.innerText = 'Generating speech...';
    
    const params = new URLSearchParams(requestData).toString();
    fetch(apiUrl + "?" + params, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('API request failed');
        }
        return response.blob();
    })
    .then(audioBlob => {
        const audioUrl = URL.createObjectURL(audioBlob);
        
        if (audioPlayer) audioPlayer.src = audioUrl;
        if (downloadButton) downloadButton.href = audioUrl;
        if (audioContainer) audioContainer.removeAttribute('hidden');
        
        if (audioPlayer) audioPlayer.play();
        
        if (status) status.innerText = 'Speech generated successfully!';
        if (generateBtn) generateBtn.disabled = false;
    })
    .catch(error => {
        console.error('Error generating audio:', error);
        if (status) status.innerText = 'Error generating speech. Please try again.';
        if (generateBtn) generateBtn.disabled = false;
    });
}

// Toggle audio play state
function togglePlay() {
    if (!audioPlayer) return;
    if (audioPlayer.paused) {
        audioPlayer.play();
    } else {
        audioPlayer.pause();
    }
}

// Parse voice payload passed via URL query parameter string
(function checkUrlVoiceImport() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('voice')) {
        const voiceData = urlParams.get('voice');
        try {
            const voice = JSON.parse(decodeURIComponent(voiceData));
            let voices = loadVoices();
            voices.push(voice);
            saveVoices(voices);
            populateManageVoices();
            alert('Voice imported successfully!');
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (e) {
            console.error('Error loading voice from URL:', e);
        }
    }
})();
