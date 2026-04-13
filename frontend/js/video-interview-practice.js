document.addEventListener('DOMContentLoaded', function () {
  const output = document.getElementById('videoInterviewOutput');
  const startBtn = document.getElementById('startInterviewBtn');
  const videoCallContainer = document.getElementById('videoCallContainer');
  const qaContainer = document.getElementById('interviewQAContainer');
  const timerDiv = document.getElementById('interviewTimer');
  const webcamToggleWrap = document.getElementById('webcamToggleWrap');
  const webcamToggle = document.getElementById('webcamToggle');
  let mediaStream = null;

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

  // Start video call
  async function startVideoCall() {
    startBtn.style.display = 'none';
    videoCallContainer.style.display = 'flex';
    qaContainer.style.display = 'block';
    output.innerHTML = '';
    timerDiv.style.display = 'block';
    webcamToggleWrap.style.display = 'flex';
    // Shuffle and pick 5 random questions
    const questions = questionsBank.slice().sort(() => Math.random() - 0.5).slice(0, 5);
    let useWebcam = webcamToggle ? webcamToggle.checked : true;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: useWebcam, audio: true });
      const userVideo = document.getElementById('userVideo');
      userVideo.srcObject = mediaStream;
      userVideo.style.display = useWebcam ? '' : 'none';
    } catch (err) {
      qaContainer.innerHTML = '<div style="color:#dc2626;">Could not access webcam/microphone. Please allow access and refresh.</div>';
      timerDiv.style.display = 'none';
      webcamToggleWrap.style.display = 'none';
      return;
    }
    // Listen for toggle changes during session
    if (webcamToggle) {
      webcamToggle.onchange = function() {
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => track.stop());
        }
        startVideoCall();
      };
    }
    runInterview(questions);
    startInterviewTimer();
  }

  // Interview Q&A flow
  let interviewTimer = null;
  let interviewTimeLeft = 120;
  function runInterview(questions) {
    let current = 0;
    let answers = [];
    function askNext() {
      if (current >= questions.length) {
        endInterview(answers);
        return;
      }
      const q = questions[current];
      qaContainer.innerHTML = `<div style='margin:18px 0;'><strong>AI Recruiter:</strong> <span style='color:#2563eb;'>${q}</span><br><textarea id='answerBox' style='width:100%;max-width:600px;height:80px;margin:12px 0;'></textarea><br><button id='submitAnswerBtn' class='feature-launch-btn'>Submit Answer</button></div>`;
      speakAI(q);
      document.getElementById('submitAnswerBtn').onclick = function() {
        const answer = document.getElementById('answerBox').value.trim();
        answers.push({ q, a: answer });
        current++;
        askNext();
      };
    }
    askNext();
  }

  function startInterviewTimer() {
    interviewTimeLeft = 120;
    timerDiv.textContent = `Time left: 2:00`;
    interviewTimer = setInterval(() => {
      interviewTimeLeft--;
      let min = Math.floor(interviewTimeLeft / 60);
      let sec = interviewTimeLeft % 60;
      timerDiv.textContent = `Time left: ${min}:${sec.toString().padStart(2, '0')}`;
      if (interviewTimeLeft <= 0) {
        clearInterval(interviewTimer);
        timerDiv.textContent = 'Time is up!';
        qaContainer.innerHTML = '';
        endInterview();
      }
    }, 1000);
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