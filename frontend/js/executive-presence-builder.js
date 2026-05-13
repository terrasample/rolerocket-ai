document.addEventListener('DOMContentLoaded', function () {
  var SCORE_KEY = 'epb_presence_score_history_v1';
  var PLAN_LEVELS = { free: 0, pro: 1, premium: 2, elite: 3, lifetime: 4 };
  var requiredPlan = 'elite';
  var currentPlan = 'free';
  var premiumUnlocked = false;
  var faceMesh = null;
  var pose = null;
  var mediaCamera = null;
  var cameraRunning = false;
  var cameraMetrics = {
    frames: 0,
    eyeContactHits: 0,
    postureHits: 0,
    stabilitySamples: [],
    nervousMovementSamples: [],
    confidenceSamples: [],
    lastNoseX: null,
    lastNoseY: null
  };

  function token() {
    return (typeof getStoredToken === 'function' ? getStoredToken() : '')
      || localStorage.getItem('token')
      || sessionStorage.getItem('token')
      || localStorage.getItem('authToken')
      || '';
  }

  function parseJsonSafe(text) {
    try { return JSON.parse(String(text || '')); } catch { return null; }
  }

  function planLevel(plan) {
    return PLAN_LEVELS[String(plan || 'free').toLowerCase()] || 0;
  }

  function readStoredUser() {
    if (typeof getStoredUser === 'function') return getStoredUser();
    try {
      return JSON.parse(localStorage.getItem('rr_user') || sessionStorage.getItem('rr_user') || 'null');
    } catch {
      return null;
    }
  }

  async function resolveUserPlan() {
    var user = readStoredUser();
    if (user && user.plan) {
      currentPlan = String(user.plan || 'free').toLowerCase();
      premiumUnlocked = planLevel(currentPlan) >= planLevel(requiredPlan);
      applyPlanState();
      return;
    }

    var tk = token();
    if (!tk) {
      applyPlanState();
      return;
    }

    try {
      var res = await fetch(apiUrl('/api/me'), {
        headers: { Authorization: 'Bearer ' + tk },
        cache: 'no-store'
      });
      var data = await res.json();
      var actor = data && data.user ? data.user : null;
      currentPlan = String(actor && actor.plan ? actor.plan : 'free').toLowerCase();
      premiumUnlocked = planLevel(currentPlan) >= planLevel(requiredPlan);
    } catch {
      currentPlan = 'free';
      premiumUnlocked = false;
    }
    applyPlanState();
  }

  function applyPlanState() {
    var badge = document.getElementById('epbPlanBadge');
    var gate = document.getElementById('epbPlanGate');
    if (badge) {
      badge.textContent = premiumUnlocked ? ('Elite Unlocked · ' + currentPlan.toUpperCase()) : ('Elite Required · ' + currentPlan.toUpperCase());
      badge.classList.toggle('locked', !premiumUnlocked);
    }
    if (gate) gate.classList.toggle('visible', !premiumUnlocked);

    Array.prototype.forEach.call(document.querySelectorAll('.epb-btn'), function (btn) {
      if (!btn) return;
      if (btn.id === 'cameraStopBtn') {
        btn.disabled = !premiumUnlocked || !cameraRunning;
        btn.style.opacity = btn.disabled ? '0.55' : '1';
        btn.style.cursor = btn.disabled ? 'not-allowed' : 'pointer';
        return;
      }
      btn.disabled = !premiumUnlocked;
      btn.style.opacity = premiumUnlocked ? '1' : '0.55';
      btn.style.cursor = premiumUnlocked ? 'pointer' : 'not-allowed';
    });
  }

  function ensurePremium() {
    if (premiumUnlocked) return true;
    var gate = document.getElementById('epbPlanGate');
    if (gate) gate.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }

  function formatList(items) {
    if (!Array.isArray(items) || !items.length) return '-';
    return items.map(function (item) { return '- ' + String(item || '').trim(); }).join('\n');
  }

  function setOutput(id, text, isError) {
    var el = document.getElementById(id);
    if (!el) return;
    el.style.color = isError ? '#fecaca' : '#dbeafe';
    el.textContent = text || '';
  }

  function setCameraStatus(text, isError) {
    var el = document.getElementById('cameraStatus');
    if (!el) return;
    el.textContent = text || '';
    el.style.color = isError ? '#fecaca' : '#cbd5e1';
  }

  function readHistory() {
    var raw = localStorage.getItem(SCORE_KEY) || '[]';
    var parsed = parseJsonSafe(raw);
    return Array.isArray(parsed) ? parsed : [];
  }

  function writeHistory(items) {
    localStorage.setItem(SCORE_KEY, JSON.stringify(items.slice(-20)));
  }

  function addScoreEntry(entry) {
    var items = readHistory();
    items.push({
      at: new Date().toISOString(),
      clarity: Number(entry.clarity || 0),
      confidence: Number(entry.confidence || 0),
      presence: Number(entry.presence || 0)
    });
    writeHistory(items);
    renderScoreBoard();
  }

  function avg(values) {
    if (!values.length) return 0;
    var sum = values.reduce(function (n, v) { return n + Number(v || 0); }, 0);
    return Math.round(sum / values.length);
  }

  function renderScoreBoard() {
    var items = readHistory();
    var clarity = avg(items.map(function (x) { return x.clarity; }));
    var confidence = avg(items.map(function (x) { return x.confidence; }));
    var presence = avg(items.map(function (x) { return x.presence; }));
    var overall = Math.round((clarity + confidence + presence) / 3);

    var clarityEl = document.getElementById('scoreClarity');
    var confidenceEl = document.getElementById('scoreConfidence');
    var presenceEl = document.getElementById('scorePresence');
    var overallEl = document.getElementById('scoreOverall');
    if (clarityEl) clarityEl.textContent = String(clarity);
    if (confidenceEl) confidenceEl.textContent = String(confidence);
    if (presenceEl) presenceEl.textContent = String(presence);
    if (overallEl) overallEl.textContent = String(overall);

    var historyEl = document.getElementById('epbScoreHistory');
    if (!historyEl) return;
    if (!items.length) {
      historyEl.textContent = 'No score history yet.';
      return;
    }

    var lines = items.slice(-8).reverse().map(function (item, index) {
      var dt = new Date(item.at);
      var label = dt.toLocaleDateString() + ' ' + dt.toLocaleTimeString();
      var o = Math.round((Number(item.clarity || 0) + Number(item.confidence || 0) + Number(item.presence || 0)) / 3);
      return (index + 1) + '. ' + label + '  |  Clarity ' + item.clarity + '  Confidence ' + item.confidence + '  Presence ' + item.presence + '  Overall ' + o;
    });
    historyEl.textContent = lines.join('\n');
  }

  function resetCameraMetrics() {
    cameraMetrics = {
      frames: 0,
      eyeContactHits: 0,
      postureHits: 0,
      stabilitySamples: [],
      nervousMovementSamples: [],
      confidenceSamples: [],
      lastNoseX: null,
      lastNoseY: null
    };
    updateCameraStat('cameraEyeContact', 0);
    updateCameraStat('cameraPosture', 0);
    updateCameraStat('cameraStability', 0);
    updateCameraStat('cameraConfidence', 0);
  }

  function updateCameraStat(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = Math.max(0, Math.min(100, Math.round(Number(value || 0)))) + '%';
  }

  function average(values) {
    if (!values || !values.length) return 0;
    var sum = values.reduce(function (acc, value) { return acc + Number(value || 0); }, 0);
    return sum / values.length;
  }

  function drawFaceLandmarks(canvasCtx, landmarks, width, height) {
    if (!canvasCtx || !landmarks || !landmarks.length || typeof drawConnectors !== 'function') return;
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, width, height);
    drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, { color: '#22d3ee', lineWidth: 1 });
    drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, { color: '#38bdf8', lineWidth: 1 });
    drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, { color: '#38bdf8', lineWidth: 1 });
    drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, { color: '#f97316', lineWidth: 1 });
    canvasCtx.restore();
  }

  function drawPoseLandmarks(canvasCtx, poseLandmarks) {
    if (!canvasCtx || !poseLandmarks || !poseLandmarks.length || typeof drawConnectors !== 'function') return;
    drawConnectors(canvasCtx, poseLandmarks, POSE_CONNECTIONS, { color: '#a78bfa', lineWidth: 2 });
  }

  function computeEyeContact(faceLandmarks) {
    if (!faceLandmarks || faceLandmarks.length < 264) return 0;
    var leftOuter = faceLandmarks[33];
    var rightOuter = faceLandmarks[263];
    var noseTip = faceLandmarks[1];
    var eyeCenterX = (leftOuter.x + rightOuter.x) / 2;
    var faceWidth = Math.max(0.001, Math.abs(rightOuter.x - leftOuter.x));
    var drift = Math.abs(noseTip.x - eyeCenterX) / faceWidth;
    return Math.max(0, 100 - drift * 220);
  }

  function computePosture(poseLandmarks) {
    if (!poseLandmarks || poseLandmarks.length < 25) return 0;
    var leftShoulder = poseLandmarks[11];
    var rightShoulder = poseLandmarks[12];
    var leftHip = poseLandmarks[23];
    var rightHip = poseLandmarks[24];
    var shoulderTilt = Math.abs((leftShoulder.y || 0) - (rightShoulder.y || 0));
    var torsoCenterX = ((leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4);
    var hipCenterX = (leftHip.x + rightHip.x) / 2;
    var lateralLean = Math.abs(torsoCenterX - hipCenterX);
    return Math.max(0, 100 - shoulderTilt * 500 - lateralLean * 300);
  }

  function computeStability(faceLandmarks) {
    if (!faceLandmarks || faceLandmarks.length < 2) return 0;
    var nose = faceLandmarks[1];
    if (cameraMetrics.lastNoseX == null) {
      cameraMetrics.lastNoseX = nose.x;
      cameraMetrics.lastNoseY = nose.y;
      return 100;
    }
    var dx = Math.abs(nose.x - cameraMetrics.lastNoseX);
    var dy = Math.abs(nose.y - cameraMetrics.lastNoseY);
    cameraMetrics.lastNoseX = nose.x;
    cameraMetrics.lastNoseY = nose.y;
    var movement = Math.sqrt(dx * dx + dy * dy);
    var stability = Math.max(0, 100 - movement * 1800);
    cameraMetrics.nervousMovementSamples.push(Math.min(100, movement * 1800));
    cameraMetrics.stabilitySamples.push(stability);
    return stability;
  }

  function updateCameraMetrics(faceLandmarks, poseLandmarks) {
    cameraMetrics.frames += 1;
    var eyeContact = computeEyeContact(faceLandmarks);
    var posture = computePosture(poseLandmarks);
    var stability = computeStability(faceLandmarks);
    var confidence = Math.max(0, Math.min(100, eyeContact * 0.4 + posture * 0.35 + stability * 0.25));

    if (eyeContact >= 70) cameraMetrics.eyeContactHits += 1;
    if (posture >= 70) cameraMetrics.postureHits += 1;
    cameraMetrics.confidenceSamples.push(confidence);

    updateCameraStat('cameraEyeContact', eyeContact);
    updateCameraStat('cameraPosture', posture);
    updateCameraStat('cameraStability', stability);
    updateCameraStat('cameraConfidence', confidence);
  }

  function buildCameraSummary() {
    var eyeContact = cameraMetrics.frames ? (cameraMetrics.eyeContactHits / cameraMetrics.frames) * 100 : 0;
    var posture = cameraMetrics.frames ? (cameraMetrics.postureHits / cameraMetrics.frames) * 100 : 0;
    var stability = average(cameraMetrics.stabilitySamples);
    var confidence = average(cameraMetrics.confidenceSamples);
    var nervousMovement = average(cameraMetrics.nervousMovementSamples);
    var summary = [];

    if (eyeContact >= 72) summary.push('Eye contact looks strong and leadership-ready.');
    else summary.push('Increase camera-centered gaze to improve executive connection.');

    if (posture >= 72) summary.push('Posture is steady and composed.');
    else summary.push('Square your shoulders and reduce lateral lean for stronger authority.');

    if (stability >= 70) summary.push('Head movement is controlled and calm.');
    else summary.push('Reduce unnecessary head movement to avoid distracted delivery.');

    return {
      eyeContact: Math.round(eyeContact),
      posture: Math.round(posture),
      stability: Math.round(stability),
      confidence: Math.round(confidence),
      nervousMovement: Math.round(nervousMovement),
      summary: summary
    };
  }

  async function setupCameraAnalytics() {
    if (faceMesh && pose) return true;
    if (typeof FaceMesh !== 'function' || typeof Pose !== 'function') {
      setCameraStatus('Camera landmark libraries did not load.', true);
      return false;
    }

    try {
      faceMesh = new FaceMesh({
        locateFile: function (file) { return 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/' + file; }
      });
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
    } catch (err) {
      console.error('FaceMesh initialization error:', err);
      setCameraStatus('Face detection failed to initialize.', true);
      return false;
    }

    try {
      pose = new Pose({
        locateFile: function (file) { return 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/' + file; }
      });
      pose.setOptions({
        modelComplexity: 1,
        selfieMode: true,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
    } catch (err) {
      console.error('Pose initialization error:', err);
      setCameraStatus('Body pose detection failed to initialize.', true);
      return false;
    }

    var pendingPoseLandmarks = null;
    pose.onResults(function (results) {
      pendingPoseLandmarks = results && results.poseLandmarks ? results.poseLandmarks : null;
    });

    faceMesh.onResults(function (results) {
      var video = document.getElementById('cameraVideo');
      var canvas = document.getElementById('cameraCanvas');
      if (!video || !canvas) return;
      var ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth || canvas.clientWidth || 640;
      canvas.height = video.videoHeight || canvas.clientHeight || 400;
      drawFaceLandmarks(ctx, results.multiFaceLandmarks && results.multiFaceLandmarks[0], canvas.width, canvas.height);
      drawPoseLandmarks(ctx, pendingPoseLandmarks);
      if (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) {
        updateCameraMetrics(results.multiFaceLandmarks[0], pendingPoseLandmarks);
      }
    });

    return true;
  }

  async function startCameraAnalytics() {
    if (!ensurePremium()) return;
    if (!(await setupCameraAnalytics())) return;
    if (cameraRunning) return;

    var video = document.getElementById('cameraVideo');
    if (!video) return;
    resetCameraMetrics();

    try {
      var stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 960, height: 540 }, audio: false });
      video.srcObject = stream;
      await video.play();
      mediaCamera = new Camera(video, {
        onFrame: async function () {
          if (!cameraRunning) return;
          await pose.send({ image: video });
          await faceMesh.send({ image: video });
        },
        width: 960,
        height: 540
      });
      cameraRunning = true;
      applyPlanState();
      await mediaCamera.start();
      setCameraStatus('Camera analysis running. Maintain eye contact and sit upright.');
    } catch (err) {
      setCameraStatus('Could not access camera. Please allow camera permission.', true);
    }
  }

  function stopCameraAnalytics() {
    if (!cameraRunning) return buildCameraSummary();
    cameraRunning = false;
    try {
      var video = document.getElementById('cameraVideo');
      if (video && video.srcObject) {
        Array.prototype.forEach.call(video.srcObject.getTracks(), function (track) { track.stop(); });
        video.srcObject = null;
      }
    } catch (_) {}
    if (mediaCamera && typeof mediaCamera.stop === 'function') {
      try { mediaCamera.stop(); } catch (_) {}
    }
    mediaCamera = null;
    applyPlanState();
    var summary = buildCameraSummary();
    setCameraStatus('Camera analysis stopped. Review feedback below.');
    return summary;
  }

  async function callApi(path, payload, isFormData) {
    var headers = {};
    if (!isFormData) headers['Content-Type'] = 'application/json';
    var tk = token();
    if (tk) headers.Authorization = 'Bearer ' + tk;

    var res = await fetch(apiUrl(path), {
      method: 'POST',
      headers: headers,
      body: isFormData ? payload : JSON.stringify(payload || {})
    });

    var data = {};
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  }

  function bindSpeakingAnalysis() {
    var btn = document.getElementById('analyzeSpeakingBtn');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      if (!ensurePremium()) return;
      try {
        setOutput('speakingOutput', 'Analyzing speaking sample...');
        var context = (document.getElementById('speakingContext') || {}).value || '';
        var transcript = (document.getElementById('speakingTranscript') || {}).value || '';
        var fileInput = document.getElementById('speakingMedia');
        var hasFile = fileInput && fileInput.files && fileInput.files[0];

        var data;
        if (hasFile) {
          var fd = new FormData();
          fd.append('context', context);
          fd.append('transcript', transcript);
          fd.append('media', fileInput.files[0]);
          data = await callApi('/api/executive-presence/speaking-analysis', fd, true);
        } else {
          data = await callApi('/api/executive-presence/speaking-analysis', {
            context: context,
            transcript: transcript
          });
        }

        var a = data.analysis || {};
        addScoreEntry({ clarity: a.clarity, confidence: a.confidence, presence: a.executiveTone });
        setOutput('speakingOutput', [
          'Summary: ' + String(a.summary || ''),
          '',
          'Scores: executive tone ' + Number(a.executiveTone || 0) + ', clarity ' + Number(a.clarity || 0) + ', confidence ' + Number(a.confidence || 0) + ', pacing ' + Number(a.pacing || 0) + ', structure ' + Number(a.structure || 0),
          'Filler word density: ' + String(a.fillerWordDensity || 'medium'),
          '',
          'Strengths:\n' + formatList(a.strengths),
          '',
          'Improvements:\n' + formatList(a.improvements),
          '',
          'Coaching script: ' + String(a.coachingScript || '')
        ].join('\n'));
      } catch (err) {
        setOutput('speakingOutput', String(err.message || 'Could not analyze sample.'), true);
      }
    });
  }

  function bindAnswerRewrite() {
    var btn = document.getElementById('rewriteAnswerBtn');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      if (!ensurePremium()) return;
      try {
        setOutput('rewriteOutput', 'Rewriting answer...');
        var data = await callApi('/api/executive-presence/answer-rewrite', {
          targetRole: (document.getElementById('rewriteRole') || {}).value || '',
          answer: (document.getElementById('rewriteAnswer') || {}).value || ''
        });
        setOutput('rewriteOutput', [
          'Executive rewrite:',
          String(data.rewritten || ''),
          '',
          'Why this is stronger:\n' + formatList(data.rationale),
          '',
          'Executive framing: ' + String(data.executiveFraming || '')
        ].join('\n'));
      } catch (err) {
        setOutput('rewriteOutput', String(err.message || 'Could not rewrite answer.'), true);
      }
    });
  }

  function bindTraining() {
    var btn = document.getElementById('trainingBtn');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      if (!ensurePremium()) return;
      try {
        setOutput('trainingOutput', 'Building training module...');
        var data = await callApi('/api/executive-presence/training', {
          scenario: (document.getElementById('trainingScenario') || {}).value || '',
          details: (document.getElementById('trainingDetails') || {}).value || ''
        });
        setOutput('trainingOutput', [
          'Leadership language:\n' + formatList(data.leadershipLanguage),
          '',
          'Stakeholder update template:\n' + String(data.stakeholderUpdateTemplate || ''),
          '',
          'Board-style version:\n' + String(data.boardStyleVersion || ''),
          '',
          'Avoid saying:\n' + formatList(data.doNotSay),
          '',
          'High-impact phrases:\n' + formatList(data.highImpactPhrases),
          '',
          'Practice prompt: ' + String(data.practicePrompt || '')
        ].join('\n'));
      } catch (err) {
        setOutput('trainingOutput', String(err.message || 'Could not generate training.'), true);
      }
    });
  }

  function bindCameraCoach() {
    var startBtn = document.getElementById('cameraStartBtn');
    var stopBtn = document.getElementById('cameraStopBtn');
    var btn = document.getElementById('cameraCoachBtn');
    if (startBtn) {
      startBtn.addEventListener('click', function () {
        startCameraAnalytics();
      });
    }
    if (stopBtn) {
      stopBtn.addEventListener('click', function () {
        var summary = stopCameraAnalytics();
        if (!summary) return;
        setOutput('cameraOutput', [
          'Landmark analytics summary:',
          'Eye contact: ' + summary.eyeContact + '%',
          'Posture: ' + summary.posture + '%',
          'Stability: ' + summary.stability + '%',
          'Confidence: ' + summary.confidence + '%',
          'Nervous movement: ' + summary.nervousMovement + '%',
          '',
          formatList(summary.summary)
        ].join('\n'));
        addScoreEntry({ clarity: summary.eyeContact, confidence: summary.confidence, presence: summary.posture });
      });
    }
    if (!btn) return;
    btn.addEventListener('click', async function () {
      if (!ensurePremium()) return;
      try {
        setOutput('cameraOutput', 'Generating body-language coaching...');
        var summary = stopCameraAnalytics();
        var notes = (document.getElementById('cameraNotes') || {}).value || '';
        var data = await callApi('/api/executive-presence/training', {
          scenario: 'Camera and body language feedback',
          details: [
            notes || 'No notes provided',
            summary ? ('Eye contact ' + summary.eyeContact + '%, posture ' + summary.posture + '%, stability ' + summary.stability + '%, confidence ' + summary.confidence + '%, nervous movement ' + summary.nervousMovement + '%.') : ''
          ].filter(Boolean).join(' ')
        });
        setOutput('cameraOutput', [
          'Body-language coaching:',
          String(data.practicePrompt || ''),
          '',
          'Leadership language cues:\n' + formatList(data.leadershipLanguage),
          '',
          'High-impact phrases:\n' + formatList(data.highImpactPhrases)
        ].join('\n'));
      } catch (err) {
        setOutput('cameraOutput', String(err.message || 'Could not generate coaching.'), true);
      }
    });
  }

  function bindMockInterview() {
    var genBtn = document.getElementById('mockGenerateBtn');
    var scoreBtn = document.getElementById('mockScoreBtn');
    if (genBtn) {
      genBtn.addEventListener('click', async function () {
        if (!ensurePremium()) return;
        try {
          setOutput('mockOutput', 'Generating executive interview questions...');
          var data = await callApi('/api/executive-presence/mock-interview', {
            role: (document.getElementById('mockRole') || {}).value || '',
            context: (document.getElementById('mockContext') || {}).value || ''
          });
          setOutput('mockOutput', [
            'Leadership questions:\n' + formatList(data.leadershipQuestions),
            '',
            'Strategic questions:\n' + formatList(data.strategicQuestions),
            '',
            'Behavioral questions:\n' + formatList(data.behavioralQuestions)
          ].join('\n'));
        } catch (err) {
          setOutput('mockOutput', String(err.message || 'Could not generate questions.'), true);
        }
      });
    }

    if (scoreBtn) {
      scoreBtn.addEventListener('click', async function () {
        if (!ensurePremium()) return;
        try {
          setOutput('mockOutput', 'Scoring executive answer...');
          var data = await callApi('/api/executive-presence/mock-interview', {
            role: (document.getElementById('mockRole') || {}).value || '',
            context: (document.getElementById('mockContext') || {}).value || '',
            answer: (document.getElementById('mockAnswer') || {}).value || ''
          });
          addScoreEntry({ clarity: data.clarity, confidence: data.confidence, presence: data.executivePresence });
          setOutput('mockOutput', [
            'Scores: confidence ' + Number(data.confidence || 0) + ', executive presence ' + Number(data.executivePresence || 0) + ', clarity ' + Number(data.clarity || 0) + ', influence ' + Number(data.influence || 0),
            '',
            'Strengths:\n' + formatList(data.strengths),
            '',
            'Improvements:\n' + formatList(data.improvements),
            '',
            'Executive version:\n' + String(data.executiveVersion || '')
          ].join('\n'));
        } catch (err) {
          setOutput('mockOutput', String(err.message || 'Could not score answer.'), true);
        }
      });
    }
  }

  function bindStructureCoach() {
    var btn = document.getElementById('structureBtn');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      if (!ensurePremium()) return;
      try {
        setOutput('structureOutput', 'Building structured response...');
        var data = await callApi('/api/executive-presence/structure-coach', {
          framework: (document.getElementById('structureFramework') || {}).value || 'STAR',
          prompt: (document.getElementById('structurePrompt') || {}).value || ''
        });
        setOutput('structureOutput', [
          'Framework: ' + String(data.framework || ''),
          '',
          'Structured response:\n' + String(data.structuredResponse || ''),
          '',
          'Executive summary:\n' + String(data.executiveSummary || ''),
          '',
          'Concise version:\n' + String(data.conciseVersion || ''),
          '',
          'Problem-solving map:\n' + formatList(data.problemSolvingMap)
        ].join('\n'));
      } catch (err) {
        setOutput('structureOutput', String(err.message || 'Could not build structure.'), true);
      }
    });
  }

  function bindWritingAssistant() {
    var btn = document.getElementById('writingBtn');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      if (!ensurePremium()) return;
      try {
        setOutput('writingOutput', 'Upgrading writing...');
        var data = await callApi('/api/executive-presence/writing-assistant', {
          writingType: (document.getElementById('writingType') || {}).value || 'executive email',
          text: (document.getElementById('writingInput') || {}).value || ''
        });
        setOutput('writingOutput', [
          'Subject line: ' + String(data.subjectLine || ''),
          '',
          'Rewritten version:\n' + String(data.rewritten || ''),
          '',
          'Before/after summary:\n' + String(data.beforeAfterSummary || ''),
          '',
          'Leadership signal words:\n' + formatList(data.leadershipSignalWords),
          '',
          'Tone notes:\n' + formatList(data.toneNotes)
        ].join('\n'));
      } catch (err) {
        setOutput('writingOutput', String(err.message || 'Could not improve writing.'), true);
      }
    });
  }

  renderScoreBoard();
  resolveUserPlan();
  bindSpeakingAnalysis();
  bindAnswerRewrite();
  bindTraining();
  bindCameraCoach();
  bindMockInterview();
  bindStructureCoach();
  bindWritingAssistant();
});
