// AI Interview Assist Audio Logic
// Adds audio call, speech-to-text, and text-to-speech for interview simulation

let localStream;
let mediaRecorder;
let audioChunks = [];
let recognition;
let synth = window.speechSynthesis;
let liveRecognition = null;
let liveRecognitionEnabled = false;

function getSpeechRecognitionClass() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

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
  const RecognitionClass = getSpeechRecognitionClass();
  if (!RecognitionClass) {
    alert('Speech recognition not supported in this browser.');
    return;
  }
  recognition = new RecognitionClass();
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

function startLiveQuestionCapture(handlers = {}) {
  const RecognitionClass = getSpeechRecognitionClass();
  if (!RecognitionClass) {
    throw new Error('Speech recognition is not supported in this browser.');
  }

  if (liveRecognitionEnabled) {
    return;
  }

  liveRecognitionEnabled = true;
  liveRecognition = new RecognitionClass();
  liveRecognition.continuous = true;
  liveRecognition.interimResults = true;
  liveRecognition.lang = 'en-US';

  liveRecognition.onresult = function onResult(event) {
    let interimText = '';
    const finals = [];

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const transcript = String(event.results[i][0]?.transcript || '').trim();
      if (!transcript) continue;

      if (event.results[i].isFinal) {
        finals.push(transcript);
      } else {
        interimText += `${transcript} `;
      }
    }

    if (interimText && typeof handlers.onInterim === 'function') {
      handlers.onInterim(interimText.trim());
    }

    if (finals.length && typeof handlers.onFinal === 'function') {
      handlers.onFinal(finals.join(' ').trim());
    }
  };

  liveRecognition.onerror = function onError(event) {
    if (typeof handlers.onError === 'function') {
      handlers.onError(event);
    }
  };

  liveRecognition.onend = function onEnd() {
    if (liveRecognitionEnabled) {
      try {
        liveRecognition.start();
        if (typeof handlers.onState === 'function') handlers.onState('listening');
      } catch {
        if (typeof handlers.onState === 'function') handlers.onState('restarting');
      }
      return;
    }
    if (typeof handlers.onState === 'function') handlers.onState('stopped');
  };

  if (typeof handlers.onState === 'function') handlers.onState('listening');
  liveRecognition.start();
}

function stopLiveQuestionCapture() {
  liveRecognitionEnabled = false;
  if (!liveRecognition) return;
  try {
    liveRecognition.onend = null;
    liveRecognition.stop();
  } catch {
    // Ignore stop errors.
  }
  liveRecognition = null;
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
  startLiveQuestionCapture,
  stopLiveQuestionCapture,
  speakText
};
