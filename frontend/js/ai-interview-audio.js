// AI Interview Assist Audio Logic
// Adds audio call, speech-to-text, and text-to-speech for interview simulation

let localStream;
let mediaRecorder;
let audioChunks = [];
let recognition;
let synth = window.speechSynthesis;

// Start audio stream (microphone)
async function startAudioStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Optionally attach to an <audio> element for local feedback
    // document.getElementById('localAudio').srcObject = localStream;
    return localStream;
  } catch (err) {
    alert('Microphone access denied or unavailable.');
    throw err;
  }
}

// Start recording audio and transcribe with Web Speech API
function startSpeechRecognition(onResult) {
  if (!('webkitSpeechRecognition' in window)) {
    alert('Speech recognition not supported in this browser.');
    return;
  }
  recognition = new webkitSpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  recognition.onresult = function(event) {
    const transcript = event.results[0][0].transcript;
    if (onResult) onResult(transcript);
  };
  recognition.onerror = function(event) {
    alert('Speech recognition error: ' + event.error);
  };
  recognition.start();
}

// Play AI feedback using text-to-speech
function speakText(text) {
  if (!synth) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'en-US';
  synth.speak(utter);
}

// Exported for use in main interview JS
window.AIInterviewAudio = {
  startAudioStream,
  startSpeechRecognition,
  speakText
};
