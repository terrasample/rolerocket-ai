document.addEventListener('DOMContentLoaded', function () {
  var SCORE_KEY = 'epb_presence_score_history_v1';

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
    var btn = document.getElementById('cameraCoachBtn');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      try {
        setOutput('cameraOutput', 'Generating body-language coaching...');
        var notes = (document.getElementById('cameraNotes') || {}).value || '';
        var data = await callApi('/api/executive-presence/training', {
          scenario: 'Camera and body language feedback',
          details: notes || 'No notes provided'
        });
        setOutput('cameraOutput', [
          'Body-language coaching (Phase 2 prep):',
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
  bindSpeakingAnalysis();
  bindAnswerRewrite();
  bindTraining();
  bindCameraCoach();
  bindMockInterview();
  bindStructureCoach();
  bindWritingAssistant();
});
