// AI Interview Assist Audio Logic
// Adds audio call, speech-to-text, and text-to-speech for interview simulation

let localStream;
let mediaRecorder;
let audioChunks = [];
let recognition;
let synth = window.speechSynthesis;
let liveRecognition = null;
let liveRecognitionEnabled = false;
let sharedAudioRecorder = null;
let sharedAudioCaptureStream = null;
let sharedAudioMode = 'shared';
let sharedAudioMicStream = null;
let sharedAudioContext = null;
let sharedAudioDestination = null;
let sharedAudioRecordSourceStream = null;
let sharedAudioKeepAliveOnStop = false;

function stopTracks(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // Ignore stop errors.
    }
  });
}

function cleanupSharedAudioMix() {
  stopTracks(sharedAudioMicStream);
  sharedAudioMicStream = null;

  if (sharedAudioContext) {
    try {
      sharedAudioContext.close();
    } catch {
      // Ignore close errors.
    }
  }

  sharedAudioContext = null;
  sharedAudioDestination = null;
  sharedAudioRecordSourceStream = null;
}

function streamHasLiveAudioTrack(stream) {
  if (!stream) return false;
  return stream.getAudioTracks().some((track) => track.readyState === 'live');
}

function buildSharedAudioRecorder(sourceStream, handlers = {}) {
  const mimeType = getSupportedAudioMimeType();
  sharedAudioRecorder = mimeType
    ? new MediaRecorder(sourceStream, { mimeType })
    : new MediaRecorder(sourceStream);

  const captureAudioTracks = sharedAudioCaptureStream ? sharedAudioCaptureStream.getAudioTracks() : [];
  captureAudioTracks.forEach((track) => {
    track.onended = () => {
      if (typeof handlers.onState === 'function') handlers.onState('stopped');
      stopSharedAudioCapture({ preserveStream: false });
    };
  });

  sharedAudioRecorder.ondataavailable = (event) => {
    if (!event.data || event.data.size === 0) return;
    if (typeof handlers.onChunk === 'function') handlers.onChunk(event.data);
  };

  sharedAudioRecorder.onerror = (event) => {
    if (typeof handlers.onError === 'function') handlers.onError(event?.error || event);
  };

  sharedAudioRecorder.onstart = () => {
    if (typeof handlers.onState === 'function') {
      if (sharedAudioMode === 'mic') {
        handlers.onState('listening-mic');
      } else if (sharedAudioMode === 'mixed') {
        handlers.onState('listening-mixed');
      } else {
        handlers.onState('listening');
      }
    }
  };

  sharedAudioRecorder.onstop = () => {
    sharedAudioRecorder = null;
    if (sharedAudioKeepAliveOnStop) {
      sharedAudioKeepAliveOnStop = false;
      return;
    }

    stopTracks(sharedAudioCaptureStream);
    sharedAudioCaptureStream = null;
    cleanupSharedAudioMix();
    sharedAudioMode = 'shared';
  };

  // Slightly longer chunks improve phrase-level clarity.
  sharedAudioRecorder.start(5000);
}

function getSupportedAudioMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus'
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

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

async function startSharedAudioCapture(handlers = {}) {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error('Shared audio capture is not supported in this browser.');
  }

  if (sharedAudioRecorder && sharedAudioRecorder.state !== 'inactive') {
    return;
  }

  if (streamHasLiveAudioTrack(sharedAudioCaptureStream) && streamHasLiveAudioTrack(sharedAudioRecordSourceStream)) {
    if (typeof handlers.onState === 'function') handlers.onState('reusing-stream');
    buildSharedAudioRecorder(sharedAudioRecordSourceStream, handlers);
    return;
  }

  if (typeof handlers.onState === 'function') handlers.onState('requesting-permission');

  let captureStream;
  try {
    captureStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });
  } catch (err) {
    throw err;
  }

  let activeStream = captureStream;
  let recordSourceStream = null;
  let audioTracks = captureStream.getAudioTracks();
  sharedAudioMode = 'shared';

  // Some browser/window combinations do not expose shared-system audio tracks.
  // Fallback to microphone capture so live listening still works instead of failing.
  if (!audioTracks.length) {
    stopTracks(captureStream);
    activeStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });
    audioTracks = activeStream.getAudioTracks();
    sharedAudioMode = 'mic';
    if (typeof handlers.onState === 'function') handlers.onState('fallback-mic');
    recordSourceStream = activeStream;
  } else {
    // When shared audio is available, also add microphone input so the user voice is captured.
    try {
      sharedAudioMicStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        sharedAudioContext = new AudioCtx();
        sharedAudioDestination = sharedAudioContext.createMediaStreamDestination();

        const sharedSource = sharedAudioContext.createMediaStreamSource(new MediaStream(audioTracks));
        sharedSource.connect(sharedAudioDestination);

        const micTracks = sharedAudioMicStream.getAudioTracks();
        if (micTracks.length) {
          const micSource = sharedAudioContext.createMediaStreamSource(new MediaStream(micTracks));
          micSource.connect(sharedAudioDestination);
          sharedAudioMode = 'mixed';
        }

        recordSourceStream = sharedAudioDestination.stream;
      }
    } catch {
      // If mic permission is denied/unavailable, continue with shared audio only.
      stopTracks(sharedAudioMicStream);
      sharedAudioMicStream = null;
    }

    if (!recordSourceStream) {
      recordSourceStream = new MediaStream(audioTracks);
    }
  }

  if (!audioTracks.length) {
    stopTracks(activeStream);
    throw new Error('No audio input detected. Share interview audio or allow microphone access.');
  }

  sharedAudioCaptureStream = activeStream;
  sharedAudioRecordSourceStream = recordSourceStream;
  buildSharedAudioRecorder(recordSourceStream, handlers);
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

function stopSharedAudioCapture(options = {}) {
  const preserveStream = Boolean(options.preserveStream);
  if (sharedAudioRecorder && sharedAudioRecorder.state !== 'inactive') {
    try {
      sharedAudioKeepAliveOnStop = preserveStream;
      sharedAudioRecorder.stop();
    } catch {
      // Ignore stop errors.
    }
    return;
  }

  if (!preserveStream) {
    stopTracks(sharedAudioCaptureStream);
    sharedAudioCaptureStream = null;
    cleanupSharedAudioMix();
    sharedAudioMode = 'shared';
  }
}

function releaseSharedAudioCapture() {
  stopSharedAudioCapture({ preserveStream: false });
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
  startSharedAudioCapture,
  stopSharedAudioCapture,
  releaseSharedAudioCapture,
  speakText
};
