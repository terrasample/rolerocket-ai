document.addEventListener('DOMContentLoaded', function () {
  const output = document.getElementById('videoInterviewOutput');
  const startBtn = document.getElementById('startInterviewBtn');
  const roleInput = document.getElementById('videoInterviewRole');
  const videoCallContainer = document.getElementById('videoCallContainer');
  const qaContainer = document.getElementById('interviewQAContainer');
  const timerDiv = document.getElementById('interviewTimer');
  const webcamToggleWrap = document.getElementById('webcamToggleWrap');
  const webcamToggle = document.getElementById('webcamToggle');
  let mediaStream = null;
  let permissionWarning = '';

  // Interview questions
  const questionsBank = [
    'Tell me about yourself.',
    'Describe a challenge you faced at work and how you handled it.',
    'Why are you interested in this role?',
    'What is your greatest strength?',
    'What is your biggest weakness?',
    'Where do you see yourself in 5 years?',
    'How do you handle stress and pressure?',
    'Give an example of teamwork.',
    'Why should we hire you?',
    'Do you have any questions for us?'
  ];

  function getToken() {
    if (typeof getStoredToken === 'function') return getStoredToken() || '';
    if (typeof window.getStoredToken === 'function') return window.getStoredToken() || '';
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }

  async function getInterviewQuestions(roleTitle) {
    const token = getToken();
    if (!token) {
      return questionsBank.slice().sort(() => Math.random() - 0.5).slice(0, 5);
    }

    try {
      const res = await fetch('/api/video-interview-practice/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ roleTitle, count: 5 })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Question generation failed');

      const questions = Array.isArray(data.questions)
        ? data.questions.map((q) => String(q || '').trim()).filter(Boolean)
        : [];

      if (questions.length) return questions.slice(0, 5);
    } catch (err) {
      console.warn('Using fallback interview questions:', err?.message || err);
    }

    return questionsBank.slice().sort(() => Math.random() - 0.5).slice(0, 5);
  }

  // Text-to-speech for AI recruiter
  function speakAI(text) {
    if ('speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(text);
      utter.voice = speechSynthesis.getVoices().find(v => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('ai')) || null;
      utter.rate = 1.05;
      utter.pitch = 1.1;
      window.speechSynthesis.speak(utter);
    }
  }

  function renderPermissionWarning() {
    if (!permissionWarning) {
      return '';
    }

    return `<div style='margin:0 0 14px 0;padding:10px 14px;border-radius:12px;background:#fff7ed;color:#c2410c;'>${permissionWarning}</div>`;
  }

  async function requestInterviewMedia(useWebcam) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      permissionWarning = 'Camera and microphone access is not supported here. Continuing in text-only mode.';
      return null;
    }

    try {
      return await navigator.mediaDevices.getUserMedia({ video: useWebcam, audio: true });
    } catch (error) {
      if (useWebcam) {
        try {
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          permissionWarning = 'Webcam access was unavailable. Continuing with microphone only. You can keep the webcam turned off.';
          if (webcamToggle) {
            webcamToggle.checked = false;
          }
          return audioOnlyStream;
        } catch (audioOnlyError) {
          permissionWarning = 'Could not access webcam/microphone. Continuing in text-only mode. You can still complete the interview without webcam.';
          if (webcamToggle) {
            webcamToggle.checked = false;
          }
          return null;
        }
      }

      permissionWarning = 'Microphone access was unavailable. Continuing in text-only mode.';
      return null;
    }
  }

  function applyVideoState() {
    const userVideo = document.getElementById('userVideo');
    if (!userVideo) {
      return;
    }

    const wantsWebcam = webcamToggle ? webcamToggle.checked : true;
    const videoTrack = mediaStream ? mediaStream.getVideoTracks()[0] : null;
    if (videoTrack) {
      videoTrack.enabled = wantsWebcam;
      userVideo.style.display = wantsWebcam ? '' : 'none';
      return;
    }

    userVideo.style.display = 'none';
  }

  // Start video call
  async function startVideoCall() {
    const roleTitle = (roleInput?.value || '').trim();
    output.innerHTML = `<div style='margin:0 0 12px 0;color:#93c5fd;'>Generating ${roleTitle ? `${roleTitle} ` : ''}interview questions...</div>`;

    const questions = await getInterviewQuestions(roleTitle);

    startBtn.style.display = 'none';
    videoCallContainer.style.display = 'flex';
    qaContainer.style.display = 'block';
    output.innerHTML = '';
    timerDiv.style.display = 'block';
    webcamToggleWrap.style.display = 'flex';
    let useWebcam = webcamToggle ? webcamToggle.checked : true;
    permissionWarning = '';
    mediaStream = await requestInterviewMedia(useWebcam);
    const userVideo = document.getElementById('userVideo');
    if (userVideo) {
      userVideo.srcObject = mediaStream;
    }
    applyVideoState();
    // Listen for toggle changes during session (only affect video track, not question)
    if (webcamToggle) {
      webcamToggle.onchange = function() {
        applyVideoState();
      };
    }
    runInterviewWithDelay(questions);
  }

  // Interview Q&A flow

  let interviewTimer = null;
  let interviewTimeLeft = 120;
  function runInterviewWithDelay(questions) {
    let current = 0;
    let answers = [];
    function askNext() {
      if (current >= questions.length) {
        endInterview(answers);
        return;
      }
      const q = questions[current];
      qaContainer.innerHTML = `<div style='margin:18px 0;'>${renderPermissionWarning()}<strong>AI Recruiter:</strong> <span style='color:#2563eb;'>${q}</span><br><textarea id='answerBox' style='width:100%;max-width:600px;height:80px;margin:12px 0;'></textarea><br><button id='submitAnswerBtn' class='feature-launch-btn'>Submit Answer</button></div>`;
      speakAI(q);
      // Start 2-minute timer for this question
      interviewTimeLeft = 120;
      timerDiv.textContent = `Time left: 2:00`;
      if (interviewTimer) clearInterval(interviewTimer);
      let answered = false;
      interviewTimer = setInterval(() => {
        interviewTimeLeft--;
        let min = Math.floor(interviewTimeLeft / 60);
        let sec = interviewTimeLeft % 60;
        timerDiv.textContent = `Time left: ${min}:${sec.toString().padStart(2, '0')}`;
        if (interviewTimeLeft <= 0) {
          clearInterval(interviewTimer);
          timerDiv.textContent = 'Time is up!';
          // If not answered, push empty answer
          if (!answered) {
            const answer = document.getElementById('answerBox').value.trim();
            answers.push({ q, a: answer });
          }
          setTimeout(() => {
            current++;
            askNext();
          }, 800);
        }
      }, 1000);
      document.getElementById('submitAnswerBtn').onclick = function() {
        if (answered) return;
        answered = true;
        const answer = document.getElementById('answerBox').value.trim();
        answers.push({ q, a: answer });
        clearInterval(interviewTimer);
        timerDiv.textContent = 'Waiting for next question...';
        setTimeout(() => {
          current++;
          askNext();
        }, 800);
      };
    }
    askNext();
  }

  // End interview, show feedback and stop video
  function endInterview(answers = []) {
    if (interviewTimer) {
      clearInterval(interviewTimer);
      timerDiv.style.display = 'none';
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    mediaStream = null;
    videoCallContainer.style.display = 'none';
    qaContainer.style.display = 'none';
    webcamToggleWrap.style.display = 'none';

    // Analyze answers for realistic feedback
    let strengths = [];
    let improvement = [];
    let aiTips = [
      'Practice the STAR method for behavioral questions',
      'Maintain eye contact and positive body language',
      'Pause briefly before answering to organize your thoughts'
    ];

    let wordCount = 0;
    let gaveExamples = false;
    let askedQuestions = false;
    let mentionedStrength = false;
    let mentionedChallenge = false;

    answers.forEach(({q, a}) => {
      const wc = a.split(/\s+/).filter(Boolean).length;
      wordCount += wc;
      if (/example|for instance|such as|like|e\.g\./i.test(a)) gaveExamples = true;
      if (/team|collaborat|group|together|we|us/i.test(a)) strengths.push('Teamwork/collaboration');
      if (/communicat|present|speak|talk|write/i.test(a)) strengths.push('Communication skills');
      if (/lead|manage|organize|plan/i.test(a)) strengths.push('Leadership/organization');
      if (/challenge|problem|difficult|issue|overcome/i.test(a)) mentionedChallenge = true;
      if (/strength|good at|best at|excel/i.test(a)) mentionedStrength = true;
      if (q.toLowerCase().includes('questions for us') && a.length > 5) askedQuestions = true;
      if (wc < 10) improvement.push('Expand your answers with more detail');
      if (wc > 60) improvement.push('Be more concise in your responses');
    });
    if (!gaveExamples) improvement.push('Provide specific examples to support your answers');
    if (!askedQuestions) improvement.push('Ask thoughtful questions at the end of the interview');
    if (!mentionedStrength) improvement.push('Highlight your strengths clearly');
    if (!mentionedChallenge) improvement.push('Describe a challenge you faced and how you handled it');
    if (wordCount < 60) improvement.push('Give more complete answers overall');
    if (strengths.length === 0) strengths.push('Willingness to participate');

    // Remove duplicates
    strengths = [...new Set(strengths)];
    improvement = [...new Set(improvement)];

    let feedbackHtml = `<div style='margin:18px 0;'><strong>AI Interview Feedback Report</strong><br><div style='text-align:left;max-width:600px;margin:0 auto;'>`;
    feedbackHtml += `<h4 style='color:#16a34a;margin-bottom:4px;'>Strengths:</h4><ul>`;
    strengths.forEach(s => { feedbackHtml += `<li>${s}</li>`; });
    feedbackHtml += `</ul>`;
    feedbackHtml += `<h4 style='color:#f59e42;margin-bottom:4px;'>Areas to Improve:</h4><ul>`;
    improvement.forEach(i => { feedbackHtml += `<li>${i}</li>`; });
    feedbackHtml += `</ul>`;
    feedbackHtml += `<h4 style='color:#2563eb;margin-bottom:4px;'>AI Tips:</h4><ul>`;
    aiTips.forEach(t => { feedbackHtml += `<li>${t}</li>`; });
    feedbackHtml += `</ul></div>`;
    feedbackHtml += `<button id='restartInterviewBtn' class='feature-launch-btn'>Practice Again</button></div>`;
    output.innerHTML = feedbackHtml;
    document.getElementById('restartInterviewBtn').onclick = function() {
      output.innerHTML = '';
      startBtn.style.display = '';
    };
  }

  if (startBtn) {
    startBtn.onclick = startVideoCall;
  }
});