document.addEventListener('DOMContentLoaded', function () {
  const params = new URLSearchParams(window.location.search);
  const topic = String(params.get('topic') || '').trim();

  const titleMain = document.getElementById('courseTitleMain');
  const titleSide = document.getElementById('courseTitleSide');
  const subtitleSide = document.getElementById('courseSubtitleSide');
  const level = document.getElementById('courseLevel');
  const duration = document.getElementById('courseDuration');
  const demand = document.getElementById('courseDemand');
  const overview = document.getElementById('courseOverview');
  const curriculumMeta = document.getElementById('courseCurriculumMeta');
  const teachingFramework = document.getElementById('courseTeachingFramework');
  const outcomes = document.getElementById('courseOutcomeList');
  const resumeSignals = document.getElementById('courseResumeSignals');
  const modules = document.getElementById('courseModules');
  const practiceBank = document.getElementById('coursePracticeBank');
  const capstone = document.getElementById('courseCapstone');
  const mockExams = document.getElementById('courseMockExams');
  const assessment = document.getElementById('courseAssessment');
  const interviewPrep = document.getElementById('courseInterviewPrep');
  const practiceSection = document.getElementById('coursePracticeSection');
  const capstoneSection = document.getElementById('courseCapstoneSection');
  const mockExamsSection = document.getElementById('courseMockExamsSection');
  const assessmentSection = document.getElementById('courseAssessmentSection');
  const interviewPrepSection = document.getElementById('courseInterviewPrepSection');
  const progressSummary = document.getElementById('courseProgressSummary');
  const progressPercent = document.getElementById('courseProgressPercent');
  const progressBar = document.getElementById('courseProgressBar');
  const refreshCourseBtn = document.getElementById('refreshCourseBtn');
  const certificateBtn = document.getElementById('downloadCourseCertificateBtn');
  const audioVoiceSelect = document.getElementById('courseAudioVoiceSelect');
  const tabLinks = Array.from(document.querySelectorAll('.crs-tab-link[href^="#"]'));

  const TAB_SECTION_IDS = {
    about: ['about'],
    outcomes: ['outcomes'],
    modules: ['modules', 'courseCapstoneSection', 'courseMockExamsSection', 'courseAssessmentSection', 'courseInterviewPrepSection'],
    practice: ['coursePracticeSection'],
    faq: ['faq']
  };

  const progressState = {
    totalModules: 0,
    completedModules: new Set(),
    currentModuleIndex: 0,
    learnerName: 'Learner',
    sessionToken: '',
    moduleNarration: [],
    moduleNarrationSegments: [],
    answerKey: [],
    answerExplanations: [],
    assessmentCompleted: false,
    assessmentAnswers: [],
    assessmentItems: [],
    assessmentScore: null,
    assessmentGrade: null,
    assessmentCurrentPage: 1,
    practiceBankItems: [],
    practiceBankPage: 1,
    practiceRevealState: {},
    mockExams: [],
    activeMockExam: null,
    mockExamResults: {},
    mockExamTimerId: null,
    certificationPlan: null,
    lastProgressFeedback: null,
    pendingAdvance: null,
    autoAdvanceTimer: null,
    practiceUnlockedModules: new Set(),
    preferLocalProgressCheck: false
  };
  let moduleHandlersBound = false;
  const PROGRESS_CHECK_TIMEOUT_MS = 8000;

  const audioState = {
    activeModuleIndex: null,
    activePartKey: '',
    utterance: null,
    isPaused: false,
    rate: 0.96,
    voices: [],
    selectedVoice: '',
    followAlongSegments: [],
    followAlongPartKey: '',
    followAlongElements: []
  };
  const AUDIO_VOICE_PREF_KEY = 'courseAudioVoicePreference';
  const COURSE_PROGRESS_PREFIX = 'rr:course-progress:cert-v4:';
  const COURSE_DIAGNOSTIC_PREFIX = 'rr:course-diagnostic:v1:';
  const COVERAGE_DEFAULT_MIN_MODULES = 10;
  const COVERAGE_DEFAULT_FINAL_QUESTION_COUNT = 60;
  const COVERAGE_DEFAULT_PRACTICE_QUESTION_COUNT = 180;
  const COVERAGE_DEFAULT_MOCK_QUESTION_COUNT = 30;
  const COVERAGE_DEFAULT_OVERALL_PASS_MARK = 70;
  const COVERAGE_DEFAULT_DOMAIN_PASS_MARK = 65;
  const COVERAGE_AI_ML_MIN_MODULES = 4;
  const COVERAGE_AI_ML_FINAL_QUESTION_COUNT = 90;
  const COVERAGE_AI_ML_PRACTICE_QUESTION_COUNT = 180;
  const COVERAGE_AI_ML_MOCK_QUESTION_COUNT = 45;
  const COVERAGE_AI_ML_OVERALL_PASS_MARK = 80;
  const COVERAGE_AI_ML_DOMAIN_PASS_MARK = 75;
  const COVERAGE_STEM_MIN_MODULES = 14;
  const COVERAGE_STEM_FINAL_QUESTION_COUNT = 100;
  const COVERAGE_STEM_PRACTICE_QUESTION_COUNT = 240;
  const COVERAGE_STEM_MOCK_QUESTION_COUNT = 50;
  const COVERAGE_STEM_OVERALL_PASS_MARK = 75;
  const COVERAGE_STEM_DOMAIN_PASS_MARK = 70;
  const COVERAGE_BUSINESS_MIN_MODULES = 12;
  const COVERAGE_BUSINESS_FINAL_QUESTION_COUNT = 80;
  const COVERAGE_BUSINESS_PRACTICE_QUESTION_COUNT = 220;
  const COVERAGE_BUSINESS_MOCK_QUESTION_COUNT = 40;
  const COVERAGE_BUSINESS_OVERALL_PASS_MARK = 72;
  const COVERAGE_BUSINESS_DOMAIN_PASS_MARK = 68;
  const COVERAGE_MOCK_EXAM_COUNT = 2;
  const CERTIFICATION_DOMAINS = [
    { key: 'foundations', label: 'Foundations & Planning' },
    { key: 'execution', label: 'Execution & Quality' },
    { key: 'communication', label: 'Communication & Measurement' },
    { key: 'improvement', label: 'Improvement & Career Readiness' }
  ];

  progressState.diagnosticCompleted = false;
  progressState.diagnosticScore = null;
  progressState.diagnosticQuestions = [];
  progressState.recommendedStartIndex = 0;
  progressState.moduleMastery = {};

  function getCourseStorageKey() {
    const normalizedTopic = normalizeTopic(topic || 'course');
    return normalizedTopic || 'course';
  }

  function getTabKeyFromHash(hashValue) {
    const key = String(hashValue || '').replace(/^#/, '').trim().toLowerCase();
    return TAB_SECTION_IDS[key] ? key : 'about';
  }

  function applySectionTab(key) {
    const activeKey = TAB_SECTION_IDS[key] ? key : 'about';
    const activeSectionIds = new Set(TAB_SECTION_IDS[activeKey]);

    Object.keys(TAB_SECTION_IDS).forEach((tabKey) => {
      TAB_SECTION_IDS[tabKey].forEach((sectionId) => {
        const section = document.getElementById(sectionId);
        if (!section) return;
        const shouldShow = activeSectionIds.has(sectionId);
        section.classList.toggle('is-tab-hidden', !shouldShow);
      });
    });

    tabLinks.forEach((link) => {
      const linkKey = getTabKeyFromHash(link.getAttribute('href'));
      const isActive = linkKey === activeKey;
      link.classList.toggle('active', isActive);
      link.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  }

  function setupSectionTabs() {
    if (!tabLinks.length) return;

    tabLinks.forEach((link) => {
      link.addEventListener('click', function (event) {
        event.preventDefault();
        const key = getTabKeyFromHash(link.getAttribute('href'));
        applySectionTab(key);
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${key}`);
      });
    });

    window.addEventListener('hashchange', function () {
      applySectionTab(getTabKeyFromHash(window.location.hash));
    });

    applySectionTab(getTabKeyFromHash(window.location.hash));
  }

  function getDiagnosticStorageKey() {
    return `${COURSE_DIAGNOSTIC_PREFIX}${getCourseStorageKey()}`;
  }

  function loadStoredDiagnostic() {
    try {
      const parsed = JSON.parse(localStorage.getItem(getDiagnosticStorageKey()) || '{}');
      if (!parsed || parsed.completed !== true) return null;
      return {
        completed: true,
        score: Number(parsed.score || 0),
        total: Number(parsed.total || 0),
        recommendedStartIndex: Number(parsed.recommendedStartIndex || 0)
      };
    } catch (_) {
      return null;
    }
  }

  function saveStoredDiagnostic(payload) {
    try {
      localStorage.setItem(getDiagnosticStorageKey(), JSON.stringify({
        completed: payload?.completed === true,
        score: Number(payload?.score || 0),
        total: Number(payload?.total || 0),
        recommendedStartIndex: Number(payload?.recommendedStartIndex || 0),
        updatedAt: new Date().toISOString()
      }));
    } catch (_) {
      // Ignore storage errors in restricted contexts.
    }
  }

  function resetStoredDiagnostic() {
    try {
      localStorage.removeItem(getDiagnosticStorageKey());
    } catch (_) {
      // Ignore storage errors.
    }
  }

  function getModuleMasteryState(idx) {
    const key = String(Number(idx));
    if (!progressState.moduleMastery[key]) {
      progressState.moduleMastery[key] = {
        quizPassed: false,
        transferPassed: false,
        transferText: '',
        transferFeedback: ''
      };
    }
    return progressState.moduleMastery[key];
  }

  function generateDiagnosticQuestions(modulesData) {
    const list = asArray(modulesData).slice(0, 3);
    return list.map((moduleItem, idx) => ({
      idx,
      question: String(moduleItem?.progressCheckQuestion || `What is the key objective in Module ${idx + 1}?`).trim(),
      options: asArray(moduleItem?.progressCheckOptions).slice(0, 4),
      correctOptionIndex: Number(moduleItem?.correctOptionIndex),
      rationale: String(moduleItem?.progressCheckExplanation || '').trim()
    })).filter((item) => item.options.length >= 2 && Number.isInteger(item.correctOptionIndex));
  }

  function gradeDiagnostic(selectedAnswers) {
    const questions = asArray(progressState.diagnosticQuestions);
    let score = 0;
    questions.forEach((question, idx) => {
      if (Number(selectedAnswers[idx]) === Number(question.correctOptionIndex)) score += 1;
    });
    return {
      score,
      total: questions.length,
      percent: questions.length ? Math.round((score / questions.length) * 100) : 0
    };
  }

  function buildRemediationGuidance(idx) {
    const moduleItem = progressState.allModules?.[idx] || {};
    const objective = String(moduleItem?.objective || '').trim();
    const practiceTask = String(moduleItem?.practiceTask || '').trim();
    return [
      objective ? `Review objective: ${objective}` : 'Review the objective section before retrying.',
      'Replay the Example lesson section and narrate the steps in your own words.',
      practiceTask ? `Do this mini task before retry: ${practiceTask}` : 'Complete a short practice attempt before retrying.'
    ];
  }

  function validateTransferResponse(idx, text) {
    const response = String(text || '').trim();
    if (response.length < 120) {
      return { ok: false, message: 'Add more detail. Write at least 120 characters to explain how you would apply this module in a new scenario.' };
    }

    const objective = String(progressState.allModules?.[idx]?.objective || '').toLowerCase();
    const objectiveKeywords = objective
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 5)
      .slice(0, 4);
    const hasObjectiveSignal = objectiveKeywords.length
      ? objectiveKeywords.some((word) => response.toLowerCase().includes(word))
      : true;

    if (!hasObjectiveSignal) {
      return { ok: false, message: 'Reference at least one core idea from the module objective so the transfer proof is competency-based.' };
    }

    return { ok: true, message: 'Transfer task accepted. This module can now advance after checkpoint success.' };
  }
  function getCurriculumLastReviewed() {
    return new Date().toISOString().slice(0, 10);
  }

  function getJamaicaStrandsForCourse(name) {
    const topicName = normalizeTopic(name);
    if (!topicName) return [];

    if (/^csec mathematics$|^csec math$/i.test(topicName)) {
      return ['Numbers', 'Algebra', 'Geometry & Measurement', 'Trigonometry', 'Statistics & Probability'];
    }
    if (/^cape mathematics$|^cape pure mathematics$|^cape applied mathematics$/i.test(topicName)) {
      return ['Functions & Graphs', 'Calculus', 'Vectors', 'Probability'];
    }
    if (/^csec english a$/i.test(topicName)) {
      return ['Reading Comprehension', 'Grammar & Language Use', 'Essay Writing', 'Editing & Revision'];
    }
    if (/^csec information technology$/i.test(topicName)) {
      return ['Computer Systems', 'Productivity Tools & Data Handling', 'Networking & Cyber Safety', 'Problem Solving & Algorithms'];
    }
    if (/^csec principles of accounts$/i.test(topicName)) {
      return ['Double Entry', 'Ledger & Trial Balance', 'Final Accounts', 'Interpretation & Controls'];
    }
    if (/^cape accounting$/i.test(topicName)) {
      return ['Financial Accounting', 'Adjustments & Reporting', 'Management Accounting Basics', 'Controls & Analysis'];
    }
    if (/^cape biology$/i.test(topicName)) {
      return ['Cells & Biochemistry', 'Genetics', 'Physiology', 'Ecology'];
    }
    if (/^cape chemistry$/i.test(topicName)) {
      return ['Atomic Structure & Bonding', 'Stoichiometry', 'Physical Chemistry', 'Organic/Applied Chemistry'];
    }
    if (/^cape economics$/i.test(topicName)) {
      return ['Microeconomics', 'Macroeconomics', 'Development Economics', 'Policy Analysis'];
    }
    if (/^communication studies$/i.test(topicName)) {
      return ['Communication Theory', 'Language & Audience', 'Message Design', 'Argumentation & Delivery'];
    }
    if (/^heart customer service$/i.test(topicName)) {
      return ['Service Standards', 'Complaint Resolution', 'Professional Communication', 'Quality Metrics'];
    }
    if (/^heart practical nursing support$/i.test(topicName)) {
      return ['Infection Control', 'Patient Observation', 'Patient Communication', 'Documentation & Handover'];
    }
    if (/^nvq-j electrical installation$/i.test(topicName)) {
      return ['Safety & Regulations', 'Circuit Theory', 'Installation Practice', 'Testing & Fault Finding'];
    }
    if (/^nvq-j welding and fabrication$/i.test(topicName)) {
      return ['Safety', 'Joint Preparation', 'Welding Technique', 'Inspection & Rework'];
    }

    return [];
  }

  function getJamaicaCurriculumMeta(courseTitle, fallbackTopic) {
    const name = normalizeTopic(courseTitle || fallbackTopic);
    if (!name) return null;

    const isJamaicaTrack = /(csec|cape|heart|nvq-j|communication studies)/i.test(name);
    if (!isJamaicaTrack) return null;

    let framework = 'Jamaica curriculum-aligned pathway';
    if (/csec/i.test(name)) framework = 'CSEC-aligned learning outcomes';
    else if (/cape/i.test(name) || /communication studies/i.test(name)) framework = 'CAPE-aligned learning outcomes';
    else if (/heart/i.test(name)) framework = 'HEART/NSTA competency pathway';
    else if (/nvq-j/i.test(name)) framework = 'NVQ-J competency standards pathway';

    const strands = getJamaicaStrandsForCourse(name);

    return {
      framework,
      strands,
      lastReviewed: getCurriculumLastReviewed(),
      updateCycle: 'Daily source freshness check + monthly pedagogy alignment pass',
      note: 'Always cross-check with your current school syllabus/teacher guidance and the latest official examination guidance before final exam preparation.',
      sources: [
        { label: 'CXC official examinations portal', href: 'https://www.cxc.org/' },
        { label: 'CSEC programme information', href: 'https://www.cxc.org/examinations/csec/' },
        { label: 'CAPE programme information', href: 'https://www.cxc.org/examinations/cape/' },
        { label: 'HEART/NSTA Trust', href: 'https://www.heart-nta.org/' },
        { label: 'Ministry of Education, Jamaica', href: 'https://www.moey.gov.jm/' },
        { label: 'MOEY NSC (Grade 7-9 Mathematics)', href: 'https://moey.gov.jm/curriculum/page/3/' },
        { label: 'MOEY Mathematics Student Resources', href: 'https://moey.gov.jm/students-2/' }
      ]
    };
  }

  function renderCurriculumMetaPanel(meta) {
    if (!curriculumMeta) return;
    if (!meta) {
      curriculumMeta.style.display = 'none';
      curriculumMeta.innerHTML = '';
      return;
    }

    const sourceList = asArray(meta.sources)
      .map((source) => `<li><a href="${escapeHtml(String(source.href || '#'))}" target="_blank" rel="noopener noreferrer" style="color:#7dd3fc;">${escapeHtml(String(source.label || 'Official source'))}</a></li>`)
      .join('');
    const strandList = asArray(meta.strands)
      .map((strand) => `<li>${escapeHtml(String(strand))}</li>`)
      .join('');

    curriculumMeta.style.display = 'block';
    curriculumMeta.innerHTML = `
      <div style="font-size:0.82rem;color:#7dd3fc;text-transform:uppercase;letter-spacing:0.04em;font-weight:700;margin-bottom:8px;">Curriculum Currency</div>
      <div style="margin-bottom:6px;"><strong style="color:#bfdbfe;">Alignment:</strong> ${escapeHtml(String(meta.framework || 'Curriculum-aligned'))}</div>
      <div style="margin-bottom:6px;"><strong style="color:#bfdbfe;">Last reviewed:</strong> ${escapeHtml(String(meta.lastReviewed || 'N/A'))}</div>
      <div style="margin-bottom:10px;"><strong style="color:#bfdbfe;">Update cycle:</strong> ${escapeHtml(String(meta.updateCycle || 'Periodic review'))}</div>
      ${strandList ? `<div style="color:#93c5fd;font-weight:700;margin-bottom:4px;">Strand structure</div><ul style="margin:0 0 10px 0;padding-left:18px;line-height:1.5;">${strandList}</ul>` : ''}
      <div style="margin-bottom:8px;color:#cbd5e1;">${escapeHtml(String(meta.note || ''))}</div>
      <div style="color:#93c5fd;font-weight:700;margin-bottom:4px;">Official reference sources</div>
      <ul style="margin:0;padding-left:18px;line-height:1.5;">${sourceList}</ul>
    `;
  }

  const LOCAL_CURRICULUM_COURSES = [
    {
      match: [/^csec mathematics$/i, /^csec math$/i],
      course: {
        courseTitle: 'CSEC Mathematics',
        subtitle: 'Numbers, algebra, geometry/measurement, trigonometry, and statistics/probability with graded checks.',
        difficulty: 'Intermediate',
        estimatedDuration: '8 weeks',
        marketDemand: 'Required for many CAPE, tertiary, and career pathways.',
        overview: 'This course teaches CSEC Mathematics through concept-first lessons, worked examples, and tested practice.',
        learningOutcomes: [
          'Use number operations, fractions, decimals, percentages, and ratio confidently.',
          'Solve algebraic equations and factorization questions.',
          'Apply geometry and measurement rules correctly.',
          'Use Pythagoras and trig ratios in right-triangle problems.',
          'Interpret data and calculate probability accurately.'
        ],
        modules: [
          {
            title: 'Number Concepts and Operations',
            objective: 'Apply fractions, decimals, percentages, ratio, and proportion in context.',
            lesson: 'Convert flexibly between fractions, decimals, and percentages and use ratio/proportion to solve everyday and exam problems.',
            workedExample: 'If an item is discounted by 15% from JMD 2,400, discount = 0.15 x 2400 = 360, sale price = JMD 2,040.',
            workedExampleSteps: [
              'Example A: Convert 3/4 to decimal and percent.',
              'Step 1: 3 divided by 4 = 0.75.',
              'Step 2: Multiply by 100 to convert to percent: 0.75 x 100 = 75%.',
              'Example B: Solve ratio proportion 2:5 = x:20.',
              'Step 1: Write as fractions: 2/5 = x/20.',
              'Step 2: Cross multiply: 2 x 20 = 5x => 40 = 5x.',
              'Step 3: x = 8.'
            ],
            commonMistake: 'Mixing percentage and decimal forms without converting correctly.',
            practiceTask: 'A school store marks up a JMD 1,500 item by 20%. Find the new price.',
            progressCheckQuestion: 'Convert 0.35 to a percentage.',
            progressCheckOptions: ['3.5%', '35%', '350%', '0.35%'],
            correctOptionIndex: 1,
            progressCheckExplanation: 'Multiply by 100: 0.35 x 100 = 35%.'
          },
          {
            title: 'Algebra Foundations',
            objective: 'Simplify expressions and solve linear equations.',
            lesson: 'Collect like terms, use inverse operations, and check your final answer by substitution.',
            workedExample: '2x + 7 = 19 gives 2x = 12, so x = 6.',
            workedExampleSteps: [
              'Example A: Solve 2x + 7 = 19.',
              'Step 1: Subtract 7 from both sides to keep the equation balanced: 2x = 12.',
              'Step 2: Divide both sides by 2: x = 6.',
              'Step 3: Check by substitution: 2(6) + 7 = 12 + 7 = 19, so the solution is correct.',
              'Example B: Solve 3x - 5 = 16.',
              'Step 1: Add 5 to both sides: 3x = 21.',
              'Step 2: Divide both sides by 3: x = 7.',
              'Step 3: Check: 3(7) - 5 = 21 - 5 = 16.'
            ],
            commonMistake: 'Applying operations to only one side of an equation.',
            practiceTask: 'Solve: 3x - 5 = 16.',
            progressCheckQuestion: 'Solve 4x + 3 = 19.',
            progressCheckOptions: ['x = 4', 'x = 5', 'x = 6', 'x = 7'],
            correctOptionIndex: 0,
            progressCheckExplanation: 'Subtract 3 to get 4x = 16, then divide by 4.'
          },
          {
            title: 'Factorization and Quadratic Setup',
            objective: 'Factorize common quadratic expressions.',
            lesson: 'For x^2 + bx + c, find two numbers that add to b and multiply to c.',
            workedExample: 'x^2 + 5x + 6 = (x + 2)(x + 3).',
            workedExampleSteps: [
              'Example A: Factorize x^2 + 5x + 6.',
              'Step 1: Identify b = 5 and c = 6.',
              'Step 2: Find two numbers that multiply to 6 and add to 5: 2 and 3.',
              'Step 3: Write factors: (x + 2)(x + 3).',
              'Example B: Factorize x^2 + 7x + 12.',
              'Step 1: Identify b = 7 and c = 12.',
              'Step 2: Find two numbers that multiply to 12 and add to 7: 3 and 4.',
              'Step 3: Final factors: (x + 3)(x + 4).'
            ],
            commonMistake: 'Choosing numbers that multiply to c but do not add to b.',
            practiceTask: 'Factorize: x^2 + 7x + 12.',
            progressCheckQuestion: 'Factorize x^2 - 9.',
            progressCheckOptions: ['(x - 9)(x + 1)', '(x - 3)(x + 3)', '(x - 3)^2', '(x + 9)(x - 1)'],
            correctOptionIndex: 1,
            progressCheckExplanation: 'Use difference of squares: a^2 - b^2 = (a-b)(a+b).'
          },
          {
            title: 'Geometry and Measurement',
            objective: 'Use angle facts, perimeter/area, and basic mensuration formulas.',
            lesson: 'Angles in a triangle sum to 180 deg. Perimeter and area formulas must match the shape and unit requirements.',
            workedExample: 'Triangle angles 50 deg and 60 deg leave 70 deg for the third angle.',
            workedExampleSteps: [
              'Example A: Triangle angle problem with angles 50 deg and 60 deg.',
              'Step 1: Use triangle rule: sum of interior angles = 180 deg.',
              'Step 2: Add known angles: 50 + 60 = 110 deg.',
              'Step 3: Subtract from 180 deg: 180 - 110 = 70 deg.',
              'Example B: Perimeter and area of rectangle where l = 9 cm and w = 4 cm.',
              'Step 1: Perimeter P = 2(l + w) = 2(9 + 4) = 26 cm.',
              'Step 2: Area A = l x w = 9 x 4 = 36 cm^2.',
              'Step 3: Keep units correct: cm for perimeter, cm^2 for area.'
            ],
            commonMistake: 'Confusing perimeter formulas with area formulas.',
            practiceTask: 'Find perimeter and area of a rectangle with l = 12 cm and w = 5 cm.',
            progressCheckQuestion: 'What is the sum of interior angles in a triangle?',
            progressCheckOptions: ['90 deg', '180 deg', '270 deg', '360 deg'],
            correctOptionIndex: 1,
            progressCheckExplanation: 'The interior angle sum of every triangle is 180 deg.'
          },
          {
            title: 'Trigonometry and Pythagoras',
            objective: 'Solve right-triangle questions with Pythagoras and SOH-CAH-TOA.',
            lesson: 'Use a^2 + b^2 = c^2 for side lengths and trig ratios for unknown angles or sides.',
            workedExample: 'A right triangle with sides 6 and 8 has hypotenuse 10.',
            workedExampleSteps: [
              'Example A: Right triangle with legs 6 and 8.',
              'Step 1: Use Pythagoras: c^2 = a^2 + b^2.',
              'Step 2: Substitute: c^2 = 6^2 + 8^2 = 36 + 64 = 100.',
              'Step 3: Take square root: c = sqrt(100) = 10.',
              'Example B: Find tan(theta) if opposite = 4 and adjacent = 3.',
              'Step 1: Use tangent rule: tan(theta) = opposite/adjacent.',
              'Step 2: Substitute values: tan(theta) = 4/3.',
              'Step 3: Keep ratio exact or convert to decimal if required by question.'
            ],
            commonMistake: 'Mixing opposite and adjacent sides when choosing trig ratios.',
            practiceTask: 'Find tan(theta) if opposite = 4 and adjacent = 3.',
            progressCheckQuestion: 'A right triangle has legs 5 and 12. What is the hypotenuse?',
            progressCheckOptions: ['11', '12', '13', '14'],
            correctOptionIndex: 2,
            progressCheckExplanation: 'c^2 = 5^2 + 12^2 = 25 + 144 = 169, so c = 13.'
          },
          {
            title: 'Data Handling and Probability',
            objective: 'Interpret tables/charts and calculate probability in simple events.',
            lesson: 'Use mean, median, mode, and probability rules to interpret and solve data-based questions.',
            workedExample: 'For values 4, 6, 8, 10, mean = (4 + 6 + 8 + 10)/4 = 7.',
            workedExampleSteps: [
              'Example A: Find median of 3, 5, 9, 11, 12.',
              'Step 1: Order values (already ordered).',
              'Step 2: Middle value is 9, so median = 9.',
              'Example B: Probability of drawing a red marble from bag with 3 red and 7 blue.',
              'Step 1: Favorable outcomes = 3.',
              'Step 2: Total outcomes = 10.',
              'Step 3: P(red) = 3/10.'
            ],
            commonMistake: 'Using total outcomes incorrectly in probability questions.',
            practiceTask: 'A die is rolled once. Find P(odd).',
            progressCheckQuestion: 'A die is rolled once. What is P(even)?',
            progressCheckOptions: ['1/6', '1/3', '1/2', '2/3'],
            correctOptionIndex: 2,
            progressCheckExplanation: 'Even outcomes are 2, 4, and 6: 3 out of 6, so 1/2.'
          }
        ],
        finalAssessment: [
          {
            question: 'Solve 3x + 4 = 19.',
            options: ['x = 3', 'x = 4', 'x = 5', 'x = 6'],
            correctOptionIndex: 2,
            explanation: 'Subtract 4 to get 3x = 15, then divide by 3.'
          },
          {
            question: 'Factorize x^2 + 7x + 12.',
            options: ['(x + 3)(x + 4)', '(x + 2)(x + 6)', '(x + 1)(x + 12)', '(x - 3)(x - 4)'],
            correctOptionIndex: 0,
            explanation: '3 and 4 add to 7 and multiply to 12.'
          },
          {
            question: 'Find the third angle of a triangle with angles 45 deg and 65 deg.',
            options: ['60 deg', '70 deg', '80 deg', '90 deg'],
            correctOptionIndex: 1,
            explanation: '180 - 45 - 65 = 70.'
          },
          {
            question: 'A right triangle has legs 6 and 8. Find the hypotenuse.',
            options: ['10', '11', '12', '14'],
            correctOptionIndex: 0,
            explanation: 'sqrt(6^2 + 8^2) = sqrt(100) = 10.'
          }
        ]
      }
    },
    {
      match: [/^cape mathematics$/i, /^cape pure mathematics$/i, /^cape applied mathematics$/i],
      course: {
        courseTitle: 'CAPE Mathematics',
        subtitle: 'Functions, calculus, vectors, and probability with graded checks.',
        difficulty: 'Advanced',
        estimatedDuration: '10 weeks',
        marketDemand: 'High-value subject for STEM, engineering, and analytics pathways.',
        overview: 'This CAPE course teaches advanced math concepts and validates mastery using objective tests.',
        modules: [
          {
            title: 'Functions and Graphs',
            objective: 'Interpret function notation and graph transformations.',
            lesson: 'In y = f(x-a), the graph shifts right by a units.',
            workedExample: 'y = (x-2)^2 shifts y = x^2 right by 2.',
            commonMistake: 'Treating x-a as a left shift.',
            practiceTask: 'Describe the shift in y = (x+3)^2.',
            progressCheckQuestion: 'What does y = f(x-4) do?',
            progressCheckOptions: ['Left 4', 'Right 4', 'Up 4', 'Down 4'],
            correctOptionIndex: 1,
            progressCheckExplanation: 'x-a shifts the graph right by a.'
          },
          {
            title: 'Differentiation and Integration',
            objective: 'Differentiate and integrate polynomial functions.',
            lesson: 'Use the power rule for derivatives and reverse power rule for integrals.',
            workedExample: 'd/dx (5x^3) = 15x^2, integral 9x^2 dx = 3x^3 + C.',
            commonMistake: 'Forgetting + C after integration.',
            practiceTask: 'Differentiate 4x^4 and integrate 8x^3.',
            progressCheckQuestion: 'Differentiate y = x^4.',
            progressCheckOptions: ['x^3', '4x^3', 'x^5', '4x^5'],
            correctOptionIndex: 1,
            progressCheckExplanation: 'Power rule: n*x^(n-1).'
          },
          {
            title: 'Vectors',
            objective: 'Add vectors and interpret vector magnitude.',
            lesson: 'Add vectors component-wise and use magnitude formula sqrt(x^2 + y^2).',
            workedExample: '(2,-1) + (4,3) = (6,2).',
            commonMistake: 'Combining x and y components incorrectly.',
            practiceTask: 'Find |(6,8)|.',
            progressCheckQuestion: 'What is (1,2) + (3,5)?',
            progressCheckOptions: ['(4,7)', '(3,7)', '(4,8)', '(5,7)'],
            correctOptionIndex: 0,
            progressCheckExplanation: 'Add x-values and y-values separately.'
          },
          {
            title: 'Probability',
            objective: 'Apply probability rules in discrete scenarios.',
            lesson: 'For independent events, multiply probabilities.',
            workedExample: 'If P(A)=0.4 and P(B)=0.5, P(A and B)=0.2.',
            commonMistake: 'Adding when multiplication is required for independent events.',
            practiceTask: 'Find P(A and B) for independent events 0.3 and 0.2.',
            progressCheckQuestion: 'If P(A)=0.2 and P(B)=0.5 independent, what is P(A and B)?',
            progressCheckOptions: ['0.1', '0.2', '0.3', '0.7'],
            correctOptionIndex: 0,
            progressCheckExplanation: 'Multiply 0.2 by 0.5.'
          }
        ],
        finalAssessment: [
          {
            question: 'Differentiate y = 5x^3.',
            options: ['5x^2', '10x^2', '15x^2', '15x^3'],
            correctOptionIndex: 2,
            explanation: '5*3x^2 = 15x^2.'
          },
          {
            question: 'Integrate 9x^2 dx.',
            options: ['3x^3 + C', '9x^3 + C', '18x + C', 'x^9 + C'],
            correctOptionIndex: 0,
            explanation: 'Integral of 9x^2 is 3x^3 + C.'
          },
          {
            question: 'For independent events P(A)=0.4 and P(B)=0.5, find P(A and B).',
            options: ['0.9', '0.45', '0.2', '0.1'],
            correctOptionIndex: 2,
            explanation: 'Multiply: 0.4 x 0.5 = 0.2.'
          }
        ]
      }
    }
  ];

  const ROLEROCKET_LEARNING_ACADEMIES = [
    {
      name: 'AI + Data Academy',
      keywords: ['ai', 'machine learning', 'data', 'analytics', 'sql', 'bi', 'dashboard', 'python'],
      courses: ['AI Foundations', 'Prompt Engineering', 'Data Analytics', 'SQL for Business', 'BI Dashboards']
    },
    {
      name: 'Software + Cloud Academy',
      keywords: ['web', 'frontend', 'backend', 'api', 'git', 'github', 'cloud', 'devops'],
      courses: ['Web Development', 'API Development', 'Git and GitHub', 'Cloud Fundamentals', 'DevOps Basics']
    },
    {
      name: 'Cyber + IT Academy',
      keywords: ['it support', 'network', 'security', 'soc', 'cyber', 'cloud security'],
      courses: ['IT Support', 'Networking Fundamentals', 'Cybersecurity Foundations', 'SOC Analyst Basics', 'Cloud Security']
    },
    {
      name: 'Business + Operations Academy',
      keywords: ['project management', 'agile', 'scrum', 'business analysis', 'operations', 'process'],
      courses: ['Project Management', 'Agile and Scrum', 'Business Analysis', 'Operations Management', 'Process Automation']
    },
    {
      name: 'Marketing + Sales Academy',
      keywords: ['marketing', 'content', 'seo', 'crm', 'sales', 'brand', 'communications'],
      courses: ['Digital Marketing', 'Content Strategy', 'SEO and SEM', 'CRM Workflows', 'Sales Enablement']
    },
    {
      name: 'Career + Leadership Academy',
      keywords: ['communication', 'interview', 'resume', 'linkedin', 'leadership', 'teamwork'],
      courses: ['Professional Communication', 'Interview Mastery', 'Resume and LinkedIn', 'Team Collaboration', 'Leadership Essentials']
    }
  ];

  const ROLEROCKET_LESSON_MODEL = {
    moduleBlueprint: [
      'Why this skill matters',
      'Core concepts',
      'Tool fluency',
      'Guided project',
      'Industry simulation',
      'Career proof'
    ],
    lessonRhythm: [
      '10 minutes: warm-up and recap quiz',
      '15 minutes: concept mini-lesson',
      '20 minutes: live demonstration',
      '30 minutes: hands-on lab or scenario',
      '10 minutes: debrief and exit ticket'
    ],
    assessmentModel: [
      'Knowledge checks and concept accuracy',
      'Execution quality in labs and assignments',
      'Problem-solving under constraints',
      'Communication and decision rationale',
      'Portfolio-ready deliverable for each course'
    ]
  };

  function normalizeTopic(topicName) {
    return String(topicName || '').trim().toLowerCase();
  }

  function getRoleRocketAcademy(courseTitle, fallbackTopic) {
    const name = normalizeTopic(courseTitle || fallbackTopic);
    if (!name) return null;

    let best = null;
    let bestScore = 0;

    ROLEROCKET_LEARNING_ACADEMIES.forEach((academy) => {
      let score = 0;
      asArray(academy.keywords).forEach((keyword) => {
        const token = normalizeTopic(keyword);
        if (token && name.includes(token)) score += 2;
      });
      asArray(academy.courses).forEach((course) => {
        const token = normalizeTopic(course);
        if (token && name.includes(token)) score += 3;
      });
      if (score > bestScore) {
        bestScore = score;
        best = academy;
      }
    });

    return best;
  }

  function renderTeachingFrameworkPanel(courseTitle, fallbackTopic) {
    if (!teachingFramework) return;
    const academy = getRoleRocketAcademy(courseTitle, fallbackTopic);
    const focus = inferCourseFocus(courseTitle, fallbackTopic);
    const academyLabel = String(academy?.name || 'RoleRocket Learning Studio');
    const outcomes = asArray(academy?.outcomes);
    const outcomeList = outcomes.length
      ? outcomes.map((item) => `<li>${escapeHtml(String(item))}</li>`).join('')
      : '<li>Adaptive pacing based on demonstrated mastery</li><li>Hands-on transfer proof before progression</li><li>Certification-aligned objective checkpoints</li>';

    teachingFramework.style.display = 'block';
    teachingFramework.innerHTML = `
      <div style="font-size:0.82rem;color:#67e8f9;text-transform:uppercase;letter-spacing:0.04em;font-weight:700;margin-bottom:8px;">Teaching Framework</div>
      <div style="margin-bottom:8px;"><strong style="color:#bfdbfe;">Model:</strong> Adaptive mastery sequence for ${escapeHtml(String(focus))}</div>
      <div style="margin-bottom:8px;"><strong style="color:#bfdbfe;">Academy alignment:</strong> ${escapeHtml(academyLabel)}</div>
      <ul style="margin:0 0 10px 0;padding-left:18px;line-height:1.55;">${outcomeList}</ul>
      <div style="color:#cbd5e1;line-height:1.6;">
        The course now runs with a placement diagnostic, targeted remediation on incorrect checkpoints, and a transfer-task mastery gate.
        Learners progress only after they demonstrate both checkpoint accuracy and applied competency.
      </div>
    `;
  }

  function inferCourseFocus(courseTitle, fallbackTopic) {
    const name = normalizeTopic(courseTitle || fallbackTopic);
    if (!name) return 'subject';
    if (name.includes('ai') || name.includes('machine learning') || name.includes('deep learning') || name.includes('data science') || name.includes('artificial intelligence')) return 'ai and machine learning';
    if (name.includes('mathematics') || name.includes('math')) return 'mathematics';
    if (name.includes('english')) return 'english';
    if (name.includes('information technology') || name.includes('it')) return 'information technology';
    if (name.includes('accounts') || name.includes('accounting')) return 'accounting';
    if (name.includes('biology')) return 'biology';
    if (name.includes('chemistry')) return 'chemistry';
    if (name.includes('economics')) return 'economics';
    if (name.includes('communication')) return 'communication studies';
    if (name.includes('customer service')) return 'customer service';
    if (name.includes('nursing')) return 'nursing support';
    if (name.includes('electrical')) return 'electrical installation';
    if (name.includes('welding')) return 'welding and fabrication';
    return 'subject';
  }

  function buildFromScratchScaffold(focus) {
    const topicLabel = String(focus || 'subject');

    const refresherByFocus = {
      'ai and machine learning': {
        title: 'Core Concept and Math Refresher for AI + Machine Learning',
        objective: 'Refresh the essential concepts and math tools needed for modern AI/ML modules.',
        lesson: 'Revisit vectors and matrices, gradients and optimization, probability/statistics intuition, and key AI distinctions (AI vs ML vs deep learning). This refresher sets up the deeper modules so learners understand why models work, not just how to run tools.',
        workedExample: 'A model starts with random weights, computes loss, then uses gradients to update weights toward lower error over iterations.',
        workedExampleSteps: [
          'Step 1: Define the prediction task and the target variable.',
          'Step 2: Compute model output and compare to true label using a loss function.',
          'Step 3: Use gradient information to update model parameters.',
          'Step 4: Re-evaluate metrics and repeat until performance stabilizes.'
        ],
        commonMistake: 'Jumping to frameworks before understanding data quality, objective choice, and evaluation metrics.',
        practiceTask: 'Write a one-page map of AI vs ML vs deep learning and connect each to one real use case.',
        progressCheckQuestion: 'Why is this refresher module placed before deep AI/ML modules?',
        progressCheckOptions: ['To skip fundamentals', 'To build concept and math readiness for later modeling work', 'To replace all projects', 'To avoid evaluation metrics'],
        correctOptionIndex: 1,
        progressCheckExplanation: 'Foundational readiness improves model selection, troubleshooting, and project outcomes.'
      },
      mathematics: {
        title: 'Formula and Method Refresher',
        objective: 'Refresh core formulas and solution habits before starting full modules.',
        lesson: 'Review the formulas you will repeatedly use: linear equations, factorization patterns, triangle angle sum, area formulas, Pythagoras theorem, and basic probability. Focus on when to use each formula, not just memorizing it.',
        workedExample: 'ax + b = c => x = (c - b)/a; then verify by substitution.',
        workedExampleSteps: [
          '2x + 7 = 19 => 2x = 12 => x = 6; check: 2(6) + 7 = 19.',
          'x^2 - 9 = x^2 - 3^2 => (x - 3)(x + 3).',
          'x + 50 + 60 = 180 => x = 70 deg.',
          'A = l x w = 9 x 4 = 36 cm^2; A = pi r^2 = pi(5)^2 = 25pi cm^2.',
          'c^2 = a^2 + b^2 = 6^2 + 8^2 = 36 + 64 = 100 => c = 10.',
          'P(even) = favorable/total = 3/6 = 1/2.',
          'Verification rule: substitute answer and confirm LHS = RHS.'
        ],
        commonMistake: 'Memorizing formulas without recognizing which question type they fit.',
        practiceTask: 'Create a one-page formula sheet and solve one example per formula from memory.',
        progressCheckQuestion: 'Solve for x: 2x + 7 = 19',
        progressCheckOptions: ['x = 4', 'x = 6', 'x = 7', 'x = 5'],
        correctOptionIndex: 1,
        progressCheckExplanation: '2x = 19 - 7 = 12, so x = 6. Check: 2(6) + 7 = 19.'
      }
    };

    const refresher = refresherByFocus[topicLabel] || {
      title: `Core Concept and Method Refresher for ${topicLabel}`,
      objective: `Refresh the key terms, methods, and patterns used across ${topicLabel}.`,
      lesson: `Before full lessons, quickly revisit the most important structures and methods so you can recognize question types faster and avoid basic errors.`,
      workedExample: `Refresher workflow: identify task type, select method, execute with structure, then verify your output.`,
      workedExampleSteps: [
        'Step 1: List the top 5 recurring concepts in this course.',
        'Step 2: Pair each concept with the method/framework you should use.',
        'Step 3: Solve one short example for each concept with full steps shown.',
        'Step 4: Write one error-prevention tip for each concept.'
      ],
      commonMistake: 'Starting advanced modules without a refreshed concept-method map.',
      practiceTask: 'Build a quick-reference refresher sheet and test yourself on all listed concepts.',
      progressCheckQuestion: 'What is the purpose of the refresher module?',
      progressCheckOptions: ['Skip fundamentals', 'Refresh key methods before deeper modules', 'Replace full lessons', 'Avoid practice'],
      correctOptionIndex: 1,
      progressCheckExplanation: 'A refresher improves readiness and reduces avoidable errors in later modules.'
    };

    return {
      refresher,
      checkpoint: {
        title: `Spiral Review and Mastery Checkpoint`,
        objective: 'Consolidate earlier modules before final assessment.',
        lesson: 'Revisit earlier concepts in mixed format. Mastery means applying the right method when question styles vary, not just repeating one familiar pattern.',
        workedExample: 'Spiral review method: mix easy, medium, and challenge items from previous modules and track error patterns.',
        workedExampleSteps: [
          'Step 1: Attempt a mixed review set spanning all modules completed so far.',
          'Step 2: Categorize mistakes by concept type rather than by question number.',
          'Step 3: Re-solve missed items with full step-by-step reasoning.',
          'Step 4: Re-test weak areas after review to confirm mastery.'
        ],
        commonMistake: 'Reviewing only your strongest topics before final assessment.',
        practiceTask: 'Complete a mixed review set and write a targeted revision plan for your weakest two topics.',
        progressCheckQuestion: 'What is the purpose of a mastery checkpoint?',
        progressCheckOptions: ['Skip revision', 'Confirm understanding across mixed topics before final testing', 'Replace all assessments', 'Only review one easy topic'],
        correctOptionIndex: 1,
        progressCheckExplanation: 'Checkpoint review confirms readiness and reduces repeated mistakes in final assessment.'
      }
    };
  }

  function applyFromScratchCourseScaffold(course, fallbackTopic) {
    const baseCourse = course || {};
    const existingModules = asArray(baseCourse.modules);
    if (!existingModules.length) return baseCourse;

    const focus = inferCourseFocus(baseCourse.courseTitle, fallbackTopic);
    if (focus === 'ai and machine learning') return baseCourse;

    const alreadyScaffolded = existingModules.some((moduleItem) => /refresher|mastery checkpoint/i.test(String(moduleItem?.title || '')));
    if (alreadyScaffolded) return baseCourse;

    const scaffold = buildFromScratchScaffold(focus);
    const modules = [scaffold.refresher].concat(existingModules).concat([scaffold.checkpoint]);

    const outcomes = asArray(baseCourse.learningOutcomes);
    const mergedOutcomes = outcomes.concat([
      'Refresh key formulas, methods, and concepts before deep modules.',
      'Pass a mastery checkpoint before final assessment.'
    ]).filter(Boolean);

    return {
      ...baseCourse,
      modules,
      learningOutcomes: mergedOutcomes
    };
  }

  function normalizeAssessmentOptions(options, correctText) {
    const source = asArray(options).map((option) => String(option || '').trim()).filter(Boolean);
    const fallbackCorrect = String(correctText || 'Apply the best-practice approach taught in the module.').trim();
    const fallbackPool = [
      'Skip planning and move straight to execution.',
      'Delay review until the deadline day.',
      'Use assumptions instead of validated evidence.',
      'Ignore tradeoffs and stakeholder impact.'
    ];
    const merged = source.concat(fallbackPool).filter(Boolean);
    const unique = [];
    merged.forEach((item) => {
      if (!unique.includes(item)) unique.push(item);
    });

    if (!unique.includes(fallbackCorrect)) unique.unshift(fallbackCorrect);
    while (unique.length < 4) unique.push(`Option ${unique.length + 1}`);
    return unique.slice(0, 4);
  }

  function buildSyntheticCertificationModule(baseModule, syntheticIndex, topicLabel) {
    const moduleTitle = String(baseModule?.title || `Module ${syntheticIndex + 1}`).trim();
    const moduleObjective = String(baseModule?.objective || '').trim();
    const question = String(baseModule?.progressCheckQuestion || 'What is the best next action in this scenario?').trim();
    const rawOptions = asArray(baseModule?.progressCheckOptions);
    const numericCorrect = Number(baseModule?.correctOptionIndex);
    const safeCorrect = Number.isInteger(numericCorrect) && numericCorrect >= 0 && numericCorrect < rawOptions.length ? numericCorrect : 0;
    const options = normalizeAssessmentOptions(rawOptions, rawOptions[safeCorrect]);
    const correctedIndex = Math.max(0, options.indexOf(String(rawOptions[safeCorrect] || '').trim()));
    const focusName = String(topicLabel || 'this course').trim();

    return {
      title: `${moduleTitle} - Applied Scenario Lab ${syntheticIndex + 1}`,
      objective: moduleObjective || `Apply ${focusName} decisions under realistic project constraints.`,
      lesson: `This certification scenario lab extends the core lesson into a higher-pressure context where decisions must be justified with evidence. Start by clarifying the objective, then identify the constraint that matters most (time, quality, scope, risk, or stakeholder impact). Next, compare at least two options and describe the tradeoff of each. Choose one option, explain why it best protects the intended outcome, and define what signal would tell you to adjust the plan. Finish by documenting the decision clearly enough that another team member can execute it without confusion. This approach builds the real exam skill that certification tests for: selecting the best answer among plausible choices using judgment, structure, and outcome-focused reasoning instead of guesswork.`,
      workedExample: `A delivery team is two days behind while quality defects are rising. The lead reduces low-impact scope, adds a risk checkpoint, and publishes a revised plan with owner accountability to protect quality and final outcome reliability.`,
      commonMistake: `Choosing the fastest option without explaining impact on quality, risk, and stakeholder trust.`,
      practiceTask: `Write a short decision memo with objective, options considered, chosen action, tradeoff rationale, and trigger for re-evaluation.`,
      progressCheckQuestion: question,
      progressCheckOptions: options,
      correctOptionIndex: correctedIndex,
      progressCheckExplanation: String(baseModule?.progressCheckExplanation || 'The strongest answer is the one that protects the objective while managing constraints and risk.').trim()
    };
  }

  function getCourseCoverageTargets(topicLabel) {
    const normalizedTopic = normalizeTopic(topicLabel || '');
    if (/ai|machine learning|ml|deep learning|data science|artificial intelligence/i.test(normalizedTopic)) {
      return {
        minModules: COVERAGE_AI_ML_MIN_MODULES,
        finalQuestionCount: COVERAGE_AI_ML_FINAL_QUESTION_COUNT,
        practiceQuestionCount: COVERAGE_AI_ML_PRACTICE_QUESTION_COUNT,
        mockQuestionCount: COVERAGE_AI_ML_MOCK_QUESTION_COUNT,
        overallPassMark: COVERAGE_AI_ML_OVERALL_PASS_MARK,
        domainPassMark: COVERAGE_AI_ML_DOMAIN_PASS_MARK,
        estimatedDuration: '10 weeks (10 hrs/week) | 100-120 hours total'
      };
    }

    if (/engineering|chemistry|physics|biology|mathematics|statistics|quantum|electrical|mechanical|robotics|computer science|cyber/i.test(normalizedTopic)) {
      return {
        minModules: COVERAGE_STEM_MIN_MODULES,
        finalQuestionCount: COVERAGE_STEM_FINAL_QUESTION_COUNT,
        practiceQuestionCount: COVERAGE_STEM_PRACTICE_QUESTION_COUNT,
        mockQuestionCount: COVERAGE_STEM_MOCK_QUESTION_COUNT,
        overallPassMark: COVERAGE_STEM_OVERALL_PASS_MARK,
        domainPassMark: COVERAGE_STEM_DOMAIN_PASS_MARK,
        estimatedDuration: '14-20 weeks'
      };
    }

    if (/project management|accounting|finance|economics|marketing|operations|supply chain|business/i.test(normalizedTopic)) {
      return {
        minModules: COVERAGE_BUSINESS_MIN_MODULES,
        finalQuestionCount: COVERAGE_BUSINESS_FINAL_QUESTION_COUNT,
        practiceQuestionCount: COVERAGE_BUSINESS_PRACTICE_QUESTION_COUNT,
        mockQuestionCount: COVERAGE_BUSINESS_MOCK_QUESTION_COUNT,
        overallPassMark: COVERAGE_BUSINESS_OVERALL_PASS_MARK,
        domainPassMark: COVERAGE_BUSINESS_DOMAIN_PASS_MARK,
        estimatedDuration: '12-16 weeks'
      };
    }

    return {
      minModules: COVERAGE_DEFAULT_MIN_MODULES,
      finalQuestionCount: COVERAGE_DEFAULT_FINAL_QUESTION_COUNT,
      practiceQuestionCount: COVERAGE_DEFAULT_PRACTICE_QUESTION_COUNT,
      mockQuestionCount: COVERAGE_DEFAULT_MOCK_QUESTION_COUNT,
      overallPassMark: COVERAGE_DEFAULT_OVERALL_PASS_MARK,
      domainPassMark: COVERAGE_DEFAULT_DOMAIN_PASS_MARK,
      estimatedDuration: '10-14 weeks'
    };
  }

  function getDomainMetaByIndex(index) {
    const safeIndex = Math.max(0, Number(index || 0));
    return CERTIFICATION_DOMAINS[safeIndex % CERTIFICATION_DOMAINS.length] || CERTIFICATION_DOMAINS[0];
  }

  function createCertificationPlan(targets, basePlan) {
    const providedDomains = asArray(basePlan?.domains)
      .map((domain, index) => ({
        key: String(domain?.key || getDomainMetaByIndex(index).key).trim(),
        label: String(domain?.label || getDomainMetaByIndex(index).label).trim()
      }))
      .filter((domain) => domain.key && domain.label);
    return {
      trackLabel: String(basePlan?.trackLabel || 'Certification pathway').trim(),
      overallPassMark: Number(basePlan?.overallPassMark || targets.overallPassMark),
      domainPassMark: Number(basePlan?.domainPassMark || targets.domainPassMark),
      practiceQuestionCount: Number(basePlan?.practiceQuestionCount || targets.practiceQuestionCount),
      finalQuestionCount: Number(basePlan?.finalQuestionCount || targets.finalQuestionCount),
      mockExamCount: Number(basePlan?.mockExamCount || COVERAGE_MOCK_EXAM_COUNT),
      mockQuestionCount: Number(basePlan?.mockQuestionCount || targets.mockQuestionCount),
      domains: providedDomains.length ? providedDomains : CERTIFICATION_DOMAINS.slice()
    };
  }

  function ensureCourseCoverageModules(modules, fallbackTopic, minModules) {
    const baseModules = asArray(modules);
    if (!baseModules.length) return [];

    const normalized = baseModules.map((moduleItem) => ({ ...moduleItem }));
    const seed = normalized.slice();
    while (normalized.length < minModules) {
      const source = seed[normalized.length % seed.length] || seed[0];
      const synthetic = buildSyntheticCertificationModule(source, normalized.length - seed.length + 1, fallbackTopic);
      normalized.push(synthetic);
    }
    return normalized;
  }

  function normalizeObjectiveAssessmentItem(item, fallbackQuestion, fallbackTopic, fallbackDomainIndex) {
    const question = String(item?.question || fallbackQuestion || `What is the best next action for ${String(fallbackTopic || 'this module')}?`).trim();
    const rawOptions = asArray(item?.options);
    const numericCorrect = Number(item?.correctOptionIndex);
    const safeCorrect = Number.isInteger(numericCorrect) && numericCorrect >= 0 && numericCorrect < rawOptions.length ? numericCorrect : 0;
    const options = normalizeAssessmentOptions(rawOptions, rawOptions[safeCorrect]);
    const matched = options.indexOf(String(rawOptions[safeCorrect] || '').trim());
    const correctOptionIndex = matched >= 0 ? matched : 0;
    const domainMeta = getDomainMetaByIndex(fallbackDomainIndex);
    return {
      question,
      options,
      correctOptionIndex,
      explanation: String(item?.explanation || 'Choose the option that best protects delivery outcomes, quality, and stakeholder expectations.').trim(),
      domainKey: String(item?.domainKey || domainMeta.key).trim(),
      domainLabel: String(item?.domainLabel || domainMeta.label).trim()
    };
  }

  function buildGeneratedAssessmentFromModules(modules, topicLabel) {
    const generated = [];
    const rows = asArray(modules);
    rows.forEach((moduleItem, moduleIndex) => {
      const moduleTitle = String(moduleItem?.title || `Module ${moduleIndex + 1}`).trim();
      const question = String(moduleItem?.progressCheckQuestion || '').trim();
      const options = normalizeAssessmentOptions(moduleItem?.progressCheckOptions, asArray(moduleItem?.progressCheckOptions)[Number(moduleItem?.correctOptionIndex) || 0]);
      const correctText = String(asArray(moduleItem?.progressCheckOptions)[Number(moduleItem?.correctOptionIndex) || 0] || options[0]).trim();
      const correctOptionIndex = Math.max(0, options.indexOf(correctText));
      const domainMeta = getDomainMetaByIndex(moduleIndex);

      generated.push(normalizeObjectiveAssessmentItem({
        question: question || `Which action best demonstrates mastery of ${moduleTitle}?`,
        options,
        correctOptionIndex,
        explanation: String(moduleItem?.progressCheckExplanation || 'This choice aligns with the strongest execution approach for the module objective.').trim(),
        domainKey: domainMeta.key,
        domainLabel: domainMeta.label
      }, question, topicLabel, moduleIndex));

      generated.push(normalizeObjectiveAssessmentItem({
        question: `A project scenario from ${moduleTitle} introduces time pressure and stakeholder constraints. What is the best first response?`,
        options,
        correctOptionIndex,
        explanation: `Use the same decision logic from ${moduleTitle}: protect the objective, evaluate tradeoffs, and choose the most defensible action.`,
        domainKey: domainMeta.key,
        domainLabel: domainMeta.label
      }, question, topicLabel, moduleIndex));
    });
    return generated;
  }

  function ensureCourseCoverageAssessment(finalAssessment, modules, fallbackTopic, finalQuestionCount) {
    const normalizedSeed = asArray(finalAssessment)
      .map((item, idx) => normalizeObjectiveAssessmentItem(item, `Question ${idx + 1}`, fallbackTopic, idx));
    const generated = buildGeneratedAssessmentFromModules(modules, fallbackTopic);
    const bank = normalizedSeed.concat(generated).filter((item) => asArray(item?.options).length >= 4);

    if (!bank.length) {
      bank.push(normalizeObjectiveAssessmentItem({
        question: `What is the strongest certification approach for ${String(fallbackTopic || 'this course')}?`,
        options: [
          'Define objective, assess tradeoffs, execute with evidence, and review outcomes.',
          'Skip planning to save time.',
          'Delay risk checks until the end.',
          'Focus on tools only and ignore outcomes.'
        ],
        correctOptionIndex: 0,
        explanation: 'Certification-level performance requires structured, outcome-focused execution.'
      }, 'Certification question', fallbackTopic, 0));
    }

    const expanded = bank.slice();
    while (expanded.length < finalQuestionCount) {
      const source = expanded[expanded.length % bank.length];
      expanded.push({
        ...source,
        question: `${source.question} (Certification Form ${expanded.length + 1})`
      });
    }

    return expanded.slice(0, finalQuestionCount);
  }

  function ensurePracticeQuestionBank(practiceBankRows, finalAssessment, modules, fallbackTopic, practiceQuestionCount) {
    const seed = asArray(practiceBankRows)
      .map((item, idx) => normalizeObjectiveAssessmentItem(item, `Practice Question ${idx + 1}`, fallbackTopic, idx));
    const assessmentSeed = asArray(finalAssessment)
      .map((item, idx) => normalizeObjectiveAssessmentItem(item, `Assessment Question ${idx + 1}`, fallbackTopic, idx));
    const moduleSeed = buildGeneratedAssessmentFromModules(modules, fallbackTopic);
    const bank = seed.concat(assessmentSeed).concat(moduleSeed).filter((item) => asArray(item?.options).length >= 4);

    if (!bank.length) return [];

    const expanded = bank.slice();
    while (expanded.length < practiceQuestionCount) {
      const source = expanded[expanded.length % bank.length];
      expanded.push({
        ...source,
        question: `${source.question} (Practice Variant ${expanded.length + 1})`
      });
    }

    return expanded.slice(0, practiceQuestionCount);
  }

  function ensureTimedMockExams(mockExamRows, questionBank, fallbackTopic, certificationPlan) {
    const requestedCount = Math.max(2, Number(certificationPlan?.mockExamCount || COVERAGE_MOCK_EXAM_COUNT));
    const questionCount = Math.max(20, Number(certificationPlan?.mockQuestionCount || 30));
    const sourceBank = asArray(questionBank)
      .map((item, idx) => normalizeObjectiveAssessmentItem(item, `Mock Question ${idx + 1}`, fallbackTopic, idx));
    const normalizedSeed = asArray(mockExamRows).map((exam, examIndex) => {
      const examQuestions = asArray(exam?.questions)
        .map((item, idx) => normalizeObjectiveAssessmentItem(item, `Mock ${examIndex + 1} Question ${idx + 1}`, fallbackTopic, idx));
      return {
        title: String(exam?.title || `Timed Mock ${examIndex + 1}`).trim(),
        description: String(exam?.description || 'Timed readiness check with rotating questions.').trim(),
        timeLimitMinutes: Math.max(30, Number(exam?.timeLimitMinutes || questionCount)),
        questions: examQuestions
      };
    }).filter((exam) => exam.questions.length);

    const mockExams = normalizedSeed.slice();
    while (mockExams.length < requestedCount) {
      const examIndex = mockExams.length;
      const questions = [];
      for (let idx = 0; idx < questionCount; idx += 1) {
        const source = sourceBank[(examIndex * questionCount + idx) % Math.max(sourceBank.length, 1)] || null;
        if (!source) continue;
        questions.push({
          ...source,
          question: `${source.question} (Mock ${examIndex + 1} - ${idx + 1})`
        });
      }
      mockExams.push({
        title: `Timed Mock ${examIndex + 1}`,
        description: 'Timed readiness check with rotating questions across certification domains.',
        timeLimitMinutes: Math.max(30, questionCount),
        questions
      });
    }

    return mockExams.slice(0, requestedCount);
  }

  function applyCourseCoverageNormalization(course, fallbackTopic) {
    const baseCourse = course || {};
    const targets = getCourseCoverageTargets(baseCourse.courseTitle || fallbackTopic);
    const baseModules = ensureCourseCoverageModules(baseCourse.modules, fallbackTopic, targets.minModules);
    if (!baseModules.length) return baseCourse;

    const finalAssessment = ensureCourseCoverageAssessment(baseCourse.finalAssessment, baseModules, fallbackTopic, targets.finalQuestionCount);
    const certificationPlan = createCertificationPlan(targets, baseCourse.certificationPlan);
    const practiceQuestionBank = ensurePracticeQuestionBank(baseCourse.practiceBank, finalAssessment, baseModules, fallbackTopic, certificationPlan.practiceQuestionCount);
    const mockExamSet = ensureTimedMockExams(baseCourse.mockExams, practiceQuestionBank, fallbackTopic, certificationPlan);
    const outcomes = asArray(baseCourse.learningOutcomes).concat([
      `Complete a full coverage pathway with ${targets.minModules}+ modules.`,
      `Pass ${certificationPlan.mockExamCount} timed mock exams with rotating question sets.`
    ]).filter(Boolean);

    const uniqueOutcomes = [];
    outcomes.forEach((item) => {
      const normalized = String(item || '').trim();
      if (normalized && !uniqueOutcomes.includes(normalized)) uniqueOutcomes.push(normalized);
    });

    return {
      ...baseCourse,
      estimatedDuration: String(baseCourse.estimatedDuration || targets.estimatedDuration),
      modules: baseModules,
      practiceBank: practiceQuestionBank,
      finalAssessment,
      mockExams: mockExamSet,
      certificationPlan,
      learningOutcomes: uniqueOutcomes,
      progressCheckMode: 'local'
    };
  }

  function applyUnifiedSubsectionStructure(course, fallbackTopic) {
    const baseCourse = course || {};
    const modules = asArray(baseCourse.modules);
    if (!modules.length) return baseCourse;

    const normalizedModules = modules.map((moduleItem, idx) => {
      const title = String(moduleItem?.title || `Module ${idx + 1}`).trim();
      const objective = String(moduleItem?.objective || '').trim();
      const lesson = String(moduleItem?.lesson || '').trim();
      const workedExample = String(moduleItem?.workedExample || '').trim();
      const practiceTask = String(moduleItem?.practiceTask || '').trim();
      const progressCheckQuestion = String(moduleItem?.progressCheckQuestion || '').trim();

      const hasStructuredSections = /section\s*1\s*[-:]/i.test(lesson);
      const sectionedLesson = hasStructuredSections
        ? lesson
        : [
            `Section 1 - Core Concepts: ${objective || `Understand the key principles for ${title}.`}`,
            `Section 2 - Method and Tools: ${lesson || `Learn the method, workflow, and tool choices used in ${title}.`}`,
            `Section 3 - Applied Practice: ${practiceTask || `Apply ${title} in a practical scenario with clear reasoning.`}`
          ].join(' ');

      const existingSteps = asArray(moduleItem?.workedExampleSteps).map((step) => String(step || '').trim()).filter(Boolean);
      const normalizedSteps = existingSteps.length
        ? existingSteps
        : [
            `Section 1: Identify the core concept and objective for ${title}.`,
            `Section 2: Apply the method/tool workflow to a guided example.`,
            `Section 3: Validate the result using a quick check or metric.`,
            `Section 4: Summarize what to repeat in a real project setting.`
          ];

      return {
        ...moduleItem,
        lesson: sectionedLesson,
        workedExample: workedExample || `Example application for ${title} in a realistic learning scenario.`,
        workedExampleSteps: normalizedSteps
      };
    });

    return {
      ...baseCourse,
      modules: normalizedModules
    };
  }

  function normalizeCompletedSequence(values, totalModules) {
    const total = Number(totalModules || 0);
    const safeTotal = Number.isInteger(total) && total > 0 ? total : 0;
    if (!safeTotal) return [];

    const set = new Set(asArray(values)
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 0 && n < safeTotal));

    const contiguous = [];
    for (let idx = 0; idx < safeTotal; idx += 1) {
      if (!set.has(idx)) break;
      contiguous.push(idx);
    }
    return contiguous;
  }

  function getCourseProgressStorageKey() {
    const safeTopic = normalizeTopic(topic || 'course');
    return `${COURSE_PROGRESS_PREFIX}${safeTopic}`;
  }

  function loadStoredProgress(totalModules) {
    try {
      const raw = localStorage.getItem(getCourseProgressStorageKey());
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return normalizeCompletedSequence(asArray(parsed), totalModules);
    } catch {
      return [];
    }
  }

  function saveStoredProgress() {
    try {
      const payload = Array.from(progressState.completedModules).sort((a, b) => a - b);
      localStorage.setItem(getCourseProgressStorageKey(), JSON.stringify(payload));
    } catch {
      // Ignore storage failures.
    }
  }

  function clearStoredProgress() {
    try {
      localStorage.removeItem(getCourseProgressStorageKey());
    } catch {
      // Ignore storage failures.
    }
  }

  function buildSubjectTemplateCourse(topicName) {
    const name = normalizeTopic(topicName);
    if (!name) return null;

    const expandLessonToParts = (moduleTitle, objective, lessonText) => {
      const text = String(lessonText || '').trim();
      if (/Part\s*1\s*-/i.test(text)) return text;
      const context = text || objective || 'Understand the core ideas and apply them in practical tasks.';
      const parts = [
        `Part 1 - Foundations: ${context}`,
        `Part 2 - Key Terms: Define essential vocabulary and explain why each concept matters in exam and workplace scenarios.`,
        `Part 3 - Process Flow: Break the topic into step-by-step actions learners can repeat confidently.`,
        `Part 4 - Worked Logic: Connect theory to a practical example and explain each decision made.`,
        `Part 5 - Quality Checks: Identify common quality checks and validation steps before final submission.`,
        `Part 6 - Troubleshooting: Diagnose common mistakes and apply corrective actions quickly.`,
        `Part 7 - Practice Pattern: Use timed practice and reflection to improve speed, accuracy, and confidence.`,
        `Part 8 - Exam and Career Link: Summarize how this module supports certification success and job readiness.`
      ];
      return parts.join(' ');
    };

    const defaultWorkedExampleSteps = (module) => {
      const seed = String(module?.workedExample || module?.objective || 'the task').trim();
      return [
        `Step 1: Clarify the goal, constraints, and success criteria for ${seed}.`,
        'Step 2: Gather the required inputs, tools, and baseline data before execution.',
        'Step 3: Execute the process in a clear sequence and record intermediate results.',
        'Step 4: Validate outputs using checks against expected quality and correctness standards.',
        'Step 5: Fix any gaps found during validation and retest the updated result.',
        'Step 6: Document final outcomes, lessons learned, and next-step improvements.'
      ];
    };

    const defaultModuleQuiz = (module) => {
      const q = String(module?.progressCheckQuestion || 'Which approach is most effective for this module?').trim();
      const opts = asArray(module?.progressCheckOptions);
      const correct = Number.isInteger(module?.correctOptionIndex) ? module.correctOptionIndex : 1;
      const expl = String(module?.progressCheckExplanation || 'Use the method that aligns with the module objective and validation criteria.').trim();
      const fallbackOptions = opts.length === 4
        ? opts
        : ['Skip planning and start immediately', 'Use a structured method with checks and documentation', 'Rely only on memory and avoid verification', 'Focus on speed and ignore quality controls'];
      return [
        { question: q, options: fallbackOptions, correctOptionIndex: correct, explanation: expl },
        { question: `What is the best first step in ${module?.title || 'this module'}?`, options: ['Apply final fixes first', 'Clarify objective, inputs, and constraints before execution', 'Skip requirements and run a quick attempt', 'Only review results at the end'], correctOptionIndex: 1, explanation: 'Strong execution starts with clear scope and required inputs.' },
        { question: `How should quality be handled in ${module?.title || 'this module'}?`, options: ['Quality checks are optional', 'Validate output against clear criteria before finalizing', 'Quality can be inferred without testing', 'Only check if users complain'], correctOptionIndex: 1, explanation: 'Validation prevents preventable errors and improves reliability.' },
        { question: `What improves long-term performance in ${module?.title || 'this module'}?`, options: ['Repeating errors without reflection', 'Documenting lessons learned and refining the workflow', 'Avoiding feedback', 'Changing process randomly each time'], correctOptionIndex: 1, explanation: 'Continuous improvement depends on documented learning and iterative refinement.' }
      ];
    };

    const normalizeModules = (modules) => asArray(modules).map((module, idx) => ({
      ...module,
      hours: Number.isFinite(module?.hours) ? module.hours : 10,
      lesson: expandLessonToParts(module?.title || `Module ${idx + 1}`, module?.objective, module?.lesson),
      workedExampleSteps: asArray(module?.workedExampleSteps).length ? asArray(module.workedExampleSteps) : defaultWorkedExampleSteps(module),
      quizQuestions: asArray(module?.quizQuestions).length ? asArray(module.quizQuestions) : defaultModuleQuiz(module)
    }));

    const normalizeFinalAssessment = (assessment, courseTitle) => {
      const base = asArray(assessment).filter((q) => q && q.question && asArray(q.options).length >= 2);
      if (!base.length) {
        return Array.from({ length: 15 }, (_, i) => ({
          question: `${courseTitle}: mastery check ${i + 1}. Which approach best demonstrates competency?`,
          options: ['Skip process documentation', 'Use structured execution, validation, and reflection', 'Ignore quality checks', 'Avoid stakeholder communication'],
          correctOptionIndex: 1,
          explanation: 'Competency requires process discipline, quality checks, and clear communication.'
        }));
      }
      if (base.length >= 15) return base;
      const expanded = [...base];
      let i = 0;
      while (expanded.length < 15) {
        const src = base[i % base.length];
        expanded.push({
          ...src,
          question: `${src.question} (Scenario ${expanded.length + 1})`
        });
        i += 1;
      }
      return expanded;
    };

    const normalizeInterviewPrep = (prep, courseTitle) => {
      const base = asArray(prep).filter(Boolean);
      if (base.length >= 10) return base;
      const defaults = [
        `Explain the end-to-end workflow for ${courseTitle} and how you validate each stage.`,
        `Describe a common failure scenario in ${courseTitle} and how you would resolve it quickly.`,
        `Walk through the metrics or checks you use to confirm quality outcomes in ${courseTitle}.`,
        `Describe how you communicate progress, risks, and final outcomes to stakeholders.`,
        `Explain how you prioritize tasks when requirements, quality, and timeline constraints conflict.`,
        `Share a practical example of converting theory into a repeatable process in ${courseTitle}.`,
        `Discuss how you document runbooks or procedures so another team member can execute reliably.`,
        `Explain how you would train a junior learner on one critical competency in ${courseTitle}.`,
        `Describe how you would improve an underperforming workflow using root-cause analysis.`,
        `Explain how this course aligns to certification standards and entry-level job expectations.`
      ];
      const out = [...base];
      let i = 0;
      while (out.length < 10) {
        out.push(defaults[i % defaults.length]);
        i += 1;
      }
      return out;
    };

    const buildCourse = (spec) => ({
      courseTitle: spec.courseTitle,
      subtitle: spec.subtitle,
      difficulty: spec.difficulty || 'Intermediate',
      estimatedDuration: spec.estimatedDuration || '6-8 weeks',
      marketDemand: spec.marketDemand,
      overview: spec.overview,
      learningOutcomes: asArray(spec.learningOutcomes),
      resumeSignals: asArray(spec.resumeSignals),
      modules: normalizeModules(spec.modules),
      finalAssessment: normalizeFinalAssessment(spec.finalAssessment, spec.courseTitle || 'Course'),
      interviewPrep: normalizeInterviewPrep(spec.interviewPrep, spec.courseTitle || 'Course')
    });

    if (/ai|machine learning|ml|deep learning|data science|artificial intelligence/i.test(name)) {
      return buildCourse({
        courseTitle: 'AI + Machine Learning',
        subtitle: 'Guided pathway closely aligned to the Stanford and DeepLearning.AI Machine Learning Specialization sequence.',
        difficulty: 'Advanced',
        estimatedDuration: '2 months (10 hrs/week) | ~95 hours total',
        marketDemand: 'AI and machine learning skills are in demand across software, analytics, automation, product, and data teams. Median entry-level ML engineer salary: $169,700 USD.',
        overview: 'This RoleRocket AI pathway is closely aligned to the Stanford and DeepLearning.AI Machine Learning Specialization taught by Andrew Ng — the same ~95-hour curriculum taken by over 4.8 million learners on Coursera.\n\nModule 1 (~22 hrs): Supervised learning foundations, linear regression from scratch, gradient descent, feature scaling, polynomial features, train/val/test splits, and data leakage prevention.\nModule 2 (~11 hrs): Logistic regression, sigmoid, cross-entropy, regularization (L1/L2), confusion matrix, precision, recall, F1, and ROC-AUC.\nModule 3 (~34 hrs): Neural networks with TensorFlow/Keras, activation functions, Adam optimizer, bias-variance diagnosis, ML development best practices, decision trees, random forests, and XGBoost.\nModule 4 (~28 hrs): K-means clustering, anomaly detection, collaborative and content-based filtering, PCA, Q-learning, and deep reinforcement learning.\n\nEach module follows the Stanford teaching sequence: concepts first, worked examples, hands-on coding labs, and mastery quizzes.',
        learningOutcomes: [
          'Implement linear and logistic regression from scratch using gradient descent; build end-to-end scikit-learn pipelines with proper train/val/test splits and data leakage prevention.',
          'Build and train neural networks in TensorFlow/Keras; apply dropout, early stopping, and Adam optimizer; diagnose high bias vs high variance; conduct error analysis.',
          'Implement decision trees, random forests, and XGBoost; tune hyperparameters on validation data; interpret feature importances.',
          'Apply unsupervised learning: K-means clustering, Gaussian anomaly detection, collaborative filtering, PCA, and Q-learning reinforcement learning.'
        ],
        resumeSignals: [
          'Supervised ML: linear regression, logistic regression (scikit-learn, NumPy), regularization (L1/L2), precision/recall/F1/ROC-AUC, cross-validation, data leakage prevention',
          'Neural networks: multi-layer perceptrons (TensorFlow/Keras), ReLU, Adam optimizer, dropout, early stopping, softmax multiclass classification',
          'Ensemble methods: decision trees, random forests, XGBoost; feature importance analysis, hyperparameter tuning (GridSearchCV, XGBoost CV)',
          'Unsupervised learning: K-means (sklearn), Gaussian anomaly detection, collaborative filtering, PCA, Q-learning reinforcement learning'
        ],
        modules: [
          {
            title: 'Linear Regression: Foundations and Single Variables',
            hours: 22,
            objective: 'Build intuition for supervised learning; implement linear regression end-to-end with gradient descent, feature engineering, and evaluation on held-out splits.',
            lesson: 'Part 1 - What is Machine Learning?: Supervised learning (labeled data maps inputs to outputs), unsupervised learning (find structure without labels), and reinforcement learning (agent learns from rewards) defined with real-world examples; terminology: training set, feature (x), label (y), model (f), prediction (y-hat), parameters (w, b). Part 2 - Linear Regression with One Variable: Model f(x) = wx + b; predict house price from square footage; what training means: find w and b that best fit training data; visualizing the fitted line; the running housing price example throughout this module. Part 3 - Cost Function (MSE): Mean squared error J(w,b) = (1/2m) * sum of (f(xi) - yi)^2; why squared error penalizes large mistakes more; visualizing J as a bowl-shaped surface over w and b; training goal = minimize J. Part 4 - Gradient Descent Algorithm: Simultaneously update w and b using partial derivatives of J with respect to w and b; learning rate alpha controls step size; batch gradient descent computes gradients over all m training examples each iteration; why simultaneous update is critical for correctness. Part 5 - Learning Rate and Convergence: Alpha too large causes divergence; alpha too small is correct but very slow; MSE is a convex function so gradient descent finds the global minimum; plot J vs iteration to confirm convergence; overview of stochastic and mini-batch gradient descent. Part 6 - Multiple Linear Regression: Extend to n features: f(x) = w1*x1 + w2*x2 + ... + wn*xn + b; vector notation f(x) = w (dot product) x + b; design matrix X with shape (m, n); NumPy dot products vs explicit loops; vectorization enables fast computation on large datasets. Part 7 - Feature Scaling and Normalization: Features on very different scales cause gradient descent to converge slowly or oscillate; z-score standardization: subtract mean and divide by standard deviation; min-max scaling: rescale to [0,1]; always fit scaler on training data only and apply same transform to val and test. Part 8 - Feature Engineering and Polynomial Regression: Create informative features from existing ones (e.g., area = length * width); polynomial features (x^2, x^3, sqrt(x)) let linear models fit nonlinear patterns; use sklearn PolynomialFeatures + LinearRegression in a Pipeline; high-degree polynomials risk overfitting. Part 9 - Scikit-learn Linear Regression Workflow: LinearRegression().fit(X_train, y_train); .predict(X_val); .coef_ and .intercept_; Pipeline combining StandardScaler and LinearRegression; cross_val_score for robust evaluation; R-squared as a measure of explained variance. Part 10 - Train/Validation/Test Splits and Data Leakage: Three-way split: train set (fit model), validation set (tune hyperparameters), test set (final reported performance — touch only once); standard splits 80/10/10 or 60/20/20; data leakage: fitting transformer on full dataset, using future data, target leakage — all cause falsely optimistic metrics and production failures. Part 11 - Diagnosing Overfitting and Underfitting: High bias: high training error, model too simple (underfit); high variance: low training error but much higher validation error (overfit); learning curves show train and val error vs training set size; fixes for each diagnosis; preview of regularization techniques.',
            workedExample: 'Predict house prices from multiple features; implement gradient descent from scratch; build sklearn Pipeline; tune polynomial degree on validation; diagnose bias vs variance from learning curves.',
            workedExampleSteps: [
              'Part 1: Load a housing dataset; identify features (size, bedrooms, age) and label (price); check for missing values; compute summary statistics.',
              'Part 2: Implement gradient descent from scratch: initialize w=0, b=0; run for 1000 iterations; plot J vs iteration to confirm convergence.',
              'Part 3: Create 80/10/10 train/val/test split; fit StandardScaler on training data only; apply same transform to val and test.',
              'Part 4: Fit sklearn LinearRegression on scaled training data; compare coefficients with your scratch implementation.',
              'Part 5: Compute and report MSE and R-squared on train and validation sets; plot predictions vs actual values.',
              'Part 6: Add PolynomialFeatures (degree=2 and degree=3); refit each; compare val MSE to identify optimal degree.',
              'Part 7: Plot learning curves (train and val MSE vs training set size); diagnose high bias vs high variance.',
              'Part 8: Select best model from validation; report final MSE and R-squared on the test set (only touch once).'
            ],
            commonMistake: 'Fitting scaler on the full dataset before splitting (data leakage); touching the test set more than once during development; not plotting learning curves to diagnose model issues.',
            practiceTask: 'Build an end-to-end linear regression pipeline: load data, split 80/10/10, fit scaler on train only, train model, tune polynomial degree on validation, report final MSE on test.',
            progressCheckQuestion: 'Why do we need a validation set separate from the test set?',
            progressCheckOptions: ['To make training faster', 'To tune hyperparameters without touching the held-out test set', 'To replace the training set when data is scarce', 'To increase model accuracy automatically'],
            correctOptionIndex: 1,
            progressCheckExplanation: 'The validation set lets you tune hyperparameters and detect overfitting while keeping the test set truly unseen — the test result is only meaningful if it has never influenced any decision.',
            colabLink: 'https://colab.research.google.com/github/greyhatguy007/Machine-Learning-Specialization-Coursera/blob/main/C1%20-%20Supervised%20Machine%20Learning%20-%20Regression%20and%20Classification/Week%202/C1W2A1/C1_W2_Linear_Regression.ipynb',
            labTitle: 'Lab: Linear Regression with Gradient Descent (Weeks 1-2)',
            labInstructions: 'Open the notebook. (1) Implement gradient descent from scratch for single-variable linear regression; plot cost function over iterations. (2) Extend to multiple features using NumPy vectorization; compare speed vs loops. (3) Add feature scaling; measure convergence speed with and without. (4) Build sklearn Pipeline; tune polynomial degree via validation MSE. (5) Report final test MSE and R-squared.',
            quizQuestions: [
              { question: 'What does the cost function J(w,b) measure in linear regression?', options: ['How quickly the model trains', 'Average squared error between predictions and actual values', 'Number of input features', 'Model complexity'], correctOptionIndex: 1, explanation: 'MSE quantifies how far predictions deviate from true values; minimizing it is the training objective.' },
              { question: 'What is gradient descent doing during training?', options: ['Splitting data into train/test', 'Iteratively updating w and b to reduce the cost function', 'Evaluating final test performance', 'Scaling input features'], correctOptionIndex: 1, explanation: 'Gradient descent moves parameters in the direction that reduces cost most steeply, iteration by iteration.' },
              { question: 'Training MSE = 0.01, Validation MSE = 3.5. What is the most likely issue?', options: ['Model is underfitting (high bias)', 'Overfitting: large gap between train and val indicates high variance', 'Learning rate is too high', 'Validation set is too small'], correctOptionIndex: 1, explanation: 'Extremely low train error with high val error is the signature of overfitting (high variance).' },
              { question: 'Why must you fit StandardScaler only on the training set?', options: ['Training will be faster', 'Using val/test statistics during fitting leaks information and inflates evaluation metrics', 'Validation data is always already normalized', 'Scalers only accept training data'], correctOptionIndex: 1, explanation: 'Fitting on all data leaks test/val distribution into training — a form of data leakage that gives falsely optimistic results.' },
              { question: 'What does high bias indicate about a model?', options: ['The model is overfitting', 'The model is too simple and underfits — high error even on training data', 'The learning rate needs to decrease', 'Too many features were used'], correctOptionIndex: 1, explanation: 'High bias = high training error = underfitting; the model lacks capacity to learn the underlying pattern.' }
            ]
          },
          {
            title: 'Multiple Variable Regression and Classification',
            hours: 11,
            objective: 'Implement logistic regression for binary classification; apply L1/L2 regularization; evaluate with precision, recall, F1, and ROC-AUC.',
            lesson: 'Part 1 - Motivation for Classification: Why linear regression fails for binary labels — predictions are unbounded and do not represent probabilities; motivating examples: spam detection, cancer diagnosis, fraud detection; the need for a model that outputs values in [0,1]. Part 2 - Logistic Regression Model: Sigmoid function sigma(z) = 1 / (1 + e^-z) maps any real number to (0,1); model output f(x) = sigma(w dot x + b) interpreted as P(y=1 given x); default decision threshold at 0.5. Part 3 - Decision Boundary: The set of points where P(y=1) = 0.5, i.e., where w dot x + b = 0; linear boundaries with linear features; non-linear boundaries possible by adding polynomial features; visualizing with scatter plots colored by predicted class. Part 4 - Logistic Regression Cost Function: MSE cost with sigmoid creates a non-convex surface with many local minima; binary cross-entropy: -[y*log(f) + (1-y)*log(1-f)]; this cost is convex, ensuring gradient descent finds the global minimum; high-confidence wrong predictions incur very high loss. Part 5 - Gradient Descent for Logistic Regression: Partial derivatives of cross-entropy cost w.r.t. w and b have the same form as linear regression but use sigmoid output; vectorized NumPy implementation; same learning rate and convergence considerations apply. Part 6 - Overfitting and Underfitting in Classification: High bias: too simple a boundary that misclassifies many training examples; high variance: decision boundary is highly curved and fits noise; visual examples in 2D; model complexity (polynomial degree) as the capacity lever. Part 7 - Regularization (L1 and L2): L2 Ridge: add lambda * sum(wj^2) to cost; penalizes large weights, shrinking them toward zero but never to zero. L1 Lasso: add lambda * sum(|wj|); drives some weights to exactly zero performing feature selection. Choose lambda via validation grid search; sklearn C parameter = 1/lambda. Part 8 - Classification Evaluation Metrics: Confusion matrix: TP, TN, FP, FN; precision = TP/(TP+FP) (reliability of positive predictions); recall = TP/(TP+FN) (fraction of positives caught); F1 = 2*P*R/(P+R) (harmonic mean); why accuracy misleads: 99% negative data lets an all-negative classifier score 99% accuracy with recall=0. Part 9 - Precision-Recall Tradeoff and Threshold Selection: Raising threshold increases precision and decreases recall; lowering threshold increases recall and decreases precision; ROC curve plots true positive rate vs false positive rate at all thresholds; AUC-ROC summarizes overall discriminative power; choose threshold based on relative cost of FP vs FN in the business context.',
            workedExample: 'Classify customer churn and cancer diagnosis; tune regularization; evaluate with confusion matrix, F1, and ROC-AUC.',
            workedExampleSteps: [
              'Part 1: Load a binary classification dataset; explore class balance; create 80/10/10 split.',
              'Part 2: Implement logistic regression from scratch: sigmoid, cross-entropy loss, gradient computation; run gradient descent for 500 iterations.',
              'Part 3: Fit sklearn LogisticRegression; compare coefficients and val accuracy with scratch implementation.',
              'Part 4: Plot the decision boundary on a 2D feature scatter plot with training points colored by label.',
              'Part 5: Compute confusion matrix, precision, recall, F1-score on validation set.',
              'Part 6: Tune L2 regularization: sweep C from 0.001 to 100; plot val F1 vs C; select best C.',
              'Part 7: Plot ROC curve; compute AUC; select high-recall threshold for a cancer detection use case.',
              'Part 8: Report final precision, recall, F1, and AUC on the test set.'
            ],
            commonMistake: 'Using accuracy as the only metric on imbalanced data; not tuning regularization lambda; applying default threshold 0.5 regardless of business cost of false negatives.',
            practiceTask: 'Fit logistic regression on an imbalanced dataset; tune regularization on validation; report confusion matrix, F1, and ROC-AUC on test.',
            progressCheckQuestion: 'Why is accuracy a poor metric for a dataset where 99% of examples are negative?',
            progressCheckOptions: ['Accuracy is always the best metric', 'A model predicting all-negative achieves 99% accuracy but misses every positive case (recall=0)', 'Accuracy only works for regression problems', 'Precision is always worse than accuracy'],
            correctOptionIndex: 1,
            progressCheckExplanation: 'A naive all-negative classifier scores 99% accuracy on 99% negative data but has recall=0. F1-score and AUC-ROC expose this failure mode.',
            colabLink: 'https://colab.research.google.com/github/greyhatguy007/Machine-Learning-Specialization-Coursera/blob/main/C1%20-%20Supervised%20Machine%20Learning%20-%20Regression%20and%20Classification/Week%203/C1W3A1/C1_W3_Logistic_Regression.ipynb',
            labTitle: 'Lab: Logistic Regression, Regularization, and Classification Evaluation (Week 3)',
            labInstructions: 'Open the notebook. (1) Implement sigmoid and cross-entropy from scratch; run gradient descent. (2) Fit sklearn LogisticRegression with L2; tune C on validation. (3) Generate confusion matrix, precision, recall, F1. (4) Plot ROC curve; compute AUC. (5) Select a high-recall threshold for a cancer detection scenario; justify the choice.',
            quizQuestions: [
              { question: 'What does the sigmoid function output represent in logistic regression?', options: ['A raw prediction score', 'Probability that the label is 1 given input x', 'A feature-scaled value', 'Gradient magnitude for weight update'], correctOptionIndex: 1, explanation: 'sigma(z) in (0,1) is interpreted as P(y=1|x) — the model confidence that the input belongs to the positive class.' },
              { question: 'Why is binary cross-entropy preferred over MSE for logistic regression?', options: ['It is faster to compute', 'Cross-entropy is convex with sigmoid; MSE creates a non-convex cost with local minima', 'MSE requires absolute values', 'There is no real difference in practice'], correctOptionIndex: 1, explanation: 'Non-convex MSE traps gradient descent in local minima; cross-entropy with sigmoid is convex and always finds the global minimum.' },
              { question: 'What does L2 regularization do to model weights in logistic regression?', options: ['Forces all weights to exactly zero', 'Penalizes large weights, shrinking them toward (but not to) zero, reducing overfitting', 'Removes correlated features automatically', 'Increases model capacity to fit complex patterns'], correctOptionIndex: 1, explanation: 'Ridge (L2) adds lambda*sum(wj^2) to cost, discouraging large weights without completely zeroing them out.' },
              { question: 'In a cancer detection model, which type of error is most harmful?', options: ['False positive (flagging a healthy patient as sick)', 'False negative (missing an actual cancer case)', 'Both are equally harmful', 'Neither matters if accuracy is high'], correctOptionIndex: 1, explanation: 'A missed cancer (false negative) can be fatal; we prioritize high recall even at the cost of more false positive follow-ups.' }
            ]
          },
          {
            title: 'Advanced Algorithms: Neural Networks, Trees, and Ensembles',
            hours: 34,
            objective: 'Build and train neural networks in TensorFlow/Keras; implement decision trees, random forests, and XGBoost; apply ML development best practices including error analysis and bias-variance diagnosis.',
            lesson: 'Part 1 - Neural Network Intuition: Biological neuron analogy — dendrites (inputs), cell body (computation), axon (output); artificial neuron: weighted sum of inputs passed through an activation function; deep networks learn hierarchical representations; applications in image recognition, NLP, and recommendations. Part 2 - Neural Network Architecture: Input layer, hidden layers, output layer; each layer l computes a[l] = g(W[l] * a[l-1] + b[l]) where g is the activation; depth (number of layers) and width (neurons per layer); notation for W, b, and activations. Part 3 - TensorFlow and Keras Implementation: Build Sequential([Dense(25, activation="relu"), Dense(15, activation="relu"), Dense(1, activation="sigmoid")]); compile with optimizer="adam" and loss="binary_crossentropy"; train with model.fit; monitor val loss; evaluate and predict. Part 4 - Activation Functions: Sigmoid: maps to (0,1), ideal for binary output, suffers vanishing gradient in deep hidden layers; ReLU: max(0,z), gradient=1 for z>0, default for hidden layers, avoids vanishing gradient; tanh: zero-centered, range (-1,1); Leaky ReLU: small negative slope prevents dying neurons; linear only for regression outputs. Part 5 - Multiclass Classification and Softmax: Output layer with N neurons for N classes; softmax: aj = e^zj / sum(e^zi), all outputs sum to 1; SparseCategoricalCrossentropy loss for integer labels; numerically stable TensorFlow implementation. Part 6 - Neural Network Training Details: Mini-batch gradient descent with batch sizes 32-256; one epoch = one full pass over all batches; Adam optimizer: maintains per-parameter first moment (momentum) and second moment (RMSprop) for adaptive learning rates; dropout: randomly zeros neurons during training to prevent co-adaptation; early stopping on val loss to prevent overfitting. Part 7 - Diagnosing Bias and Variance in Neural Networks: High bias — both train and val error high (underfit): fix with larger network, more epochs, or new architecture. High variance — low train error but much higher val error (overfit): fix with more data, dropout, L2 regularization, or data augmentation. Iterative ML development loop: model -> evaluate -> diagnose -> improve. Part 8 - ML Development Best Practices: Error analysis: manually inspect 20-100 misclassified validation examples; categorize systematic failure modes; prioritize fixes by estimated impact. Data augmentation: expand training set artificially (image flipping/rotation/cropping, text paraphrasing). Transfer learning: initialize from pre-trained weights (ImageNet for vision, BERT for text) and fine-tune. Data-centric AI: improving data quality often outperforms architectural changes. Part 9 - Skewed Datasets and Production Thresholds: Choosing decision threshold on validation to maximize F1, not always 0.5; macro vs micro F1 for multiclass; confusion matrix heatmaps; when AUC-ROC is more informative than accuracy on imbalanced test sets. Part 10 - Decision Trees: Entropy H(p) = -p*log2(p) - (1-p)*log2(1-p) measures node impurity; information gain = parent entropy minus weighted average of children entropy; Gini impurity as an alternative; recursive splitting until stopping criteria; max_depth, min_samples_split, min_impurity_decrease; visualize tree with sklearn plot_tree. Part 11 - Tree Ensembles and Random Forests: Bagging: train each tree on a bootstrap sample (sampling with replacement); predictions by majority vote (classification) or mean (regression); random feature selection at each split (sqrt(n_features)) decorrelates trees; RandomForestClassifier key hyperparameters: n_estimators (100+), max_depth, max_features, min_samples_leaf. Part 12 - XGBoost and Gradient Boosting: Boosting: train trees sequentially, each fitting residuals of the previous ensemble; XGBoost adds L1/L2 regularization, handles missing values natively, uses built-in cross-validation; key hyperparameters: n_estimators, max_depth, learning_rate, subsample; when to prefer XGBoost (usually better on tabular data) vs Random Forest (faster, simpler tuning).',
            workedExample: 'Build logistic regression baseline, neural network, decision tree, random forest, and XGBoost on the same dataset; compare using error analysis on the winner.',
            workedExampleSteps: [
              'Part 1: Load a classification dataset; split 80/10/10; normalize features; fit logistic regression baseline and record val accuracy and F1.',
              'Part 2: Build 2-hidden-layer Keras model (ReLU hidden layers, sigmoid output); train 50 epochs with Adam; plot train/val loss and accuracy.',
              'Part 3: Add Dropout(0.3) and EarlyStopping(patience=5); retrain; compare val accuracy with and without regularization.',
              'Part 4: Run error analysis: print 20 misclassified validation examples; identify systematic patterns (e.g., specific feature ranges, edge cases).',
              'Part 5: Train DecisionTreeClassifier; visualize top 3 splits; sweep max_depth from 2 to 20; plot val F1 vs depth.',
              'Part 6: Train RandomForestClassifier(n_estimators=100); print top 10 feature importances; compare val F1 vs single decision tree.',
              'Part 7: Train XGBClassifier; use xgb.cv to find optimal n_estimators; compare val F1 across all 5 models.',
              'Part 8: Select best model by validation F1; report precision, recall, F1, and AUC on test set; build a comparison table.'
            ],
            commonMistake: 'No dropout or early stopping in neural networks; using default hyperparameters without tuning; skipping error analysis; not comparing multiple model families before choosing.',
            practiceTask: 'Train all 5 models (logreg, NN, decision tree, random forest, XGBoost) on one dataset; tune each on validation; produce a comparison table of test accuracy, F1, and training time.',
            progressCheckQuestion: 'Why does ReLU outperform sigmoid as a hidden-layer activation in deep networks?',
            progressCheckOptions: ['ReLU outputs probabilities like sigmoid', 'ReLU avoids vanishing gradients; sigmoid saturates near 0/1, blocking weight updates in deep layers', 'ReLU requires fewer neurons to work', 'Sigmoid is only for regression output layers'],
            correctOptionIndex: 1,
            progressCheckExplanation: 'Sigmoid saturates (gradient near zero) for large positive or negative inputs, killing gradient flow in deep networks. ReLU = max(0,z) has gradient=1 for positive z, enabling learning across many hidden layers.',
            colabLink: 'https://colab.research.google.com/github/greyhatguy007/Machine-Learning-Specialization-Coursera/blob/main/C2%20-%20Advanced%20Learning%20Algorithms/Week%201/C2W1A1/C2_W1_Assignment.ipynb',
            labTitle: 'Lab: Neural Networks, Decision Trees, and Ensembles (Weeks 1-4, Course 2)',
            labInstructions: 'Open the notebook. (1) Build 2-hidden-layer Keras model; add dropout and early stopping; plot loss curves. (2) Implement softmax output for multiclass; use SparseCategoricalCrossentropy. (3) Train decision tree; sweep max_depth; visualize splits. (4) Train random forest; print feature importances. (5) Train XGBoost with built-in CV. (6) Build a comparison table: test accuracy, F1, training time.',
            quizQuestions: [
              { question: 'What does backpropagation compute in a neural network?', options: ['Forward pass predictions', 'Gradients of the cost function w.r.t. every weight via the chain rule', 'The optimal number of layers', 'The learning rate for each layer'], correctOptionIndex: 1, explanation: 'Backpropagation applies the chain rule from output to input layer, computing dJ/dW at each layer for gradient descent.' },
              { question: 'Why does ReLU outperform sigmoid in hidden layers of deep networks?', options: ['ReLU squashes output to [0,1]', 'ReLU avoids vanishing gradients; sigmoid gradient vanishes near 0 and 1, blocking learning', 'ReLU is required for multiclass output', 'ReLU needs fewer parameters'], correctOptionIndex: 1, explanation: 'ReLU = max(0,z) has gradient=1 for z>0, preventing the vanishing gradient problem that makes sigmoid-based deep nets slow to train.' },
              { question: 'What does max_depth control in a decision tree?', options: ['Number of features used at each split', 'Tree complexity: too large causes overfitting; too small causes underfitting', 'Training speed only', 'Feature importance weighting'], correctOptionIndex: 1, explanation: 'max_depth limits how many splits a tree can make; a deep tree memorizes training noise (overfits); too shallow underfits.' },
              { question: 'Why do random forests outperform individual decision trees?', options: ['Random forests use shallower trees', 'Averaging many independently-trained trees cancels individual errors, reducing overall variance', 'Random forests apply L2 regularization to each tree', 'Fewer hyperparameters to tune'], correctOptionIndex: 1, explanation: 'Each tree overfits its bootstrap sample; averaging across 100+ such trees reduces variance while maintaining low bias.' },
              { question: 'What does the Adam optimizer do differently from standard gradient descent?', options: ['Removes the need for backpropagation', 'Maintains per-parameter adaptive learning rates using momentum and second-moment estimates', 'Eliminates the need for a validation set', 'Uses only random weight initialization'], correctOptionIndex: 1, explanation: 'Adam tracks a running mean (momentum) and variance (RMSprop) of gradients per parameter, adapting each step size individually for faster convergence.' }
            ]
          },
          {
            title: 'Unsupervised Learning, Recommenders, and Reinforcement Learning',
            hours: 28,
            objective: 'Apply K-means and Gaussian anomaly detection; build collaborative and content-based filtering recommenders; implement Q-learning and understand deep reinforcement learning.',
            lesson: 'Part 1 - Unsupervised Learning Overview: No ground-truth labels; goal is to discover structure in unlabeled data; contrast with supervised learning; applications: customer segmentation, server anomaly detection, data compression, content recommendation. Part 2 - K-Means Clustering Algorithm: Randomly initialize K centroids; assign each point to its nearest centroid by Euclidean distance; recompute each centroid as the mean of assigned points; iterate until assignments no longer change; cost function is distortion J = (1/m)*sum(||xi - mu_c(i)||^2). Part 3 - K-Means in Practice: Choosing K: elbow method (plot J vs K, find the inflection point); silhouette score (measures cohesion and separation); random restarts (run 50-100 times, keep lowest J); K-means++ for smarter initialization; limitations: fails on non-convex or ring-shaped clusters. Part 4 - Anomaly Detection with Gaussian Model: Fit Gaussian to each feature: mu = (1/m)*sum(xi), sigma^2 = (1/m)*sum((xi-mu)^2); anomaly score p(x) = product over features of p(xj; muj, sigmaj^2); flag as anomaly if p(x) < epsilon; tune epsilon by maximizing F1 on a small labeled validation set. Part 5 - Anomaly Detection vs Supervised Learning: Use anomaly detection when: very few positive examples available, future anomalies may look very different from training examples; use supervised classification when: large balanced labeled dataset and anomaly types are well-known and consistent. Part 6 - Recommender Systems Intuition: Problem setup: m users, n items, sparse rating matrix; goal: predict missing entries; evaluation: RMSE on held-out ratings; content-based filtering uses item features; collaborative filtering learns from user-item interaction patterns; cold start problem for new users and items. Part 7 - Collaborative Filtering: User parameters (w_u, b_u) and item parameters x_i; predicted rating = w_u dot x_i + b_u; minimize joint cost function over all user and item parameters simultaneously using gradient descent; regularization prevents overfitting; mean normalization: subtract per-user mean rating so new users receive average predictions. Part 8 - Content-Based Filtering with Deep Learning: User network outputs a user embedding of size k; item network outputs an item embedding of size k; predicted rating = dot(user_embedding, item_embedding); both networks trained jointly; production pipeline: fast retrieval (approximate nearest neighbor) followed by full-model ranking. Part 9 - Principal Component Analysis (PCA): Motivation: reduce dimensionality for visualization, compression, or speeding up downstream models; PCA finds orthogonal principal components in directions of maximum variance; explained variance ratio per component; choose n_components retaining 95% variance; sklearn PCA(n_components=k); use 2D projection for visualization. Part 10 - Reinforcement Learning Fundamentals: Agent, environment, state s, action a, reward R(s); return G = R1 + gamma*R2 + gamma^2*R3 + ... (discounted future rewards); discount factor gamma in [0,1] controls far-sightedness; policy pi(s) maps state to action; state-action value Q(s,a) = expected return starting from s, taking action a, then following policy. Part 11 - Bellman Equation and Q-Learning: Bellman: Q(s,a) = R(s) + gamma * max over a-prime of Q(s-prime, a-prime); Q-learning update rule via temporal difference; epsilon-greedy: with probability epsilon choose random action (explore), else argmax Q (exploit); tabular Q-learning for discrete state spaces. Part 12 - Deep Q-Networks (DQN): Neural network approximates Q(s,a; theta) for large or continuous state spaces; experience replay: store (s,a,r,s-prime) in buffer, sample random mini-batches to break correlations; target network: frozen copy of Q updated every N steps to stabilize training; applying DQN to the lunar lander environment with 8-dimensional continuous state and 4 discrete actions.',
            workedExample: 'Segment customers with K-means; detect fraud with anomaly detection; build a movie recommender; visualize with PCA; train a Q-learning agent on a grid world.',
            workedExampleSteps: [
              'Part 1: Load a customer dataset; scale all features; apply K-means for K=2 through K=8; plot elbow curve and compute silhouette scores.',
              'Part 2: Select optimal K; visualize clusters in 2D using PCA projection; print centroid feature means; interpret each cluster segment.',
              'Part 3: Fit Gaussian anomaly detector on normal training transactions; tune epsilon on labeled val anomalies using F1; report test precision, recall, F1.',
              'Part 4: Load a movie rating matrix; implement collaborative filtering cost function and gradients from scratch using NumPy.',
              'Part 5: Add mean normalization; run gradient descent; generate top-5 recommendations for a test user; compute RMSE.',
              'Part 6: Apply sklearn PCA to a high-dimensional dataset; plot explained variance ratio; visualize first 2 components with class labels.',
              'Part 7: Implement epsilon-greedy Q-learning on a 4x4 grid world; train 5000 episodes; plot cumulative reward per episode.',
              'Part 8: Compare greedy (epsilon=0) vs epsilon-greedy (epsilon=0.1) agent; visualize learned Q-values as a heatmap on the grid.'
            ],
            commonMistake: 'Not scaling features before K-means (distance-based, scale-sensitive); epsilon too small in Q-learning (agent never explores); ignoring cold start for new users; fitting PCA on full dataset instead of training data only.',
            practiceTask: 'Apply K-means; build anomaly detector; implement collaborative filtering; train Q-learning agent. Report: silhouette score, anomaly F1, recommender RMSE, RL reward convergence curve.',
            progressCheckQuestion: 'What is the cold start problem in collaborative filtering?',
            progressCheckOptions: ['The algorithm takes a long time to initialize centroids', 'New users or items have no rating history, so the model cannot generate useful recommendations for them', 'Q-learning needs warm initialization of the Q-table', 'Large item catalogs cause memory overflow at startup'],
            correctOptionIndex: 1,
            progressCheckExplanation: 'Collaborative filtering is powered by past interactions. A new user has no rating history, so the algorithm has nothing to base recommendations on. Solutions include content-based fallback or asking for initial preferences.',
            colabLink: 'https://colab.research.google.com/github/greyhatguy007/Machine-Learning-Specialization-Coursera/blob/main/C3%20-%20Unsupervised%20Learning%2C%20Recommenders%2C%20Reinforcement%20Learning/Week%201/C3W1A1/C3_W1_KMeans_Assignment.ipynb',
            labTitle: 'Lab: K-Means, Anomaly Detection, Collaborative Filtering, PCA, and Q-Learning (Weeks 1-3, Course 3)',
            labInstructions: 'Open the notebook. (1) Implement K-means from scratch; use elbow and silhouette to choose K; visualize clusters. (2) Fit Gaussian anomaly detector; tune epsilon on validation; report precision/recall/F1. (3) Implement collaborative filtering gradient descent; add regularization; evaluate RMSE; apply mean normalization. (4) Apply PCA; plot explained variance; project to 2D. (5) Implement Q-learning with epsilon-greedy exploration; plot reward convergence.',
            quizQuestions: [
              { question: 'What does the elbow method help determine for K-means?', options: ['Total training samples needed', 'Optimal number of clusters K: the point where adding more K gives diminishing reduction in distortion', 'Learning rate for centroid updates', 'Anomaly detection threshold epsilon'], correctOptionIndex: 1, explanation: 'The elbow is the inflection point in the distortion-vs-K plot — beyond it, more clusters yield diminishing improvements.' },
              { question: 'Why must features be scaled before K-means clustering?', options: ['K-means requires integer-valued inputs', 'K-means uses Euclidean distance; features on larger scales dominate and bias cluster assignments', 'Scaling is optional for unsupervised learning', 'K-means assumes all features are normally distributed'], correctOptionIndex: 1, explanation: 'Without scaling, a feature measured in thousands (e.g., income) dominates over a feature in tens (e.g., number of purchases), corrupting the clustering.' },
              { question: 'In the Bellman equation, what does a discount factor gamma close to 1 mean?', options: ['The agent ignores future rewards', 'Future rewards are valued nearly as much as immediate ones — the agent plans for the long term', 'Training converges faster', 'The agent increases exploration probability'], correctOptionIndex: 1, explanation: 'gamma near 1 weights future rewards almost as heavily as immediate ones, producing far-sighted long-term planning behavior.' },
              { question: 'How does content-based filtering differ from collaborative filtering?', options: ['Content-based requires ratings from similar users', 'Content-based uses item and user features to compute similarity without needing other users rating history', 'Content-based only works for text items', 'They are the same method with different names'], correctOptionIndex: 1, explanation: 'Content-based uses item features (genre, description) and user preference profiles, enabling recommendations for new items with no ratings — solving the item cold start problem.' }
            ]
          }
        ],
        finalAssessment: [
          { question: 'What does gradient descent do during linear regression training?', options: ['Splits data into train and test', 'Iteratively updates w and b to minimize the cost function J', 'Scales input features', 'Reports final test accuracy'], correctOptionIndex: 1, explanation: 'Gradient descent moves parameters in the direction of steepest cost decrease each iteration until J converges.' },
          { question: 'Why must you fit StandardScaler only on training data?', options: ['Training is faster', 'Fitting on all data leaks val/test statistics into training, inflating metrics (data leakage)', 'Validation data is always pre-normalized', 'Scalers only accept training data'], correctOptionIndex: 1, explanation: 'Using test/val statistics contaminates training with future information — a classic data leakage that makes production performance worse than reported.' },
          { question: 'Training MSE = 0.005, Validation MSE = 4.1. What is the diagnosis?', options: ['Underfitting (high bias)', 'Overfitting (high variance): very low train error, much higher val error', 'The model is optimal', 'Validation set is incorrectly labeled'], correctOptionIndex: 1, explanation: 'A large gap between train and val error is the signature of high variance / overfitting.' },
          { question: 'Why is binary cross-entropy preferred over MSE for logistic regression?', options: ['Faster to compute on GPU', 'Cross-entropy is convex with sigmoid; MSE creates a non-convex cost with local minima', 'MSE relies on absolute values', 'They produce identical results in practice'], correctOptionIndex: 1, explanation: 'Non-convex MSE traps gradient descent in local minima; cross-entropy guarantees the global minimum via gradient descent.' },
          { question: 'In cancer detection, which error type should be minimized most aggressively?', options: ['False positive (flagging a healthy patient)', 'False negative (missing actual cancer)', 'Both are equally important', 'Neither matters if accuracy is high'], correctOptionIndex: 1, explanation: 'Missing cancer (false negative) can be fatal; models for critical detection prioritize recall even at the cost of more false positives.' },
          { question: 'What does L2 regularization do to logistic regression weights?', options: ['Forces all weights to exactly zero', 'Penalizes large weights, shrinking them toward zero and reducing overfitting', 'Adds more features to improve fit', 'Increases model capacity'], correctOptionIndex: 1, explanation: 'Ridge adds lambda*sum(wj^2) to cost; large weights become expensive, so the optimizer shrinks them for better generalization.' },
          { question: 'What does backpropagation compute in a neural network?', options: ['The forward pass predictions', 'Gradients of cost w.r.t. all weights via the chain rule', 'Optimal number of layers', 'The learning rate value'], correctOptionIndex: 1, explanation: 'Backpropagation applies the chain rule layer-by-layer to compute dJ/dW at every layer — these gradients drive weight updates.' },
          { question: 'Why does ReLU outperform sigmoid in deep network hidden layers?', options: ['ReLU outputs class probabilities', 'ReLU avoids vanishing gradients; sigmoid saturates near 0/1, blocking gradient flow', 'ReLU needs fewer neurons', 'Sigmoid is only for regression outputs'], correctOptionIndex: 1, explanation: 'ReLU = max(0,z) has gradient=1 for z>0; sigmoid gradient approaches zero at extremes, making deep sigmoid nets very slow to train.' },
          { question: 'What happens when a decision tree is grown with no depth limit?', options: ['It underfits and performs poorly', 'It memorizes training noise — perfect train accuracy but poor generalization', 'Training stops automatically at convergence', 'Feature importances become unreliable'], correctOptionIndex: 1, explanation: 'An unlimited tree grows until one leaf per training example, achieving perfect train accuracy but near-zero generalization.' },
          { question: 'Why do random forests typically outperform individual decision trees?', options: ['Random forests use simpler trees', 'Averaging many independently-trained trees cancels individual errors, reducing variance', 'Random forests apply L2 regularization to each tree', 'Fewer hyperparameters need tuning'], correctOptionIndex: 1, explanation: 'Each tree overfits its bootstrap sample; averaging across 100+ trees reduces variance while preserving low bias.' },
          { question: 'What advantage does Adam optimizer have over standard gradient descent?', options: ['Eliminates backpropagation', 'Adapts learning rate per parameter using momentum and second-moment estimates, converging faster', 'Reduces model size by pruning layers', 'Removes need for a validation set'], correctOptionIndex: 1, explanation: 'Adam maintains per-parameter adaptive rates (momentum + RMSprop), converging faster and more robustly than fixed-rate gradient descent.' },
          { question: 'Why must features be scaled before K-means clustering?', options: ['K-means only accepts binary features', 'K-means uses Euclidean distance; unscaled large-range features dominate cluster assignments', 'Scaling is only needed for supervised methods', 'K-means converges faster without scaling'], correctOptionIndex: 1, explanation: 'Unscaled features bias Euclidean distance toward high-magnitude dimensions, corrupting cluster assignments.' },
          { question: 'What is the cold start problem in collaborative filtering?', options: ['System takes time to load the model', 'New users or items have no interaction history, making personalized recommendations impossible without fallback', 'Algorithm needs warm weight initialization', 'Large catalogs cause memory overflow'], correctOptionIndex: 1, explanation: 'Collaborative filtering needs past interactions. New users have none, requiring content-based filtering or preference elicitation as fallback.' },
          { question: 'In Q-learning, what does a discount factor gamma close to 1 produce?', options: ['Agent ignores all future rewards', 'Far-sighted agent that values long-term returns nearly as much as immediate reward', 'Faster training convergence', 'Greater random exploration'], correctOptionIndex: 1, explanation: 'gamma near 1 makes return G weight future rewards almost as heavily as immediate ones, producing long-term planning.' },
          { question: 'When should you prefer anomaly detection over supervised binary classification?', options: ['When you have thousands of labeled anomaly examples', 'When positive examples are very rare and future anomalies may differ from known ones', 'When the dataset is perfectly balanced', 'When neural networks are not feasible'], correctOptionIndex: 1, explanation: 'Anomaly detection models normal behavior from abundant normal examples and generalizes to unseen anomaly types without requiring many labeled anomalies.' }
        ],
        interviewPrep: [
          'Implement linear regression from scratch: describe the cost function (MSE), gradient descent update rule, learning rate, and convergence; explain train/val/test splits and define data leakage with a concrete example.',
          'Implement logistic regression: explain sigmoid, binary cross-entropy, gradient descent for logistic loss, and decision boundary; compare L1 vs L2 regularization; explain precision, recall, F1, and ROC-AUC.',
          'Explain the bias-variance tradeoff: define high bias (underfitting) and high variance (overfitting); show how to diagnose each from learning curves; describe the specific fix for each.',
          'Walk through a neural network end-to-end: forward propagation, activation functions (ReLU vs sigmoid in hidden layers, sigmoid vs softmax for output), backpropagation via chain rule, Adam optimizer, dropout, and early stopping.',
          'Compare decision trees, random forests, and XGBoost: explain entropy and information gain; describe bagging vs boosting; discuss when you would choose each algorithm; describe your hyperparameter tuning process.',
          'Explain the full ML development cycle: describe the iterate-train-evaluate-diagnose-improve loop; define error analysis; explain data augmentation and transfer learning; describe how to handle skewed datasets in production.',
          'Describe K-means clustering step by step: initialization, assignment, update, convergence; explain how to choose K using elbow and silhouette; contrast with anomaly detection and explain when to use each.',
          'Explain collaborative filtering: describe the joint cost function over user and item parameters, gradient descent, mean normalization for new users, and the cold start problem; contrast with content-based filtering.',
          'Describe PCA: explain what it computes, how to choose the number of components using explained variance, and when you would apply dimensionality reduction before modeling.',
          'Walk through the reinforcement learning framework: agent-environment loop, state, action, reward, return, discount factor, Q-function, Bellman equation, epsilon-greedy exploration; explain experience replay and target networks in DQN.'
        ]
      });
    }

  if (/project.manag/i.test(name)) {
    return buildCourse({
      courseTitle: 'Project Management',
      subtitle: 'Aligned to the PMI CAPM certification and PMBOK 7th edition — the global standard trusted by over 1 million certified professionals.',
      difficulty: 'Intermediate',
      estimatedDuration: '2 months (8 hrs/week) | ~60 hours total',
      marketDemand: 'PMI projects 25 million new PM professionals needed by 2030. CAPM/PMP-certified managers earn 22% more than peers. Median PM salary: $98,580 USD.',
      overview: 'This pathway aligns to the PMI CAPM certification and PMBOK 7th edition.\n\nModule 1 (~14 hrs): Initiation, PMBOK 7 principles, stakeholder analysis, project charter, and WBS.\nModule 2 (~16 hrs): Schedule planning (CPM), EVM, risk management, and cost baseline.\nModule 3 (~18 hrs): Execution, quality management, change control, and monitoring.\nModule 4 (~12 hrs): Agile delivery, hybrid PM, lessons learned, and formal project closure.',
      learningOutcomes: [
        'Create a project charter, WBS, and scope baseline from a project brief.',
        'Build a CPM schedule, identify the critical path, and calculate total float.',
        'Monitor project health using EVM metrics: SPI, CPI, EAC, and TCPI.',
        'Identify, analyze, and respond to project risks using qualitative and quantitative methods.',
        'Manage quality, change control, and stakeholder engagement throughout execution.',
        'Apply agile, predictive, and hybrid delivery approaches based on project context.'
      ],
      resumeSignals: [
        'PMI CAPM Certification (in progress or earned)',
        'Developed WBS and project charter for cross-functional initiative',
        'Tracked project health using EVM — delivered on scope, schedule, and budget',
        'Managed stakeholder register and communication plan for multi-department team',
        'Applied risk register with response strategies, reducing project variance by 30%'
      ],
      modules: [
        {
          title: 'Project Initiation and Foundations',
          objective: 'Define a project, apply PMBOK 7 principles, develop a project charter, identify stakeholders, and create a WBS.',
          hours: 14,
          lesson: 'Part 1 - What Is a Project: A project is a temporary endeavor to create a unique product, service, or result with a defined beginning and end; it is distinct from ongoing operations; project management applies knowledge, skills, tools, and techniques to meet project requirements within constraints of scope, schedule, cost, and quality. Part 2 - PMBOK 7 Performance Domains: PMBOK 7 defines eight performance domains covering stakeholders, team, development approach and lifecycle, planning, project work, delivery, measurement, and uncertainty; they replace the PMBOK 6 process-group model with a principles-based framework applicable to predictive and agile projects alike. Part 3 - PMBOK 7 Principles: Twelve principles guide all project decisions: stewardship, collaborative team, stakeholders, value, systems thinking, leadership, tailoring, quality, complexity, risk, adaptability, and enabling change; they form the ethical and behavioral foundation for project management practice. Part 4 - Project Charter: The charter formally authorizes the project and names the project manager; it contains SMART objectives, high-level requirements, milestones, budget summary, constraints, assumptions, and the initial stakeholder list; the sponsor approves the charter granting the PM authority to apply resources. Part 5 - Stakeholder Identification: Stakeholders include anyone who may affect or be affected by the project; the stakeholder register captures name, role, interest, influence, and engagement level; the power/interest grid maps each stakeholder to guide communication frequency and engagement approach. Part 6 - Scope and WBS: The WBS decomposes total project scope into work packages using the 100% rule — every deliverable appears exactly once; the WBS dictionary describes each component with owner, duration, and acceptance criteria; the approved WBS plus the scope statement forms the scope baseline. Part 7 - Organizational Structures: Functional, matrix (weak/balanced/strong), and projectized organizations differ in PM authority; in a strong matrix the PM controls resources; in a functional organization the PM acts more as a coordinator; the PM must adapt leadership style to the authority level the structure provides. Part 8 - PMI Ethics and Talent Triangle: The PMI Code of Ethics covers responsibility, respect, fairness, and honesty; the PM Talent Triangle spans technical PM skills, leadership, and strategic/business management; cultural awareness and managing conflicts of interest are core professional responsibilities for every project manager.',
          workedExample: 'Build a charter and WBS for a digital employee onboarding system: SMART objectives, stakeholder grid, WBS to level 3, and WBS dictionary entry.',
          workedExampleSteps: [
            'Step 1: Write SMART objective — "Deliver digital onboarding portal by Q3, reducing time-to-productivity by 30%."',
            'Step 2: List deliverables: system design, backend development, frontend UI, user testing, training materials, go-live.',
            'Step 3: Build stakeholder register; map HR director (High Power/High Interest), IT lead, and compliance to power/interest grid.',
            'Step 4: WBS Level 1: 1.0 Project Management, 2.0 Design, 3.0 Development, 4.0 Testing, 5.0 Deployment.',
            'Step 5: Decompose Level 2: 3.0 Development = 3.1 Backend API, 3.2 Frontend UI, 3.3 Database Schema, 3.4 Integration.',
            'Step 6: Write WBS dictionary for 3.1 — description, owner, due date, deliverable, and acceptance criteria.',
            'Step 7: Document constraints ($50k budget, Q3 deadline) and assumptions (IT team full-time availability).',
            'Step 8: Draft charter sign-off section with sponsor approval line and explicit PM authority statement.'
          ],
          commonMistake: 'Confusing product scope (features of the deliverable) with project scope (work needed to produce it); omitting exclusions from the scope statement opens the door to scope creep disputes later.',
          practiceTask: 'Choose a real or hypothetical project. Write a 1-page charter with SMART objectives, 3 deliverables, stakeholder power/interest grid, and WBS to level 2.',
          progressCheckQuestion: 'Which document formally authorizes a project and grants the PM authority over resources?',
          progressCheckOptions: ['Project management plan', 'Stakeholder register', 'Project charter', 'WBS dictionary'],
          correctOptionIndex: 2,
          progressCheckExplanation: 'The project charter is the initiating document that formally sanctions the project and explicitly names the project manager, granting authority to apply organizational resources.',
          quizQuestions: [
            { question: 'The 100% rule in WBS means:', options: ['All resources work 100% of the time', 'WBS captures 100% of project scope with no omissions or duplications', 'Budget is fully allocated at project start', 'Critical path activities use 100% of resources'], correctOptionIndex: 1, explanation: 'Every deliverable must appear exactly once in the WBS — no scope gaps and no duplication.' },
            { question: 'In a strong matrix organization:', options: ['Functional manager has the most authority', 'Project manager has more authority than the functional manager', 'Both share exactly equal authority', 'The sponsor holds all day-to-day authority'], correctOptionIndex: 1, explanation: 'In a strong matrix the PM controls resources and decisions; a weak matrix gives that authority to the functional manager.' },
            { question: 'Which PMBOK 7 performance domain covers project delivery approach?', options: ['Measurement', 'Delivery', 'Development approach and lifecycle', 'Project work'], correctOptionIndex: 2, explanation: 'The development approach and lifecycle domain covers whether the project uses predictive, iterative, agile, or hybrid methods.' },
            { question: 'PMI Talent Triangle covers:', options: ['Scope, schedule, cost management', 'Technical PM, leadership, and strategic/business skills', 'Risk, quality, and communication', 'Initiation, planning, and closing'], correctOptionIndex: 1, explanation: 'The PMI Talent Triangle spans technical project management skills, leadership, and strategic business management.' }
          ]
        },
        {
          title: 'Project Planning',
          objective: 'Build a CPM schedule, calculate critical path and float, apply EVM cost and schedule metrics, and develop a risk register with response plans.',
          hours: 16,
          lesson: 'Part 1 - Schedule Management: Activity definition lists all tasks; activity sequencing uses the Precedence Diagramming Method with four dependency types: finish-to-start (most common), start-to-start, finish-to-finish, and start-to-finish; leads allow tasks to overlap; lags introduce deliberate delays between activities. Part 2 - Duration Estimation: Analogous estimating uses historical data from similar projects; parametric estimating applies statistical unit rates; three-point PERT uses optimistic O, most likely M, and pessimistic P: Expected = (O+4M+P)/6; standard deviation = (P-O)/6; three-point estimates reduce single-point anchoring bias. Part 3 - Critical Path Method: Forward pass calculates early start and early finish from left to right; backward pass calculates late start and late finish from right to left; total float = LS minus ES; the critical path is the longest path through the network with zero float; any delay on the critical path equals a project delay. Part 4 - Schedule Compression: Crashing adds resources to critical path activities to shorten duration at added cost; fast-tracking overlaps sequential activities, increasing rework risk; both techniques apply only to critical path activities; schedule reserve protects against uncertainty on near-critical paths. Part 5 - Cost Management: Bottom-up estimating aggregates work package costs upward through the WBS; the cost baseline excludes management reserve; contingency reserve covers identified risks; management reserve covers unknown unknowns; funding limit reconciliation aligns spending with fund availability. Part 6 - Earned Value Management: Planned value PV is the budgeted cost of scheduled work; earned value EV is the budgeted cost of work performed; actual cost AC is actual costs incurred; SV=EV-PV; CV=EV-AC; SPI=EV/PV; CPI=EV/AC; values above 1.0 are favorable; EAC=BAC/CPI forecasts total project cost. Part 7 - Risk Identification: Risk register captures description, category, cause, and potential impact; brainstorming, SWOT analysis, and assumption analysis aid identification; risks include both threats (negative) and opportunities (positive); the risk register is a living document updated throughout the project. Part 8 - Risk Responses: Threat responses are avoid, transfer, mitigate, and accept; opportunity responses are exploit, share, enhance, and accept; residual risks remain after response; secondary risks arise from the risk response itself; risk response owners are assigned and tracked in the risk register.',
          workedExample: 'Build a 6-activity schedule, find the critical path, perform a mid-project EVM analysis, and create a risk register entry with response.',
          workedExampleSteps: [
            'Step 1: Define activities A(3d), B(5d,dep A), C(4d,dep A), D(2d,dep B), E(6d,dep B+C), F(3d,dep D+E). Draw network.',
            'Step 2: Forward pass — A(0-3), B(3-8), C(3-7), D(8-10), E(8-14), F(14-17). Project duration = 17 days.',
            'Step 3: Backward pass — F(14-17), E(8-14), D(12-14) float=2, C(4-8) float=1, B(3-8) float=0, A(0-3) float=0.',
            'Step 4: Critical path = A > B > E > F (zero float). D and C have float and can slip without delaying the project.',
            'Step 5: Mid-project EVM — PV=$40k, EV=$34k, AC=$38k. SV=-$6k (behind). CV=-$4k (over). SPI=0.85. CPI=0.89.',
            'Step 6: EAC = BAC/CPI = $100k/0.89 = $112.4k. TCPI = (100-34)/(100-38) = 66/62 = 1.06.',
            'Step 7: Risk entry: "Key developer resigns." Probability: Medium. Impact: High. Priority score: High.',
            'Step 8: Response: Mitigate — cross-train a backup developer on critical modules now. Contingency: 5-day schedule buffer.'
          ],
          commonMistake: 'Confusing SPI and CPI — SPI=EV/PV measures schedule efficiency; CPI=EV/AC measures cost efficiency. A project can be ahead of schedule and simultaneously over budget.',
          practiceTask: 'Create a 6-activity network diagram, calculate all ES/EF/LS/LF values, identify critical path and float, then compute SPI and CPI from sample EVM data. Write 3 risks with responses.',
          progressCheckQuestion: 'A project has CPI = 0.85. What does this indicate?',
          progressCheckOptions: ['Project is 15% ahead of schedule', 'Over budget — only $0.85 of value delivered per $1 spent', 'Schedule is 85% complete', 'Risk impact scores average 85%'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'CPI = EV/AC. Below 1.0 means actual cost exceeds earned value — the project is spending more than the value being delivered.',
          quizQuestions: [
            { question: 'Total float for an activity means:', options: ['Total project duration', 'Amount of time the activity can be delayed without delaying the project end', 'Sum of all activity durations', 'Time saved by crashing the schedule'], correctOptionIndex: 1, explanation: 'Float = LS-ES. Zero float indicates a critical path activity — any delay here delays the whole project.' },
            { question: 'Fast-tracking a project schedule:', options: ['Adds resources to shorten critical tasks', 'Overlaps sequential activities, increasing rework risk', 'Removes low-priority scope', 'Extends the deadline to reduce cost'], correctOptionIndex: 1, explanation: 'Fast-tracking performs tasks in parallel that were originally sequential — it is faster but riskier due to potential rework.' },
            { question: 'Risk transfer as a strategy means:', options: ['Eliminating the risk entirely', 'Shifting the financial impact to a third party such as an insurer or subcontractor', 'Accepting the risk without taking action', 'Reducing the probability of occurrence'], correctOptionIndex: 1, explanation: 'Transfer shifts the financial consequence to another party through insurance or outsourcing; the risk itself is not eliminated.' },
            { question: 'PERT expected duration formula is:', options: ['(O+M+P)/3', '(O+4M+P)/6', 'O+4M+P divided by 3', '(O+3M+P)/5'], correctOptionIndex: 1, explanation: 'PERT weights the most likely estimate four times to reduce the influence of extreme optimistic or pessimistic estimates.' }
          ]
        },
        {
          title: 'Executing, Monitoring, and Controlling',
          objective: 'Direct project work, manage quality and change control, track EVM performance, and engage stakeholders throughout execution.',
          hours: 18,
          lesson: 'Part 1 - Direct and Manage Project Work: Execution coordinates people and resources to produce deliverables according to the project management plan; work performance data is collected throughout; issues are logged and resolved; change requests are submitted; lessons learned are captured continuously rather than only at closure. Part 2 - Quality Management: Quality planning defines metrics, measurement methods, and acceptance criteria; quality assurance audits processes proactively to ensure standards are being followed; quality control inspects deliverables reactively against metrics; cost of quality includes prevention costs, appraisal costs, and failure costs both internal and external. Part 3 - Quality Control Tools: Seven basic tools — cause-and-effect (Ishikawa) diagrams identify root causes; control charts monitor process variation over time using upper and lower control limits; Pareto charts apply the 80/20 rule; histograms show frequency distribution; scatter diagrams show correlation; check sheets collect structured data; flowcharts map processes end to end. Part 4 - Integrated Change Control: All change requests are reviewed by the change control board for impact on scope, schedule, cost, quality, resources, and risk; approved changes update baselines; the change log records every request, evaluation, decision, and rationale throughout the project lifecycle. Part 5 - Monitoring Performance: Variance analysis compares actual vs planned performance; trend analysis forecasts future performance; EVM objectively tracks schedule and cost simultaneously; corrective actions address current deviations; preventive actions reduce the likelihood of future negative events; defect repair corrects non-conforming deliverables. Part 6 - Scope Control: Scope creep is uncontrolled scope additions without formal change requests; gold plating adds unrequested features; both are prevented by rigorous change control discipline; scope validation involves formal stakeholder acceptance of completed deliverables at defined checkpoints. Part 7 - Team Management: Tuckman model stages — forming, storming, norming, performing, adjourning; PMI preferred conflict resolution order: collaborate first, then compromise, accommodate, force, and withdraw; motivation theories include Maslow hierarchy of needs, Herzberg two-factor, and McGregor Theory X versus Theory Y. Part 8 - Procurement Execution: Monitor seller performance against the statement of work; process payments; administer contract changes through formal change control; maintain complete records; procurement audits assess effectiveness; disputes are resolved per contract terms; formal written notice is required to close a contract.',
          workedExample: 'Monitor a project at 60% planned completion using EVM, process a scope change through the CCB, and conduct a root cause analysis with an Ishikawa diagram.',
          workedExampleSteps: [
            'Step 1: EVM check — PV=$60k, EV=$54k, AC=$62k. SV=-$6k (behind schedule). CV=-$8k (over budget). SPI=0.9. CPI=0.87.',
            'Step 2: EAC = BAC/CPI = $100k/0.87 = $114.9k. TCPI = (100-54)/(100-62) = 46/38 = 1.21.',
            'Step 3: Client requests new reporting dashboard mid-project. Submit formal change request to the CCB.',
            'Step 4: CCB impact assessment: +3 days to schedule, +$4k to cost. CCB approves. Update schedule baseline, cost baseline, and change log.',
            'Step 5: Quality defect found: 15% of API responses failing validation checks. Draw Ishikawa diagram.',
            'Step 6: Root cause: missing input validation in the API layer. Corrective action: add validation middleware to all endpoints.',
            'Step 7: Preventive action: update the code review checklist to require input validation review before merging any API code.',
            'Step 8: Update risk register — approved scope change creates new schedule risk. Add 2-day contingency buffer on the integration phase.'
          ],
          commonMistake: 'Confusing corrective and preventive actions — corrective actions address deviations that have already occurred; preventive actions are implemented before problems occur to reduce the probability of future variance.',
          practiceTask: 'Given PV=$80k, EV=$68k, AC=$75k, BAC=$200k: calculate SV, CV, SPI, CPI, and EAC. Write one corrective and one preventive action. Build a 5-step CCB checklist for processing a scope change request.',
          progressCheckQuestion: 'What is the primary purpose of integrated change control?',
          progressCheckOptions: ['Auto-approve all stakeholder requests', 'Assess every change for impact before approving, rejecting, or deferring it', 'Document lessons learned at project closure', 'Assign resources to new project activities'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'Integrated change control ensures every change is formally evaluated for its impact on scope, schedule, cost, and quality before approval — protecting all project baselines.',
          quizQuestions: [
            { question: 'Which quality tool uses the 80/20 rule to focus improvement effort?', options: ['Control chart', 'Pareto chart', 'Scatter diagram', 'Ishikawa diagram'], correctOptionIndex: 1, explanation: 'Pareto charts identify the vital few causes producing most defects, directing quality improvement where it has the most impact.' },
            { question: 'Gold plating in project management means:', options: ['Using premium-certified vendors', 'Adding unrequested features or enhancements beyond agreed scope', 'Exceeding quality metrics by 20%', 'Applying a gold-tier pricing contract'], correctOptionIndex: 1, explanation: 'Gold plating wastes resources and may introduce defects without delivering any additional agreed customer value.' },
            { question: 'In Tuckman\'s model, the stage where the team achieves highest performance is:', options: ['Forming', 'Storming', 'Norming', 'Performing'], correctOptionIndex: 3, explanation: 'During Performing the team operates with cohesion and high efficiency focused on achieving project goals.' },
            { question: 'Quality assurance vs quality control:', options: ['They are exactly the same', 'QA audits processes proactively; QC inspects deliverables reactively', 'QC sets standards; QA enforces them', 'QA applies only to software'], correctOptionIndex: 1, explanation: 'QA is process-focused and preventive; QC is product-focused and detective — both are necessary for comprehensive quality management.' }
          ]
        },
        {
          title: 'Agile Delivery and Project Closure',
          objective: 'Apply agile and hybrid project management, facilitate sprint events, forecast release dates, and formally close a project.',
          hours: 12,
          lesson: 'Part 1 - Agile vs Predictive: Predictive suits stable requirements and fixed deliverables; agile suits high uncertainty, evolving requirements, and frequent value delivery; the choice depends on requirements stability, delivery cadence, team experience, and stakeholder involvement; hybrid blends both for complex environments. Part 2 - Scrum in PM Context: Scrum uses time-boxed sprints of 1 to 4 weeks; the product owner prioritizes the backlog; the scrum master removes impediments; the development team self-organizes; the sprint increment is a potentially releasable product delivered at the sprint review. Part 3 - User Stories and Backlog: User stories follow the format "As a user, I want a function so that I get a benefit"; INVEST criteria (independent, negotiable, valuable, estimable, small, testable) guide quality; acceptance criteria define done; backlog refinement ensures items are sprint-ready; velocity in story points enables release forecasting. Part 4 - Hybrid Project Management: Governance, charter, budget, and contracts remain predictive; product development becomes iterative; the PMBOK Agile Practice Guide recommends selecting approach on a sliding scale based on project characteristics; hybrid is common in regulated industries. Part 5 - Agile Metrics: Burndown tracks remaining story points vs time within a sprint; burnup shows completed work and total scope, making scope additions visible; velocity trends across sprints enable release planning; the cumulative flow diagram shows WIP health and cycle time trends. Part 6 - Retrospectives: Retrospectives at the end of each sprint inspect and adapt team process; common formats include Start/Stop/Continue, 4Ls (liked/learned/lacked/longed for), and DAKI (drop/add/keep/improve); action items are assigned owners and tracked in the next sprint. Part 7 - Lessons Learned: Lessons learned register documents what worked, what did not, and recommendations; collected continuously throughout the project not only at closure; archived in the organizational knowledge base for use by future projects. Part 8 - Project Closure and CAPM Prep: Closure includes formal deliverable acceptance, resource release, contract closure, document archiving, and the final project report; CAPM exam has 150 questions covering predictive 50% and agile/hybrid 50%; key formulas include EVM metrics, PERT Expected=(O+4M+P)/6, and communication channels=n(n-1)/2; 23 contact hours of PM education are required for CAPM eligibility.',
          workedExample: 'Lead a hybrid project: predictive planning followed by agile sprints. Run a sprint retrospective, forecast the release date, and close the project formally.',
          workedExampleSteps: [
            'Step 1: Predictive phase — develop charter, WBS, $150k budget baseline, and risk register top-5.',
            'Step 2: Convert WBS deliverables to user stories; prioritize product backlog by business value with PO.',
            'Step 3: Sprint 1 planning — select 8 stories worth 32 story points for the 2-week sprint.',
            'Step 4: Sprint 1 velocity = 26 story points delivered. 6 points deferred. Stakeholders accept all delivered stories at review.',
            'Step 5: Retrospective — Liked: daily standups kept alignment. Improvement: acceptance criteria too vague. Action: PO writes explicit criteria for all future backlog items.',
            'Step 6: Release forecast — 104 points remaining at velocity 26 = 4 more sprints = 8 weeks to release.',
            'Step 7: Project closure — obtain formal sponsor sign-off, release team members, archive all documentation, close vendor contract.',
            'Step 8: Final lessons learned: "Hybrid approach effective for compliance-constrained delivery; recommend for all future regulated software projects."'
          ],
          commonMistake: 'Treating agile as having no planning — agile still requires release planning, sprint planning, and daily planning; the project charter, budget, and high-level schedule exist even in agile environments.',
          practiceTask: 'Write 5 user stories for a mobile banking app with explicit acceptance criteria. Estimate story points, plan a 2-week sprint at velocity 20, and sketch a burndown chart with the ideal trend line.',
          progressCheckQuestion: 'With 10 stakeholders, how many communication channels exist?',
          progressCheckOptions: ['10', '45', '90', '100'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'Communication channels = n(n-1)/2 = 10x9/2 = 45. This formula shows why communication management complexity grows exponentially with team size.',
          quizQuestions: [
            { question: 'A sprint burndown chart tracks:', options: ['Total budget spent vs time', 'Remaining story points vs time within the sprint', 'Velocity across multiple sprints', 'Number of defects found per iteration'], correctOptionIndex: 1, explanation: 'Burndown plots remaining work against time — a flat or rising line signals the team is behind the sprint goal.' },
            { question: 'Lessons learned should be collected:', options: ['Only at project closure', 'Continuously throughout the project lifecycle', 'Only when problems occur', 'Only for projects over $1 million'], correctOptionIndex: 1, explanation: 'Continuous collection captures knowledge while fresh and can benefit the current project, not just future ones.' },
            { question: 'CAPM eligibility requires:', options: ['5 contact hours of PM education', '15 contact hours', '23 contact hours of PM education', '35 hours plus work experience'], correctOptionIndex: 2, explanation: 'CAPM requires 23 contact hours of PM education and a secondary degree; PMP requires 35 hours plus 36 months of leadership experience.' },
            { question: 'Which is NOT a Scrum event?', options: ['Daily scrum', 'Sprint review', 'Kanban standup', 'Sprint retrospective'], correctOptionIndex: 2, explanation: 'Kanban standup belongs to Kanban, not Scrum. The four Scrum events are sprint planning, daily scrum, sprint review, and sprint retrospective.' }
          ]
        }
      ],
      finalAssessment: [
        { question: 'Which document formally authorizes a project?', options: ['Project management plan', 'Scope statement', 'Project charter', 'Risk register'], correctOptionIndex: 2, explanation: 'The charter formally initiates the project and authorizes the PM to apply resources.' },
        { question: 'The 100% rule in WBS means:', options: ['All resources work 100%', 'WBS captures 100% of scope with no omissions or duplications', 'Budget fully allocated at start', 'Critical path uses all resources'], correctOptionIndex: 1, explanation: 'Every deliverable must appear exactly once in the WBS — no scope gaps and no gold plating.' },
        { question: 'Total float equals:', options: ['Total project duration', 'LS minus ES for an activity — time it can slip without delaying the project', 'Sum of all activity durations', 'Time saved by crashing the schedule'], correctOptionIndex: 1, explanation: 'Float = LS-ES. Critical path activities have zero float.' },
        { question: 'CPI = 0.85 means:', options: ['Project is 15% ahead of schedule', 'Over budget — only $0.85 of value delivered per $1 spent', 'Schedule is 85% complete', 'Risk probability is 85%'], correctOptionIndex: 1, explanation: 'CPI=EV/AC. Below 1.0 indicates cost overrun.' },
        { question: 'Risk transfer strategy:', options: ['Eliminates the risk', 'Shifts financial impact to a third party such as insurer or vendor', 'Reduces probability of occurrence', 'Accepts risk without action'], correctOptionIndex: 1, explanation: 'Transfer shifts the financial consequence to another party; the risk itself remains.' },
        { question: 'Fast-tracking a schedule:', options: ['Adds resources to critical tasks', 'Overlaps sequential activities at the cost of rework risk', 'Removes low-priority scope', 'Extends the deadline to reduce cost'], correctOptionIndex: 1, explanation: 'Fast-tracking reduces duration by overlapping tasks — faster but riskier.' },
        { question: 'Pareto chart applies:', options: ['Control limits to monitor process variation', 'The 80/20 rule to identify vital few defect causes', 'Correlation analysis between two variables', 'Root cause fishbone analysis'], correctOptionIndex: 1, explanation: 'Pareto identifies the causes responsible for most defects, focusing quality improvement effort.' },
        { question: 'Integrated change control ensures:', options: ['All requests auto-approved', 'All changes assessed for impact before approval or rejection', 'Only sponsors can request changes', 'Changes bypass baselines'], correctOptionIndex: 1, explanation: 'Every change is evaluated for its effect on scope, schedule, cost, and quality before any decision.' },
        { question: 'Tuckman stage with highest team performance:', options: ['Forming', 'Storming', 'Norming', 'Performing'], correctOptionIndex: 3, explanation: 'Performing is the stage of peak cohesion and efficiency.' },
        { question: 'User story format:', options: ['"System shall..."', '"As a user, I want function so that benefit"', '"Feature ID: requirement"', '"When user does X, system does Y"'], correctOptionIndex: 1, explanation: 'User stories capture value from the user perspective to drive agile backlog prioritization.' },
        { question: 'EAC = BAC/CPI assumes:', options: ['Schedule variance trend continues', 'Current cost efficiency persists to project end', 'All remaining work costs exactly as planned', 'Management reserve covers all overruns'], correctOptionIndex: 1, explanation: 'EAC=BAC/CPI forecasts total project cost assuming current CPI continues.' },
        { question: 'Gold plating means:', options: ['Using premium-certified vendors', 'Adding unrequested features beyond agreed scope', 'Extra budget spent on quality', 'A tiered pricing contract'], correctOptionIndex: 1, explanation: 'Gold plating wastes resources and introduces risk without delivering agreed value.' },
        { question: 'Communication channels with 10 stakeholders:', options: ['10', '45', '90', '100'], correctOptionIndex: 1, explanation: 'n(n-1)/2 = 10x9/2 = 45 channels.' },
        { question: 'Lessons learned should be:', options: ['Only at closure', 'Collected continuously and archived for future projects', 'Written only by sponsor', 'Optional for small projects'], correctOptionIndex: 1, explanation: 'Continuous collection benefits the current project and organizational knowledge base.' },
        { question: 'PERT expected duration:', options: ['(O+M+P)/3', '(O+4M+P)/6', 'O+4M+P', '(O+3M+P)/4'], correctOptionIndex: 1, explanation: 'PERT weights the most likely estimate four times: Expected=(O+4M+P)/6.' }
      ],
      interviewPrep: [
        'Explain PMBOK 7 performance domains and how they differ from PMBOK 6 process groups; describe how you tailor your PM approach for a small agile team vs a large regulated project.',
        'Walk through all EVM formulas — PV, EV, AC, SPI, CPI, EAC, TCPI, VAC. Given PV=$100k, EV=$80k, AC=$90k, BAC=$250k: calculate all metrics and describe the corrective action you would take.',
        'Describe integrated change control step by step — who is involved, what is assessed, how baselines are updated; explain how you handle a senior stakeholder who bypasses formal change control.',
        'Explain CPM — how do you calculate ES, EF, LS, LF, and float? Describe a time you used schedule compression and the tradeoffs you made between crashing and fast-tracking.',
        'Describe your risk management approach from identification through response planning; explain the difference between residual and secondary risks and give an example of each.',
        'Explain QA vs QC; name three quality tools and when you would use each; describe what the cost of quality framework means for project budget planning.',
        'Describe Tuckman\'s model and how your PM leadership changes at each stage; explain your preferred conflict resolution technique and when forcing is the last resort.',
        'Explain hybrid project management — what stays predictive (governance, contracts, budget) and what becomes agile (delivery sprints); how do you manage stakeholder expectations across both modes?',
        'Walk through the project closure process — formal acceptance, contract closure, resource release, archiving, and what a lessons-learned session looks like in practice.',
        'Calculate PERT expected duration and standard deviation for O=4, M=7, P=16; explain why three-point estimating is more accurate and how you apply it to project-level schedule estimates.'
      ]
    });
  }


  if (/agile|scrum/i.test(name)) {
    return buildCourse({
      courseTitle: 'Agile and Scrum',
      subtitle: 'Aligned to the Scrum Guide 2020, PMI Agile Practice Guide, and PMI-ACP certification framework — the leading agile credential worldwide.',
      difficulty: 'Intermediate',
      estimatedDuration: '6 weeks (6 hrs/week) | ~35 hours total',
      marketDemand: 'Agile practitioners earn a median of $120,000+ USD. Over 71% of organizations use agile approaches. Scrum Masters and Agile Coaches are in high demand across tech, finance, and healthcare.',
      overview: 'This pathway aligns to the Scrum Guide 2020 and PMI-ACP framework.\n\nModule 1 (~8 hrs): Agile Manifesto, 4 values, 12 principles, empiricism, and the agile mindset.\nModule 2 (~10 hrs): Scrum framework — 3 accountabilities, 5 events, 3 artifacts, and Definition of Done.\nModule 3 (~9 hrs): Kanban principles, user stories (INVEST), story points, velocity, and release planning.\nModule 4 (~8 hrs): Agile metrics, retrospective formats, team health, and agile coaching.',
      learningOutcomes: [
        'Apply the four Agile Manifesto values and 12 principles to real team situations.',
        'Facilitate all five Scrum events correctly as a Scrum Master or team member.',
        'Write high-quality user stories with INVEST criteria and acceptance criteria.',
        'Forecast delivery dates using velocity and release planning techniques.',
        'Apply Kanban flow metrics to identify and resolve bottlenecks.',
        'Lead effective retrospectives using multiple formats for continuous improvement.'
      ],
      resumeSignals: [
        'Certified Scrum Master (CSM) or PMI-ACP (in progress or earned)',
        'Facilitated sprint ceremonies and increased team velocity by 20% over 4 sprints',
        'Managed product backlog using user stories with INVEST criteria and acceptance criteria',
        'Delivered features on 2-week cadence with burndown tracking and stakeholder demos',
        'Applied Kanban WIP limits to reduce cycle time from 9 days to 5 days'
      ],
      modules: [
        {
          title: 'Agile Mindset, Values, and Principles',
          objective: 'Explain the Agile Manifesto values and 12 principles, describe empiricism, and contrast agile with predictive waterfall approaches.',
          hours: 8,
          lesson: 'Part 1 - Origin of Agile: In 2001, 17 software practitioners published the Agile Manifesto in response to the failures of heavyweight waterfall processes; waterfall delayed feedback until the end, making changes expensive; the manifesto established a new set of values and principles focused on early delivery and adaptation. Part 2 - The Four Agile Values: Individuals and interactions over processes and tools; working software over comprehensive documentation; customer collaboration over contract negotiation; responding to change over following a plan; the word "over" implies balance — the right side has value but the left side has more. Part 3 - The 12 Agile Principles: Key principles include delivering working software frequently (weeks not months), welcoming changing requirements even late in development, maintaining a sustainable working pace indefinitely, and measuring progress primarily by working software. Part 4 - Empiricism: Scrum is grounded in empirical process control theory — transparency means everyone sees the true state of work; inspection means frequently reviewing progress and process; adaptation means adjusting when inspection reveals problems; empiricism accepts that complex work cannot be fully predicted upfront. Part 5 - Agile vs Waterfall: Waterfall defines all requirements upfront, delivers at project end, and treats change as a risk to control; agile delivers in increments, embraces change as competitive advantage, and uses feedback loops to continuously improve; agile best suits uncertain and evolving environments. Part 6 - Servant Leadership: Agile leaders serve the team by removing impediments, facilitating events, and coaching; servant leaders create conditions for high performance rather than directing work; psychological safety enables teams to surface problems and experiment without fear of blame. Part 7 - Agile Beyond Software: Agile applies to marketing, HR, finance, and operations — not only software; the Business Agility mindset extends agile values to entire organizations; scaling frameworks such as SAFe, LeSS, and Nexus apply agile principles at enterprise scale. Part 8 - Agile Roles Overview: The product owner maximizes product value by managing the backlog; the scrum master facilitates the process and removes impediments; the development team is self-organizing and cross-functional; all three accountabilities appear in the Scrum Guide with distinct responsibilities.',
          workedExample: 'Apply agile principles to a failed waterfall scenario: identify the failure mode, map it to an agile principle, describe the corrective agile approach.',
          workedExampleSteps: [
            'Step 1: Failure identified — "Requirements changed after 6-month design phase; entire architecture had to be rebuilt."',
            'Step 2: Map to Agile Principle 2: "Welcome changing requirements, even late in development."',
            'Step 3: Agile response: break delivery into 2-week sprints with customer review after each increment.',
            'Step 4: Apply Principle 1: "Deliver working software frequently, from a couple of weeks to a couple of months."',
            'Step 5: Apply empiricism — inspect the product with the customer at each sprint review; adapt backlog based on what is learned.',
            'Step 6: Outcome: requirement changes caught at sprint 2 (2 weeks in) vs at month 6 — cost of change reduced by over 90%.'
          ],
          commonMistake: 'Treating agile as "no documentation" or "no planning" — the manifesto says comprehensive documentation and rigid plans have less priority than working software and change responsiveness, not that they are worthless.',
          practiceTask: 'Read all 12 Agile Principles. For each of 3 principles, write a real-world failure scenario it would prevent and describe the specific agile practice that addresses it.',
          progressCheckQuestion: 'The first Agile Manifesto value is:',
          progressCheckOptions: ['Working software over comprehensive documentation', 'Individuals and interactions over processes and tools', 'Customer collaboration over contract negotiation', 'Responding to change over following a plan'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'The first value prioritizes people and communication over rigid processes and tools — the foundation of agile culture.',
          quizQuestions: [
            { question: 'The three pillars of empiricism in Scrum are:', options: ['Planning, execution, review', 'Transparency, inspection, adaptation', 'Vision, backlog, sprint', 'Roles, events, artifacts'], correctOptionIndex: 1, explanation: 'Transparency makes work visible; inspection reviews it regularly; adaptation adjusts based on findings.' },
            { question: 'Agile works best when:', options: ['Requirements are fully known upfront', 'Requirements are uncertain and frequent feedback is valuable', 'Projects are long-term and low-risk', 'Teams are large and geographically distributed'], correctOptionIndex: 1, explanation: 'Agile thrives in environments where requirements evolve and early feedback loops reduce the cost of change.' },
            { question: 'The Agile Manifesto was created in:', options: ['1995', '1998', '2001', '2005'], correctOptionIndex: 2, explanation: '17 software practitioners signed the Agile Manifesto at Snowbird, Utah in February 2001.' },
            { question: 'Servant leadership in agile means:', options: ['The leader assigns all tasks', 'The leader removes impediments and creates conditions for team success', 'The leader writes all user stories', 'The leader reports directly to the product owner'], correctOptionIndex: 1, explanation: 'Servant leaders prioritize the team\'s needs — facilitating events and removing obstacles rather than directing work.' }
          ]
        },
        {
          title: 'Scrum Framework Mastery',
          objective: 'Apply all Scrum accountabilities, events, and artifacts correctly; explain the Definition of Done and sprint goal; facilitate all sprint ceremonies.',
          hours: 10,
          lesson: 'Part 1 - Scrum Overview: Scrum is a lightweight framework for developing and sustaining complex products using fixed-length sprints of 1 to 4 weeks; the Scrum Guide 2020 defines Scrum with three accountabilities, five events, and three artifacts; Scrum is intentionally incomplete and does not prescribe specific engineering practices. Part 2 - Scrum Accountabilities: Product owner maximizes product value by owning and ordering the product backlog; scrum master serves the team by facilitating events, removing impediments, and coaching on Scrum; development team is cross-functional (typically 3 to 9 people), self-organizing, and accountable for delivering a potentially releasable increment each sprint. Part 3 - Sprint Planning: Sprint planning answers what can we do and how will we do it; the team selects product backlog items into the sprint backlog; the sprint goal provides focus and flexibility; capacity planning uses velocity history; once the sprint starts, the sprint backlog is owned by the development team and the sprint duration does not extend. Part 4 - Daily Scrum: A 15-minute daily event for the development team to inspect progress toward the sprint goal and plan the next 24 hours; it is not a status report to the scrum master or management; the team synchronizes and identifies impediments; the scrum master does not run this meeting — the team self-facilitates. Part 5 - Sprint Review: Held at the end of the sprint; the team demonstrates the increment to stakeholders; the product owner updates the backlog based on feedback; the sprint review is an informal collaborative session not a gate review; the key question is what did we learn and how does it change what we build next. Part 6 - Sprint Retrospective: Held after the sprint review; the team inspects their own process, tools, and relationships; identifies specific improvements for the next sprint; action items are assigned owners; the scrum master facilitates and ensures all voices are heard; creates a culture of continuous improvement. Part 7 - Scrum Artifacts: Product backlog is the ordered list of everything that might be done; sprint backlog contains selected items plus the sprint plan; the increment is the sum of all completed product backlog items including prior increments; each artifact has a commitment: product goal, sprint goal, and Definition of Done respectively. Part 8 - Definition of Done: The Definition of Done is a shared understanding of quality standards an increment must meet to be considered complete; it may include code review passed, unit tests green, documentation updated, and acceptance criteria verified; nothing is done until it meets the DoD; the DoD creates transparency and prevents accumulation of technical debt.',
          workedExample: 'Run a complete 2-week sprint for a task management app: planning, daily scrums, review, and retrospective with action items.',
          workedExampleSteps: [
            'Step 1: Sprint planning — select 5 stories (22 points) aligned to sprint goal: "Users can create and assign tasks."',
            'Step 2: Day 3 daily scrum — Dev A: completed task creation API, starting assignment endpoint; Dev B: blocked waiting for design specs (impediment); SM escalates design request immediately.',
            'Step 3: Mid-sprint check: burndown shows 14 points remaining after 7 days — on track.',
            'Step 4: Sprint review — demo task creation and assignment to product owner and stakeholders; PO adds notifications to backlog.',
            'Step 5: Retrospective with Start/Stop/Continue. Start: write acceptance criteria before development. Stop: skipping code review under time pressure. Continue: pair programming for complex stories.',
            'Step 6: Action item — PO writes acceptance criteria for all stories before sprint planning. Owner: PO. Due: next sprint planning.'
          ],
          commonMistake: 'Using the daily scrum as a status report to management — the daily scrum is for the development team to synchronize and plan their next 24 hours; management observation is acceptable but participation is not.',
          practiceTask: 'Write a sprint backlog for a 2-week sprint with a clear sprint goal, 5 user stories, and a capacity-based selection. Write a sprint retrospective report using Start/Stop/Continue format with 3 action items.',
          progressCheckQuestion: 'What is the primary purpose of the sprint retrospective?',
          progressCheckOptions: ['Demo the increment to stakeholders', 'Inspect team process and create improvements for the next sprint', 'Update the product backlog priorities', 'Report sprint progress to management'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'The retrospective is an internal team event to improve their own process and practices — distinct from the sprint review which is the stakeholder demo.',
          quizQuestions: [
            { question: 'Who owns and orders the product backlog?', options: ['Scrum Master', 'Development team', 'Product Owner', 'Stakeholders collectively'], correctOptionIndex: 2, explanation: 'The Product Owner is accountable for maximizing product value through backlog ownership and ordering decisions.' },
            { question: 'The Definition of Done ensures:', options: ['Sprint velocity is consistent', 'Increments meet agreed quality standards before being considered complete', 'All stakeholders approve every story', 'The sprint goal is achieved every sprint'], correctOptionIndex: 1, explanation: 'The DoD creates transparency about quality and prevents hidden technical debt from accumulating.' },
            { question: 'Sprint duration in Scrum:', options: ['Is always exactly 2 weeks', 'Is always exactly 4 weeks', 'Is fixed once set and does not extend', 'Is determined by management for each release'], correctOptionIndex: 2, explanation: 'Sprint duration is fixed; if too much remains, scope is reduced — the sprint end date does not extend.' },
            { question: 'At the sprint review:', options: ['Team improves their own process', 'Team demos the increment and collects stakeholder feedback', 'Team plans the next sprint backlog', 'Team reports risks to the project sponsor'], correctOptionIndex: 1, explanation: 'The sprint review is a collaborative demo and feedback session; stakeholder input updates the product backlog.' }
          ]
        },
        {
          title: 'Kanban, User Stories, and Release Planning',
          objective: 'Apply Kanban WIP limits and flow metrics, write user stories with INVEST criteria, estimate with story points, and plan releases using velocity.',
          hours: 9,
          lesson: 'Part 1 - Kanban Method: Kanban is a flow-based method originating from Toyota lean manufacturing; core practices include visualizing workflow on a board, limiting work in progress, managing flow, making policies explicit, implementing feedback loops, and improving collaboratively and experimentally. Part 2 - Kanban Board and WIP Limits: The Kanban board has columns representing workflow stages such as To Do, In Progress, Review, and Done; WIP limits cap the number of items in each stage; when a column is full the team finishes items before pulling new work; WIP limits expose bottlenecks and reduce costly multitasking. Part 3 - Flow Metrics: Cycle time measures elapsed time from work start to done for a single item; throughput measures items completed per time period; work in progress count tracks active items; the cumulative flow diagram visualizes WIP trends across workflow stages and detects systemic delays. Part 4 - User Stories: User stories follow the format "As a user, I want a function so that I get a benefit"; INVEST criteria guide quality: Independent, Negotiable, Valuable, Estimable, Small (fits in a sprint), and Testable; acceptance criteria define specific conditions the story must satisfy to be accepted by the product owner. Part 5 - Story Points and Planning Poker: Story points measure relative effort, complexity, and uncertainty — not hours; the Fibonacci sequence is commonly used; planning poker reveals estimates simultaneously to prevent anchoring bias; velocity is the average story points completed per sprint and is team-specific, not comparable across teams. Part 6 - Backlog Refinement: The team reviews, estimates, and orders upcoming backlog items; acceptance criteria are added; epics are split into smaller stories; the goal is a ready backlog 2 to 3 sprints deep; the product owner leads refinement with development team participation. Part 7 - Release Planning: Total story points divided by velocity equals sprints needed; always add buffer for risk and interruptions; rolling-wave planning updates the release forecast each sprint as velocity stabilizes; feature-based and date-based planning are both valid approaches depending on the contract type. Part 8 - Scaling Agile: SAFe organizes multiple Scrum teams into Agile Release Trains synchronized by Program Increments of 10 to 12 weeks; PI Planning is a 2-day event for all teams to align on a shared roadmap; LeSS (Large-Scale Scrum) and Nexus are lighter-weight alternatives to SAFe for scaling without adding excessive process overhead.',
          workedExample: 'Apply Kanban WIP limits to unblock a stuck team, write 3 user stories with acceptance criteria, estimate with planning poker, and build a release plan.',
          workedExampleSteps: [
            'Step 1: Kanban board shows 6 items stuck in "In Review" for 3 days. WIP limit for Review = 3. Enforce the limit.',
            'Step 2: Root cause: only 1 reviewer. Solution: team agrees each developer reviews 1 item before starting new work.',
            'Step 3: Story 1 — "As a mobile user, I want to log in with Face ID so that I do not need to type my password." AC: login completes in under 2 seconds; fallback to PIN if Face ID unavailable.',
            'Step 4: Planning poker for Face ID story — estimates: 3, 5, 5, 8. Discuss the 8 (risk of device compatibility). Consensus: 5 points.',
            'Step 5: Story 2 — "As an admin, I want to reset any user password so that locked-out users can regain access." AC: only admin role can trigger; user receives reset email within 30 seconds.',
            'Step 6: Release plan — 80 story points remaining at velocity 20 = 4 sprints = 8 weeks. Add 10% buffer = 9 weeks.'
          ],
          commonMistake: 'Comparing story points across teams — story points measure relative effort within a single team; a 5-point story for one team may represent very different effort from a 5-point story on another team.',
          practiceTask: 'Draw a 4-column Kanban board with WIP limits. Write 4 user stories with INVEST criteria and acceptance criteria. Estimate with Fibonacci story points. Build a release plan for 60 points at velocity 15.',
          progressCheckQuestion: 'WIP limits on a Kanban board are used to:',
          progressCheckOptions: ['Prevent too many items in one stage, forcing focus and exposing bottlenecks', 'Limit total backlog size', 'Set a maximum sprint velocity cap', 'Restrict how many people can work on one story'],
          correctOptionIndex: 0,
          progressCheckExplanation: 'WIP limits force the team to finish before starting more work — this reveals bottlenecks and encourages swarming on blocked items.',
          quizQuestions: [
            { question: 'INVEST stands for:', options: ['Independent, Negotiable, Valuable, Estimable, Small, Testable', 'Integrated, Needed, Verified, Exact, Safe, Trackable', 'Iterative, Novel, Validated, Effective, Stable, Timely', 'Important, Narrow, Visible, Explicit, Scoped, Tested'], correctOptionIndex: 0, explanation: 'INVEST guides user story quality across all six dimensions from independence to testability.' },
            { question: 'Cycle time in Kanban measures:', options: ['Total sprint duration', 'Elapsed time from work start to done for one item', 'Items completed per sprint', 'Team velocity in story points'], correctOptionIndex: 1, explanation: 'Cycle time = time from active start to done — a key indicator of delivery speed and flow health.' },
            { question: 'Story points measure:', options: ['Hours required to complete the story', 'Relative effort, complexity, and uncertainty', 'Lines of code written', 'Calendar days per story'], correctOptionIndex: 1, explanation: 'Story points are relative, not absolute — they capture effort and complexity without committing to a specific duration.' },
            { question: 'Release planning uses velocity to:', options: ['Set the team daily standup schedule', 'Forecast when features will be delivered', 'Determine Kanban WIP limits', 'Assign stories to individual developers'], correctOptionIndex: 1, explanation: 'Total points divided by velocity gives sprints needed — enabling a data-driven forecast of the release date.' }
          ]
        },
        {
          title: 'Agile Metrics, Retrospectives, and Continuous Improvement',
          objective: 'Interpret agile delivery metrics, facilitate retrospectives using multiple formats, and apply continuous improvement discipline to sustain team growth.',
          hours: 8,
          lesson: 'Part 1 - Agile Metrics Philosophy: Metrics in agile serve the team not management reporting; the right metrics create transparency without perverse incentives; key categories include delivery metrics such as velocity and throughput, quality metrics such as defect rate and test coverage, and team health metrics such as satisfaction scores and retrospective action completion rate. Part 2 - Burndown and Burnup Charts: Burndown tracks remaining story points vs time within a sprint; a flat or rising burndown signals impediments or scope creep mid-sprint; burnup shows completed work and total scope separately, making scope increases immediately visible when the total-scope line rises; burnup is preferred for release planning. Part 3 - Velocity Trends: Velocity is most useful as a trend across 3 or more sprints not a single sprint value; stable velocity enables reliable release forecasting; drops indicate team disruptions such as new members, technical debt, or external dependencies; artificially inflating velocity by splitting stories into tiny pieces undermines planning accuracy. Part 4 - Cycle Time and Throughput: Cycle time measures delivery speed for individual items; throughput measures how many items are completed per time period; control charts plot cycle time per item and identify outliers and trends; Monte Carlo simulation uses historical throughput data to forecast delivery dates with confidence intervals. Part 5 - Cumulative Flow Diagram: The CFD shows items in each workflow stage over time; a widening band in one stage indicates a growing bottleneck; the vertical distance between the started and done lines represents average WIP; the horizontal distance represents average cycle time; CFD is the richest single-chart health indicator for a Kanban team. Part 6 - Retrospective Formats: Start/Stop/Continue identifies what to begin, end, and keep doing; 4Ls (Liked/Learned/Lacked/Longed for) explores team experience holistically; DAKI (Drop/Add/Keep/Improve) is highly action-oriented; Sailboat uses wind (helps) and anchors (slows) as metaphors; rotating formats prevents retrospective fatigue and surfaces new insights. Part 7 - Effective Retrospectives: Psychological safety, time-boxing, and action commitment are essential; silent brainstorming prevents groupthink and ensures all voices are heard; action items must have a single owner and be completed in the next sprint to maintain credibility; the scrum master facilitates but does not dominate the conversation. Part 8 - Agile Coaching and Maturity: Agile maturity evolves from following the rules to understanding principles to adapting practices to context; anti-patterns to diagnose include Zombie Scrum (going through motions without improvement), ScrumBut (skipping the uncomfortable events), and HiPPO decisions (highest paid person overrides data); an agile coach helps teams recognize and address their own dysfunctions.',
          workedExample: 'Diagnose declining velocity from sprint data, select a retrospective format, and write action items with owners.',
          workedExampleSteps: [
            'Step 1: Sprint velocity data: 18, 16, 14, 12 over 4 sprints. Clear declining trend. Investigate root cause.',
            'Step 2: Burnup chart reveals scope creep — total-scope line rose by 15 points in Sprint 3; PO adding mid-sprint stories.',
            'Step 3: Choose 4Ls retrospective format to surface emotional and process issues safely.',
            'Step 4: 4Ls results — Liked: pair programming helped quality. Learned: mid-sprint additions hurt velocity. Lacked: clear sprint goal. Longed for: more PO availability during sprint.',
            'Step 5: Root cause: PO adding stories mid-sprint without team agreement, breaking sprint backlog integrity.',
            'Step 6: Action 1 — PO commits to freeze sprint backlog at sprint start. Owner: PO. Due: Sprint 5. Action 2 — Write explicit sprint goal in planning. Owner: PO+SM. Due: Sprint 5 planning.'
          ],
          commonMistake: 'Using velocity as a cross-team performance metric — velocity is a team-level planning tool; teams gaming velocity by splitting stories into tiny pieces undermine sprint planning and make release forecasts unreliable.',
          practiceTask: 'Plot a 5-sprint burnup chart showing 2 scope additions. Write a Sailboat retrospective (wind/anchors) with 3 action items with owners and deadlines. Calculate your retrospective action completion rate.',
          progressCheckQuestion: 'Burnup charts are preferred for release tracking because:',
          progressCheckOptions: ['They are simpler to draw than burndown charts', 'They show both completed work and total scope, making scope changes immediately visible', 'The Scrum Guide requires burnup for release tracking', 'They eliminate the need for tracking velocity'], correctOptionIndex: 1,
          progressCheckExplanation: 'Burnup tracks done work and total scope separately — when scope increases, the total-scope line rises, making scope creep visible to the entire team and stakeholders.',
          quizQuestions: [
            { question: 'Velocity should be used primarily for:', options: ['Measuring individual developer performance', 'Sprint capacity planning and release forecasting within the same team', 'Comparing teams across the organization', 'Reporting to executive stakeholders as a KPI'], correctOptionIndex: 1, explanation: 'Velocity is a team planning tool — it enables forecasting and sprint sizing but should never be a performance metric.' },
            { question: 'Cycle time in a Kanban context measures:', options: ['Total sprint duration', 'Elapsed time from when work starts to when the item is done', 'Time from backlog creation to when work starts', 'Story points delivered per day'], correctOptionIndex: 1, explanation: 'Cycle time = start to done for a single item — lower cycle time means faster, healthier flow.' },
            { question: 'Which retrospective format uses Liked/Learned/Lacked/Longed for?', options: ['Start/Stop/Continue', '4Ls', 'DAKI', 'Sailboat'], correctOptionIndex: 1, explanation: '4Ls explores all four experiential dimensions, uncovering insights about learning and unmet needs in addition to actions.' },
            { question: 'ScrumBut anti-pattern means:', options: ['Team uses Scrum without any modifications', 'Team claims to do Scrum but skips or modifies events to avoid discomfort', 'Team applies SAFe at team level', 'PO skips backlog refinement sessions'], correctOptionIndex: 1, explanation: 'ScrumBut teams cherry-pick Scrum events, typically skipping the uncomfortable ones that drive the most improvement.' }
          ]
        }
      ],
      finalAssessment: [
        { question: 'First Agile Manifesto value:', options: ['Working software over docs', 'Individuals and interactions over processes and tools', 'Customer collaboration over contract', 'Responding to change over following a plan'], correctOptionIndex: 1, explanation: 'Individuals and interactions over processes and tools is the first Agile Manifesto value.' },
        { question: 'Three pillars of Scrum empiricism:', options: ['Planning, execution, review', 'Transparency, inspection, adaptation', 'Vision, backlog, sprint', 'Roles, events, artifacts'], correctOptionIndex: 1, explanation: 'Transparency, inspection, and adaptation are the three empirical pillars.' },
        { question: 'Product backlog is owned by:', options: ['Scrum Master', 'Development team', 'Product Owner', 'Stakeholders collectively'], correctOptionIndex: 2, explanation: 'The Product Owner is accountable for backlog ownership and ordering.' },
        { question: 'Definition of Done ensures:', options: ['Consistent velocity', 'Increments meet agreed quality standards before being called complete', 'Stakeholder approval of every story', 'Sprint goal achieved every sprint'], correctOptionIndex: 1, explanation: 'DoD creates transparency about quality and prevents hidden technical debt.' },
        { question: 'INVEST stands for:', options: ['Independent, Negotiable, Valuable, Estimable, Small, Testable', 'Integrated, Novel, Verified, Exact, Safe, Trackable', 'Iterative, Needed, Validated, Effective, Stable, Timely', 'Important, Narrow, Visible, Explicit, Scoped, Tested'], correctOptionIndex: 0, explanation: 'INVEST is the 6-dimension quality model for user stories.' },
        { question: 'WIP limits on Kanban boards:', options: ['Limit backlog size', 'Prevent too many items per stage, exposing bottlenecks', 'Set velocity caps', 'Restrict team headcount'], correctOptionIndex: 1, explanation: 'WIP limits force focus and reveal bottlenecks by stopping new work until current work finishes.' },
        { question: 'Story points measure:', options: ['Hours required', 'Relative effort, complexity, and uncertainty', 'Lines of code', 'Calendar days per story'], correctOptionIndex: 1, explanation: 'Story points are relative estimates capturing effort and complexity — not time commitments.' },
        { question: 'Sprint retrospective purpose:', options: ['Demo increment to stakeholders', 'Inspect team process and create improvement actions', 'Update product backlog', 'Report progress to management'], correctOptionIndex: 1, explanation: 'The retrospective is an internal team event for continuous process improvement.' },
        { question: 'Burnup charts are preferred for release tracking because:', options: ['Simpler to draw', 'Show completed work AND total scope — scope changes visible', 'Scrum Guide requires them', 'They replace velocity tracking'], correctOptionIndex: 1, explanation: 'Burnup makes scope creep visible by showing total scope and done work separately.' },
        { question: 'Velocity is best used for:', options: ['Measuring individual performance', 'Sprint planning and release forecasting within one team', 'Cross-team comparison', 'Executive performance reporting'], correctOptionIndex: 1, explanation: 'Velocity is a team-level planning tool — not a performance metric.' },
        { question: 'Sprint duration in Scrum:', options: ['Always 2 weeks', 'Always 4 weeks', 'Fixed once set and does not extend', 'Set by management per release'], correctOptionIndex: 2, explanation: 'Sprint duration is fixed — if too much remains, scope is reduced, not the sprint extended.' },
        { question: 'ScrumBut means:', options: ['Using Scrum without modification', 'Claiming to use Scrum while skipping uncomfortable events', 'Applying SAFe at team level', 'PO skipping refinement'], correctOptionIndex: 1, explanation: 'ScrumBut teams avoid the hardest parts of Scrum, which are usually the most valuable.' },
        { question: 'Cycle time measures:', options: ['Total sprint duration', 'Time from work start to done for one item', 'Story points per day', 'Time in backlog before work starts'], correctOptionIndex: 1, explanation: 'Cycle time = active start to done — a key flow health indicator.' },
        { question: 'Planning poker prevents:', options: ['Late sprints', 'Anchoring bias in estimation by revealing estimates simultaneously', 'Scope creep', 'Management interference in estimation'], correctOptionIndex: 1, explanation: 'Simultaneous reveal prevents early estimators from anchoring the team on their numbers.' },
        { question: 'SAFe Agile Release Trains are synchronized by:', options: ['2-week sprints', 'Program Increments of 10-12 weeks', 'Monthly release trains', 'Annual product roadmaps'], correctOptionIndex: 1, explanation: 'ARTs align multiple Scrum teams through PI Planning for enterprise-scale agile coordination.' }
      ],
      interviewPrep: [
        'Explain the four Agile Manifesto values and describe three of the 12 principles; give a real scenario where applying a principle would have prevented a project failure.',
        'Walk through all five Scrum events — what happens in each, who attends, the time-box, and the output; explain the key difference between sprint review and sprint retrospective.',
        'Explain the three Scrum accountabilities; describe how you would handle a situation where the product owner keeps adding scope mid-sprint.',
        'Write a complete user story with INVEST criteria, acceptance criteria, and story point estimate; explain how you would split an epic into sprint-sized stories without losing business value.',
        'Describe how you would facilitate a retrospective for a team with low psychological safety — which format, how to include all voices, and how to track action item completion.',
        'Explain Kanban flow metrics — cycle time, throughput, WIP, and CFD — and describe how you used them to identify and resolve a bottleneck.',
        'Explain velocity, how you use it for release planning, and what you investigate when velocity drops; describe why comparing velocity across teams is counterproductive.',
        'Describe the SAFe framework — what problem it solves, what an Agile Release Train is, and what happens during PI Planning.',
        'Explain the difference between burndown and burnup charts; interpret a burnup chart where scope is increasing faster than completion rate.',
        'Describe three Scrum or agile anti-patterns — how you would diagnose each and the specific coaching action you would take.'
      ]
    });
  }

  // ── BUSINESS ANALYSIS (IIBA ECBA / BABOK v3 aligned, ~50 hrs) ─────────────
  if (/business.analys/i.test(name)) {
    return buildCourse({
      courseTitle: 'Business Analysis',
      subtitle: 'Aligned to the IIBA ECBA certification and BABOK v3 — the global standard for business analysis practice.',
      difficulty: 'Intermediate',
      estimatedDuration: '7 weeks (7 hrs/week) | ~50 hours total',
      marketDemand: 'Business analysts earn a median salary of $99,260 USD. IIBA-certified analysts command 15-20% salary premiums. BA skills are critical in IT, finance, healthcare, and consulting.',
      overview: 'This pathway aligns to the IIBA ECBA certification and BABOK v3 Knowledge Areas.\n\nModule 1 (~12 hrs): BA role, BABOK areas, stakeholder analysis, and elicitation techniques.\nModule 2 (~14 hrs): Requirements documentation — use cases, user stories, BPMN, data models, and traceability.\nModule 3 (~12 hrs): Solution evaluation — gap analysis, options analysis, MoSCoW, UAT planning, and business case.\nModule 4 (~12 hrs): BA in agile contexts, backlog facilitation, data analysis basics, and stakeholder reporting.',
      learningOutcomes: [
        'Apply BABOK knowledge areas to structure real business analysis work.',
        'Conduct stakeholder analysis and elicit requirements through interviews and workshops.',
        'Document requirements using use cases, user stories, BPMN, and traceability matrices.',
        'Evaluate solution options using gap analysis, feasibility assessment, and MoSCoW.',
        'Plan and support user acceptance testing with structured test scenarios.',
        'Facilitate backlog refinement and apply BA skills in agile project environments.'
      ],
      resumeSignals: [
        'IIBA ECBA or CCBA Certification (in progress or earned)',
        'Elicited and documented 200+ functional and non-functional requirements for enterprise system migration',
        'Facilitated stakeholder workshops and produced business requirements document (BRD) for cross-functional initiative',
        'Created end-to-end BPMN process maps identifying 12 inefficiencies, enabling 25% process improvement',
        'Developed UAT test plan and managed 3 testing cycles resulting in zero critical defects at go-live'
      ],
      modules: [
        {
          title: 'BA Role, Competencies, and Elicitation',
          objective: 'Explain the BA role in the SDLC, apply BABOK knowledge areas, conduct stakeholder analysis, and use core elicitation techniques.',
          hours: 12,
          lesson: 'Part 1 - The BA Role: Business analysts bridge the gap between business stakeholders and technical teams; core tasks include eliciting requirements, analyzing them, documenting them, and validating that solutions meet business needs; BAs work across all SDLC phases and are present in both waterfall and agile projects. Part 2 - BABOK v3 Knowledge Areas: BABOK v3 defines six knowledge areas: business analysis planning and monitoring, elicitation and collaboration, requirements lifecycle management, strategy analysis, requirements analysis and design definition, and solution evaluation; each area has tasks, techniques, and competencies. Part 3 - Stakeholder Analysis: Stakeholder analysis identifies all parties affected by or influencing the solution; a RACI matrix assigns responsible, accountable, consulted, and informed roles; an onion diagram shows stakeholder proximity to the solution; understanding stakeholder needs, interests, and influence guides elicitation priorities. Part 4 - Elicitation Techniques: Interviews are one-on-one sessions using structured or unstructured question formats; facilitated workshops bring multiple stakeholders together to resolve conflicts and reach consensus; surveys collect data at scale; observation (job shadowing) reveals unstated processes; prototyping shows concrete representations to elicit feedback quickly. Part 5 - Document Analysis: Reviewing existing documentation — system specs, process manuals, org charts, and data dictionaries — uncovers requirements without direct stakeholder engagement; analysis of as-is documentation reveals current state and implicit requirements that stakeholders take for granted. Part 6 - Requirements Categories: Functional requirements describe what the system must do; non-functional requirements describe how well it must do it (performance, security, usability, scalability); business rules define constraints; transition requirements cover migration and training; regulatory requirements add compliance constraints. Part 7 - Elicitation Planning: Effective elicitation requires preparation — understanding the business domain, preparing question lists, scheduling diverse stakeholders, and building trust before sessions; poorly prepared interviews yield vague requirements and require expensive rework; confirming shared understanding after each session prevents misinterpretation. Part 8 - Collaboration and Communication: BAs must adapt communication style to audience — technical language for developers, business language for executives; active listening, paraphrasing, and visual models improve shared understanding; managing conflict between stakeholders is a core BA competency; written confirmation of elicitation results ensures accuracy.',
          workedExample: 'Plan and conduct a requirements elicitation for a new HR leave management system: stakeholder analysis, interview guide, and workshop agenda.',
          workedExampleSteps: [
            'Step 1: Identify stakeholders — HR director (sponsor), employees (users), payroll team (integration), IT (builder), legal (compliance).',
            'Step 2: Build RACI: HR Director = Accountable. HR Analysts = Responsible. Legal + Payroll = Consulted. IT = Informed initially then Responsible for build.',
            'Step 3: Prepare interview guide for HR manager: "How do employees currently request leave? What approval steps exist? What causes delays or disputes?"',
            'Step 4: Conduct 45-minute interview; record notes; confirm understanding at end: "To summarize — approval requires manager then HR, and notifications fail when manager is on leave."',
            'Step 5: Plan a 2-hour facilitated workshop with HR, Payroll, and Legal; agenda: (1) Review current process, (2) Identify pain points, (3) Define desired future state.',
            'Step 6: Workshop output: 23 functional requirements, 8 non-functional requirements, and 5 regulatory constraints documented.'
          ],
          commonMistake: 'Jumping to solution design before fully understanding the business need — BAs must first establish the problem statement and business objectives before any discussion of how to solve them.',
          practiceTask: 'Choose a business system (library app, clinic booking, HR portal). Identify 5 stakeholders with RACI. Write 10 interview questions for the primary user. Conduct a mock 20-minute elicitation interview with a peer.',
          progressCheckQuestion: 'Which BABOK knowledge area covers stakeholder identification and communication planning?',
          progressCheckOptions: ['Strategy analysis', 'Requirements lifecycle management', 'Business analysis planning and monitoring', 'Solution evaluation'],
          correctOptionIndex: 2,
          progressCheckExplanation: 'Business analysis planning and monitoring covers how BA activities will be planned, monitored, and improved — including stakeholder engagement and communication planning.',
          quizQuestions: [
            { question: 'What is the primary role of a business analyst?', options: ['Write code for new features', 'Bridge business needs and technical solutions through requirements work', 'Manage project budgets and schedules', 'Conduct UAT testing exclusively'], correctOptionIndex: 1, explanation: 'BAs translate business problems into clear requirements that technical teams can implement — they work across the SDLC.' },
            { question: 'Non-functional requirements describe:', options: ['Specific features the system must have', 'How well the system must perform (speed, security, usability)', 'Data migration between systems', 'Compliance with legal regulations'], correctOptionIndex: 1, explanation: 'Non-functional requirements define quality attributes — performance, scalability, security, and usability standards.' },
            { question: 'Job shadowing (observation) as an elicitation technique is best for:', options: ['Collecting data at scale from hundreds of users', 'Uncovering unstated and implicit processes that workers do automatically', 'Resolving conflicts between stakeholder groups', 'Documenting existing system architecture'], correctOptionIndex: 1, explanation: 'Observation reveals the actual work process including informal workarounds that stakeholders have normalized and would never think to mention in an interview.' },
            { question: 'BABOK v3 defines how many knowledge areas?', options: ['4', '5', '6', '8'], correctOptionIndex: 2, explanation: 'BABOK v3 has 6 knowledge areas covering the complete business analysis lifecycle from planning through solution evaluation.' }
          ]
        },
        {
          title: 'Requirements Analysis and Documentation',
          objective: 'Produce high-quality requirements using use cases, user stories, BPMN process maps, ERDs, and a requirements traceability matrix.',
          hours: 14,
          lesson: 'Part 1 - Use Cases: A use case describes an interaction between an actor and the system to achieve a goal; components include actor, use case name, preconditions, main success scenario, alternative flows, exception flows, and postconditions; use case diagrams show system scope and relationships between actors and use cases at a high level. Part 2 - User Stories vs Use Cases: User stories ("As a user I want function so that benefit") work best in agile for iterative delivery; use cases provide more detail for complex workflows and are preferred in regulatory environments; both require clear acceptance criteria; BAs select the format appropriate to project methodology and stakeholder preference. Part 3 - BPMN Process Mapping: Business Process Model and Notation uses standardized symbols — events (circles), activities (rectangles), gateways (diamonds), and sequence flows (arrows); swimlane diagrams show which actor performs each step; to-be process maps reveal improvement opportunities and define target-state requirements. Part 4 - Data Modeling: Entity-relationship diagrams model data structures with entities (nouns), attributes (properties), and relationships (verbs) with cardinality (one-to-one, one-to-many, many-to-many); data dictionaries define each data element, type, constraints, and source; data models drive database design and API contracts. Part 5 - Requirements Attributes: Each requirement needs a unique ID, title, description, source, priority, owner, status, and test condition; well-formed requirements are complete, correct, feasible, necessary, unambiguous, and verifiable (CCFNUV); requirements quality directly determines testing and implementation accuracy. Part 6 - Requirements Traceability Matrix: The RTM links requirements to their source (business objective), design artifacts, test cases, and deployment status; bidirectional traceability ensures every requirement is tested and every test covers a requirement; the RTM is critical for impact analysis when requirements change. Part 7 - Prioritization Techniques: MoSCoW categories requirements as Must have (critical), Should have (important but not critical), Could have (nice to have), and Will not have (out of scope for now); Kano model classifies features as basic needs, performance needs, and delighters; value/effort matrix helps prioritize quick wins. Part 8 - Requirements Review and Baseline: Requirements walkthroughs involve stakeholders reviewing documentation for accuracy and completeness; formal inspections use structured defect detection; sign-off establishes a requirements baseline; baseline changes require formal change control; version control manages requirements documents across project phases.',
          workedExample: 'Document requirements for an online patient appointment booking system: use case, BPMN process map, and RTM.',
          workedExampleSteps: [
            'Step 1: Use case — Actor: Patient. Name: "Book Appointment." Precondition: Patient is registered and logged in.',
            'Step 2: Main success scenario: (1) Patient selects specialty, (2) System shows available slots, (3) Patient selects slot, (4) System confirms booking and sends email.',
            'Step 3: Alternative flow: no available slots — system offers waitlist option. Exception: payment failure — booking held for 15 minutes.',
            'Step 4: BPMN to-be map — Patient swimlane: Search > Select Slot > Confirm. System swimlane: Check Availability > Reserve Slot > Send Confirmation. Finance swimlane: Process Payment.',
            'Step 5: Gateway (diamond): "Payment successful?" Yes: confirm booking. No: release slot and notify patient.',
            'Step 6: RTM entry — REQ-001: "Patient can search appointments by specialty and date." Source: Stakeholder workshop. Priority: Must Have. Test case: TC-001. Status: Approved.'
          ],
          commonMistake: 'Writing ambiguous requirements such as "the system should be fast" — every requirement must be verifiable; "fast" must be specified as "API responses must complete within 200ms under 1000 concurrent users."',
          practiceTask: 'Document a 5-step use case for a library book reservation system including main and alternative flows. Draw a BPMN swimlane for 3 actors. Create a 10-row RTM with IDs, descriptions, priority, and test references.',
          progressCheckQuestion: 'The requirements traceability matrix (RTM) is primarily used to:',
          progressCheckOptions: ['Store project meeting notes', 'Link requirements to source, design, test cases, and deployment — enabling impact analysis', 'Assign requirements to development sprints', 'Measure team velocity across requirements'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'The RTM provides bidirectional traceability — every requirement links to its source and tests, and every test links to a requirement — supporting change impact analysis and completeness verification.',
          quizQuestions: [
            { question: 'MoSCoW prioritization categorizes requirements as:', options: ['Major, Secondary, Critical, Optional', 'Must have, Should have, Could have, Will not have (this time)', 'Mandatory, Suggested, Conditional, Waived', 'Milestone, Scope, Cost, Workflow'], correctOptionIndex: 1, explanation: 'MoSCoW helps stakeholders agree on what is truly critical vs nice-to-have by forcing explicit prioritization.' },
            { question: 'BPMN gateways represent:', options: ['System data stores', 'Decision points and parallel flows in a process', 'Actor swimlane boundaries', 'Non-functional requirements'], correctOptionIndex: 1, explanation: 'BPMN diamond-shaped gateways split or merge flows based on conditions (exclusive, inclusive, or parallel).' },
            { question: 'A well-formed requirement must be:', options: ['Brief and aspirational', 'Complete, correct, feasible, necessary, unambiguous, and verifiable', 'Approved by all stakeholders before being written', 'Written in technical language for developers'], correctOptionIndex: 1, explanation: 'CCFNUV: all six qualities must be present for a requirement to be implementable and testable.' },
            { question: 'Bidirectional traceability means:', options: ['Requirements trace forward to tests only', 'Requirements trace to source AND tests, and tests trace back to requirements', 'All requirements trace to the same test suite', 'Requirements are traced after deployment only'], correctOptionIndex: 1, explanation: 'Bidirectional traceability ensures completeness — every requirement is tested and every test covers a requirement.' }
          ]
        },
        {
          title: 'Solution Evaluation and Requirements Management',
          objective: 'Conduct gap analysis, evaluate solution options, write a business case, prioritize with MoSCoW, and plan UAT for solution validation.',
          hours: 12,
          lesson: 'Part 1 - Strategy Analysis: Strategy analysis identifies the business need, assesses the current state, defines the desired future state, and describes the solution space that addresses the gap; context diagrams show system boundaries; root cause analysis (5 Whys, fishbone) ensures the real problem is solved rather than symptoms. Part 2 - Gap Analysis: Gap analysis compares the current state (as-is) with the desired future state (to-be) to identify what needs to change in process, people, technology, and data; the gap becomes the scope of the change initiative; it ensures solutions address actual needs rather than assumed ones. Part 3 - Options Analysis and Feasibility: Options analysis evaluates multiple solution alternatives against criteria such as cost, risk, time, feasibility, and strategic alignment; feasibility assessment covers technical, financial, operational, and legal dimensions; a SWOT analysis for each option supports recommendation. Part 4 - Business Case: The business case justifies the investment by quantifying costs and benefits over time; components include executive summary, problem statement, options considered, recommended option, cost-benefit analysis, risk assessment, and implementation plan; benefits may be financial (ROI, cost savings) or non-financial (customer satisfaction, regulatory compliance). Part 5 - Acceptance Criteria and UAT: Acceptance criteria define specific, testable conditions a solution must satisfy; user acceptance testing validates that the solution meets business requirements before go-live; UAT test plan includes scope, test scenarios, entry/exit criteria, roles, and defect management process. Part 6 - Change Management for Solutions: Business change readiness assessments evaluate stakeholder capacity and willingness to adopt the new solution; training plans, communication plans, and pilot programs reduce resistance; BAs support the transition by translating requirements into operational procedures. Part 7 - Requirements Change Control: Change requests for requirements must be evaluated for impact on scope, schedule, cost, and interdependencies; a change control board or requirements review board approves changes; the RTM is updated; version-controlled requirements documents prevent confusion between requirement versions. Part 8 - Post-Implementation Review: After go-live, BAs assess whether the solution achieved intended business outcomes; benefits realization review measures ROI, user adoption, and process improvement metrics; lessons learned inform future business analysis and solution delivery practices.',
          workedExample: 'Conduct a gap analysis and write a business case for replacing a manual expense reporting process with an automated system.',
          workedExampleSteps: [
            'Step 1: As-is: employees submit paper receipts to manager, who compiles spreadsheets sent to finance monthly. Average processing time: 8 days per report.',
            'Step 2: To-be: digital submission with automated approval routing and same-day processing. Target: under 24 hours.',
            'Step 3: Gap identified: no digital submission capability, no automated approval workflow, no integration with finance system.',
            'Step 4: Option A: Build custom system ($120k, 6 months). Option B: Buy SaaS expense tool ($30k/year, 2 months). Option C: Extend existing ERP ($80k, 4 months).',
            'Step 5: Recommend Option B: lowest cost, fastest deployment, proven technology, vendor maintains security and compliance.',
            'Step 6: Business case ROI: current cost $18/report × 5000 reports/year = $90k/year; SaaS cost $30k/year; net savings $60k/year; payback period < 6 months.'
          ],
          commonMistake: 'Recommending the first technically feasible solution without evaluating alternatives — the BA must present options with objective evaluation criteria and let the business make an informed decision.',
          practiceTask: 'Choose a real manual business process. Document the as-is with a BPMN map. Identify gaps. Evaluate 2 solution options using a weighted criteria matrix. Write a 1-page business case with cost-benefit analysis.',
          progressCheckQuestion: 'Gap analysis in business analysis compares:',
          progressCheckOptions: ['Project budget vs actual spend', 'Current state (as-is) to desired future state (to-be) to identify what must change', 'Stakeholder satisfaction before and after training', 'Requirements coverage before and after testing'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'Gap analysis identifies the delta between where things are now and where they need to be — this gap defines the scope of the solution.',
          quizQuestions: [
            { question: 'A business case justifies an investment by:', options: ['Listing all technical requirements for the solution', 'Quantifying costs and benefits and recommending the best option', 'Describing the project schedule in detail', 'Documenting stakeholder interview transcripts'], correctOptionIndex: 1, explanation: 'The business case makes the financial and strategic argument for why the investment should be made, including ROI and risk assessment.' },
            { question: 'UAT (User Acceptance Testing) validates that:', options: ['The code has no defects', 'The solution meets business requirements as experienced by real users', 'The system performs under load', 'The database schema is correctly designed'], correctOptionIndex: 1, explanation: 'UAT is the final validation that the business requirements are met before go-live — it is owned by the business, not IT.' },
            { question: 'The 5 Whys technique is used to:', options: ['Prioritize requirements by business value', 'Identify the root cause of a problem by asking why repeatedly', 'Evaluate solution options against criteria', 'Estimate project costs bottom-up'], correctOptionIndex: 1, explanation: 'The 5 Whys traces a problem back to its fundamental cause, ensuring the solution addresses the root issue rather than symptoms.' },
            { question: 'Options analysis evaluates alternatives against:', options: ['Only cost criteria', 'Weighted criteria including cost, risk, feasibility, time, and strategic fit', 'Stakeholder preference only', 'Technical complexity exclusively'], correctOptionIndex: 1, explanation: 'Multiple criteria ensure the recommendation is well-rounded, not just cheapest or fastest but best overall fit for the organization.' }
          ]
        },
        {
          title: 'Business Analysis in Agile and Data-Driven Contexts',
          objective: 'Apply BA skills in agile teams, facilitate backlog refinement, perform basic data analysis, and communicate insights to stakeholders.',
          hours: 12,
          lesson: 'Part 1 - BA in Agile Teams: In agile environments the BA role blends with the product owner, scrum master, or developer depending on team structure; BA activities shift from big upfront requirements to just-in-time elaboration; the BA ensures user stories are correctly specified and acceptance criteria are testable before sprint planning. Part 2 - Backlog Refinement Facilitation: BAs lead or support backlog refinement by decomposing epics into sprint-sized stories, adding acceptance criteria, and resolving ambiguity; they collaborate with the product owner to prioritize based on business value; they translate stakeholder feedback from sprint reviews into updated backlog items. Part 3 - Continuous Elicitation: In agile, elicitation is continuous throughout the project via sprint reviews, retrospectives, stakeholder feedback, and analytics data; BAs must be skilled at rapid elicitation in short feedback cycles; the just-in-time approach reduces documentation overhead while maintaining requirements clarity for development. Part 4 - Data Analysis Fundamentals: BAs use data to understand business performance and identify improvement opportunities; basic techniques include frequency analysis, trend analysis, and ratio analysis; common tools include Excel (pivot tables, charts), SQL queries, and Power BI dashboards; data tells the story that stakeholders need to understand. Part 5 - Process Improvement with Data: Data analysis reveals process bottlenecks, error rates, and inefficiencies; comparing KPIs before and after solution implementation quantifies benefits; control charts identify process variation; A/B testing validates which process variant performs better for business outcomes. Part 6 - Stakeholder Reporting: BA reports translate technical findings into business language; executive summaries lead with insights not data; visualizations (bar charts, trend lines, heat maps) communicate patterns faster than tables; reports must answer the so-what question — what does this data mean for the business? Part 7 - BA in Digital Transformation: Digital transformation initiatives require BAs who understand cloud platforms, API integrations, and data architecture; BAs bridge business change and technical implementation; they must be comfortable with the concepts of microservices, data lakes, and AI-driven processes without needing to implement them. Part 8 - ECBA Exam Preparation: IIBA ECBA certification requires 21 hours of professional development in business analysis and knowledge of all BABOK v3 knowledge areas; key exam topics include the BA core concept model (change, need, solution, context, value, stakeholder), the six knowledge areas, and underlying competencies; ECBA is the entry-level credential with no work experience requirement.',
          workedExample: 'Facilitate backlog refinement for a mobile payment feature, write acceptance criteria, and build a data analysis to justify the feature priority.',
          workedExampleSteps: [
            'Step 1: Epic: "Mobile payments." Decompose into stories: (1) Add card, (2) Make payment, (3) View transaction history, (4) Manage saved cards.',
            'Step 2: "Make payment" story — AC: payment processes in under 3 seconds; user receives push notification; transaction appears in history immediately.',
            'Step 3: Data analysis: pull last 6 months of user session data. Finding: 23% of users abandon checkout at payment step — highest drop-off point in funnel.',
            'Step 4: Insight: long payment form is the cause; mobile users dislike typing card details on small screens.',
            'Step 5: Business justification: reducing abandonment by 50% = 11.5% revenue increase on mobile = $340k annual uplift based on current volumes.',
            'Step 6: Present to PO with chart showing abandonment rate trend. Recommend mobile payment as sprint 1 priority — highest value, confirmed by data.'
          ],
          commonMistake: 'Writing vague acceptance criteria such as "the feature should work smoothly" — acceptance criteria must be specific and testable: "Payment confirmation screen displays within 3 seconds of submission."',
          practiceTask: 'Take an existing product backlog epic (e.g., "User Profile Management"). Decompose into 4 user stories. Write detailed acceptance criteria for each. Identify one data source that would help justify prioritization.',
          progressCheckQuestion: 'In an agile environment, BA requirements elicitation is:',
          progressCheckOptions: ['Completed entirely upfront before sprints begin', 'Continuous — happening throughout sprints via reviews, feedback, and data', 'Delegated entirely to the product owner', 'Only performed at major milestones'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'Agile BA work is continuous and just-in-time — requirements are elaborated progressively as the team learns more through sprint delivery and stakeholder feedback.',
          quizQuestions: [
            { question: 'In agile, the BA\'s primary contribution during backlog refinement is:', options: ['Writing code for user stories', 'Ensuring stories are correctly specified with testable acceptance criteria before sprint planning', 'Setting the sprint velocity target', 'Managing the development team capacity'], correctOptionIndex: 1, explanation: 'BAs in agile ensure the backlog is ready — stories are clear, sized appropriately, and have testable acceptance criteria.' },
            { question: 'Pivot tables in Excel help BAs to:', options: ['Write requirements documents automatically', 'Summarize and cross-analyze large datasets to identify patterns and trends', 'Create BPMN process diagrams', 'Manage stakeholder communication plans'], correctOptionIndex: 1, explanation: 'Pivot tables allow rapid summarization of data by multiple dimensions — essential for identifying patterns in operational data.' },
            { question: 'ECBA certification requires:', options: ['3 years of BA work experience', '21 hours of professional development in BA plus knowledge of BABOK v3', 'PMP certification as a prerequisite', '5 years of project management experience'], correctOptionIndex: 1, explanation: 'ECBA is the entry-level IIBA credential requiring 21 professional development hours and BABOK v3 knowledge — no work experience needed.' },
            { question: 'A BA stakeholder report should lead with:', options: ['Raw data tables', 'Insights and recommendations (the so-what)', 'Technical implementation details', 'A complete list of requirements'], correctOptionIndex: 1, explanation: 'Executives need insights and actions, not data dumps — leading with the "so what" respects their time and drives decisions.' }
          ]
        }
      ],
      finalAssessment: [
        { question: 'The primary BA role is to:', options: ['Write code', 'Bridge business needs and technical solutions through requirements work', 'Manage project budgets', 'Conduct only UAT testing'], correctOptionIndex: 1, explanation: 'BAs translate business problems into implementable requirements across the SDLC.' },
        { question: 'Non-functional requirements describe:', options: ['Specific features the system must do', 'How well the system performs (speed, security, usability)', 'Data migration between systems', 'Legal compliance constraints only'], correctOptionIndex: 1, explanation: 'Non-functional requirements define quality attributes — not features.' },
        { question: 'Observation (job shadowing) is best for:', options: ['Collecting data from hundreds of users', 'Uncovering implicit processes workers do automatically', 'Resolving stakeholder conflicts', 'Documenting system architecture'], correctOptionIndex: 1, explanation: 'Observation reveals actual work including informal workarounds not mentioned in interviews.' },
        { question: 'MoSCoW stands for:', options: ['Major, Secondary, Critical, Optional', 'Must have, Should have, Could have, Will not have (this time)', 'Mandatory, Suggested, Conditional, Waived', 'Milestone, Scope, Cost, Workflow'], correctOptionIndex: 1, explanation: 'MoSCoW forces explicit prioritization of requirements into four categories.' },
        { question: 'BPMN gateways represent:', options: ['System data stores', 'Decision points and flow splits or merges', 'Actor swimlane boundaries', 'Non-functional requirements'], correctOptionIndex: 1, explanation: 'Diamond-shaped gateways in BPMN handle decision logic and parallel/conditional flows.' },
        { question: 'A well-formed requirement must be:', options: ['Brief and aspirational', 'Complete, correct, feasible, necessary, unambiguous, and verifiable', 'Approved before written', 'In technical language for developers'], correctOptionIndex: 1, explanation: 'CCFNUV ensures requirements are implementable and testable.' },
        { question: 'The RTM links requirements to:', options: ['Project budget items', 'Source, design artifacts, test cases, and deployment — enabling impact analysis', 'Sprint backlog items only', 'Developer assignments'], correctOptionIndex: 1, explanation: 'Bidirectional RTM supports change impact analysis and test completeness.' },
        { question: 'Gap analysis compares:', options: ['Project budget vs actual', 'Current state (as-is) to desired future state (to-be)', 'Stakeholder satisfaction levels', 'Requirements coverage before/after test'], correctOptionIndex: 1, explanation: 'The gap between as-is and to-be defines the solution scope.' },
        { question: 'UAT validates that:', options: ['Code has no defects', 'Solution meets business requirements as experienced by users', 'System performs under load', 'Database schema is correct'], correctOptionIndex: 1, explanation: 'UAT is the final business validation before go-live — owned by the business, not IT.' },
        { question: 'A business case justifies investment by:', options: ['Listing all technical requirements', 'Quantifying costs, benefits, and recommending the best option', 'Describing the project schedule', 'Documenting interview transcripts'], correctOptionIndex: 1, explanation: 'Business cases make the financial and strategic argument for the investment.' },
        { question: 'BABOK v3 defines how many knowledge areas?', options: ['4', '5', '6', '8'], correctOptionIndex: 2, explanation: 'BABOK v3 has 6 knowledge areas covering the complete BA lifecycle.' },
        { question: 'Agile BA elicitation is:', options: ['Completed entirely upfront', 'Continuous throughout sprints via reviews, feedback, and data', 'Delegated entirely to PO', 'Only at major milestones'], correctOptionIndex: 1, explanation: 'Agile BA work is continuous and just-in-time.' },
        { question: 'Acceptance criteria must be:', options: ['High-level and open to interpretation', 'Specific and testable — defining exact pass/fail conditions', 'Written only after development', 'Approved by the development team alone'], correctOptionIndex: 1, explanation: 'Vague acceptance criteria lead to subjective interpretation and rework.' },
        { question: 'The 5 Whys technique identifies:', options: ['Top 5 stakeholder priorities', 'Root cause of a problem by iteratively asking why', 'Five solution options for evaluation', 'Five phases of the requirements lifecycle'], correctOptionIndex: 1, explanation: '5 Whys traces problems to their fundamental root cause, ensuring solutions address causes not symptoms.' },
        { question: 'ECBA certification requires:', options: ['3 years BA experience', '21 professional development hours plus BABOK v3 knowledge', 'PMP as prerequisite', '5 years of PM experience'], correctOptionIndex: 1, explanation: 'ECBA is the entry-level IIBA credential — no work experience required, just 21 hours of BA education.' }
      ],
      interviewPrep: [
        'Explain the six BABOK v3 knowledge areas and how you apply them in a typical BA engagement; describe the difference between functional and non-functional requirements with examples.',
        'Walk through your elicitation process for a complex new system — which techniques you would use (interviews, workshops, observation), how you prepare, and how you confirm shared understanding.',
        'Describe how you document requirements — explain use cases vs user stories, when you use each, and how acceptance criteria make requirements testable.',
        'Explain how you perform gap analysis — what inputs you need, how you map as-is to to-be, and how the gap defines solution scope.',
        'Walk through how you would build a requirements traceability matrix — what columns it contains, how you maintain it through change control, and how you use it to assess impact of a proposed change.',
        'Describe your approach to writing a business case — what sections it contains, how you calculate ROI, and how you present the recommendation to a non-technical executive.',
        'Explain MoSCoW prioritization — how you facilitate the session with stakeholders who disagree on priorities, and what you do when everything is labeled "Must Have."',
        'Describe how your BA role changes in an agile vs waterfall project; explain how you facilitate backlog refinement and ensure stories are sprint-ready before planning.',
        'Walk through how you would plan and manage UAT for a major system go-live — test plan structure, entry/exit criteria, defect management, and sign-off process.',
        'Describe a time you used data analysis to identify a process improvement opportunity or justify a business requirement — what data you analyzed, what insight you found, and how you communicated it to stakeholders.'
      ]
    });
  }


  if (/web.dev/i.test(name)) {
    return buildCourse({
      courseTitle: 'Web Development',
      subtitle: 'Full-stack web development pathway aligned to MDN Web Docs, The Odin Project, and freeCodeCamp curricula — the most trusted free-to-learn roadmaps in the industry.',
      difficulty: 'Intermediate',
      estimatedDuration: '3 months (8 hrs/week) | ~100 hours total',
      marketDemand: 'Web developers earn a median salary of $98,000 USD. Entry-level developers with a portfolio regularly land roles in 3-6 months. The global market for web development is growing at 8% per year.',
      overview: 'This pathway aligns to MDN Web Docs, The Odin Project, and freeCodeCamp full-stack curriculum.\n\nModule 1 (~22 hrs): HTML5 semantics, forms, accessibility, CSS box model, flexbox, grid, and responsive design.\nModule 2 (~28 hrs): JavaScript core — variables, functions, DOM, events, async/await, fetch API, and ES6+.\nModule 3 (~25 hrs): React framework — components, hooks, routing, context API, and API integration.\nModule 4 (~25 hrs): Node.js and Express — REST APIs, MongoDB, JWT authentication, and deployment.',
      learningOutcomes: [
        'Build fully responsive, accessible web pages using semantic HTML5 and CSS Grid/Flexbox.',
        'Manipulate the DOM, handle events, and make async API calls with vanilla JavaScript.',
        'Build interactive UIs with React using hooks, state management, and React Router.',
        'Design and build RESTful APIs with Node.js, Express, and MongoDB.',
        'Implement JWT-based authentication and protect API endpoints.',
        'Deploy full-stack applications to cloud platforms with environment configuration.'
      ],
      resumeSignals: [
        'Built full-stack React + Node.js application with JWT authentication and MongoDB',
        'Implemented responsive design with CSS Grid/Flexbox — passed Lighthouse accessibility audit at 95+',
        'Integrated 3 third-party REST APIs with async/await error handling and loading states',
        'Deployed production application on Railway/Vercel with environment variable configuration',
        'GitHub portfolio: 5+ projects demonstrating HTML/CSS, JavaScript, React, and Node.js proficiency'
      ],
      modules: [
        {
          title: 'HTML5 and CSS Foundations',
          objective: 'Build accessible, semantic HTML5 pages with forms and validation, and style them with CSS Box Model, Flexbox, Grid, and responsive design.',
          hours: 22,
          lesson: 'Part 1 - Semantic HTML5: Semantic elements such as header, nav, main, section, article, aside, and footer give meaning to content structure; they improve SEO, screen reader navigation, and code readability; use heading hierarchy (h1 through h6) correctly as it defines document outline and affects accessibility. Part 2 - HTML Forms and Validation: Form elements include input, textarea, select, checkbox, radio, and button; input types include text, email, number, date, tel, password, and file; HTML5 native validation attributes include required, minlength, maxlength, pattern, and min/max; the novalidate attribute disables browser validation for custom JS validation. Part 3 - Web Accessibility (WCAG): ARIA roles and attributes supplement semantic HTML for dynamic content; alt text on images must describe the image for screen reader users; color contrast ratios must meet WCAG AA (4.5:1 for normal text); keyboard navigation must work for all interactive elements; use the Lighthouse accessibility audit to identify issues. Part 4 - CSS Box Model: Every element is a box with content, padding, border, and margin; box-sizing: border-box makes width include padding and border, simplifying layout math; margin collapse occurs between adjacent vertical margins; understanding the box model is prerequisite for debugging all layout issues. Part 5 - Flexbox Layout: Flexbox solves one-dimensional layout (row or column); container properties: display:flex, flex-direction, justify-content, align-items, flex-wrap, gap; item properties: flex-grow, flex-shrink, flex-basis, align-self, order; flexbox is ideal for navigation bars, card rows, and centered content. Part 6 - CSS Grid Layout: Grid solves two-dimensional layout; container: display:grid, grid-template-columns, grid-template-rows, gap, grid-template-areas; item: grid-column, grid-row, grid-area; the fr unit allocates fractional space; repeat() and minmax() enable responsive grids without media queries. Part 7 - Responsive Design: Mobile-first approach writes base styles for small screens then uses min-width media queries to enhance for larger screens; responsive images use max-width:100% and srcset; viewport meta tag sets initial scale; the CSS clamp() function creates fluid typography without breakpoints. Part 8 - CSS Custom Properties and Modern CSS: Custom properties (CSS variables) with --property-name syntax enable theming and DRY stylesheets; CSS animations and transitions with keyframes and transition shorthand; BEM (Block-Element-Modifier) naming convention prevents specificity conflicts; CSS nesting (native and preprocessed) reduces repetition.',
          workedExample: 'Build a responsive product card grid with HTML5, Flexbox/Grid, CSS variables, and a contact form with native validation.',
          workedExampleSteps: [
            'Step 1: HTML structure — article.card with img, header h2, p.description, footer.card-actions; semantic and accessible.',
            'Step 2: CSS variables — :root { --primary: #3b82f6; --radius: 8px; --shadow: 0 2px 8px rgba(0,0,0,0.1); }',
            'Step 3: Grid layout — .card-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(280px,1fr)); gap:1.5rem; }',
            'Step 4: Card styling — .card { border-radius: var(--radius); box-shadow: var(--shadow); overflow:hidden; }',
            'Step 5: Contact form — input[type="email"] required pattern validation; fieldset grouping with legend for screen readers.',
            'Step 6: Media query — @media(max-width:640px) { .card-grid { grid-template-columns: 1fr; } }',
            'Step 7: Accessibility check — all images have descriptive alt text; form labels associated with inputs via for/id; focus styles visible.',
            'Step 8: Lighthouse audit — score accessibility 95+, performance 90+, best practices 100.'
          ],
          commonMistake: 'Using divs for everything instead of semantic HTML — divs provide no meaning; using article, section, nav, and button makes pages accessible, SEO-friendly, and maintainable.',
          practiceTask: 'Build a responsive 3-column blog post grid that collapses to 1 column on mobile. Use CSS Grid, custom properties, and semantic HTML5. Include an accessible skip-to-content link.',
          progressCheckQuestion: 'Which CSS property makes an element width include its padding and border?',
          progressCheckOptions: ['box-sizing: content-box', 'box-sizing: border-box', 'width: auto', 'overflow: hidden'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'border-box ensures width calculations include padding and border, preventing elements from overflowing their containers unexpectedly.',
          quizQuestions: [
            { question: 'Semantic HTML5 elements like article and section:', options: ['Only affect visual styling', 'Add meaning to content structure, improving accessibility and SEO', 'Replace CSS classes entirely', 'Require JavaScript to function'], correctOptionIndex: 1, explanation: 'Semantic elements communicate content meaning to browsers, screen readers, and search engines.' },
            { question: 'Mobile-first responsive design means:', options: ['Building only for mobile, ignoring desktop', 'Writing base styles for small screens and using min-width media queries to enhance for larger screens', 'Making images larger on mobile', 'Using JavaScript to detect device type'], correctOptionIndex: 1, explanation: 'Mobile-first ensures the core experience works on small screens, with progressive enhancement for larger viewports.' },
            { question: 'CSS Flexbox is best for:', options: ['Two-dimensional grid layouts', 'One-dimensional layouts in a row or column direction', 'Animating elements on scroll', 'Setting CSS custom properties'], correctOptionIndex: 1, explanation: 'Flexbox excels at one-dimensional layouts — it is the right tool for navigation bars, card rows, and centered content.' },
            { question: 'Alt text on images:', options: ['Is optional if the image is decorative', 'Describes the image for screen reader users and displays when the image fails to load', 'Only improves SEO, not accessibility', 'Is only required for product images'], correctOptionIndex: 1, explanation: 'Alt text makes images accessible to visually impaired users and serves as a fallback when images do not load.' }
          ]
        },
        {
          title: 'JavaScript Core',
          objective: 'Master JavaScript fundamentals — variables, functions, DOM manipulation, events, async/await, fetch API, ES6+, and module system.',
          hours: 28,
          lesson: 'Part 1 - Variables and Data Types: var is function-scoped and hoisted; let and const are block-scoped; always prefer const, use let when reassignment is needed, avoid var; primitive types: string, number, bigint, boolean, undefined, null, symbol; reference types: object, array, function; typeof operator; strict equality === vs loose equality ==. Part 2 - Functions and Scope: Function declarations are hoisted; function expressions and arrow functions are not; arrow functions do not have their own this binding; closures allow inner functions to access outer scope variables after the outer function returns; the call stack and execution context; IIFE pattern for encapsulation. Part 3 - Arrays and Objects: Array methods: map (transform), filter (subset), reduce (accumulate), find, findIndex, some, every, forEach, flat, flatMap; object methods: Object.keys, Object.values, Object.entries, Object.assign, Object.freeze; destructuring assignment for cleaner code; spread (...) and rest (...params) operators. Part 4 - DOM Manipulation: document.getElementById, querySelector, querySelectorAll; creating elements with createElement and insertAdjacentHTML; modifying elements with textContent, innerHTML (careful with XSS), classList, setAttribute; traversal with parentElement, children, nextElementSibling; performance: batch DOM updates, use DocumentFragment for bulk inserts. Part 5 - Event Handling: addEventListener with event types: click, input, submit, keydown, scroll, resize; event object properties: target, currentTarget, preventDefault, stopPropagation; event delegation attaches one listener to a parent to handle children dynamically; removing listeners with removeEventListener prevents memory leaks. Part 6 - Asynchronous JavaScript: The event loop, call stack, and task queue; Promises with .then/.catch/.finally; async/await syntactic sugar over Promises; Promise.all for parallel async operations; Promise.race for race conditions; error handling with try/catch around await; never ignore rejected Promises. Part 7 - Fetch API and REST Calls: fetch(url) returns a Promise; chain .then(res => res.json()) to parse JSON; handle errors: check res.ok before parsing; POST requests pass headers (Content-Type: application/json) and body (JSON.stringify); async/await with fetch; handling loading, success, and error states in the UI. Part 8 - ES6+ and Modules: Template literals with ${} interpolation; optional chaining (?.) and nullish coalescing (??); import/export (ESM) vs require/module.exports (CommonJS); named exports vs default exports; dynamic import() for code splitting; localStorage and sessionStorage for client-side persistence.',
          workedExample: 'Build a weather dashboard that fetches data from a public API, displays results dynamically, and handles all states: loading, success, and error.',
          workedExampleSteps: [
            'Step 1: HTML — input#city, button#search, div#loading (hidden), div#weather-card (hidden), div#error (hidden).',
            'Step 2: Event — button.addEventListener("click", async () => { const city = input.value.trim(); if (!city) return; })',
            'Step 3: Show loading, hide others: loading.hidden = false; weatherCard.hidden = true; error.hidden = true;',
            'Step 4: Fetch — const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`); if (!res.ok) throw new Error(await res.text());',
            'Step 5: Parse and render — const data = await res.json(); weatherCard.innerHTML = `<h2>${data.city}</h2><p>${data.temp}C, ${data.description}</p>`;',
            'Step 6: Error handling — catch(err) { error.textContent = err.message; error.hidden = false; } finally { loading.hidden = true; }',
            'Step 7: Event delegation for "Save to favorites" buttons inside dynamically rendered cards — one listener on the container.',
            'Step 8: Save favorites to localStorage; load on page init; display as chips; remove on click.'
          ],
          commonMistake: 'Using innerHTML with user-provided data creates XSS vulnerabilities — always sanitize input or use textContent/createElement for user-generated content.',
          practiceTask: 'Build a filterable list of GitHub repositories fetched from the GitHub API. Implement loading state, error handling, and a search filter using array filter() on fetched data. Deploy on GitHub Pages.',
          progressCheckQuestion: 'Which Promise method runs multiple async operations in parallel and waits for all to complete?',
          progressCheckOptions: ['Promise.race()', 'Promise.any()', 'Promise.all()', 'Promise.resolve()'],
          correctOptionIndex: 2,
          progressCheckExplanation: 'Promise.all() takes an array of Promises and resolves when all complete — it rejects immediately if any one fails.',
          quizQuestions: [
            { question: 'Arrow functions differ from regular functions because they:', options: ['Cannot be assigned to variables', 'Do not have their own this binding — they inherit this from the enclosing scope', 'Cannot accept parameters', 'Are always asynchronous'], correctOptionIndex: 1, explanation: 'Arrow functions use lexical this, making them ideal for callbacks but wrong for object methods that need their own this.' },
            { question: 'Event delegation attaches event listeners to:', options: ['Every child element individually', 'A parent element to handle events from dynamically created children', 'The document body only', 'The window object exclusively'], correctOptionIndex: 1, explanation: 'Event delegation uses event bubbling — one listener on a parent handles all child events, improving performance and supporting dynamic content.' },
            { question: 'The purpose of async/await is to:', options: ['Make code synchronous by blocking the thread', 'Write asynchronous Promise-based code in a synchronous-looking style', 'Replace all callbacks with Promises', 'Make fetch requests faster'], correctOptionIndex: 1, explanation: 'async/await is syntactic sugar over Promises — the code reads synchronously while remaining non-blocking.' },
            { question: 'XSS vulnerability occurs when:', options: ['API responses are too slow', 'User-provided data is inserted into the DOM as raw HTML via innerHTML', 'CORS headers are misconfigured', 'async/await is used incorrectly'], correctOptionIndex: 1, explanation: 'Inserting unsanitized user input as innerHTML allows attackers to inject and execute malicious scripts in users\' browsers.' }
          ]
        },
        {
          title: 'React and Modern Frontend',
          objective: 'Build interactive UIs with React using functional components, hooks, React Router, Context API, and API integration with proper state management.',
          hours: 25,
          lesson: 'Part 1 - React Fundamentals: React is a declarative, component-based UI library; the virtual DOM diffing algorithm minimizes real DOM updates; JSX is JavaScript-in-HTML syntax compiled by Babel; functional components return JSX; React re-renders a component when its state or props change; every component must return a single root element or Fragment. Part 2 - Props and State: Props are immutable data passed from parent to child; state is mutable data managed inside a component with useState hook; state updates are asynchronous and batch; never mutate state directly — always create new objects/arrays; lifting state up to a common ancestor enables sibling communication. Part 3 - Core Hooks: useState for local state; useEffect for side effects (data fetching, subscriptions, timers) — cleanup functions prevent memory leaks; useRef for DOM references and values that do not trigger re-render; useMemo and useCallback memoize expensive values and functions to prevent unnecessary recalculations; custom hooks encapsulate reusable stateful logic. Part 4 - Lists and Keys: Rendering arrays with map() returns JSX elements; each element must have a unique key prop to help React identify which items changed; keys must be stable, unique, and not array indexes when list order may change; the key prop is not accessible inside the child component. Part 5 - React Router: Install react-router-dom; BrowserRouter wraps the app; Routes and Route define URL mappings to components; Link and NavLink for navigation without page reload; useParams for URL parameters; useNavigate for programmatic navigation; useLocation for current path; nested routes with Outlet for layouts. Part 6 - Context API and State Management: createContext creates a context object; Provider wraps the component tree providing a value; useContext consumes context without prop drilling; suitable for theme, auth state, and language; for complex state use useReducer — it handles state transitions with a reducer function similar to Redux pattern. Part 7 - API Integration: Fetch data in useEffect on component mount; track loading, data, and error state with useState; async functions inside useEffect require cleanup for cancelled requests (AbortController); environment variables with REACT_APP_ prefix in Create React App or import.meta.env in Vite; never hardcode API keys in client-side code. Part 8 - Performance and Build: React.memo prevents unnecessary child re-renders when props have not changed; useCallback stabilizes function references passed as props; code splitting with React.lazy and Suspense loads components on demand; Vite provides faster development builds than CRA; production builds are minified and optimized; use React DevTools to identify render bottlenecks.',
          workedExample: 'Build a React task management app with CRUD operations, React Router, Context for auth state, and REST API integration.',
          workedExampleSteps: [
            'Step 1: Vite setup — npm create vite@latest tasks-app -- --template react; install react-router-dom axios.',
            'Step 2: Auth context — const AuthContext = createContext(); provider stores user and login/logout functions; wrap App in AuthProvider.',
            'Step 3: Protected route — if (!user) return <Navigate to="/login" />; else return <Outlet />.',
            'Step 4: Task list component — useEffect fetches tasks on mount with cleanup; tracks { tasks:[], loading:true, error:null } state.',
            'Step 5: Add task — form onSubmit posts to API; on success spread new task into tasks array (immutable update).',
            'Step 6: Delete task — DELETE request; on success filter out deleted task from state: setTasks(tasks.filter(t => t.id !== id)).',
            'Step 7: useMemo for filtered/sorted task list — avoids recalculation on unrelated state changes.',
            'Step 8: Deploy — npm run build; push dist/ to Vercel; set VITE_API_URL env variable in Vercel dashboard.'
          ],
          commonMistake: 'Mutating state directly — React will not re-render when you mutate objects or arrays in place; always create new references: setTasks([...tasks, newTask]) not tasks.push(newTask).',
          practiceTask: 'Build a React movie search app using the OMDB API. Implement search, results list, detail page with React Router, and a favorites list with Context API. Add loading and error states.',
          progressCheckQuestion: 'Which hook handles side effects like data fetching in React?',
          progressCheckOptions: ['useState', 'useReducer', 'useEffect', 'useContext'],
          correctOptionIndex: 2,
          progressCheckExplanation: 'useEffect runs after render and is used for side effects — data fetching, subscriptions, and DOM manipulation. The cleanup function prevents memory leaks.',
          quizQuestions: [
            { question: 'Why must list items in React have unique key props?', options: ['To apply CSS styles to specific items', 'To help React identify which items changed, were added, or removed for efficient updates', 'To make the list sortable by users', 'To satisfy TypeScript type checking'], correctOptionIndex: 1, explanation: 'Keys enable React\'s diffing algorithm to reconcile list changes efficiently without re-rendering the entire list.' },
            { question: 'Context API is best used for:', options: ['Local component state management', 'Global state like auth, theme, or language — avoiding deep prop drilling', 'Replacing useState entirely', 'Managing server state and caching'], correctOptionIndex: 1, explanation: 'Context provides global state to any component in the tree without passing props through every level.' },
            { question: 'React.memo prevents:', options: ['API calls from being cached', 'Unnecessary re-renders of a child component when its props have not changed', 'useEffect from running twice', 'State from being reset on route change'], correctOptionIndex: 1, explanation: 'React.memo wraps a component and skips re-rendering if props are shallowly equal to the previous render.' },
            { question: 'AbortController in useEffect is used to:', options: ['Cancel animations on unmount', 'Cancel in-flight API requests when the component unmounts, preventing memory leaks', 'Stop the render cycle', 'Abort form submissions'], correctOptionIndex: 1, explanation: 'Without cleanup, a fetch completing after unmount tries to set state on an unmounted component — AbortController prevents this.' }
          ]
        },
        {
          title: 'Backend with Node.js and Express',
          objective: 'Build RESTful APIs with Node.js and Express, connect to MongoDB with Mongoose, implement JWT authentication, and deploy to a cloud platform.',
          hours: 25,
          lesson: 'Part 1 - Node.js Runtime: Node.js executes JavaScript outside the browser using the V8 engine; it uses an event-driven, non-blocking I/O model making it efficient for concurrent I/O-heavy applications; the npm ecosystem provides over 2 million packages; package.json tracks dependencies and scripts; nodemon enables hot reload during development. Part 2 - Express Framework: Express is a minimal, unopinionated Node.js web framework; app.get/post/put/delete/patch define route handlers; the request object contains params, query, body, and headers; the response object provides json(), status(), send(), and redirect(); error-handling middleware has four parameters (err, req, res, next). Part 3 - Middleware: Middleware functions receive (req, res, next) and can read/modify requests, end the cycle, or pass to the next function; built-in middleware: express.json(), express.urlencoded(); third-party: cors, morgan (logging), helmet (security headers); custom middleware for logging, auth, and validation runs in order of registration. Part 4 - REST API Design: Resources are nouns in plural form: /users, /products; HTTP methods map to CRUD: GET (read), POST (create), PUT/PATCH (update), DELETE (remove); status codes: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Server Error; versioning with /api/v1/ prefix. Part 5 - MongoDB and Mongoose: MongoDB is a NoSQL document database; Mongoose provides schemas, models, and validation; Schema defines fields and types; Model.create, Model.find, Model.findById, Model.findByIdAndUpdate, Model.findByIdAndDelete; populate() resolves references; indexes speed queries; .lean() returns plain objects for better performance when read-only. Part 6 - JWT Authentication: Users POST credentials; server validates and signs a JWT with a secret (HS256) or private key (RS256); JWT payload contains userId, role, and expiry; client stores token in httpOnly cookie (secure) or localStorage (XSS risk); auth middleware extracts token from Authorization header, verifies with jsonwebtoken, and attaches user to req.user. Part 7 - Input Validation and Security: Never trust client input — validate all inputs with express-validator or Joi; sanitize to prevent injection attacks; use helmet for security headers; rate limit endpoints with express-rate-limit to prevent brute force; bcrypt for password hashing (salt rounds 12+); store secrets in .env, never in code; use HTTPS in production. Part 8 - Deployment: Separate development, staging, and production environments with NODE_ENV; environment variables via .env locally and platform settings in production; deploy to Railway, Render, or Heroku with a Procfile or detected start script; set up health check endpoint /health; use PM2 for process management in self-hosted environments; enable CORS only for trusted origins in production.',
          workedExample: 'Build a complete REST API for a task manager: CRUD endpoints, MongoDB, JWT auth, input validation, and Railway deployment.',
          workedExampleSteps: [
            'Step 1: Setup — npm init -y; npm install express mongoose jsonwebtoken bcrypt dotenv express-validator cors helmet.',
            'Step 2: MongoDB connection in db.js — mongoose.connect(process.env.MONGO_URI); export connection function; call in app.js startup.',
            'Step 3: User model — Schema with email (unique, required, trim), password (minlength 8), createdAt; pre-save hook hashes password with bcrypt.',
            'Step 4: Auth routes — POST /api/v1/auth/register validates email+password, hashes, saves; POST /api/v1/auth/login finds user, compares hash, returns signed JWT.',
            'Step 5: Auth middleware — extract Bearer token from Authorization header; verify with jwt.verify; attach decoded user to req.user; return 401 if invalid.',
            'Step 6: Task routes — all protected by authMiddleware; GET /tasks returns req.user._id tasks; POST /tasks creates with userId; DELETE /tasks/:id verifies ownership.',
            'Step 7: Global error handler — app.use((err,req,res,next) => res.status(err.status||500).json({error:err.message})).',
            'Step 8: Deploy to Railway — connect GitHub repo; set MONGO_URI and JWT_SECRET env vars; auto-deploy on push to main.'
          ],
          commonMistake: 'Storing JWT in localStorage exposes it to XSS attacks; prefer httpOnly cookies which JavaScript cannot access; also never store sensitive user data in JWT payload — anyone can base64-decode it.',
          practiceTask: 'Build a REST API for a blog platform: users can register, login, create posts, and comment. Protect write endpoints with JWT auth. Validate all inputs. Deploy to Railway and test with Postman.',
          progressCheckQuestion: 'Which HTTP method is used to update a resource partially in REST APIs?',
          progressCheckOptions: ['PUT', 'POST', 'PATCH', 'DELETE'],
          correctOptionIndex: 2,
          progressCheckExplanation: 'PATCH updates part of a resource; PUT replaces the entire resource. PATCH is preferred for partial updates as it requires only the changed fields.',
          quizQuestions: [
            { question: 'Express middleware with four parameters (err,req,res,next) is:', options: ['A route handler', 'An error-handling middleware', 'An authentication function', 'A validation middleware'], correctOptionIndex: 1, explanation: 'Error-handling middleware is identified by its four-parameter signature and catches errors passed via next(err) calls.' },
            { question: 'JWT tokens should be stored in:', options: ['localStorage for easy access from JavaScript', 'httpOnly cookies to protect against XSS attacks', 'URL query parameters', 'The DOM as a hidden input'], correctOptionIndex: 1, explanation: 'httpOnly cookies are inaccessible to JavaScript, preventing XSS from stealing the token; localStorage is vulnerable to script injection.' },
            { question: 'Mongoose populate() is used to:', options: ['Add indexes to collections', 'Resolve document references, replacing IDs with full documents', 'Create schema validation rules', 'Connect to multiple databases'], correctOptionIndex: 1, explanation: 'populate() replaces object IDs stored in a document with the actual referenced documents — similar to SQL JOIN.' },
            { question: 'bcrypt salt rounds determine:', options: ['Password length requirement', 'Computational cost — higher rounds make brute-force attacks slower at the cost of hash time', 'Number of login attempts allowed', 'JWT expiry duration'], correctOptionIndex: 1, explanation: 'Higher salt rounds exponentially increase hash time — 12 is a reasonable modern default balancing security and performance.' }
          ]
        }
      ],
      finalAssessment: [
        { question: 'box-sizing: border-box makes element width:', options: ['Exclude padding and border', 'Include padding and border — preventing overflow surprises', 'Auto-adjust for viewport', 'Apply to all child elements'], correctOptionIndex: 1, explanation: 'border-box simplifies layout math by including padding and border in the declared width.' },
        { question: 'Semantic HTML5 elements improve:', options: ['Visual styling only', 'Accessibility and SEO by adding meaning to content structure', 'JavaScript performance', 'CSS specificity calculations'], correctOptionIndex: 1, explanation: 'Semantic elements communicate content meaning to screen readers, search engines, and developers.' },
        { question: 'Arrow functions differ from regular functions because:', options: ['They cannot accept parameters', 'They do not have their own this — they inherit it lexically', 'They are always async', 'They cannot return values'], correctOptionIndex: 1, explanation: 'Arrow functions use lexical this, making them ideal for callbacks but wrong for object methods.' },
        { question: 'XSS vulnerability is caused by:', options: ['Slow API responses', 'Inserting unsanitized user data as innerHTML in the DOM', 'CORS misconfiguration', 'Missing alt attributes on images'], correctOptionIndex: 1, explanation: 'Raw innerHTML with user input allows attackers to inject executable scripts into other users\' browsers.' },
        { question: 'Promise.all() resolves when:', options: ['The first Promise resolves', 'All Promises resolve, or immediately rejects if any one fails', 'The slowest Promise resolves and others are cancelled', 'All Promises reject'], correctOptionIndex: 1, explanation: 'Promise.all() awaits all — useful for parallel independent async operations.' },
        { question: 'React useEffect with empty dependency array runs:', options: ['On every render', 'Once after the first render — equivalent to componentDidMount', 'Only when state changes', 'Never automatically'], correctOptionIndex: 1, explanation: 'Empty dependency array [] tells React to run the effect only once after mounting.' },
        { question: 'React keys in lists must be:', options: ['Array indexes always', 'Stable, unique IDs that identify the item across renders', 'CSS class names', 'The item title text'], correctOptionIndex: 1, explanation: 'Stable unique IDs help React identify changed items; using array indexes breaks when items reorder.' },
        { question: 'Context API is best suited for:', options: ['Local component state', 'Global state like auth/theme shared across many components', 'Async API state management', 'Performance optimization of renders'], correctOptionIndex: 1, explanation: 'Context avoids prop drilling for truly global state like authentication and theme preferences.' },
        { question: 'PATCH HTTP method is used to:', options: ['Create a new resource', 'Partially update an existing resource', 'Replace an entire resource', 'Delete a resource'], correctOptionIndex: 1, explanation: 'PATCH updates specific fields; PUT replaces the whole resource.' },
        { question: 'JWT should be stored in:', options: ['localStorage for easy JavaScript access', 'httpOnly cookies to prevent XSS theft', 'URL parameters', 'DOM hidden inputs'], correctOptionIndex: 1, explanation: 'httpOnly cookies are inaccessible to JavaScript, protecting tokens from XSS attacks.' },
        { question: 'Express error-handling middleware is identified by:', options: ['A route path beginning with /error', 'A 4-parameter signature (err, req, res, next)', 'app.error() method call', 'A try/catch block in the route'], correctOptionIndex: 1, explanation: 'The four-parameter signature signals to Express that this middleware handles errors passed via next(err).' },
        { question: 'Mongoose populate() does what?', options: ['Adds database indexes', 'Replaces object ID references with full documents — like a SQL JOIN', 'Creates schema validation', 'Seeds the database with test data'], correctOptionIndex: 1, explanation: 'populate() resolves document references, replacing stored IDs with the actual related documents.' },
        { question: 'CSS Flexbox is best for:', options: ['Two-dimensional grid layouts', 'One-dimensional row or column alignment', 'Database-driven content grids', 'CSS animations and transitions'], correctOptionIndex: 1, explanation: 'Flexbox is the right tool for one-dimensional layouts like navigation bars and card rows.' },
        { question: 'Event delegation attaches listeners to:', options: ['Every child element', 'A parent element to handle events from dynamic children efficiently', 'The window object only', 'Each event type individually'], correctOptionIndex: 1, explanation: 'Event delegation leverages bubbling — one parent listener handles all child events including dynamically added ones.' },
        { question: 'bcrypt is used to:', options: ['Encrypt JWT tokens', 'Hash passwords with a salt so the hash cannot be reversed or easily brute-forced', 'Sign API requests', 'Validate email addresses'], correctOptionIndex: 1, explanation: 'bcrypt is the industry standard for password hashing — its adaptive cost function makes brute force attacks impractical.' }
      ],
      interviewPrep: [
        'Explain the CSS Box Model and describe how box-sizing: border-box changes layout behavior; demonstrate how you would build a responsive 3-column card grid that collapses on mobile.',
        'Walk through JavaScript event bubbling and delegation — explain how you would use event delegation for a dynamically rendered list with delete buttons.',
        'Explain async/await and how it compares to Promise chains; describe how you handle all three states (loading, success, error) when fetching data in a React component.',
        'Describe React\'s reconciliation process — why keys matter in lists, when you would use useMemo vs useCallback, and how to diagnose unnecessary re-renders with React DevTools.',
        'Walk through building a JWT authentication system — user registration with bcrypt, login endpoint, token generation, auth middleware, and protected route pattern in Express.',
        'Explain REST API design principles — HTTP methods, status codes, URI design, versioning, and pagination; describe the difference between PUT and PATCH.',
        'Describe the React Context API vs Redux — when you would choose each and how you have used Context for global auth state in a project.',
        'Explain how you would prevent common web security vulnerabilities: XSS (innerHTML sanitization), CSRF (SameSite cookies), SQL/NoSQL injection (input validation), and rate limiting.',
        'Walk through deploying a full-stack React + Node.js app — build process, environment variables, CORS configuration, and monitoring in production.',
        'Explain the difference between server-side rendering (Next.js), client-side rendering (React), and static site generation — when you would choose each approach.'
      ]
    });
  }

  // ── API DEVELOPMENT (REST / OpenAPI 3.0 aligned, ~45 hrs) ─────────────────
  if (/api.dev/i.test(name)) {
    return buildCourse({
      courseTitle: 'API Development',
      subtitle: 'Aligned to REST architectural constraints, OpenAPI 3.0 specification, and OWASP API Security Top 10 — the industry standards for professional API design.',
      difficulty: 'Intermediate',
      estimatedDuration: '7 weeks (7 hrs/week) | ~45 hours total',
      marketDemand: 'API development is a core skill for all backend, full-stack, and integration engineer roles. API engineers earn $110,000-$160,000 USD. REST is the dominant web API style in 83% of production APIs.',
      overview: 'This pathway covers REST design through OpenAPI documentation and secure deployment.\n\nModule 1 (~10 hrs): REST constraints, HTTP methods/status codes, URI design, versioning, and pagination.\nModule 2 (~12 hrs): Building APIs with Node.js/Express — routing, validation, error handling, and database integration.\nModule 3 (~12 hrs): Authentication (JWT/OAuth 2.0), CORS, rate limiting, and OWASP API Security Top 10.\nModule 4 (~11 hrs): OpenAPI/Swagger documentation, testing with Postman/Jest, and production deployment.',
      learningOutcomes: [
        'Design RESTful APIs following all six REST constraints with clean URI patterns.',
        'Build and structure Express.js APIs with middleware, validation, and error handling.',
        'Implement JWT and OAuth 2.0 authentication flows securely.',
        'Apply OWASP API Security Top 10 mitigations to production APIs.',
        'Document APIs with OpenAPI 3.0 specification and Swagger UI.',
        'Test APIs with Postman collections and automated Jest integration tests.'
      ],
      resumeSignals: [
        'Designed and built RESTful API handling 10k+ requests/day with OpenAPI 3.0 documentation',
        'Implemented OAuth 2.0 authorization code flow with PKCE for public client applications',
        'Applied OWASP API Security Top 10 — prevented BOLA vulnerabilities with object-level authorization checks',
        'Wrote Postman collection and Jest integration test suite with 90%+ endpoint coverage',
        'Deployed versioned API to Railway with rate limiting, helmet security headers, and structured logging'
      ],
      modules: [
        {
          title: 'REST API Design Principles',
          objective: 'Explain all six REST constraints, apply HTTP methods and status codes correctly, design clean URI patterns, and implement pagination and versioning.',
          hours: 10,
          lesson: 'Part 1 - REST Architectural Constraints: REST (Representational State Transfer) has six constraints defined by Roy Fielding: uniform interface, stateless, client-server, cacheable, layered system, and code-on-demand (optional); uniform interface is the most important, achieved through standardized HTTP methods, resource URIs, and self-descriptive messages. Part 2 - HTTP Methods and Idempotency: GET retrieves a resource and is safe and idempotent; POST creates a new resource and is neither; PUT replaces a resource completely and is idempotent; PATCH partially updates a resource and is idempotent if designed correctly; DELETE removes a resource and is idempotent; safe methods do not modify server state. Part 3 - HTTP Status Codes: 200 OK, 201 Created (POST success), 204 No Content (DELETE success), 400 Bad Request (invalid input), 401 Unauthorized (missing or invalid credentials), 403 Forbidden (authenticated but not authorized), 404 Not Found, 409 Conflict (duplicate), 422 Unprocessable Entity (validation error), 429 Too Many Requests, 500 Internal Server Error. Part 4 - URI Design Best Practices: Resources are nouns in lowercase plural: /users, /orders, /products; never use verbs in URIs (/getUser is wrong); hierarchical relationships use nesting: /users/{id}/orders; query parameters for filtering, sorting, and searching: /products?category=shoes&sort=price; avoid deep nesting beyond 2 levels. Part 5 - API Versioning: URL versioning (/api/v1/) is the most visible and widely used; header versioning (Accept: application/vnd.api+json;version=2) is more RESTful but harder to test; query parameter versioning (/api/products?version=2) is simple but pollutes the URL; semantic versioning (major.minor.patch) guides version increment decisions. Part 6 - Pagination: Offset-based pagination uses ?page=2&limit=20; cursor-based pagination uses an opaque cursor pointing to the last seen item (better for real-time data); response should include total count, next/previous cursor, and self-link; never return unbounded lists — always paginate. Part 7 - Content Negotiation: The Accept header specifies the preferred response format (application/json, application/xml); Content-Type header specifies the request body format; 406 Not Acceptable when the server cannot produce the requested format; API should default to JSON if Accept is missing. Part 8 - HATEOAS and API Maturity: HATEOAS (Hypermedia as Engine of Application State) embeds links in responses guiding clients to related actions; Richardson Maturity Model levels: Level 0 (one URI, one method), Level 1 (multiple URIs), Level 2 (correct HTTP methods), Level 3 (HATEOAS); most production APIs target Level 2; Level 3 adds discoverability but adds complexity.',
          workedExample: 'Design a complete URI scheme for an e-commerce API: products, orders, users, reviews, and pagination.',
          workedExampleSteps: [
            'Step 1: Resources — /api/v1/users, /api/v1/products, /api/v1/orders, /api/v1/reviews.',
            'Step 2: Nested: GET /api/v1/users/{userId}/orders (user\'s orders); GET /api/v1/products/{productId}/reviews.',
            'Step 3: HTTP methods — GET /products (list), POST /products (create), GET /products/{id} (detail), PATCH /products/{id} (update), DELETE /products/{id} (remove).',
            'Step 4: Filtering — GET /products?category=electronics&minPrice=100&maxPrice=500&sort=rating&order=desc.',
            'Step 5: Pagination — GET /products?cursor=eyJpZCI6NTB9&limit=20. Response: { data:[...], nextCursor:"eyJpZCI6NzB9", total:847 }.',
            'Step 6: Versioning strategy — /api/v1/ for current; /api/v2/ when breaking changes ship; maintain v1 for 12 months after v2 GA.',
            'Step 7: Status codes — POST /orders 201 Created with Location header; PATCH /orders/{id} 200 OK; DELETE /orders/{id} 204 No Content.',
            'Step 8: Error response shape — { "error": { "code": "VALIDATION_ERROR", "message": "email is required", "field": "email" } }.'
          ],
          commonMistake: 'Using verbs in URIs (/api/getUser, /api/deleteOrder) is not REST — URIs identify resources; HTTP methods express the action; /users/{id} with DELETE is the correct pattern.',
          practiceTask: 'Design a complete URI scheme for a blog API (posts, comments, authors, tags). Define HTTP methods, status codes, filtering, and pagination for each resource. Document in a table.',
          progressCheckQuestion: 'Which HTTP status code indicates a resource was successfully created?',
          progressCheckOptions: ['200 OK', '201 Created', '204 No Content', '202 Accepted'],
          correctOptionIndex: 1,
          progressCheckExplanation: '201 Created is the correct response to a successful POST request that creates a new resource. The Location header should contain the URI of the new resource.',
          quizQuestions: [
            { question: 'Which HTTP method replaces an entire resource?', options: ['POST', 'PATCH', 'PUT', 'GET'], correctOptionIndex: 2, explanation: 'PUT replaces the complete resource. PATCH makes partial updates. Using PUT with incomplete data will overwrite unspecified fields with null.' },
            { question: 'Cursor-based pagination is preferred over offset-based when:', options: ['Total page count is known', 'Data changes in real time or at very large scale — offset can skip or duplicate items', 'Simple blogs with few records', 'The API is internal only'], correctOptionIndex: 1, explanation: 'Offset pagination breaks on real-time data — if a new item is inserted before your current offset, you see duplicates or miss items.' },
            { question: 'REST stateless constraint means:', options: ['The API never returns state', 'Each request must contain all information needed — the server stores no client session state', 'Responses are never cached', 'The client never stores data'], correctOptionIndex: 1, explanation: 'Stateless improves scalability — any server instance can handle any request because no session state is stored server-side.' },
            { question: 'HTTP 403 Forbidden differs from 401 Unauthorized in that:', options: ['403 means the request is malformed', '403 means authenticated but not authorized; 401 means not authenticated at all', '403 is a server error; 401 is a client error', 'They are interchangeable'], correctOptionIndex: 1, explanation: '401 says "I do not know who you are — please authenticate"; 403 says "I know who you are, but you do not have permission."' }
          ]
        },
        {
          title: 'Building APIs with Node.js and Express',
          objective: 'Structure Express applications with routing, middleware, input validation, error handling, and MongoDB and PostgreSQL database integration.',
          hours: 12,
          lesson: 'Part 1 - Express Application Structure: Separate concerns into routes, controllers, services, and models; routes define endpoints and delegate to controllers; controllers handle request/response cycle; services contain business logic; models define data schemas; this layered architecture keeps files small and testable. Part 2 - Router and Route Handlers: express.Router() creates modular route files; route parameters (:id), query strings (?filter=), and request body; chaining route methods with router.route("/users").get(list).post(create); route-level middleware applies to specific routes; router.param() for parameter-level middleware. Part 3 - Middleware Chain: Middleware runs in registration order; global middleware (cors, helmet, morgan, express.json) registered before routes; route-specific middleware for auth checks; async middleware must wrap with try/catch or use a wrapper like express-async-errors; calling next() without arguments passes to the next handler; next(err) jumps to error handler. Part 4 - Input Validation: Validate all incoming data at the API boundary using express-validator or Joi; validate request body, params, and query strings; return 422 with specific field errors for validation failures; sanitize inputs to prevent injection; never trust client data even from authenticated users. Part 5 - MongoDB with Mongoose: Define Schema with field types, required flags, defaults, and validators; indexing fields used in queries (unique indexes, compound indexes); query builders: find, findOne, findById, updateOne, deleteOne; aggregation pipeline for complex queries; transactions for multi-document atomic operations. Part 6 - PostgreSQL with Sequelize: Sequelize defines models that map to tables; migrations track schema changes; associations: hasOne, hasMany, belongsTo, belongsToMany; raw queries for complex SQL; connection pooling for production; parameterized queries prevent SQL injection — never use string concatenation in queries. Part 7 - Response Consistency: All API responses should follow a consistent shape: { success, data, error, meta }; success responses include data and optional pagination meta; error responses include error code, message, and optionally field-level errors; HTTP status codes must accurately reflect the outcome. Part 8 - Structured Logging and Monitoring: Use winston or pino for structured JSON logging; log request id, method, path, status, duration; never log sensitive data (passwords, tokens, PII); log levels: error (actionable), warn (anomalies), info (notable events), debug (development only); export logs to a centralized service (Datadog, CloudWatch) in production.',
          workedExample: 'Build a layered Express API for a library management system with books and patrons, Mongoose, validation, and structured error responses.',
          workedExampleSteps: [
            'Step 1: Folder structure — src/routes/books.js, src/controllers/bookController.js, src/services/bookService.js, src/models/Book.js.',
            'Step 2: Book schema — { title: { type:String, required:true, trim:true }, isbn: { type:String, unique:true }, author: ObjectId ref Users, available: Boolean }.',
            'Step 3: Validation middleware — body("title").notEmpty().trim().isLength({max:200}); body("isbn").matches(/^[0-9-]{13}$/).',
            'Step 4: GET /api/v1/books — query: ?available=true&author=&sort=title&page=1&limit=20; service layer builds query and returns paginated results.',
            'Step 5: POST /api/v1/books — validate body; check ISBN uniqueness (catch duplicate key error 11000); return 201 with created resource.',
            'Step 6: PATCH /api/v1/books/:id — validate id is valid ObjectId; only update provided fields using $set; return updated document.',
            'Step 7: Error handler — 11000 duplicate key -> 409 Conflict; CastError invalid id -> 404 Not Found; ValidationError -> 422 with field errors.',
            'Step 8: Logging middleware — log { requestId, method, path, status, duration, userId } for every request using pino.'
          ],
          commonMistake: 'Putting all business logic in route handlers (controller bloat) — controllers should only extract request data, call a service, and send the response; services contain the actual business logic and are independently testable.',
          practiceTask: 'Build a layered Express API for a recipe platform (recipes, ingredients, users). Implement GET list with filtering/pagination, POST create with validation, PATCH update, DELETE, and consistent error responses.',
          progressCheckQuestion: 'Input validation in an API should occur:',
          progressCheckOptions: ['In the database model only', 'At the API boundary (route level) before any business logic runs', 'Only when data is saved to the database', 'In the frontend before the request is sent'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'Validating at the API boundary catches invalid data before it reaches business logic or the database — fail fast, fail clearly with actionable error messages.',
          quizQuestions: [
            { question: 'Why separate routes, controllers, and services in Express?', options: ['It is a Node.js requirement', 'Separation of concerns makes code testable, maintainable, and easier to change', 'It is required for Mongoose to work', 'It improves API response speed'], correctOptionIndex: 1, explanation: 'Layered architecture ensures each layer has a single responsibility — routes handle HTTP, controllers handle request/response, services handle business logic.' },
            { question: 'Mongoose unique index violations return error code:', options: ['400', '11000', '422', '409'], correctOptionIndex: 1, explanation: 'MongoDB returns error code 11000 for duplicate key violations — handle this in error middleware to return 409 Conflict to clients.' },
            { question: 'Parameterized queries in SQL are used to:', options: ['Improve query performance through caching', 'Prevent SQL injection by separating query structure from data', 'Enable query logging', 'Support multiple databases simultaneously'], correctOptionIndex: 1, explanation: 'Parameterized queries ensure user input is treated as data, never as executable SQL — preventing injection attacks.' },
            { question: 'next(err) in Express middleware:', options: ['Moves to the next route handler normally', 'Skips all middleware and routes to jump directly to the error handler', 'Logs the error and continues', 'Sends a 500 response automatically'], correctOptionIndex: 1, explanation: 'Calling next(err) bypasses all remaining middleware and routes, passing control to the error-handling middleware (4-parameter function).' }
          ]
        },
        {
          title: 'Authentication, Security, and CORS',
          objective: 'Implement JWT authentication, OAuth 2.0 flows, apply OWASP API Security Top 10, configure CORS, and add rate limiting.',
          hours: 12,
          lesson: 'Part 1 - JWT Authentication: JWT (JSON Web Token) has three base64url-encoded parts: header (algorithm), payload (claims), and signature; server signs with secret (HMAC-SHA256) or private key (RS256); payload contains sub (user ID), role, and exp (expiry); never put sensitive data in payload — anyone can decode it; short expiry (15-30 min) plus refresh token is best practice. Part 2 - Refresh Token Pattern: Short-lived access token (15 min) stored in memory or httpOnly cookie; long-lived refresh token (7-30 days) stored only in httpOnly Secure cookie; POST /auth/refresh exchanges valid refresh token for new access token; revoking refresh tokens on logout prevents token theft reuse; refresh token rotation improves security. Part 3 - OAuth 2.0 Flows: Authorization code flow for server-side apps; PKCE (Proof Key for Code Exchange) for public clients (SPAs, mobile); client credentials flow for machine-to-machine; implicit flow is deprecated; OpenID Connect (OIDC) adds identity layer on top of OAuth 2.0 providing ID tokens with user claims. Part 4 - OWASP API Security Top 10: API1 Broken Object Level Authorization — verify user owns the resource before returning it; API2 Broken Authentication — enforce strong password policies, MFA, and short token expiry; API3 Broken Object Property Level Authorization — do not expose fields users should not see; API4 Unrestricted Resource Consumption — add rate limits and payload size limits; API5 Broken Function Level Authorization — role checks on sensitive endpoints. Part 5 - OWASP API Security (continued): API6 Unrestricted Access to Sensitive Business Flows — rate limit flows like login and checkout; API7 Server Side Request Forgery — validate and whitelist URLs if the API fetches URLs; API8 Security Misconfiguration — disable debug in production, use HTTPS, remove default credentials; API9 Improper Inventory Management — maintain API catalog, deprecate old versions; API10 Unsafe Consumption of APIs — validate and sanitize data from third-party APIs. Part 6 - CORS Configuration: CORS preflight OPTIONS request checks origin, method, and headers; Access-Control-Allow-Origin should list specific trusted origins not wildcard in production; Access-Control-Allow-Methods and Access-Control-Allow-Headers must enumerate permitted values; Access-Control-Allow-Credentials: true required for cross-origin cookies; misconfigured CORS enabling arbitrary origins is a critical vulnerability. Part 7 - Rate Limiting and Throttling: express-rate-limit middleware sets max requests per window per IP; apply strict limits on auth endpoints (5 requests per 15 min); looser limits on read endpoints; return 429 Too Many Requests with Retry-After header; use Redis-backed rate limiter in multi-instance deployments for accuracy across instances. Part 8 - Security Headers with Helmet: helmet.js sets multiple security headers in one call; Content-Security-Policy prevents XSS; X-Frame-Options prevents clickjacking; X-Content-Type-Options prevents MIME sniffing; Strict-Transport-Security enforces HTTPS; Referrer-Policy controls referrer information leakage; configure CSP carefully — too strict breaks third-party scripts.',
          workedExample: 'Implement a complete auth flow: registration, login, JWT issuance, refresh tokens, protected routes, and OWASP BOLA prevention.',
          workedExampleSteps: [
            'Step 1: Register — POST /auth/register; validate email+password; hash password with bcrypt(12); save user; return 201.',
            'Step 2: Login — POST /auth/login; find user; compare bcrypt hash; sign accessToken (exp:15min) + refreshToken (exp:7d) with different secrets.',
            'Step 3: Set refreshToken in httpOnly Secure SameSite=Strict cookie; return accessToken in response body to store in memory.',
            'Step 4: Auth middleware — extract Bearer token from Authorization header; verify with jwt.verify; attach req.user = { id, role }.',
            'Step 5: BOLA check — GET /api/v1/orders/:id; after auth middleware: if (order.userId.toString() !== req.user.id) return 403; never skip this check.',
            'Step 6: Refresh — POST /auth/refresh; read refreshToken from cookie; verify; issue new accessToken; rotate refreshToken.',
            'Step 7: Rate limit — authLimiter: max 5 per 15 min; apiLimiter: max 100 per 1 min; apply authLimiter to /auth/login and /auth/register only.',
            'Step 8: CORS config — allowedOrigins: ["https://app.mysite.com"]; credentials:true; reject requests from unlisted origins with 403.'
          ],
          commonMistake: 'Checking authentication (is the user logged in?) but not authorization (does this user own this resource?) — BOLA is the most common critical API vulnerability; always verify resource ownership, not just auth status.',
          practiceTask: 'Implement JWT auth for your Express API: registration, login, refresh token rotation, auth middleware, and BOLA-safe resource ownership checks on at least 3 endpoints. Test with Postman.',
          progressCheckQuestion: 'OWASP API1 (Broken Object Level Authorization) is prevented by:',
          progressCheckOptions: ['Using HTTPS for all requests', 'Verifying that the authenticated user owns the requested resource before returning it', 'Enabling rate limiting on all endpoints', 'Using OAuth 2.0 instead of JWT'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'BOLA occurs when an API returns resources based on an ID without verifying the requester owns them — always check req.user.id === resource.userId before responding.',
          quizQuestions: [
            { question: 'JWT payload can be read by:', options: ['Only the server with the secret', 'Anyone — it is base64url encoded, not encrypted', 'Only authenticated users', 'Nobody without decryption key'], correctOptionIndex: 1, explanation: 'JWTs are signed not encrypted — the payload is only base64url encoded and can be decoded by anyone; never store sensitive data in the payload.' },
            { question: 'PKCE (Proof Key for Code Exchange) is required for:', options: ['Server-side web apps with client secrets', 'Public clients like SPAs and mobile apps that cannot safely store a client secret', 'Machine-to-machine API calls', 'All OAuth 2.0 flows regardless of client type'], correctOptionIndex: 1, explanation: 'Public clients cannot securely store a client secret; PKCE uses a cryptographic code challenge/verifier to prevent authorization code interception attacks.' },
            { question: 'CORS wildcard origin (Access-Control-Allow-Origin: *) in production:', options: ['Is the recommended approach for public APIs', 'Is a security risk when used with credentials — any website can make authenticated cross-origin requests', 'Is required for JWT authentication to work', 'Improves API performance'], correctOptionIndex: 1, explanation: 'Wildcard origin with credentials enabled allows any malicious website to make authenticated requests on behalf of logged-in users.' },
            { question: 'Rate limiting is applied most strictly to:', options: ['Read-only data endpoints', 'Authentication endpoints to prevent brute-force credential attacks', 'Documentation endpoints', 'Admin-only endpoints'], correctOptionIndex: 1, explanation: 'Login and registration endpoints are primary brute-force targets — strict rate limits (e.g., 5 per 15 min) are essential protection.' }
          ]
        },
        {
          title: 'Documentation, Testing, and Deployment',
          objective: 'Document APIs with OpenAPI 3.0/Swagger, write Postman collections, implement Jest integration tests, and deploy versioned APIs to production.',
          hours: 11,
          lesson: 'Part 1 - OpenAPI 3.0 Specification: OpenAPI (formerly Swagger) is the industry standard for describing REST APIs; YAML or JSON format; key sections: info (title/version/description), servers, paths (endpoints), components (schemas/securitySchemes/responses); each path includes summary, parameters, requestBody, and responses with schemas. Part 2 - Writing OpenAPI Definitions: requestBody schema uses $ref to reusable components/schemas; response schemas define success and error shapes; parameters include name, in (path/query/header/cookie), required, and schema; security schemes define bearer JWT, API key, or OAuth 2.0 flows; the spec becomes a contract between API producers and consumers. Part 3 - Swagger UI and Code Generation: swagger-ui-express serves an interactive API explorer from the spec; developers can test endpoints directly in the browser; openapi-generator produces client SDKs (JavaScript, Python, Java, Go) from the spec; this automation reduces integration effort and keeps clients in sync. Part 4 - Postman Collections: Collections organize requests by resource; environments store base URL, tokens, and variables; pre-request scripts set up auth tokens automatically; test scripts validate response status codes, schemas, and values; run collections with Newman CLI in CI/CD pipelines for automated API regression testing. Part 5 - Unit and Integration Testing with Jest: Unit tests cover individual functions (validation logic, utility functions) in isolation with mocked dependencies; integration tests hit actual endpoints using supertest; describe/it/expect structure; beforeAll connects test database; afterAll tears down; beforeEach seeds test data; afterEach cleans up. Part 6 - Test Coverage and CI: Aim for 80%+ line coverage on business logic; coverage reports with jest --coverage; GitHub Actions runs tests on every PR; failing tests block merges via branch protection rules; test in isolation — never test against production data. Part 7 - API Versioning and Deprecation: Maintain multiple API versions simultaneously during transition periods; add deprecation warnings via Sunset and Deprecation response headers; communicate deprecation timelines to consumers; provide migration guides; sunset v1 after v2 has been stable for a defined period (e.g., 6-12 months). Part 8 - Production Deployment: Environment-specific configuration with dotenv; health check endpoint GET /health returns 200 with version and uptime; graceful shutdown handles in-flight requests before process exit; horizontal scaling with PM2 cluster mode or container replicas; API gateway (Kong, AWS API Gateway) adds centralized auth, rate limiting, and routing; structured logging ships to Datadog or CloudWatch for production observability.',
          workedExample: 'Write OpenAPI 3.0 spec for the task API, create a Postman collection, and write Jest integration tests for all CRUD endpoints.',
          workedExampleSteps: [
            'Step 1: openapi.yaml — info: { title: Task API, version: 1.0.0 }; servers: [{ url: http://localhost:3000/api/v1 }].',
            'Step 2: Path definition — /tasks: get: { summary: List tasks, parameters: [{ name: status, in: query, schema: { type: string } }], responses: { 200: { content: { application/json: { schema: { $ref: #/components/schemas/TaskList } } } } } }.',
            'Step 3: Component schema — TaskList: { type: array, items: { $ref: #/components/schemas/Task } }; Task: { type: object, required: [title], properties: { id, title, status, userId } }.',
            'Step 4: Postman environment — BASE_URL: http://localhost:3000/api/v1; TOKEN variable auto-set by login request test script.',
            'Step 5: Postman test script on login — pm.environment.set("TOKEN", pm.response.json().accessToken); pm.test("status 200", () => pm.expect(pm.response.code).to.equal(200)).',
            'Step 6: Jest test — describe("POST /tasks", () => { it("creates a task", async () => { const res = await request(app).post("/api/v1/tasks").set("Authorization", `Bearer ${token}`).send({title:"Test task"}); expect(res.status).toBe(201); expect(res.body.data.title).toBe("Test task"); }); });',
            'Step 7: GitHub Actions — on: [push, pull_request]; steps: npm ci; npm test; block merge if tests fail.',
            'Step 8: Deploy to Railway — connect GitHub repo; set env vars; auto-deploy on push; health check /health returns 200 with { status:"ok", version:"1.0.0", uptime:3600 }.'
          ],
          commonMistake: 'Writing only happy-path tests — always test error cases: 400 for bad input, 401 for missing token, 403 for wrong user, 404 for missing resource, and 409 for duplicates.',
          practiceTask: 'Write a complete OpenAPI 3.0 spec for your API with at least 4 endpoints. Create a Postman collection with environment variables and test scripts. Write Jest integration tests covering happy path and 3 error scenarios.',
          progressCheckQuestion: 'OpenAPI 3.0 specification is used to:',
          progressCheckOptions: ['Generate database schemas from API routes', 'Define a machine-readable contract describing endpoints, parameters, schemas, and security', 'Auto-generate frontend React components', 'Replace unit testing for API endpoints'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'OpenAPI creates a standardized contract — enabling interactive documentation, client SDK generation, and contract-based testing between producers and consumers.',
          quizQuestions: [
            { question: 'Integration tests in an Express API differ from unit tests because they:', options: ['Only test individual functions in isolation', 'Test complete HTTP request-response cycles through the actual Express app', 'Run faster than unit tests', 'Do not require a test database'], correctOptionIndex: 1, explanation: 'Integration tests exercise the full request lifecycle — routing, middleware, controllers, services, and database — catching wiring errors unit tests miss.' },
            { question: 'Newman CLI is used to:', options: ['Generate OpenAPI specs from Express routes', 'Run Postman collections in CI/CD pipelines for automated regression testing', 'Manage npm package dependencies', 'Compile TypeScript APIs to JavaScript'], correctOptionIndex: 1, explanation: 'Newman runs Postman collections headlessly in CI pipelines, enabling automated API regression testing on every code change.' },
            { question: 'The API Sunset header communicates:', options: ['When the server goes into maintenance mode', 'The date after which a deprecated API version will no longer be available', 'When JWT tokens expire', 'When rate limits reset'], correctOptionIndex: 1, explanation: 'The Sunset header gives API consumers advance notice of when a version will be shut down, enabling planned migration.' },
            { question: 'A /health endpoint in a production API should:', options: ['Return all system configuration for debugging', 'Return 200 with minimal status info — enabling load balancers and monitoring to verify the service is alive', 'Require authentication to protect server details', 'Redirect to the API documentation'], correctOptionIndex: 1, explanation: 'Health endpoints must be fast, unauthenticated, and return only minimal info — load balancers and uptime monitors need them to be reliable and simple.' }
          ]
        }
      ],
      finalAssessment: [
        { question: 'Which HTTP status code is returned when a resource is successfully created?', options: ['200 OK', '201 Created', '204 No Content', '202 Accepted'], correctOptionIndex: 1, explanation: '201 Created is the standard response to a successful POST that creates a new resource.' },
        { question: 'REST stateless constraint means:', options: ['The API never returns state', 'Each request contains all information needed — no server-side session state', 'Responses are never cached', 'The client never stores anything'], correctOptionIndex: 1, explanation: 'Stateless improves scalability — any server instance handles any request without session dependency.' },
        { question: 'URI design best practice uses:', options: ['Verbs: /getUser, /deleteOrder', 'Nouns in plural: /users, /orders with HTTP methods expressing the action', 'Uppercase paths for resources', 'Random path formats per endpoint'], correctOptionIndex: 1, explanation: 'URIs identify resources; HTTP methods express what to do with them — verbs in URIs duplicate the method.' },
        { question: 'JWT payload is:', options: ['Encrypted and secure', 'Only base64url encoded — readable by anyone', 'Hashed with bcrypt', 'Visible only with the secret key'], correctOptionIndex: 1, explanation: 'JWTs are signed not encrypted — never store sensitive data in the payload.' },
        { question: 'OWASP API1 (BOLA) is prevented by:', options: ['Using HTTPS', 'Verifying the user owns the requested resource before returning it', 'Rate limiting all endpoints', 'Using OAuth instead of JWT'], correctOptionIndex: 1, explanation: 'Always check that req.user.id matches the resource owner ID — authentication alone is insufficient.' },
        { question: 'PKCE is required for:', options: ['Server-side apps with client secrets', 'Public clients (SPAs, mobile) that cannot safely store a client secret', 'All OAuth flows', 'Machine-to-machine calls'], correctOptionIndex: 1, explanation: 'PKCE protects public clients that cannot safely store secrets from authorization code interception.' },
        { question: 'Rate limiting is strictest on:', options: ['Read-only data endpoints', 'Authentication endpoints to prevent brute-force attacks', 'Documentation pages', 'Admin-only endpoints'], correctOptionIndex: 1, explanation: 'Login and registration are brute-force targets — strict limits are essential.' },
        { question: 'Input validation should occur:', options: ['In the database model only', 'At the API boundary before business logic runs', 'In the frontend before sending', 'Only for POST requests'], correctOptionIndex: 1, explanation: 'Fail fast at the boundary — validate all inputs before processing, regardless of client-side validation.' },
        { question: 'OpenAPI 3.0 is used to:', options: ['Generate databases from APIs', 'Define a machine-readable API contract for documentation and client generation', 'Auto-generate React components', 'Replace integration tests'], correctOptionIndex: 1, explanation: 'OpenAPI is the industry-standard API description format — enabling interactive docs and SDK generation.' },
        { question: 'cursor-based pagination vs offset-based:', options: ['Offset is better for real-time data', 'Cursor is better for real-time or large datasets — offset can skip/duplicate items when data changes', 'They are equivalent for all use cases', 'Cursor requires database changes, offset does not'], correctOptionIndex: 1, explanation: 'New inserts before your offset position cause data skipping or duplication; cursors are position-stable.' },
        { question: 'next(err) in Express middleware:', options: ['Moves to the next route normally', 'Jumps directly to the error-handling middleware bypassing routes', 'Logs the error automatically', 'Returns 500 automatically'], correctOptionIndex: 1, explanation: 'next(err) signals Express to skip to the 4-parameter error handler.' },
        { question: 'Integration tests vs unit tests in APIs:', options: ['Integration tests only test individual functions', 'Integration tests exercise full HTTP request-response cycles through the app', 'Unit tests are slower', 'They test the same things differently'], correctOptionIndex: 1, explanation: 'Integration tests catch wiring bugs that unit tests miss by testing the entire request pipeline.' },
        { question: 'HTTP 403 Forbidden means:', options: ['The request format is wrong', 'The user is authenticated but not authorized for this resource', 'The user is not authenticated', 'The resource does not exist'], correctOptionIndex: 1, explanation: '403 = authenticated but lacking permission; 401 = not authenticated at all.' },
        { question: 'Helmet.js provides:', options: ['Password hashing', 'Security HTTP response headers preventing XSS, clickjacking, and MIME sniffing', 'Input validation schemas', 'Database connection pooling'], correctOptionIndex: 1, explanation: 'Helmet sets multiple defensive HTTP headers in one call — a security baseline for every Express API.' },
        { question: 'Newman CLI runs:', options: ['OpenAPI spec validation', 'Postman collections in CI/CD for automated API regression testing', 'Jest unit tests', 'Database migrations'], correctOptionIndex: 1, explanation: 'Newman enables headless Postman collection execution in CI pipelines.' }
      ],
      interviewPrep: [
        'Explain all six REST constraints and describe how you apply the uniform interface constraint with HTTP methods, URIs, and status codes in a real API design.',
        'Walk through JWT authentication from registration to protected resource access — token signing, middleware, refresh token rotation, and storage in httpOnly cookies.',
        'Explain OWASP API Security Top 10 items 1 through 5; describe BOLA specifically and show how you prevent it with a code example.',
        'Describe your approach to input validation — which library you use, where in the middleware chain you apply it, and what error response format you return.',
        'Explain OAuth 2.0 authorization code flow with PKCE — what problem PKCE solves, what the code verifier and challenge are, and how the token exchange works.',
        'Write an OpenAPI 3.0 path definition for a paginated GET endpoint with query parameters and a 200 response referencing a reusable schema component.',
        'Describe how you would structure a large Express application — folder organization, router modules, controller vs service vs model separation, and reasoning.',
        'Explain CORS — what the preflight request is, what headers control it, and what misconfiguration allows cross-origin attacks.',
        'Describe your API testing strategy — unit tests, integration tests with supertest, Postman collections, and how you run them in CI/CD.',
        'Explain cursor-based vs offset-based pagination — when you would use each and how you return the cursor and total in the API response.'
      ]
    });
  }

  // ── GIT AND GITHUB (Git SCM / GitHub Docs aligned, ~20 hrs) ──────────────
  if (/\bgit\b|github/i.test(name)) {
    return buildCourse({
      courseTitle: 'Git and GitHub',
      subtitle: 'Aligned to official Git documentation, GitHub Docs, and industry branching conventions — essential version control for every developer.',
      difficulty: 'Beginner',
      estimatedDuration: '3 weeks (7 hrs/week) | ~20 hours total',
      marketDemand: 'Git proficiency is required for virtually every software engineering role. Git and GitHub are listed in 95%+ of technical job postings. Understanding Git internals separates junior from senior developers.',
      overview: 'This pathway covers Git from fundamentals through professional collaboration workflows.\n\nModule 1 (~5 hrs): Git fundamentals — init, add, commit, diff, log, .gitignore, and undoing changes.\nModule 2 (~5 hrs): Branching, merging, rebasing, cherry-pick, stash, and conflict resolution.\nModule 3 (~5 hrs): GitHub collaboration — remotes, PRs, code review, branch protection, and GitHub CLI.\nModule 4 (~5 hrs): Advanced Git — hooks, bisect, submodules, GitHub Actions, and signed commits.',
      learningOutcomes: [
        'Explain the Git object model and how commits, trees, and blobs relate to each other.',
        'Stage and commit changes with meaningful messages following commit message conventions.',
        'Create and manage branches, perform merges and rebases, and resolve conflicts confidently.',
        'Collaborate on GitHub using the fork-and-PR workflow with code review.',
        'Write GitHub Actions workflows for CI/CD automation.',
        'Use advanced Git commands like bisect, stash, and interactive rebase to manage project history.'
      ],
      resumeSignals: [
        'Managed feature development using GitFlow branching strategy on 5-person team',
        'Maintained clean commit history using interactive rebase and squash before merging PRs',
        'Set up GitHub Actions CI pipeline running tests and linting on every pull request',
        'Configured branch protection rules requiring 2 approvals and passing CI before merge',
        'Resolved complex merge conflicts during large-scale refactoring affecting 50+ files'
      ],
      modules: [
        {
          title: 'Git Fundamentals',
          objective: 'Explain the Git object model, initialize repositories, stage and commit changes, view history, and undo changes at any stage.',
          hours: 5,
          lesson: 'Part 1 - What Is Version Control: Version control systems track changes to files over time; distributed VCS (Git) gives every developer a full copy of the repository history; centralized VCS (SVN) has one server; Git enables offline work, fast branching, and complex collaboration patterns not possible with centralized systems. Part 2 - Git Object Model: Git stores four object types: blobs (file content), trees (directory structure), commits (snapshot with metadata), and tags (named commit pointers); objects are content-addressed by SHA-1 hash; this immutable object store is what makes Git operations atomic and reliable; every commit points to a tree and optionally to parent commits. Part 3 - Initializing and Cloning: git init creates a new .git directory; git clone copies a remote repository locally including all history; the .git directory contains the object database, config, refs (branches and tags), and HEAD; never delete the .git directory; git status shows working tree and staging area state. Part 4 - Staging and Committing: git add file stages specific files; git add -p (patch) stages selected hunks; git add . stages all changes; the staging area (index) allows crafting precise commits; git commit -m "message" records the snapshot; commit messages should use imperative mood: "Add feature" not "Added feature"; git commit --amend modifies the most recent commit. Part 5 - Viewing History and Changes: git log --oneline --graph --all shows compact history with branch topology; git diff shows unstaged changes; git diff --staged shows staged changes; git show COMMIT displays a commit\'s metadata and diff; git blame FILE annotates each line with the last commit that changed it. Part 6 - .gitignore: .gitignore patterns prevent untracked files from appearing in git status; common patterns: *.log, node_modules/, .env, dist/, .DS_Store; already-tracked files must be untracked with git rm --cached FILE; global .gitignore at ~/.gitignore_global applies to all repos. Part 7 - Undoing Changes: git restore FILE discards working directory changes; git restore --staged FILE unstages without losing changes; git reset --soft HEAD~1 undoes last commit keeping changes staged; git reset --mixed HEAD~1 (default) keeps changes in working directory; git reset --hard HEAD~1 discards changes permanently; git revert COMMIT creates a new commit that undoes the target commit without rewriting history. Part 8 - HEAD and References: HEAD is a pointer to the current branch or commit; detached HEAD occurs when HEAD points to a commit directly instead of a branch; git reflog records every HEAD movement for 90 days — useful for recovering lost commits; branch names are simply pointers to commits; tags are permanent named references.',
          workedExample: 'Set up a Node.js project in Git: init, first commit, .gitignore, view history, and demonstrate soft/mixed/hard reset scenarios.',
          workedExampleSteps: [
            'Step 1: git init project-name; cd project-name; npm init -y; create index.js.',
            'Step 2: Create .gitignore with: node_modules/, .env, dist/, *.log.',
            'Step 3: git add .gitignore index.js; git status shows staged files; git commit -m "Initialize Node.js project".',
            'Step 4: Edit index.js (add a function); git diff shows unstaged change; git add -p to stage specific hunk.',
            'Step 5: git commit -m "Add greeting function"; git log --oneline shows both commits.',
            'Step 6: Undo last commit with changes staged: git reset --soft HEAD~1; git status shows staged changes.',
            'Step 7: Restore unstaged changes: git restore index.js; verify file is back to last committed state.',
            'Step 8: git reflog shows all HEAD movements — use to recover accidentally reset commits: git reset --hard REFLOG_HASH.'
          ],
          commonMistake: 'Using git reset --hard without checking git reflog first — hard reset discards changes permanently; always check what you are about to lose; git stash is safer for temporary changes.',
          practiceTask: 'Create a new repo. Make 5 meaningful commits adding features. View log with graph. Demonstrate soft reset, mixed reset, and revert. Create a .gitignore that excludes node_modules and .env.',
          progressCheckQuestion: 'git reset --soft HEAD~1 does what?',
          progressCheckOptions: ['Permanently discards the last commit and all changes', 'Undoes the last commit but keeps changes staged in the index', 'Undoes the last commit and moves changes to the working directory', 'Creates a new commit that reverts the last commit'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'Soft reset moves HEAD back one commit while keeping all changes staged — useful for combining commits or amending commit messages.',
          quizQuestions: [
            { question: 'The Git staging area (index) allows you to:', options: ['Store commits permanently', 'Craft precise commits by staging only specific changes before committing', 'View remote repository branches', 'Merge branches automatically'], correctOptionIndex: 1, explanation: 'The staging area is a preparation zone — you compose exactly what goes into each commit rather than committing all working directory changes.' },
            { question: 'git revert COMMIT differs from git reset in that:', options: ['Revert is faster', 'Revert creates a new commit that undoes the change — preserving history; reset rewrites it', 'Revert only works on the last commit', 'Reset is safer for shared branches'], correctOptionIndex: 1, explanation: 'Revert is safe for shared branches because it adds a new commit; reset rewrites history, breaking other developers\' clones.' },
            { question: 'git reflog shows:', options: ['Remote repository changes', 'Every HEAD movement in the local repository for the last 90 days', 'Changes made by other developers', 'Differences between branches'], correctOptionIndex: 1, explanation: 'Reflog is the safety net — it records every HEAD position change, enabling recovery of seemingly lost commits after a hard reset.' },
            { question: 'What does HEAD point to in a normal (non-detached) state?', options: ['The first commit in the repository', 'The current branch, which in turn points to the latest commit on that branch', 'The remote origin branch', 'The staged changes'], correctOptionIndex: 1, explanation: 'HEAD -> branch-name -> commit. Moving HEAD by checking out a different branch changes what branch you are working on.' }
          ]
        },
        {
          title: 'Branching, Merging, and Rebasing',
          objective: 'Create and delete branches, perform fast-forward and three-way merges, rebase and squash commits, and resolve merge conflicts.',
          hours: 5,
          lesson: 'Part 1 - Branching Basics: Branches are lightweight pointers to commits; git branch BRANCH creates; git switch BRANCH (modern) or git checkout BRANCH; git switch -c BRANCH creates and switches; git branch -d BRANCH deletes merged branch; git branch -D forces delete; branches should be short-lived and focused on a single concern. Part 2 - Merge Strategies: Fast-forward merge moves the target branch pointer forward when the branch has not diverged — no merge commit created; three-way merge creates a merge commit when histories have diverged; --no-ff forces a merge commit even when fast-forward is possible, preserving branch history in the log. Part 3 - Conflict Resolution: Conflicts occur when the same lines were changed differently on both branches; git mergetool opens a visual merge editor; conflict markers show <<<<<<< HEAD (current), ======= (separator), and >>>>>>> branch (incoming); after resolving, git add the file and git commit; always verify changes compile after conflict resolution. Part 4 - Rebase: git rebase BRANCH replays commits from the current branch on top of the target — creates a linear history without merge commits; interactive rebase git rebase -i HEAD~N: reorder (pick), squash (combine with previous), fixup (squash silently), reword (edit message), drop (remove); rebase rewrites history — never rebase commits on shared branches. Part 5 - Cherry-Pick: git cherry-pick COMMIT applies a single commit from another branch; useful for backporting hotfixes to a release branch without merging the full feature branch; conflicts are possible and resolved identically to merge conflicts; cherry-picked commits get new SHAs. Part 6 - Stash: git stash saves working directory and staged changes; git stash pop restores and removes; git stash apply restores without removing; git stash list shows all stashes; git stash drop STASH deletes; use stash to quickly switch branches without committing incomplete work. Part 7 - Tags: Lightweight tags are just named pointers; annotated tags (git tag -a v1.0 -m "release") store tagger name, date, and message and are recommended for releases; git push --tags pushes all tags; semantic versioning (major.minor.patch): major for breaking changes, minor for features, patch for bug fixes. Part 8 - Branching Strategies: GitFlow uses main, develop, feature, release, and hotfix branches — good for versioned releases; trunk-based development uses short-lived feature branches merged daily to main — better for CI/CD; GitHub Flow uses main and feature branches with PR merge — simple and popular for web services; choose strategy based on release cadence.',
          workedExample: 'Demonstrate a GitFlow feature development cycle: create feature branch, commit, rebase on develop, squash commits, and merge with no-fast-forward.',
          workedExampleSteps: [
            'Step 1: git switch -c feature/user-auth from develop branch.',
            'Step 2: Make 4 commits: "WIP auth", "Add login route", "Fix typo", "Add tests".',
            'Step 3: Interactive rebase — git rebase -i HEAD~4. Squash WIP and typo into "Add login route": pick + squash + squash. Reword to "Add JWT authentication with login route and tests".',
            'Step 4: Rebase on latest develop — git rebase develop; resolve any conflicts; git add; git rebase --continue.',
            'Step 5: Switch to develop: git switch develop; git merge --no-ff feature/user-auth -m "Merge feature/user-auth: JWT authentication".',
            'Step 6: Delete feature branch: git branch -d feature/user-auth.',
            'Step 7: git log --oneline --graph shows clean linear history with one descriptive merge commit.',
            'Step 8: Tag the release: git tag -a v1.1.0 -m "Feature: JWT authentication"; git push origin v1.1.0.'
          ],
          commonMistake: 'Rebasing commits that have already been pushed to a shared branch — this rewrites history and forces others to resolve diverged histories; use rebase only on local commits or with team agreement.',
          practiceTask: 'Create a feature branch from main. Make 5 commits including 2 WIP commits. Interactively rebase to squash WIPs and clean messages. Rebase onto latest main. Merge with --no-ff. Tag the resulting commit.',
          progressCheckQuestion: 'Interactive rebase with "squash" does what?',
          progressCheckOptions: ['Deletes the commit entirely', 'Combines the commit with the previous commit, merging messages', 'Renames the commit without changing content', 'Splits one commit into multiple commits'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'Squash combines the marked commit with the commit above it, merging both messages and changes — useful for cleaning up WIP commits before merging.',
          quizQuestions: [
            { question: 'git rebase vs git merge: rebase produces:', options: ['A merge commit with full history', 'A linear history by replaying commits on top of the target branch', 'A faster merge with fewer conflicts', 'Identical results to merge'], correctOptionIndex: 1, explanation: 'Rebase creates linear history without merge commits — ideal for feature branches before PR; merge preserves branch topology.' },
            { question: 'git cherry-pick is used to:', options: ['Merge entire branches', 'Apply a single specific commit from another branch to the current branch', 'Select files to stage', 'Choose which conflicts to keep'], correctOptionIndex: 1, explanation: 'Cherry-pick applies one commit — common for backporting a hotfix to a release branch without merging the full feature.' },
            { question: 'Annotated tags differ from lightweight tags because they:', options: ['Can be pushed to remotes while lightweight cannot', 'Store tagger metadata (name, date, message) and are recommended for releases', 'Can be used as branch names', 'Are automatically created on merge'], correctOptionIndex: 1, explanation: 'Annotated tags are full Git objects with metadata — the right choice for version releases.' },
            { question: 'GitFlow is most appropriate when:', options: ['Teams deploy to production multiple times per day', 'Teams maintain versioned releases with scheduled deployment windows', 'All developers work on one feature at a time', 'The team uses Kanban exclusively'], correctOptionIndex: 1, explanation: 'GitFlow suits scheduled versioned releases; trunk-based development and GitHub Flow suit continuous delivery.' }
          ]
        },
        {
          title: 'GitHub Collaboration',
          objective: 'Work with remote repositories, use the fork-and-PR workflow, conduct code reviews, configure branch protection, and use GitHub Issues and Projects.',
          hours: 5,
          lesson: 'Part 1 - Remote Repositories: git remote add origin URL adds a remote; git push origin branch pushes; git fetch downloads remote changes without merging; git pull = git fetch + git merge; git remote -v lists remotes; origin is the conventional name for the primary remote; upstream is the conventional name for the original repository when working from a fork. Part 2 - Fork and Pull Request Workflow: Fork creates a copy of a repository under your account; clone your fork locally; add upstream remote pointing to original; git fetch upstream; git rebase upstream/main to stay current; push your feature branch; open a pull request from your fork to the original repository. Part 3 - Pull Request Best Practices: PRs should be small (under 400 lines changed) and focused on one concern; write a clear PR description with what, why, and how to test; link to the related issue with "Closes #123"; add screenshots for UI changes; self-review your diff before requesting reviewers; respond to all review comments before merging. Part 4 - Code Review: Reviewers check correctness, security, readability, test coverage, and adherence to conventions; use inline comments for specific lines; use "suggestion" blocks for proposed changes that authors can accept with one click; approve when satisfied; request changes when blocking issues exist; always be respectful and specific in feedback. Part 5 - Branch Protection Rules: Require PR reviews (1-2 approvals) before merging to main; require status checks (CI tests) to pass; restrict who can push directly; require signed commits; require linear history (prevents direct merge commits); configure via Settings > Branches in GitHub. Part 6 - GitHub Issues and Projects: Issues track bugs, features, and tasks; labels categorize issues (bug/feature/docs/wontfix); milestones group issues for a release; assignees claim ownership; GitHub Projects (V2) is a kanban/table view for managing issues across repos; issue templates ensure consistent bug reports. Part 7 - GitHub CLI (gh): gh repo clone, gh pr create, gh pr review, gh pr merge, gh issue create, gh issue list; gh auth login authenticates; gh codespace create spins a dev container; CLI enables GitHub workflow entirely from the terminal or scripts. Part 8 - Release Management: GitHub Releases tag a version and attach release notes; auto-generated release notes from merged PR titles; attach build artifacts (binaries, packages) to releases; CHANGELOG.md documents notable changes per version; semantic versioning (major.minor.patch) guides version increment decisions.',
          workedExample: 'Collaborate on an open-source project: fork, clone, add upstream, keep in sync, submit PR, and respond to review comments.',
          workedExampleSteps: [
            'Step 1: Fork repository on GitHub; git clone https://github.com/YOUR_USERNAME/repo; cd repo.',
            'Step 2: git remote add upstream https://github.com/ORIGINAL/repo; git fetch upstream.',
            'Step 3: git switch -c feature/improve-docs; make changes to README.md; commit.',
            'Step 4: git fetch upstream; git rebase upstream/main; resolve any conflicts; force-push: git push origin feature/improve-docs --force-with-lease.',
            'Step 5: Open PR on GitHub — title: "Improve README setup instructions"; description: what was changed, why, how to verify; link to issue "Closes #42".',
            'Step 6: Reviewer requests change: "Please add a code example." Author adds example, commits, pushes — PR auto-updates.',
            'Step 7: Reviewer approves. Author clicks "Merge pull request" with squash strategy. Branch auto-deleted.',
            'Step 8: Sync fork: git switch main; git pull upstream main; git push origin main.'
          ],
          commonMistake: 'Pushing large commits with unrelated changes — PRs should be small and focused; large PRs are hard to review, slow to merge, and harder to revert if they introduce bugs.',
          practiceTask: 'Fork a public GitHub repository. Create a feature branch, make a meaningful improvement, and open a PR with a clear description. Request a review from a peer. Respond to their comments and merge.',
          progressCheckQuestion: 'Branch protection rules in GitHub can require:',
          progressCheckOptions: ['Only the repository owner can view the branch', 'PR approvals, passing CI checks, and restrictions on who can push directly', 'All commits to use the same email address', 'Feature branches to expire after 7 days'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'Branch protection ensures code quality gates are enforced — reviews, tests, and push restrictions protect the main branch from direct unreviewed commits.',
          quizQuestions: [
            { question: 'git fetch vs git pull:', options: ['They are identical', 'fetch downloads remote changes; pull also merges them into your current branch', 'pull is safer than fetch', 'fetch requires internet; pull uses local cache'], correctOptionIndex: 1, explanation: 'git fetch is safe — it only downloads; git pull = fetch + merge (or rebase with --rebase flag).' },
            { question: 'Why should PRs be small (under ~400 lines)?', options: ['GitHub limits PR size to 400 lines', 'Small PRs are easier to review thoroughly, have clearer purpose, and are faster to merge and revert if needed', 'Large PRs cause merge conflicts automatically', 'Branch protection rules limit PR size'], correctOptionIndex: 1, explanation: 'Studies show code review quality drops sharply above 400 lines — reviewers miss bugs in large PRs.' },
            { question: 'The upstream remote in a fork workflow points to:', options: ['Your fork on GitHub', 'The original repository the fork was created from', 'The production deployment', 'The CI/CD pipeline runner'], correctOptionIndex: 1, explanation: 'Upstream = original repo. This lets you fetch latest changes from the source project to keep your fork in sync.' },
            { question: 'GitHub suggested changes in code review allow:', options: ['Reviewers to approve automatically', 'Authors to accept the reviewer\'s proposed code change with a single click', 'Reviewers to commit directly to the PR branch', 'Automatic test generation from review comments'], correctOptionIndex: 1, explanation: 'Suggestion blocks create a one-click apply button for the author — dramatically speeding up acting on reviewer feedback.' }
          ]
        },
        {
          title: 'Advanced Git and GitHub Actions',
          objective: 'Use Git hooks, bisect, submodules, and interactive rebase; write GitHub Actions CI/CD workflows; and configure signed commits.',
          hours: 5,
          lesson: 'Part 1 - Git Hooks: Hooks are scripts in .git/hooks/ triggered by Git events; client-side hooks: pre-commit (run linters), commit-msg (enforce message format), pre-push (run tests); server-side hooks: pre-receive, update, post-receive; hooks are not version-controlled by default; Husky manages hooks in package.json for team sharing. Part 2 - git bisect: git bisect start; git bisect bad (marks current commit as broken); git bisect good KNOWN_GOOD_COMMIT; Git checks out midpoint commits; mark each as good or bad; Git narrows the range until the first bad commit is found; git bisect reset returns to original HEAD; bisect performs a binary search through commit history. Part 3 - Git Submodules: Submodules reference a specific commit in another repository; git submodule add URL adds; git submodule update --init --recursive initializes; submodules must be updated explicitly with git submodule update --remote; useful for shared libraries or design systems; downsides: complexity and common developer confusion; consider Git subtree or monorepo as alternatives. Part 4 - GitHub Actions Fundamentals: Workflows are YAML files in .github/workflows/; triggers: on push, pull_request, schedule (cron), workflow_dispatch (manual); jobs contain steps; steps run shell commands or use actions from the marketplace; jobs run in parallel by default; jobs can depend on other jobs with needs. Part 5 - CI Workflow Example: Trigger on push and PR to main; checkout action; setup Node.js action; npm ci (clean install); npm run lint; npm test; upload coverage report as artifact; fail-fast: true stops other jobs if one fails; GitHub shows green/red check status on commits and PRs. Part 6 - CD and Deployment Workflows: Deploy on push to main after CI passes; use environment secrets for API keys and tokens; needs: [test] ensures deploy only runs if tests pass; deployment actions for Railway, Vercel, AWS, and Heroku exist on the Marketplace; use environments (staging, production) for approval gates before production deploys. Part 7 - Reusable Workflows and Matrix Builds: Reusable workflows extract common CI patterns into shared YAML files called from multiple workflows; matrix builds run a job across multiple versions: matrix: { node: [18, 20, 22] }; this tests your library against multiple Node.js versions in parallel; cache actions store node_modules between runs to speed up builds. Part 8 - Signed Commits: GPG-signed commits (git commit -S) verify author identity; configure gpg key in GitHub account settings; Vigilant mode shows unverified badges on unsigned commits; SSH commit signing (supported since Git 2.34) is simpler; branch protection can require signed commits for sensitive repositories.',
          workedExample: 'Set up a complete CI/CD pipeline with GitHub Actions: lint, test, build, and deploy on merge to main.',
          workedExampleSteps: [
            'Step 1: Create .github/workflows/ci.yml.',
            'Step 2: Trigger — on: { push: { branches: [main] }, pull_request: { branches: [main] } }.',
            'Step 3: Jobs — ci: runs-on: ubuntu-latest; steps: uses: actions/checkout@v4; uses: actions/setup-node@v4 with: { node-version: 20, cache: npm }.',
            'Step 4: npm ci; npm run lint; npm test -- --coverage; upload-artifact: coverage report.',
            'Step 5: Create deploy job — needs: ci; if: github.ref == "refs/heads/main"; install railway CLI; run railway up with RAILWAY_TOKEN secret.',
            'Step 6: Add pre-commit hook with Husky — npx husky init; echo "npm run lint" > .husky/pre-commit.',
            'Step 7: Add commit-msg hook — echo "npx --no -- commitlint --edit $1" > .husky/commit-msg; install @commitlint/config-conventional.',
            'Step 8: Test bisect — introduce a bug; git bisect start; git bisect bad HEAD; git bisect good v1.0.0; mark each checkout good/bad; find offending commit.'
          ],
          commonMistake: 'Storing secrets directly in workflow YAML files — always use GitHub Secrets (Settings > Secrets > Actions); secrets are masked in logs and never visible in the repository.',
          practiceTask: 'Write a GitHub Actions workflow for your project: (1) run lint and tests on every PR, (2) deploy to staging on merge to main, and (3) add a Husky pre-commit hook for linting. Verify it runs on a test PR.',
          progressCheckQuestion: 'GitHub Actions secrets should be stored in:',
          progressCheckOptions: ['The workflow YAML file directly for easy access', 'GitHub repository or organization secrets — masked in logs and never visible in source code', 'A .env file committed to the repository', 'A comment in the workflow file'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'Secrets stored in YAML files are visible to everyone with repository access and in git history. GitHub Secrets are encrypted, masked in logs, and injected at runtime.',
          quizQuestions: [
            { question: 'git bisect uses which search algorithm to find a bug-introducing commit?', options: ['Linear search through every commit', 'Binary search — halving the commit range with each good/bad marking', 'Random sampling of commits', 'Depth-first traversal of the commit tree'], correctOptionIndex: 1, explanation: 'Bisect performs binary search — finding the culprit commit in O(log n) steps instead of checking every commit linearly.' },
            { question: 'Husky is used to:', options: ['Manage npm packages', 'Share Git hooks with the team via package.json (pre-commit linting, commit message validation)', 'Configure GitHub branch protection', 'Run GitHub Actions locally'], correctOptionIndex: 1, explanation: 'Husky stores hooks in package.json making them version-controlled and automatically set up when developers run npm install.' },
            { question: 'GitHub Actions matrix builds allow:', options: ['Running a job sequentially across different configurations', 'Running a job in parallel across multiple versions or configurations (e.g., Node 18, 20, 22)', 'Deploying to multiple environments simultaneously', 'Running workflows on multiple trigger events'], correctOptionIndex: 1, explanation: 'Matrix strategy creates parallel job instances for each combination — testing your code against multiple Node, Python, or OS versions in one workflow.' },
            { question: 'Git submodules reference:', options: ['A folder in the parent repository', 'A specific commit in an external repository embedded in the parent', 'A GitHub Actions workflow', 'A branch in the same repository'], correctOptionIndex: 1, explanation: 'Submodules embed a pointer to a specific commit in another repo — useful for shared code but complex to keep in sync.' }
          ]
        }
      ],
      finalAssessment: [
        { question: 'git reset --soft HEAD~1:', options: ['Permanently discards the last commit', 'Undoes last commit, keeps changes staged', 'Moves changes to working directory unstaged', 'Creates a reverting commit'], correctOptionIndex: 1, explanation: 'Soft reset moves HEAD back but keeps all changes staged for recommitting.' },
        { question: 'git reflog shows:', options: ['Remote repository changes', 'Every HEAD movement in local repo for 90 days', 'Changes by other developers', 'Diff between branches'], correctOptionIndex: 1, explanation: 'Reflog is the safety net for recovering seemingly lost commits.' },
        { question: 'Interactive rebase "squash" does:', options: ['Deletes the commit', 'Combines with previous commit merging messages', 'Renames the commit message', 'Splits into multiple commits'], correctOptionIndex: 1, explanation: 'Squash combines a commit with the one above it.' },
        { question: 'git fetch vs git pull:', options: ['Identical commands', 'fetch downloads; pull downloads and merges', 'pull is safer', 'fetch requires auth; pull does not'], correctOptionIndex: 1, explanation: 'fetch is safe — only downloads. pull = fetch + merge.' },
        { question: 'Branch protection rules can require:', options: ['Only owner can view', 'PR approvals, passing CI checks, and push restrictions', 'Same email on all commits', 'Branches expire after 7 days'], correctOptionIndex: 1, explanation: 'Protection rules enforce quality gates before merging to protected branches.' },
        { question: 'Rebasing commits already on a shared branch is:', options: ['Safe and recommended', 'Dangerous — it rewrites history, breaking other developers\' clones', 'Required before merging', 'The same as reverting'], correctOptionIndex: 1, explanation: 'Rebase rewrites commit SHAs — everyone who based work on those commits must resolve diverged history.' },
        { question: 'git bisect performs:', options: ['Linear search through commits', 'Binary search to find the first bad commit', 'Random commit sampling', 'Diff between all commits'], correctOptionIndex: 1, explanation: 'Bisect halves the commit range with each good/bad marking — O(log n) to find the bug-introducing commit.' },
        { question: 'GitHub Actions secrets should be:', options: ['In the YAML file for easy editing', 'In repository/org settings — encrypted and masked in logs', 'In a committed .env file', 'In a comment in the workflow'], correctOptionIndex: 1, explanation: 'Secrets in YAML are visible to anyone with repo access and in history — always use GitHub Secrets.' },
        { question: 'git cherry-pick applies:', options: ['An entire branch', 'A single specific commit to the current branch', 'All uncommitted changes', 'The latest tag'], correctOptionIndex: 1, explanation: 'Cherry-pick is for backporting a single fix without merging the full branch.' },
        { question: 'Annotated tags vs lightweight tags:', options: ['Lightweight stores metadata', 'Annotated stores tagger name, date, and message — recommended for releases', 'They are identical', 'Lightweight can be pushed; annotated cannot'], correctOptionIndex: 1, explanation: 'Annotated tags are full Git objects with metadata — the right choice for version releases.' },
        { question: 'Husky manages:', options: ['npm packages', 'Git hooks in package.json for team sharing', 'GitHub branch protection', 'GitHub Actions workflows'], correctOptionIndex: 1, explanation: 'Husky makes hooks version-controlled and auto-installed via npm install.' },
        { question: 'A detached HEAD state means:', options: ['HEAD points to a corrupted commit', 'HEAD points directly to a commit rather than a branch', 'The last commit was lost', 'The remote is disconnected'], correctOptionIndex: 1, explanation: 'Detached HEAD occurs when you check out a commit directly — commits made here are not on any branch and can be lost.' },
        { question: 'Matrix builds in GitHub Actions:', options: ['Run jobs sequentially across configs', 'Run jobs in parallel across multiple configurations (Node versions, OS, etc.)', 'Deploy to multiple environments', 'Test multiple branches simultaneously'], correctOptionIndex: 1, explanation: 'Matrix creates parallel job instances for each configuration combination.' },
        { question: 'PRs should ideally be:', options: ['As large as possible to minimize PR count', 'Small and focused on one concern — easier to review and revert', 'Merged directly without review for speed', 'Created only when all features are complete'], correctOptionIndex: 1, explanation: 'Small focused PRs are reviewed more thoroughly, merged faster, and easier to revert.' },
        { question: 'git stash is used to:', options: ['Delete uncommitted changes', 'Temporarily save working directory changes to switch branches without committing', 'Push changes to remote', 'Create a new branch from current state'], correctOptionIndex: 1, explanation: 'Stash is a temporary shelf — save and restore changes without committing them.' }
      ],
      interviewPrep: [
        'Explain the Git object model — what are blobs, trees, commits, and tags? Walk through what happens internally when you run git commit.',
        'Describe the difference between git merge and git rebase — when would you use each, and why should you never rebase commits already on a shared branch?',
        'Walk through the fork-and-PR workflow for contributing to an open-source project — from fork through sync, PR creation, code review, and merge.',
        'Explain how you would use git bisect to find a commit that introduced a regression in a 500-commit history.',
        'Describe interactive rebase — what operations are available (pick, squash, fixup, reword, drop, reorder) and give a scenario where you used it to clean up a feature branch.',
        'Explain what branch protection rules are and which ones you would configure for a production repository that many developers contribute to.',
        'Write a GitHub Actions workflow that runs lint and tests on every PR and deploys to a staging environment on merge to main.',
        'Explain git stash, when you use it, and how it differs from creating a WIP commit — describe a scenario where stash saved you from losing work.',
        'Describe the difference between GitFlow and trunk-based development — when would you recommend each and what are the tradeoffs?',
        'Explain how Git handles merge conflicts internally and walk through your process for resolving a complex conflict affecting the same file on two active feature branches.'
      ]
    });
  }


  if (/cloud.fund/i.test(name)) {
    return buildCourse({
      courseTitle: 'Cloud Fundamentals',
      subtitle: 'Aligned to the AWS Certified Cloud Practitioner (CLF-C02) exam — the most widely held entry-level cloud certification with over 1 million holders.',
      difficulty: 'Beginner',
      estimatedDuration: '6 weeks (7 hrs/week) | ~40 hours total',
      marketDemand: 'Cloud spending is projected to exceed $1 trillion by 2027. AWS holds 32% of the cloud market. AWS CCP is listed as a preferred qualification in 250,000+ job postings. Cloud-skilled workers earn 20-30% more than non-cloud peers.',
      overview: 'This pathway aligns to the AWS Certified Cloud Practitioner (CLF-C02) exam objectives.\n\nModule 1 (~10 hrs): Cloud concepts — benefits, service models (IaaS/PaaS/SaaS), deployment models, and shared responsibility.\nModule 2 (~10 hrs): Core AWS services — EC2, S3, RDS, Lambda, VPC, CloudFront, and Route 53.\nModule 3 (~10 hrs): Security and identity — IAM, MFA, encryption, Shield, WAF, and security best practices.\nModule 4 (~10 hrs): Billing, pricing, support plans, the AWS Well-Architected Framework, and cloud economics.',
      learningOutcomes: [
        'Explain cloud computing concepts: IaaS, PaaS, SaaS, and the shared responsibility model.',
        'Describe core AWS services across compute, storage, database, and networking categories.',
        'Identify AWS security and identity services and explain IAM best practices.',
        'Estimate AWS costs using the Pricing Calculator and read a billing dashboard.',
        'Describe the six pillars of the AWS Well-Architected Framework.',
        'Choose between AWS support plans based on business requirements.'
      ],
      resumeSignals: [
        'AWS Certified Cloud Practitioner (CLF-C02) — certification in progress',
        'Deployed a static website to S3 with CloudFront CDN and Route 53 domain routing',
        'Implemented IAM least-privilege access with roles, policies, and MFA enforcement',
        'Built a serverless function with AWS Lambda and API Gateway triggered by HTTP events',
        'Created a cost budget alert and analyzed AWS Cost Explorer to optimize monthly spend'
      ],
      modules: [
        {
          title: 'Cloud Concepts and AWS Fundamentals',
          objective: 'Define cloud computing, explain IaaS/PaaS/SaaS models, compare deployment models, and describe the AWS shared responsibility model.',
          hours: 10,
          lesson: 'Part 1 - What Is Cloud Computing: NIST defines cloud computing as on-demand self-service, broad network access, resource pooling, rapid elasticity, and measured service; cloud eliminates the need to buy, maintain, and deprecate physical hardware; pay-as-you-go pricing converts capital expenditure (CapEx) to operational expenditure (OpEx); economies of scale allow providers to offer lower prices than individual organizations. Part 2 - Cloud Service Models: IaaS (Infrastructure as a Service) provides virtual machines, storage, and networking — customer manages OS and above; examples: EC2, Azure VMs; PaaS (Platform as a Service) provides a managed platform for application deployment — customer manages application and data; examples: Elastic Beanstalk, Heroku; SaaS (Software as a Service) delivers ready-to-use software — customer only configures; examples: Gmail, Salesforce, Microsoft 365. Part 3 - Cloud Deployment Models: Public cloud infrastructure owned and operated by a cloud provider (AWS, Azure, GCP) and shared among multiple customers; private cloud dedicated infrastructure operated for a single organization on-premises or hosted; hybrid cloud combines public and private with network connectivity between them; multi-cloud uses multiple public cloud providers; community cloud shared by organizations with common requirements. Part 4 - Shared Responsibility Model: AWS is responsible for security OF the cloud — hardware, data centers, network infrastructure, hypervisors, and managed service software; the customer is responsible for security IN the cloud — OS patching, application security, identity configuration, data classification, and encryption choices; responsibility level shifts with service model: EC2 (IaaS) requires more customer responsibility than Lambda (serverless). Part 5 - AWS Global Infrastructure: Regions are geographically isolated areas containing multiple Availability Zones; Availability Zones are one or more discrete data centers with redundant power/networking; Edge Locations are Points of Presence used by CloudFront CDN; Local Zones bring services close to large population centers; Wavelength Zones embed compute at 5G network edges for ultra-low latency. Part 6 - Benefits of Cloud: High availability and fault tolerance by distributing across multiple AZs; elasticity scales resources up and down automatically; agility allows experimenting quickly without procurement delays; global reach deploys applications worldwide in minutes; durability with services like S3 offering 11 nines (99.999999999%) object durability; disaster recovery with multi-region replication. Part 7 - Cloud Adoption Framework: AWS CAF has six perspectives: Business (ROI, strategy), People (culture, workforce), Governance (risk, compliance), Platform (architecture, data), Security (identity, detective controls), Operations (monitoring, incident response); foundational, migrating, and optimizing phases guide cloud adoption maturity. Part 8 - Cloud Economics: Total Cost of Ownership (TCO) compares on-premises vs cloud costs; AWS TCO Calculator estimates migration savings; right-sizing matches instance types to actual workload needs; reserved instances and savings plans offer up to 72% discount for committed usage; spot instances offer up to 90% discount for interruptible workloads; cost allocation tags track spending by project, team, and environment.',
          workedExample: 'Compare on-premises vs AWS architecture for a web application and map responsibilities using the shared responsibility model.',
          workedExampleSteps: [
            'Step 1: On-premises stack — physical servers, SAN storage, network switches, OS licenses, power/cooling, staff, and 3-year refresh cycle.',
            'Step 2: AWS equivalent — EC2 (compute), EBS (block storage), RDS (database), S3 (object storage), VPC (networking).',
            'Step 3: Shared responsibility map — AWS: physical hardware, hypervisor, managed service patches; Customer: EC2 OS patching, application security, IAM configuration.',
            'Step 4: CapEx vs OpEx — on-premises: $200k upfront server purchase; AWS: $2k/month pay-as-you-go with no upfront.',
            'Step 5: Elasticity — on-premises: buy 3x peak capacity that sits idle 80% of time; AWS: Auto Scaling scales to peak during Black Friday, scales down after.',
            'Step 6: Availability — on-premises: single data center single point of failure; AWS: deploy across 2 AZs for 99.99% SLA.',
            'Step 7: Disaster recovery — on-premises: secondary datacenter doubles cost; AWS: cross-region replication adds ~10% to storage cost.',
            'Step 8: TCO calculation — use AWS TCO Calculator to quantify 3-year cost comparison including staff savings from managed services.'
          ],
          commonMistake: 'Assuming the cloud provider handles all security — the shared responsibility model means customers are always responsible for identity configuration, data classification, and application security regardless of service model.',
          practiceTask: 'Use the AWS TCO Calculator to compare 3-year costs for a small web application (10 servers, 10TB storage) on-premises vs AWS. Identify 5 responsibilities that remain with the customer in each service model.',
          progressCheckQuestion: 'In the AWS shared responsibility model, who is responsible for patching an EC2 instance operating system?',
          progressCheckOptions: ['AWS — it manages all infrastructure', 'The customer — EC2 is IaaS so OS and above is customer responsibility', 'Both AWS and the customer share this responsibility', 'The cloud reseller managing the account'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'EC2 is IaaS — AWS manages the hypervisor and physical infrastructure; the customer controls and must patch the guest OS.',
          quizQuestions: [
            { question: 'PaaS differs from IaaS in that:', options: ['PaaS is less expensive than IaaS always', 'PaaS manages the OS and runtime — customers only deploy applications and data', 'PaaS requires more customer management', 'They are interchangeable terms'], correctOptionIndex: 1, explanation: 'PaaS abstracts OS and platform management — developers focus on application code and data, not infrastructure.' },
            { question: 'AWS Availability Zones are:', options: ['Globally distributed CDN cache points', 'Isolated data center locations within a region, providing fault tolerance within a region', 'Separate AWS accounts for compliance', 'Physical locations of AWS hardware manufacturers'], correctOptionIndex: 1, explanation: 'Deploying across multiple AZs protects against a single data center failure within a region.' },
            { question: 'Reserved Instances save money by:', options: ['Reducing request latency', 'Committing to usage for 1 or 3 years in exchange for up to 72% discount vs On-Demand pricing', 'Allowing instances to be paused and billed at 50%', 'Sharing compute resources with other customers'], correctOptionIndex: 1, explanation: 'Reserved Instances offer significant discounts for predictable, steady-state workloads where usage can be committed in advance.' },
            { question: 'The AWS Well-Architected Framework has:', options: ['4 pillars focused on cost and security', '6 pillars: Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, and Sustainability', '3 pillars aligned to IaaS/PaaS/SaaS', '5 pillars aligned to the NIST framework'], correctOptionIndex: 1, explanation: 'The 6-pillar WAF guides architects in building robust, efficient, and secure cloud workloads.' }
          ]
        },
        {
          title: 'Core AWS Services',
          objective: 'Describe and compare core AWS services across compute (EC2, Lambda), storage (S3, EBS, EFS), database (RDS, DynamoDB), and networking (VPC, CloudFront, Route 53).',
          hours: 10,
          lesson: 'Part 1 - EC2 Compute: EC2 (Elastic Compute Cloud) provides resizable virtual machines; instance families: T (burstable, general purpose), M (general purpose), C (compute optimized), R (memory optimized), G (GPU); AMI (Amazon Machine Image) is a template including OS and software; key pairs for SSH access; security groups act as virtual firewalls; Auto Scaling Groups maintain desired capacity and replace unhealthy instances. Part 2 - Serverless with Lambda: Lambda runs code without provisioning or managing servers; functions trigger on events: API Gateway, S3 events, DynamoDB streams, CloudWatch Events, SNS; pricing is per-request and per-GB-second of compute; free tier includes 1 million requests and 400,000 GB-seconds per month; cold starts add latency; max execution timeout is 15 minutes; stateless by design. Part 3 - S3 Object Storage: S3 stores objects in buckets; objects have a key (path), value (data), metadata, and ACL; unlimited storage, 5TB max object size; storage classes: Standard (frequently accessed), Infrequent Access, Glacier Instant/Flexible/Deep Archive (cold data); lifecycle policies automate transitions between classes; versioning enables recovery of deleted or overwritten objects; bucket policies and ACLs control access. Part 4 - EBS and EFS: EBS (Elastic Block Store) is persistent block storage attached to EC2 like a hard drive; gp3 is the default general-purpose SSD; io2 for high-performance databases; snapshots back up EBS volumes to S3; EFS (Elastic File System) is a managed NFS file system shareable across multiple EC2 instances simultaneously — useful for shared web content and container storage. Part 5 - Managed Databases: RDS (Relational Database Service) manages MySQL, PostgreSQL, MariaDB, Oracle, and SQL Server; automates patching, backups, and Multi-AZ failover; Read Replicas scale read workloads; Aurora is AWS-native MySQL/PostgreSQL-compatible with up to 5x MySQL performance; DynamoDB is a serverless key-value and document NoSQL database with single-digit millisecond latency at any scale; ElastiCache provides managed Redis or Memcached for in-memory caching. Part 6 - VPC Networking: VPC (Virtual Private Cloud) is your isolated network in AWS; subnets are subdivisions of the VPC CIDR block; public subnets route to an Internet Gateway; private subnets use NAT Gateway for outbound internet access; route tables define traffic paths; security groups are stateful instance-level firewalls; NACLs are stateless subnet-level firewalls; VPC peering connects VPCs; Transit Gateway connects multiple VPCs and on-premises networks. Part 7 - Content Delivery and DNS: CloudFront is a global CDN with 450+ edge locations caching content close to users; reduces latency for static and dynamic content; supports HTTPS with custom certificates via ACM (AWS Certificate Manager); Route 53 is a highly available DNS service; routing policies: simple, weighted, latency-based, failover, geolocation, and multi-value; health checks trigger failover automatically. Part 8 - Application Integration: SQS (Simple Queue Service) is a managed message queue decoupling producers and consumers; SNS (Simple Notification Service) is a pub/sub messaging service sending to multiple subscribers (email, SMS, Lambda, SQS); SQS + SNS fan-out pattern distributes a message to multiple queues; EventBridge routes events between AWS services and third-party SaaS; Step Functions orchestrates multi-step serverless workflows.',
          workedExample: 'Design an AWS architecture for a web application: VPC, EC2 in private subnet, RDS, S3 for static assets, CloudFront CDN, and ALB.',
          workedExampleSteps: [
            'Step 1: VPC with CIDR 10.0.0.0/16; 2 public subnets (10.0.1.0/24, 10.0.2.0/24) and 2 private subnets (10.0.3.0/24, 10.0.4.0/24) across 2 AZs.',
            'Step 2: Public subnets — Application Load Balancer (internet-facing); NAT Gateway for private subnet outbound internet.',
            'Step 3: Private subnets — EC2 instances in Auto Scaling Group (no public IP); security group allows port 3000 from ALB only.',
            'Step 4: RDS PostgreSQL in private subnet; security group allows port 5432 from EC2 security group only; Multi-AZ enabled for failover.',
            'Step 5: S3 bucket for static assets (images, CSS, JS); bucket policy allows CloudFront origin access only.',
            'Step 6: CloudFront distribution — origin: S3 bucket and ALB; cache static assets; HTTPS enforced; ACM certificate.',
            'Step 7: Route 53 — A record aliasing app.mydomain.com to CloudFront distribution.',
            'Step 8: CloudWatch alarms on CPU, ALB 5xx errors, and RDS connections; Auto Scaling policy scales EC2 on CPU > 70%.'
          ],
          commonMistake: 'Putting databases in public subnets — RDS instances should always be in private subnets with security groups allowing access only from application servers; never expose databases directly to the internet.',
          practiceTask: 'Create an AWS account on free tier. Deploy a static website: S3 bucket with static hosting, CloudFront distribution with HTTPS, and Route 53 domain (or use the CloudFront URL). Write down each service\'s role.',
          progressCheckQuestion: 'S3 Glacier is used for:',
          progressCheckOptions: ['Frequently accessed objects requiring millisecond retrieval', 'Long-term archival storage rarely accessed — low cost, retrieval takes minutes to hours', 'Real-time database queries', 'Hosting static websites'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'Glacier is designed for cold data archival — compliance records, backups older than 90 days — where low cost outweighs the minutes-to-hours retrieval time.',
          quizQuestions: [
            { question: 'AWS Lambda is "serverless" meaning:', options: ['It runs on physical servers, not virtual', 'AWS manages all infrastructure — you only write and deploy function code', 'Functions run without any network access', 'No billing occurs for Lambda usage'], correctOptionIndex: 1, explanation: 'Serverless means no server provisioning or management — you pay only for actual compute time, not idle capacity.' },
            { question: 'VPC Security Groups vs NACLs:', options: ['They are identical tools', 'Security Groups are stateful instance-level firewalls; NACLs are stateless subnet-level firewalls', 'NACLs are for RDS only; Security Groups are for EC2 only', 'NACLs are applied after Security Groups always'], correctOptionIndex: 1, explanation: 'Security Groups track connection state (stateful); NACLs evaluate each packet independently (stateless) and require explicit inbound and outbound rules.' },
            { question: 'RDS Multi-AZ deployment provides:', options: ['Horizontal read scaling across regions', 'Automatic failover to a standby replica in a different AZ if the primary fails', 'Cross-region data replication', 'Reduced storage costs through compression'], correctOptionIndex: 1, explanation: 'Multi-AZ maintains a synchronous standby — automatic failover happens in 1-2 minutes if the primary AZ fails.' },
            { question: 'SNS vs SQS:', options: ['They are the same service', 'SNS is pub/sub for broadcasting to multiple subscribers; SQS is a queue for point-to-point messaging', 'SQS supports push notifications; SNS is for queuing', 'Both only work with Lambda'], correctOptionIndex: 1, explanation: 'SNS pushes to multiple subscribers simultaneously; SQS stores messages for consumers to poll — they are often combined in fan-out patterns.' }
          ]
        },
        {
          title: 'Security, Identity, and Compliance',
          objective: 'Configure IAM users, groups, roles, and policies; enable MFA; use AWS security services (Shield, WAF, GuardDuty); and explain compliance programs.',
          hours: 10,
          lesson: 'Part 1 - IAM Fundamentals: IAM (Identity and Access Management) controls who can do what in AWS; principals: IAM users (long-term credentials), IAM groups (collections of users), IAM roles (temporary credentials for services and applications); policies are JSON documents defining Allow or Deny on actions and resources; the root account has full access and should only be used to create the first IAM admin. Part 2 - IAM Best Practices: Enable MFA on root account and all privileged users; never use root account for day-to-day work; create individual IAM users; use groups to assign permissions; grant least privilege — only the permissions needed; rotate access keys regularly; use IAM roles for EC2 instances and Lambda functions instead of embedding access keys in code. Part 3 - IAM Policies: Managed policies are reusable; inline policies are attached to one entity; policy evaluation: explicit Deny always wins; if no explicit Allow, default Deny; policy conditions add context (IP restriction, MFA required, time-of-day); Permission Boundaries limit the maximum permissions an entity can have even if policies grant more. Part 4 - AWS Organizations and SCPs: AWS Organizations manages multiple accounts centrally; master/management account controls member accounts; Service Control Policies (SCPs) set maximum permissions for all accounts in an OU (Organizational Unit) — even overriding root users in member accounts; consolidated billing across all accounts; useful for large enterprises separating production, development, and compliance workloads into separate accounts. Part 5 - Encryption Services: KMS (Key Management Service) manages cryptographic keys; customer-managed keys (CMKs) give you control over key rotation and access; server-side encryption protects data at rest in S3, RDS, EBS; ACM (Certificate Manager) provisions and manages TLS/SSL certificates; Secrets Manager stores and automatically rotates database credentials and API keys; never hardcode credentials in application code. Part 6 - Network Security Services: Shield Standard protects against DDoS attacks automatically at no additional cost; Shield Advanced provides enhanced DDoS protection with 24/7 DRT (DDoS Response Team) support; WAF (Web Application Firewall) blocks SQL injection, XSS, and rate-based rules; Firewall Manager centrally manages WAF rules across accounts; Security Groups and NACLs are the first network-level defenses. Part 7 - Monitoring and Threat Detection: CloudTrail records all API calls in AWS — who did what, when, and from where; essential for audit and forensics; GuardDuty is an intelligent threat detection service using ML to detect compromised credentials, unusual API calls, and cryptomining; Security Hub aggregates findings from GuardDuty, Inspector, and Macie into a single dashboard; Config tracks resource configuration changes and evaluates compliance rules. Part 8 - Compliance and Governance: AWS maintains compliance with ISO 27001, SOC 1/2/3, PCI DSS, HIPAA, GDPR, and FedRAMP; Artifact provides self-service access to compliance reports; Macie discovers and protects sensitive data (PII, financial data) in S3 using ML; Control Tower sets up a landing zone with governance guardrails for multi-account environments; compliance is a shared responsibility — AWS provides compliant infrastructure, customers must configure their workloads compliantly.',
          workedExample: 'Implement least-privilege IAM for a web application: EC2 role with S3 read access, developer group, and MFA enforcement.',
          workedExampleSteps: [
            'Step 1: Create IAM role EC2-WebApp-Role with policy allowing only s3:GetObject on the specific app bucket.',
            'Step 2: Attach role to EC2 instance profile — no access keys needed in application code; credentials auto-rotate.',
            'Step 3: Create IAM group Developers with PowerUserAccess managed policy; create individual user accounts for each developer.',
            'Step 4: Enable MFA for all users — virtual MFA device (Google Authenticator) or hardware token.',
            'Step 5: Create an IAM policy requiring MFA: Condition: { Bool: { "aws:MultiFactorAuthPresent": "true" } } — attach to Developers group.',
            'Step 6: Enable CloudTrail in all regions — S3 bucket for log storage; SNS alert for root account usage.',
            'Step 7: Enable GuardDuty — it will alert on unusual API calls, impossible travel, and known malicious IPs.',
            'Step 8: Enable S3 block public access at the account level — prevents accidental public bucket creation.'
          ],
          commonMistake: 'Using the root account for daily operations or embedding AWS access keys in application code — use IAM roles attached to EC2/Lambda instances; roles provide temporary credentials that auto-rotate, eliminating key management risk.',
          practiceTask: 'Create an IAM structure: admin group with admin policy, developer group with least-privilege policies, and a service role for an S3-accessing Lambda. Enable MFA for all users. Enable CloudTrail. Document the policy for each principal.',
          progressCheckQuestion: 'IAM roles differ from IAM users in that roles:',
          progressCheckOptions: ['Have no permissions attached to them', 'Provide temporary credentials and can be assumed by AWS services like EC2 and Lambda', 'Can only be used by human users', 'Are not managed by IAM policies'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'Roles provide temporary, automatically-rotating credentials perfect for AWS services — no long-term access keys needed, eliminating key rotation risk.',
          quizQuestions: [
            { question: 'The IAM policy evaluation rule for an explicit Deny is:', options: ['It can be overridden by an Allow in the same policy', 'Explicit Deny always wins regardless of any Allow statements', 'It only applies to root account actions', 'It requires an SCP to take effect'], correctOptionIndex: 1, explanation: 'Explicit Deny is absolute — it overrides any number of Allow statements, making it the most powerful policy statement.' },
            { question: 'AWS KMS Customer Managed Keys (CMKs) provide:', options: ['Free unlimited encryption operations', 'Control over key creation, rotation, access policies, and deletion — with full audit trail', 'Automatic encryption of all S3 data without configuration', 'Compliance certification replacement'], correctOptionIndex: 1, explanation: 'CMKs give customers full control over cryptographic key lifecycle, enabling compliance with strict data sovereignty requirements.' },
            { question: 'AWS CloudTrail records:', options: ['Performance metrics for EC2 instances', 'Every API call made in the account — who, what, when, and from where', 'Application logs from web servers', 'Network packet captures'], correctOptionIndex: 1, explanation: 'CloudTrail is the audit log for your AWS account — essential for security investigations and compliance audits.' },
            { question: 'AWS GuardDuty detects:', options: ['Configuration drift in CloudFormation stacks', 'Threats using ML — compromised credentials, unusual API patterns, and cryptomining activity', 'Cost anomalies in billing', 'Performance degradation in databases'], correctOptionIndex: 1, explanation: 'GuardDuty analyzes CloudTrail, VPC Flow Logs, and DNS logs with ML to detect threats without requiring agents or configuration.' }
          ]
        },
        {
          title: 'Billing, Pricing, and Well-Architected Framework',
          objective: 'Explain AWS pricing models, estimate costs with the Pricing Calculator, analyze billing with Cost Explorer, choose a support plan, and describe the six pillars of the Well-Architected Framework.',
          hours: 10,
          lesson: 'Part 1 - AWS Pricing Fundamentals: Pay-as-you-go with no upfront commitment; save with reserved pricing (1 or 3 year commitment); save even more with Spot Instances (up to 90% for interruptible workloads); factors affecting cost: compute (CPU/memory), storage (GB stored), data transfer (egress charges — ingress is free), and API requests; pricing varies by region — us-east-1 is typically cheapest. Part 2 - AWS Free Tier: 12-month free tier for new accounts: 750 hrs EC2 t2.micro/t3.micro per month, 5GB S3, 750 hrs RDS db.t2.micro, 15GB data transfer out; Always Free: Lambda 1M requests/400k GB-sec per month, DynamoDB 25GB, CloudFront 1TB data transfer; Trials: some services free for limited period; free tier applies per account not per IAM user. Part 3 - Cost Management Tools: AWS Pricing Calculator estimates costs before deployment; Cost Explorer visualizes and analyzes spending with filtering by service, region, and tag; AWS Budgets sets spending alerts and forecasts; Cost and Usage Reports (CUR) provides granular hourly/daily billing data for BI tools; Trusted Advisor gives cost optimization recommendations including idle resources and underutilized instances. Part 4 - Cost Optimization Strategies: Right-sizing instances to match actual CPU/memory utilization; Reserved Instances for steady-state workloads; Savings Plans flexible committed usage discount; Spot Instances for fault-tolerant batch workloads; S3 Intelligent-Tiering automatically moves objects between tiers based on access patterns; deleting unattached EBS volumes and unused Elastic IPs; cleaning up old snapshots and AMIs. Part 5 - AWS Support Plans: Basic (free): documentation, forums, and core health dashboard; Developer ($29/month): business-hours email support, 1 contact, general guidance < 24 hrs; Business ($100+/month): 24/7 phone/chat, unlimited contacts, < 1 hr response for production down; Enterprise On-Ramp ($5,500+/month): 30-minute response for critical, concierge support; Enterprise ($15,000+/month): designated TAM, 15-minute response for business-critical. Part 6 - Well-Architected Framework - Pillar 1: Operational Excellence — define operations as code (CloudFormation, CDK); annotate documentation; make frequent small reversible changes; refine operations procedures frequently; anticipate failure; learn from all operational events; tools: AWS Systems Manager, CloudWatch, AWS Config. Part 7 - Well-Architected Framework - Pillars 2-4: Security — implement strong identity foundation; enable traceability; apply security at all layers; automate security best practices; protect data in transit and at rest; Reliability — test recovery procedures; auto-recover from failure; scale horizontally; stop guessing capacity; manage change in automation; Performance Efficiency — use advanced technologies, go global in minutes, use serverless architectures, experiment more often, use mechanical sympathy. Part 8 - Well-Architected Framework - Pillars 5-6: Cost Optimization — implement cloud financial management; adopt consumption model; measure overall efficiency; stop spending money on undifferentiated heavy lifting; analyze and attribute expenditure; Sustainability — understand your impact; establish sustainability goals; maximize utilization; anticipate and adopt new hardware and software offerings; use managed services; reduce downstream impact; use the Well-Architected Tool in the AWS console to assess workloads against all 6 pillars.',
          workedExample: 'Estimate monthly AWS costs for a production web application and identify 3 optimization opportunities.',
          workedExampleSteps: [
            'Step 1: AWS Pricing Calculator — add EC2: 2x t3.medium On-Demand in us-east-1 = ~$60/month.',
            'Step 2: RDS: db.t3.medium MySQL Multi-AZ = ~$130/month; 100GB gp2 storage = ~$11.50/month.',
            'Step 3: S3: 50GB storage + 100k requests = ~$1.20/month; CloudFront: 1TB data transfer = ~$85/month.',
            'Step 4: Total estimate: ~$290/month. Identify optimizations:',
            'Step 5: Optimization 1 — convert EC2 to 1-year Reserved: saves 38%, ~$22/month savings.',
            'Step 6: Optimization 2 — right-size from t3.medium to t3.small if CPU < 20% utilization average: saves ~$30/month.',
            'Step 7: Optimization 3 — move CloudFront to monthly 1TB commit: saves ~$8/month.',
            'Step 8: Set AWS Budget alert at $300/month; Cost Explorer tags by environment (prod/dev/staging) to track spend by project.'
          ],
          commonMistake: 'Ignoring data transfer costs — AWS charges for data leaving their network (egress); high-traffic applications can rack up unexpected egress bills; design architectures to keep data within AWS regions and use CloudFront to serve end users.',
          practiceTask: 'Use the AWS Pricing Calculator to estimate monthly costs for a 3-tier web app (2 EC2, 1 RDS, S3, CloudFront). Identify at least 2 cost optimizations. Set up a $50 budget alert in your AWS account.',
          progressCheckQuestion: 'Which AWS support plan includes a 24/7 phone/chat support with less than 1-hour response for production system down?',
          progressCheckOptions: ['Basic (free)', 'Developer ($29/month)', 'Business ($100+/month)', 'Developer Plus ($50/month)'],
          correctOptionIndex: 2,
          progressCheckExplanation: 'Business support provides 24/7 phone and chat access with < 1-hour response for production outages — the minimum for production workloads requiring SLA-backed support.',
          quizQuestions: [
            { question: 'AWS Spot Instances offer up to 90% discount because:', options: ['They run on older hardware', 'They use spare EC2 capacity and can be interrupted with 2-minute notice when AWS needs it back', 'They are shared with other customers', 'They only run during off-peak hours'], correctOptionIndex: 1, explanation: 'Spot uses unused EC2 capacity — great for batch jobs, data analysis, and CI builds that can handle interruption.' },
            { question: 'AWS Cost Explorer allows you to:', options: ['Predict future architecture decisions', 'Visualize and analyze past spending by service, region, tag, and usage type', 'Generate compliance reports', 'Monitor application performance'], correctOptionIndex: 1, explanation: 'Cost Explorer is the primary tool for understanding where money is going and identifying optimization opportunities.' },
            { question: 'The Well-Architected Framework Reliability pillar focuses on:', options: ['Minimizing infrastructure cost', 'Designing systems that recover from failure automatically and meet workload demand', 'Encrypting data at rest and in transit', 'Writing infrastructure as code'], correctOptionIndex: 1, explanation: 'Reliability covers fault tolerance, recovery procedures, and scaling — ensuring workloads recover automatically from infrastructure failures.' },
            { question: 'AWS Free Tier 12-month benefits apply to:', options: ['All AWS accounts indefinitely', 'New accounts for the first 12 months after sign-up — some services are always free', 'Enterprise support plan subscribers only', 'Accounts with a minimum committed spend'], correctOptionIndex: 1, explanation: 'The 12-month free tier helps new users learn and build without immediate costs — great for certification prep and personal projects.' }
          ]
        }
      ],
      finalAssessment: [
        { question: 'IaaS, PaaS, and SaaS differ in:', options: ['Cost only', 'How much infrastructure the customer manages vs the provider manages', 'Geographic availability', 'Support plan requirements'], correctOptionIndex: 1, explanation: 'IaaS = customer manages OS and above; PaaS = customer manages app and data; SaaS = customer only configures.' },
        { question: 'The AWS shared responsibility model means:', options: ['AWS handles all security', 'AWS secures the infrastructure; customers secure their workloads, data, and identity configuration', 'Customers own the data centers', 'Responsibility never changes between service types'], correctOptionIndex: 1, explanation: 'Responsibility shifts with service model — EC2 (IaaS) requires more customer effort than Lambda (serverless).' },
        { question: 'Availability Zones provide:', options: ['Global CDN caching', 'Fault isolation — deploying across multiple AZs protects against single data center failure', 'Edge computing locations', 'Separate billing accounts'], correctOptionIndex: 1, explanation: 'Multiple AZs give high availability within a region — a hallmark of well-architected AWS workloads.' },
        { question: 'S3 Glacier is designed for:', options: ['Frequently accessed real-time data', 'Archival storage rarely accessed — low cost with retrieval taking minutes to hours', 'Static website hosting', 'Database backups requiring instant access'], correctOptionIndex: 1, explanation: 'Glacier is for cold archival data where access latency is acceptable in exchange for very low storage costs.' },
        { question: 'IAM roles vs IAM users:', options: ['Roles are for humans, users are for services', 'Roles provide temporary credentials for services and cross-account access; users have long-term credentials for humans', 'They have identical permissions models', 'Roles cannot be attached to EC2 instances'], correctOptionIndex: 1, explanation: 'Roles are the preferred way to grant AWS services access — no long-term credentials to manage or rotate.' },
        { question: 'Explicit Deny in an IAM policy:', options: ['Can be overridden by an Allow', 'Always wins over any number of Allows', 'Only applies to root account', 'Requires SCP support'], correctOptionIndex: 1, explanation: 'Explicit Deny is absolute — the most powerful IAM statement.' },
        { question: 'AWS CloudTrail logs:', options: ['EC2 performance metrics', 'Every API call — who, what, when, and from where', 'Application-level events', 'VPC network packets'], correctOptionIndex: 1, explanation: 'CloudTrail is the audit trail for all AWS account activity.' },
        { question: 'Reserved Instances save money by:', options: ['Using older hardware', 'Committing to 1 or 3 years of usage in exchange for up to 72% discount', 'Sharing resources with other accounts', 'Disabling automatic backups'], correctOptionIndex: 1, explanation: 'Reserved Instances are right for predictable steady-state workloads.' },
        { question: 'RDS Multi-AZ provides:', options: ['Read scaling across multiple regions', 'Automatic synchronous standby and failover within a region', 'Reduced storage costs', 'Unlimited IOPS'], correctOptionIndex: 1, explanation: 'Multi-AZ maintains a synchronous standby for automatic failover — key for production database availability.' },
        { question: 'Security Groups vs NACLs:', options: ['Identical tools with different names', 'Security Groups are stateful instance firewalls; NACLs are stateless subnet firewalls', 'NACLs are more powerful than Security Groups always', 'Security Groups require explicit outbound rules'], correctOptionIndex: 1, explanation: 'Security Groups track state; NACLs evaluate each packet independently requiring explicit inbound and outbound rules.' },
        { question: 'AWS Business support plan provides:', options: ['Monthly email support only', '24/7 phone/chat with < 1-hour response for production outages', 'A dedicated Technical Account Manager', '15-minute response time for all issues'], correctOptionIndex: 1, explanation: 'Business is the minimum plan for production workloads needing round-the-clock SLA-backed support.' },
        { question: 'AWS Spot Instances are best for:', options: ['Production databases', 'Fault-tolerant batch workloads and CI builds that tolerate interruption for 90% cost savings', 'Applications needing guaranteed uptime', 'Real-time transaction processing'], correctOptionIndex: 1, explanation: 'Spot is ideal when interruption is acceptable — rendering, genomics, CI pipelines, data analysis.' },
        { question: 'The Well-Architected Reliability pillar covers:', options: ['Minimizing cost through rightsizing', 'Auto-recovery from failure, fault tolerance, and meeting demand at scale', 'Encrypting data at rest', 'Optimizing for carbon footprint'], correctOptionIndex: 1, explanation: 'Reliability ensures workloads recover automatically and scale to meet demand.' },
        { question: 'AWS GuardDuty detects:', options: ['Cost overruns in billing', 'Security threats using ML — compromised credentials, unusual API patterns, cryptomining', 'Performance issues in databases', 'Network latency problems'], correctOptionIndex: 1, explanation: 'GuardDuty is the intelligent threat detection service analyzing CloudTrail and flow logs.' },
        { question: 'Cost Explorer is used to:', options: ['Estimate future architecture costs before deployment', 'Visualize and analyze past AWS spending by service, region, and tag', 'Generate security compliance reports', 'Monitor API performance metrics'], correctOptionIndex: 1, explanation: 'Cost Explorer reveals where money is going and which resources are over-provisioned.' }
      ],
      interviewPrep: [
        'Explain the AWS shared responsibility model — describe how responsibilities differ between EC2 (IaaS), Elastic Beanstalk (PaaS), and S3 (managed service); give examples of what AWS owns and what you own in each case.',
        'Walk through the architecture for a highly available 3-tier web application on AWS — VPC design with public/private subnets, ALB, Auto Scaling Group, RDS Multi-AZ, S3, and CloudFront.',
        'Explain IAM least-privilege best practices — how you would structure IAM users, groups, roles, and policies for a team of 5 developers working on a web application with separate dev and prod environments.',
        'Describe the difference between S3 storage classes — when you would use Standard, Infrequent Access, Glacier Instant Retrieval, and Deep Archive; explain how lifecycle policies automate transitions.',
        'Explain the 6 pillars of the AWS Well-Architected Framework and give one concrete practice from each pillar you would apply to a production web application.',
        'Walk through AWS pricing models — On-Demand, Reserved Instances, Savings Plans, and Spot — and describe a workload type where each is the right choice.',
        'Explain what CloudTrail, GuardDuty, and Security Hub do and how they work together to provide a layered security monitoring posture.',
        'Describe the difference between Security Groups and NACLs — stateful vs stateless, where each is applied, and how you would use both to secure an EC2 application in a private subnet.',
        'Explain VPC networking — CIDR blocks, public vs private subnets, Internet Gateway, NAT Gateway, and route tables — and walk through how traffic flows from the internet to an EC2 instance in a private subnet.',
        'Describe how you would set up cost monitoring for an AWS account — budgets, Cost Explorer tags, Trusted Advisor, and right-sizing analysis; give an example of a cost optimization you found and implemented.'
      ]
    });
  }

  // ── DEVOPS BASICS (Docker/Kubernetes/CI-CD aligned, ~60 hrs) ──────────────
  if (/devops/i.test(name)) {
    return buildCourse({
      courseTitle: 'DevOps Basics',
      subtitle: 'Aligned to the Docker Certified Associate study guide, Kubernetes CKA prerequisites, and DORA DevOps Research — the foundational certifications for platform engineering.',
      difficulty: 'Intermediate',
      estimatedDuration: '8 weeks (8 hrs/week) | ~60 hours total',
      marketDemand: 'DevOps engineers earn a median of $125,000 USD. Knowledge of Docker, Kubernetes, and CI/CD pipelines is in the top 5 most-requested skills in cloud/backend job postings. Docker Hub has 14 billion image pulls per month.',
      overview: 'This pathway covers DevOps practices, containerization, orchestration, and automation.\n\nModule 1 (~14 hrs): DevOps culture, CI/CD pipelines, and GitHub Actions workflows.\nModule 2 (~16 hrs): Docker — images, containers, networking, volumes, multi-stage builds, and Compose.\nModule 3 (~16 hrs): Kubernetes — architecture, pods, deployments, services, ingress, and ConfigMaps/Secrets.\nModule 4 (~14 hrs): Monitoring, Infrastructure as Code with Terraform, and SRE principles.',
      learningOutcomes: [
        'Explain DevOps culture, DORA metrics, and the benefits of CI/CD for software delivery.',
        'Build Docker images with multi-stage builds, manage containers, networks, and volumes.',
        'Compose multi-service applications with Docker Compose for local development.',
        'Deploy and manage applications in a Kubernetes cluster using kubectl and YAML manifests.',
        'Configure Kubernetes services, ingress, ConfigMaps, Secrets, and health checks.',
        'Write Terraform configurations to provision cloud infrastructure as code.'
      ],
      resumeSignals: [
        'Containerized a Node.js/Python application with multi-stage Docker builds reducing image size by 70%',
        'Deployed application to Kubernetes cluster with rolling updates, horizontal pod autoscaling, and liveness probes',
        'Built GitHub Actions CI/CD pipeline: lint, test, Docker build, push to registry, and deploy to Kubernetes',
        'Wrote Terraform configuration provisioning VPC, EC2, RDS, and S3 with state stored in S3 backend',
        'Monitored production services with Prometheus metrics and Grafana dashboards; configured alert rules'
      ],
      modules: [
        {
          title: 'DevOps Culture and CI/CD Pipelines',
          objective: 'Explain DevOps culture and DORA metrics, design CI/CD pipelines, and implement automated build-test-deploy workflows with GitHub Actions.',
          hours: 14,
          lesson: 'Part 1 - DevOps Culture: DevOps is the combination of cultural philosophy, practices, and tools that increases an organization\'s ability to deliver applications at high velocity; it breaks down the wall between development (code fast) and operations (stay stable); CALMS framework: Culture, Automation, Lean, Measurement, Sharing; psychological safety enables blameless postmortems; DevOps is not a job title but an organizational practice. Part 2 - DORA Metrics: DORA (DevOps Research and Assessment) identified 4 key metrics: Deployment Frequency (how often code deploys to production), Lead Time for Changes (commit to production time), Change Failure Rate (percentage of deployments causing incidents), Time to Restore Service (MTTR after an incident); elite teams deploy multiple times per day with < 1 hour lead time; these metrics predict both software delivery performance and organizational performance. Part 3 - Continuous Integration: CI automates building and testing code on every commit; developers commit frequently to main (trunk-based) or short-lived feature branches; each push triggers: checkout, install dependencies, lint, run all tests, build artifact; failing CI blocks merge; CI enables teams to detect integration errors within minutes; key principle: keep the build green at all times. Part 4 - Continuous Delivery vs Deployment: Continuous Delivery means every passing build is releasable to production with a manual approval gate; Continuous Deployment means every passing build is automatically deployed to production without human gate; CD requires automated tests with high confidence, feature flags for safe incremental rollout, and monitoring to detect regressions quickly. Part 5 - GitHub Actions Pipelines: YAML workflows in .github/workflows/; triggers: push, pull_request, schedule; jobs: multiple parallel jobs with steps; actions from Marketplace reduce boilerplate; environment variables via secrets; build matrix for multi-version testing; artifacts preserve build outputs between jobs; workflow_dispatch enables manual trigger with inputs. Part 6 - Pipeline Stages: Source stage (checkout); build stage (compile, bundle); test stage (unit, integration, e2e); security scan (SAST with CodeQL, dependency audit with npm audit); artifact registry (push Docker image to GHCR or ECR); deploy stage (update Kubernetes deployment or push to cloud platform); notification (Slack alert on failure). Part 7 - Feature Flags: Feature flags (feature toggles) decouple deployment from release; dark launch — deploy code to production but only enable for 1% of users; A/B testing — enable feature for half of users; kill switch — disable a faulty feature without a rollback deployment; tools: LaunchDarkly, AWS AppConfig, Unleash; enables continuous deployment safely. Part 8 - Trunk-Based Development: Short-lived branches (< 1 day) or commit directly to main; feature flags hide incomplete features; every developer integrates daily; eliminates long-lived branch merge hell; requires comprehensive automated test suite; reduces deployment risk through smaller, more frequent changes; the practice that enables elite DORA performance.',
          workedExample: 'Build a complete CI/CD pipeline for a Node.js API: lint, test, build Docker image, push to GHCR, and deploy to a Kubernetes cluster.',
          workedExampleSteps: [
            'Step 1: .github/workflows/ci-cd.yml — trigger on push to main and PRs.',
            'Step 2: CI job — checkout; setup Node 20; npm ci; npm run lint; npm test -- --coverage; upload coverage artifact.',
            'Step 3: Security scan — npm audit --audit-level=high; fail if high vulnerabilities found.',
            'Step 4: Build job (needs: ci) — docker/login-action with GHCR_TOKEN; docker/build-push-action — build multi-stage image; push ghcr.io/org/app:sha-${{ github.sha }}.',
            'Step 5: Deploy job (needs: build; if: github.ref == refs/heads/main) — use kubectl action or custom step.',
            'Step 6: kubectl set image deployment/app app=ghcr.io/org/app:sha-${{ github.sha }} -n production.',
            'Step 7: kubectl rollout status deployment/app — wait for rollout; fail pipeline if rollout fails.',
            'Step 8: Notify Slack via webhook on success/failure — include commit SHA, author, and link to workflow run.'
          ],
          commonMistake: 'Deploying without monitoring the rollout — always run kubectl rollout status after a deploy; if new pods crash, Kubernetes stops the rollout but you need the pipeline to detect and report this failure.',
          practiceTask: 'Set up a CI/CD pipeline for a simple web application: CI runs lint and tests on PRs; CD builds a Docker image and pushes to GHCR on merge to main. Add npm audit security scanning. Verify it runs on a test PR.',
          progressCheckQuestion: 'Which DORA metric measures the percentage of deployments that result in an incident requiring a hotfix?',
          progressCheckOptions: ['Deployment Frequency', 'Lead Time for Changes', 'Change Failure Rate', 'Time to Restore Service'],
          correctOptionIndex: 2,
          progressCheckExplanation: 'Change Failure Rate is a quality metric — elite teams target < 5%; high rates indicate insufficient automated testing or risky deployment practices.',
          quizQuestions: [
            { question: 'Continuous Deployment differs from Continuous Delivery in that:', options: ['Delivery is faster', 'Deployment automatically deploys every passing build to production; Delivery requires a manual approval gate', 'They are the same practice', 'Delivery deploys more frequently'], correctOptionIndex: 1, explanation: 'CD = every green build goes to production automatically; CDelivery = every green build is releasable but a human chooses when.' },
            { question: 'Feature flags enable:', options: ['Faster Docker builds', 'Decoupling deployment from release — code is deployed but features are toggled on/off independently', 'Automatic scaling of services', 'CI pipeline caching'], correctOptionIndex: 1, explanation: 'Feature flags allow dark launches, A/B tests, and instant rollback without a code deployment.' },
            { question: 'Trunk-based development means:', options: ['All code lives in one giant file', 'Short-lived feature branches (< 1 day) or direct commits to main — minimizing merge conflicts', 'Only one developer commits at a time', 'Branches last until features are fully complete'], correctOptionIndex: 1, explanation: 'Trunk-based development with small frequent commits is the practice behind elite DORA performance — it eliminates long-lived branch merge hell.' },
            { question: 'DORA Lead Time for Changes measures:', options: ['Time to restore service after an incident', 'Time from code commit to running in production', 'How often code is deployed', 'Percentage of failed deployments'], correctOptionIndex: 1, explanation: 'Lead time is the end-to-end delivery speed metric — elite teams achieve < 1 hour from commit to production.' }
          ]
        },
        {
          title: 'Docker and Containerization',
          objective: 'Build and optimize Docker images with multi-stage builds, manage containers, configure networking and volumes, and compose multi-service applications.',
          hours: 16,
          lesson: 'Part 1 - Container Concepts: Containers package an application with all its dependencies into an isolated, portable unit; containers share the host OS kernel (unlike VMs which run a full OS); Docker uses namespaces for isolation and cgroups for resource limits; a container is a running instance of an image; images are immutable, layered file systems; the Docker daemon manages images and containers. Part 2 - Docker Images: Dockerfile instructions build layers: FROM selects base image, WORKDIR sets working directory, COPY adds files, RUN executes commands and creates a layer, CMD specifies default command, EXPOSE documents ports, ENV sets environment variables; layers are cached — order instructions from least to most frequently changed for faster builds; official images from Docker Hub are curated and regularly patched. Part 3 - Multi-Stage Builds: Multi-stage Dockerfiles use multiple FROM instructions; the builder stage installs dev dependencies and builds the app; the final stage copies only the built artifacts into a minimal runtime image (node:alpine, distroless); this dramatically reduces final image size — a Node.js app goes from 1.2GB to 150MB; smaller images have smaller attack surface and pull faster. Part 4 - Container Networking: Bridge network is the default — containers communicate via IP; user-defined bridge networks add DNS hostname resolution (container names resolve to IPs); host network removes network isolation, useful for performance; none network disables networking; port publishing (-p host:container) maps container ports to host; docker network create, connect, and inspect commands manage networks. Part 5 - Volumes and Data Persistence: Containers are ephemeral — data is lost when the container is removed; named volumes (docker volume create) persist data between container restarts; bind mounts map a host directory into the container (useful for development hot reload); tmpfs mounts store data in memory only; never store important data in the container writeable layer; volume backups use docker run --volumes-from. Part 6 - Docker Compose: docker-compose.yml defines multi-service applications; services section defines each container (image, build, ports, environment, volumes, depends_on, networks); docker compose up -d starts all services in the background; docker compose logs -f streams logs; docker compose down removes containers but preserves named volumes; docker compose down -v also removes volumes; compose files use YAML anchors for DRY configuration. Part 7 - Docker Security: Run as non-root user: USER node in Dockerfile; read-only filesystem: --read-only flag; no-new-privileges: --security-opt=no-new-privileges; limit capabilities with --cap-drop=ALL --cap-add NET_BIND_SERVICE; scan images for vulnerabilities with docker scout or trivy; use specific image tags not :latest (immutable and auditable); never embed secrets in images. Part 8 - Container Registry: Docker Hub is the default public registry; AWS ECR, Google Artifact Registry, and GitHub Container Registry (GHCR) are private options; docker push pushes to registry; docker pull downloads; image tagging: registry/namespace/image:tag; tag with git commit SHA for immutable traceability; tag with :latest for convenience (not recommended for production deployments); lifecycle policies automatically delete old images.',
          workedExample: 'Build a production-ready Docker setup for a Node.js API with multi-stage build, Docker Compose for local dev, and security best practices.',
          workedExampleSteps: [
            'Step 1: Dockerfile — FROM node:20-alpine AS builder; WORKDIR /app; COPY package*.json .; RUN npm ci; COPY . .; RUN npm run build.',
            'Step 2: Final stage — FROM node:20-alpine; WORKDIR /app; RUN addgroup -S app && adduser -S app -G app; USER app.',
            'Step 3: COPY --from=builder --chown=app:app /app/dist ./dist; COPY --from=builder --chown=app:app /app/node_modules ./node_modules.',
            'Step 4: CMD ["node", "dist/server.js"]; EXPOSE 3000; HEALTHCHECK --interval=30s CMD wget -qO- http://localhost:3000/health || exit 1.',
            'Step 5: docker build -t myapp:$(git rev-parse --short HEAD) . — check image size; compare to single-stage build.',
            'Step 6: docker-compose.yml — services: app (build: ., ports: 3000:3000, environment: .env file, depends_on: db); db (image: postgres:16, volumes: pgdata).',
            'Step 7: Scan image: trivy image myapp:sha — fix any HIGH/CRITICAL vulnerabilities before pushing.',
            'Step 8: Push to GHCR: docker tag myapp:sha ghcr.io/org/myapp:sha; docker push; verify lifecycle policy cleans up images older than 30 days.'
          ],
          commonMistake: 'Running containers as root — this means a container escape gives attackers root access on the host; always add a non-root USER in the Dockerfile and use --read-only where possible.',
          practiceTask: 'Containerize an existing Node.js or Python application with a multi-stage Dockerfile. Reduce image size to under 200MB. Write a docker-compose.yml with the app and a database. Scan with trivy and fix any HIGH vulnerabilities.',
          progressCheckQuestion: 'Multi-stage Docker builds reduce image size by:',
          progressCheckOptions: ['Compressing the filesystem', 'Using a builder stage with dev tools and copying only built artifacts to a minimal final stage', 'Removing documentation files', 'Using the latest base image'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'Multi-stage builds leave build tools and dev dependencies in the builder stage — only the compiled output is copied into the minimal production image.',
          quizQuestions: [
            { question: 'Docker named volumes differ from bind mounts in that:', options: ['Named volumes are faster', 'Named volumes are managed by Docker and persist independently; bind mounts map host paths directly', 'Bind mounts work on Linux only', 'Named volumes require docker compose'], correctOptionIndex: 1, explanation: 'Named volumes are portable and Docker-managed; bind mounts tie containers to specific host paths, complicating portability.' },
            { question: 'Docker containers share with the host:', options: ['The entire OS including kernel and filesystem', 'Only the OS kernel — each container has isolated filesystem, processes, and network via namespaces', 'CPU and memory resources without any limits', 'The same network interfaces'], correctOptionIndex: 1, explanation: 'Containers use namespaces for isolation — much lighter than VMs while still providing process and network isolation.' },
            { question: 'USER instruction in a Dockerfile:', options: ['Sets the username in container logs', 'Runs subsequent instructions and the CMD as a non-root user — critical security practice', 'Creates a Linux user with sudo access', 'Configures authentication for docker pull'], correctOptionIndex: 1, explanation: 'Running as non-root limits the blast radius if the application is compromised — an attacker gets the app process, not root.' },
            { question: 'Docker image layers should be ordered:', options: ['Alphabetically by instruction name', 'From least to most frequently changed to maximize layer cache reuse', 'Largest to smallest', 'By file size descending'], correctOptionIndex: 1, explanation: 'Each changed instruction invalidates all subsequent cached layers — install dependencies before copying source code to avoid reinstalling on every code change.' }
          ]
        },
        {
          title: 'Kubernetes Fundamentals',
          objective: 'Explain Kubernetes architecture, deploy and manage applications with kubectl and YAML manifests, configure services and ingress, and use ConfigMaps and Secrets.',
          hours: 16,
          lesson: 'Part 1 - Kubernetes Architecture: Control plane components: API Server (all communication), etcd (cluster state store), Scheduler (assigns pods to nodes), Controller Manager (reconciliation loops); worker node components: kubelet (node agent), kube-proxy (networking), container runtime (containerd, Docker); declarative model — desired state stored in etcd, controllers reconcile actual state to desired; kubectl is the command-line interface to the API server. Part 2 - Pods: Pod is the smallest deployable unit in Kubernetes — a group of one or more containers sharing network and storage; containers in a pod communicate via localhost; pods are ephemeral — do not rely on pod IPs; each pod gets a unique cluster-internal IP; pod spec defines containers, resources, volumes, environment variables, and probes; pods are almost never created directly — Deployments manage them. Part 3 - Deployments: Deployment manages a set of identical pods with a ReplicaSet; spec.replicas sets desired pod count; spec.selector matches pods it manages; spec.template is the pod template; rolling update strategy replaces pods gradually — zero downtime; kubectl rollout status checks progress; kubectl rollout undo rolls back; Recreate strategy kills all old pods before starting new — incurs downtime. Part 4 - Services: Services provide stable network access to a set of pods; ClusterIP (default) gives a stable in-cluster IP; NodePort exposes on a port on every node; LoadBalancer provisions a cloud load balancer; ExternalName maps to a DNS name; service discovery: pods use service name as hostname; kube-proxy handles load balancing across pod replicas. Part 5 - ConfigMaps and Secrets: ConfigMaps store non-sensitive configuration (database hostname, feature flags) as key-value pairs; injected as environment variables or volume files; Secrets store sensitive data (passwords, tokens, TLS certificates) base64-encoded; by default Secrets are not encrypted at rest — enable encryption with KMS provider; never commit Secret manifests with values to git; use external secret managers (Vault, AWS Secrets Manager) in production. Part 6 - Ingress: Ingress manages external HTTP/HTTPS access to services; Ingress controllers (NGINX, Traefik, AWS ALB) implement routing rules; ingress resource defines host-based and path-based routing: app.example.com -> app-service; TLS termination with Let\'s Encrypt via cert-manager; ingress replaces multiple NodePort/LoadBalancer services with one entry point. Part 7 - Health Checks: livenessProbe restarts a container if it fails (deadlock detection); readinessProbe removes the pod from service endpoints until it is ready to receive traffic (startup grace period); startupProbe is for slow-starting containers — liveness is only checked after startupProbe succeeds; HTTP, TCP socket, and exec probe types; configure initialDelaySeconds, periodSeconds, failureThreshold appropriately. Part 8 - Resource Management and Autoscaling: resources.requests reserves CPU and memory on the node for scheduling; resources.limits caps CPU and memory — pod is OOMKilled if it exceeds memory limit; HorizontalPodAutoscaler (HPA) scales replicas based on CPU or custom metrics; cluster-autoscaler adds or removes nodes based on unschedulable pods; LimitRange enforces default resource requests/limits in a namespace; ResourceQuota limits total resources in a namespace.',
          workedExample: 'Deploy a Node.js API to Kubernetes: Deployment, Service, Ingress, ConfigMap, Secret, and health checks.',
          workedExampleSteps: [
            'Step 1: namespace.yaml — apiVersion: v1; kind: Namespace; metadata: { name: production }.',
            'Step 2: configmap.yaml — data: { DATABASE_HOST: postgres-service, LOG_LEVEL: info }.',
            'Step 3: secret.yaml — type: Opaque; data: { DATABASE_PASSWORD: base64-encoded-value } — use Sealed Secrets in production.',
            'Step 4: deployment.yaml — replicas: 3; strategy: RollingUpdate (maxSurge: 1, maxUnavailable: 0); container resources: requests: { cpu: 100m, memory: 128Mi }, limits: { memory: 256Mi }.',
            'Step 5: Health probes — livenessProbe: httpGet /health port 3000, initialDelaySeconds 30, periodSeconds 10; readinessProbe: same path, initialDelaySeconds 5.',
            'Step 6: service.yaml — kind: Service; type: ClusterIP; selector matches deployment labels; port 80 -> containerPort 3000.',
            'Step 7: ingress.yaml — host: api.example.com; path: / -> service port 80; TLS: cert-manager.io/cluster-issuer: letsencrypt-prod.',
            'Step 8: kubectl apply -f k8s/ -n production; kubectl rollout status deployment/app -n production; verify pods running and ingress responds.'
          ],
          commonMistake: 'Not setting resource requests and limits — without them, one runaway pod can consume all node resources, evicting other pods; always set requests (for scheduling) and limits (for protection).',
          practiceTask: 'Deploy your Dockerized application to a local Kubernetes cluster (Kind or minikube). Write Deployment, Service, ConfigMap, and Secret manifests. Configure liveness and readiness probes. Verify with kubectl get all.',
          progressCheckQuestion: 'A Kubernetes readinessProbe failure causes:',
          progressCheckOptions: ['The pod to be restarted immediately', 'The pod to be removed from service endpoints until it passes — traffic stops routing to it', 'The node to be drained', 'The deployment to be rolled back'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'readinessProbe gates traffic — a failing probe removes the pod from Service endpoints; it is not restarted. livenessProbe failure triggers a container restart.',
          quizQuestions: [
            { question: 'Kubernetes Services provide:', options: ['Container image storage', 'Stable DNS and load-balanced network access to a set of pods — even as pods are replaced', 'Persistent storage for pods', 'Node scheduling decisions'], correctOptionIndex: 1, explanation: 'Services abstract away pod ephemerality — clients connect to the stable Service IP/DNS, not individual pod IPs.' },
            { question: 'ConfigMaps vs Secrets in Kubernetes:', options: ['They are identical', 'ConfigMaps for non-sensitive config; Secrets for sensitive data (encrypted in transit, base64 at rest)', 'Secrets are always encrypted at rest by default', 'ConfigMaps can store TLS certificates'], correctOptionIndex: 1, explanation: 'Secrets are not encrypted at rest by default — enable encryption with a KMS provider for production; use external secret managers for best security.' },
            { question: 'Kubernetes rolling update strategy:', options: ['Kills all old pods before starting new ones (incurs downtime)', 'Replaces pods gradually — maintains availability by keeping old pods running until new ones are ready', 'Updates only one pod and leaves others on the old version', 'Requires manual approval for each pod replacement'], correctOptionIndex: 1, explanation: 'Rolling updates provide zero-downtime deployments — maxSurge and maxUnavailable tune the rollout speed.' },
            { question: 'Resource requests in Kubernetes pod specs are used for:', options: ['Capping the maximum CPU the pod can use', 'Informing the scheduler how much CPU and memory to reserve on a node for the pod', 'Billing purposes only', 'Setting hard limits that kill the container if exceeded'], correctOptionIndex: 1, explanation: 'Requests are scheduling hints — the scheduler finds a node with enough available capacity; limits cap actual usage.' }
          ]
        },
        {
          title: 'Monitoring, Infrastructure as Code, and SRE',
          objective: 'Set up Prometheus and Grafana monitoring, write Terraform configurations for cloud infrastructure, and apply SRE principles including SLOs and incident response.',
          hours: 14,
          lesson: 'Part 1 - Observability Pillars: The three pillars of observability are metrics (quantitative measurements over time), logs (discrete events with context), and traces (distributed request paths across services); metrics tell you something is wrong; logs tell you what happened; traces tell you where in the system it happened; observability enables understanding system behavior without modifying production code. Part 2 - Prometheus Metrics: Prometheus scrapes metrics from /metrics endpoints using pull model; metric types: Counter (always increasing, e.g., request count), Gauge (can go up or down, e.g., queue size), Histogram (distribution with buckets, e.g., request latency), Summary (similar but with quantiles); PromQL query language filters and aggregates; alerting rules trigger alerts when conditions are met. Part 3 - Grafana Dashboards: Grafana visualizes metrics from Prometheus, CloudWatch, and many other data sources; panels: time series, stat, gauge, table, heatmap; variables enable dynamic dashboards (select environment, service); alerts trigger notifications via PagerDuty, Slack, or email; dashboards as code (Grafonnet) enables version control; the RED method (Rate, Errors, Duration) per service is the starting point for dashboards. Part 4 - Centralized Logging: ELK Stack (Elasticsearch, Logstash, Kibana) or OpenSearch for centralized log aggregation and search; Fluentd or Filebeat collect and forward logs; structured JSON logging enables field-based filtering; Loki (Grafana Labs) is a lightweight log aggregation system paired with Grafana; log retention policies balance cost and compliance; never log secrets, PII, or authentication tokens. Part 5 - Terraform Fundamentals: Terraform is the leading Infrastructure as Code tool supporting 1,000+ providers; HCL (HashiCorp Configuration Language) syntax; main.tf, variables.tf, outputs.tf, providers.tf file convention; terraform init, plan, apply, destroy workflow; state file tracks real infrastructure; remote state backend (S3 + DynamoDB locking) enables team collaboration; modules encapsulate reusable infrastructure patterns. Part 6 - Terraform Best Practices: Use modules for reusable infrastructure (VPC module, EKS module); workspace or separate state files for environment isolation (dev/staging/prod); import existing resources with terraform import; drift detection with terraform plan in CI; version pin providers and modules; never commit terraform.tfstate to git; use Atlantis or Terraform Cloud for pull-request-based workflow with plan previews. Part 7 - SRE Principles: SRE (Site Reliability Engineering) applies software engineering to operations; SLI (Service Level Indicator): the metric measured (e.g., 99th percentile latency); SLO (Service Level Objective): the target (e.g., p99 latency < 200ms for 99.9% of requests over 30 days); SLA (Service Level Agreement): the contractual commitment; Error Budget: 100% - SLO = the allowed downtime/errors; burning the error budget triggers a freeze on risky deployments. Part 8 - Incident Response: On-call rotation with clear escalation policy; runbooks for common failure scenarios; the incident lifecycle: detect (alert fires), triage (impact assessment), mitigate (restore service), investigate (root cause), postmortem (blameless, with action items); postmortems focus on system and process improvements not individual blame; MTTR (Mean Time to Restore) is the key SRE operational metric.',
          workedExample: 'Write a Terraform configuration for a VPC, EC2 instance, and RDS database; add Prometheus monitoring with a custom metrics dashboard.',
          workedExampleSteps: [
            'Step 1: providers.tf — required_providers { aws = { source = "hashicorp/aws", version = "~> 5.0" } }; backend "s3" { bucket, key, region, dynamodb_table }.',
            'Step 2: variables.tf — variable "env" { default = "dev" }; variable "instance_type" {}; variable "db_password" { sensitive = true }.',
            'Step 3: vpc.tf — module "vpc" { source = "terraform-aws-modules/vpc/aws"; cidr = "10.0.0.0/16"; azs, public_subnets, private_subnets }.',
            'Step 4: ec2.tf — resource "aws_instance" "app" { ami, instance_type, subnet_id = module.vpc.private_subnets[0], iam_instance_profile }.',
            'Step 5: rds.tf — resource "aws_db_instance" "main" { engine = "postgres", multi_az = true, db_subnet_group_name, vpc_security_group_ids }.',
            'Step 6: terraform plan shows what will be created; review carefully; terraform apply --auto-approve in CI after review.',
            'Step 7: Prometheus scrape config — job_name: node; static_configs: [{ targets: [ec2-ip:9100] }]; alert rule: CPU > 80% for 5m.',
            'Step 8: Grafana dashboard — RED method panel per service: rate(http_requests_total[5m]), rate(http_errors_total[5m]), histogram_quantile(0.99, http_duration_seconds_bucket).'
          ],
          commonMistake: 'Committing terraform.tfstate to a git repository — state contains sensitive values like passwords and keys; always use a remote backend (S3 with encryption + DynamoDB locking) for team collaboration and security.',
          practiceTask: 'Write a Terraform configuration creating a VPC, public/private subnets, and an EC2 instance. Store state in S3. Run terraform plan and apply. Use terraform destroy when done. Set up a basic Prometheus + Grafana stack locally with docker-compose.',
          progressCheckQuestion: 'The SRE Error Budget is:',
          progressCheckOptions: ['The total spending budget for on-call engineers', '100% minus the SLO target — the allowed amount of downtime or errors before risky deploys are frozen', 'The maximum number of incidents per month', 'The time allocated for incident postmortems'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'Error budget quantifies acceptable unreliability — if the SLO is 99.9% uptime, the error budget is 0.1% (43 min/month). Burning it triggers a deployment freeze to protect reliability.',
          quizQuestions: [
            { question: 'Prometheus Counters vs Gauges:', options: ['They are identical metric types', 'Counters only increase (requests, errors); Gauges can increase and decrease (queue size, memory)', 'Gauges are for histograms; Counters are for latency', 'Counters reset hourly; Gauges are permanent'], correctOptionIndex: 1, explanation: 'Counters track cumulative totals; Gauges track current state — use rate() with Counters in PromQL.' },
            { question: 'Terraform remote state backend (S3 + DynamoDB) provides:', options: ['Faster terraform apply execution', 'Shared state file across team members with locking to prevent concurrent modifications', 'Automatic infrastructure drift detection', 'Cost optimization recommendations'], correctOptionIndex: 1, explanation: 'Remote backend enables team collaboration — S3 stores state, DynamoDB provides mutex locking to prevent simultaneous applies.' },
            { question: 'SLO (Service Level Objective) is:', options: ['The contractual guarantee in a customer agreement', 'The internal reliability target (e.g., 99.9% of requests succeed) against which error budget is measured', 'The average response time of the service', 'The maximum number of allowed incidents'], correctOptionIndex: 1, explanation: 'SLO is the internal target; SLA is the contractual obligation (usually lower than the SLO to provide buffer).' },
            { question: 'A blameless postmortem focuses on:', options: ['Identifying and disciplining the engineer who caused the incident', 'System and process improvements — understanding contributing factors without attributing blame to individuals', 'Calculating financial penalties for downtime', 'Removing the feature that caused the incident'], correctOptionIndex: 1, explanation: 'Blameless culture encourages honest reporting of failures — finding systemic issues produces sustainable reliability improvements.' }
          ]
        }
      ],
      finalAssessment: [
        { question: 'DORA Change Failure Rate measures:', options: ['Deployment speed', 'Percentage of deployments causing incidents', 'Time to restore after an incident', 'How often code deploys'], correctOptionIndex: 1, explanation: 'Change Failure Rate is a quality metric — elite teams target < 5%.' },
        { question: 'Multi-stage Docker builds:', options: ['Compress the image with gzip', 'Use a builder stage and copy only artifacts to a minimal final image — dramatically reducing size', 'Run multiple builds in parallel', 'Cache all layers for faster pulls'], correctOptionIndex: 1, explanation: 'Multi-stage builds leave dev tools in the builder; only compiled output goes to the production image.' },
        { question: 'Docker containers vs VMs:', options: ['Containers include a full OS per instance', 'Containers share the host OS kernel — lighter weight with namespace isolation', 'VMs start faster than containers', 'Containers cannot run multiple processes'], correctOptionIndex: 1, explanation: 'Containers are lightweight because they share the host kernel, using namespaces for isolation.' },
        { question: 'Kubernetes readinessProbe failure:', options: ['Restarts the container', 'Removes pod from Service endpoints — traffic stops routing to it', 'Drains the node', 'Rolls back the deployment'], correctOptionIndex: 1, explanation: 'readinessProbe gates traffic routing without restarting the container.' },
        { question: 'Kubernetes resource requests are used for:', options: ['Killing pods that exceed CPU limits', 'Informing the scheduler how much capacity to reserve on a node', 'Setting billing priorities', 'Configuring network bandwidth'], correctOptionIndex: 1, explanation: 'Requests are scheduling hints — limits cap actual usage and trigger OOMKill if exceeded.' },
        { question: 'Kubernetes rolling updates:', options: ['Kill all pods before starting new ones', 'Replace pods gradually maintaining availability throughout the rollout', 'Require manual pod-by-pod approval', 'Only work with StatefulSets'], correctOptionIndex: 1, explanation: 'Rolling updates enable zero-downtime deployments by keeping old pods running until new ones are ready.' },
        { question: 'Kubernetes ConfigMaps vs Secrets:', options: ['They are identical', 'ConfigMaps for non-sensitive config; Secrets for sensitive data (need KMS for at-rest encryption)', 'Secrets are always encrypted at rest by default', 'ConfigMaps support TLS certificates'], correctOptionIndex: 1, explanation: 'Secrets need additional encryption configuration for at-rest security — external secret managers are best practice.' },
        { question: 'Terraform state file should be:', options: ['Committed to git for version control', 'Stored in a remote backend (S3 + DynamoDB) — never in git as it contains sensitive values', 'Recreated on every terraform apply', 'Shared via email between team members'], correctOptionIndex: 1, explanation: 'State contains sensitive values and must be shared securely — remote backends with locking enable safe team collaboration.' },
        { question: 'SRE error budget is:', options: ['The monthly operations budget', '100% minus the SLO — the allowed unreliability before deploy freeze', 'Maximum incident response time', 'The cost of on-call staff'], correctOptionIndex: 1, explanation: 'Error budget quantifies how much unreliability is acceptable before action is needed.' },
        { question: 'Prometheus metric type for HTTP request count:', options: ['Gauge — can decrease', 'Counter — always increasing cumulative count; use rate() for per-second rate', 'Histogram — for distribution', 'Summary — for percentiles'], correctOptionIndex: 1, explanation: 'Request count is a Counter — always increasing; rate() converts it to per-second rate for dashboards.' },
        { question: 'Feature flags allow:', options: ['Faster container builds', 'Decoupling code deployment from feature release — deploy dark, enable gradually', 'Automatic scaling of services', 'CI pipeline caching'], correctOptionIndex: 1, explanation: 'Feature flags enable safe continuous deployment with instant rollback via toggle, not deployment.' },
        { question: 'Running Docker containers as non-root:', options: ['Reduces image size', 'Limits blast radius if compromised — attacker gets app process, not root host access', 'Improves container startup time', 'Is required by Docker for all containers'], correctOptionIndex: 1, explanation: 'Non-root USER in Dockerfile is a critical security practice for production containers.' },
        { question: 'Kubernetes Ingress provides:', options: ['Persistent volume storage', 'External HTTP/HTTPS routing to services with host/path rules and TLS termination', 'Node-to-node communication', 'Container image caching'], correctOptionIndex: 1, explanation: 'Ingress consolidates external access through one entry point with routing rules.' },
        { question: 'Continuous Delivery vs Continuous Deployment:', options: ['Identical practices', 'Delivery requires a manual gate before production; Deployment is fully automated to production', 'Deployment is slower and more careful', 'Delivery only applies to microservices'], correctOptionIndex: 1, explanation: 'Delivery = releasable at any time with human approval; Deployment = automatically ships every green build.' },
        { question: 'Blameless postmortems:', options: ['Identify and discipline responsible engineers', 'Focus on systemic improvements — understanding contributing factors without personal blame', 'Only apply to major outages', 'Replace SLA penalties for downtime'], correctOptionIndex: 1, explanation: 'Blameless culture enables honest failure reporting, producing lasting reliability improvements.' }
      ],
      interviewPrep: [
        'Explain the DORA four metrics — Deployment Frequency, Lead Time for Changes, Change Failure Rate, and Time to Restore Service — and describe practices that improve each metric.',
        'Walk through building a CI/CD pipeline for a Dockerized Node.js application: stages (lint, test, build image, push to registry, deploy), tools (GitHub Actions), and how you handle rollback on a failed deployment.',
        'Explain multi-stage Docker builds — write a Dockerfile for a Node.js application, explain why it reduces image size, and describe the security benefits of running as a non-root user.',
        'Describe Kubernetes architecture — control plane components (API server, etcd, scheduler, controller manager) and worker node components (kubelet, kube-proxy); explain how a deployment is created end-to-end.',
        'Explain the difference between livenessProbe and readinessProbe in Kubernetes — what happens when each fails and why you need both on a web server pod.',
        'Walk through writing a Terraform module for a VPC with public/private subnets — explain the init/plan/apply workflow, remote state backend configuration, and how you handle environment isolation.',
        'Describe the three pillars of observability (metrics, logs, traces) — explain what Prometheus metrics types exist, what the RED method dashboard covers, and how you set up an alert for high error rate.',
        'Explain SRE SLO/SLI/SLA/Error Budget — give an example SLO for an API, calculate the error budget, and describe what happens when the error budget is exhausted.',
        'Walk through a blameless postmortem — what sections it contains, how you identify contributing factors without blame, and what action items you would create from a database outage.',
        'Explain Docker networking — how containers communicate on a user-defined bridge network, what DNS resolution provides, and how port publishing works for external access.'
      ]
    });
  }


  if (/it.support/i.test(name)) {
    return buildCourse({
      courseTitle: 'IT Support',
      subtitle: 'Aligned to the CompTIA A+ Core 1 (220-1101) and Core 2 (220-1102) certification objectives — the most widely recognized entry-level IT credential with 1.3 million holders.',
      difficulty: 'Beginner',
      estimatedDuration: '10 weeks (8 hrs/week) | ~80 hours total',
      marketDemand: 'IT support roles have a 9% growth projection through 2032. CompTIA A+ holders start at $42,000-$60,000 and move into sysadmin, networking, or security roles within 2 years. The certification is listed in 300,000+ job postings.',
      overview: 'This pathway aligns to CompTIA A+ Core 1 (220-1101) and Core 2 (220-1102) objectives.\n\nModule 1 (~22 hrs): Hardware, mobile devices, networking basics, and printers (Core 1 domains 1-3).\nModule 2 (~18 hrs): Virtualization, cloud, and troubleshooting hardware/network (Core 1 domains 4-5).\nModule 3 (~22 hrs): Operating systems — Windows, macOS, Linux — installation, configuration, and administration (Core 2).\nModule 4 (~18 hrs): Security, troubleshooting OS and security, and operational/professional procedures (Core 2).',
      learningOutcomes: [
        'Identify, install, configure, and upgrade PC hardware components and peripherals.',
        'Set up and troubleshoot wired and wireless networks for small offices and home offices.',
        'Install, configure, and maintain Windows, macOS, and Linux operating systems.',
        'Apply cybersecurity best practices including malware removal, encryption, and secure authentication.',
        'Implement virtualization, cloud computing concepts, and troubleshoot virtualized environments.',
        'Demonstrate professional communication, documentation, and change management procedures.'
      ],
      resumeSignals: [
        'CompTIA A+ Core 1 and Core 2 certified (220-1101 / 220-1102)',
        'Configured SOHO network with managed switch, VLAN segmentation, and WPA3 wireless',
        'Deployed 15-workstation Windows domain environment with Active Directory and GPO-based security policies',
        'Performed malware removal, drive encryption with BitLocker, and OS hardening on end-user machines',
        'Maintained hardware asset inventory and ticket documentation following ITIL-aligned change management processes'
      ],
      modules: [
        {
          title: 'Hardware, Networking Basics, and Mobile Devices',
          objective: 'Identify, install, and configure PC hardware components; explain networking fundamentals; set up SOHO wireless networks; and support mobile devices.',
          hours: 22,
          lesson: 'Part 1 - PC Hardware Components: Motherboard is the main circuit board connecting all components via buses and chipset; CPU socket types: LGA (Intel), AM5 (AMD); RAM types: DDR4 vs DDR5 — check motherboard compatibility; PSU wattage must exceed peak system load; SATA vs M.2 NVMe storage — NVMe is 3-7x faster; GPU PCIe slot; POST (Power-On Self-Test) runs at startup to check hardware integrity. Part 2 - Storage Technologies: HDD (spinning disk) is slower but cheaper per GB — good for bulk storage; SSD (Solid State Drive) SATA is 5x faster than HDD; NVMe M.2 SSDs are the fastest consumer storage; RAID levels: RAID 0 (striping, no redundancy), RAID 1 (mirroring, 50% capacity used), RAID 5 (striping with parity, requires 3+ drives), RAID 10 (stripe + mirror); understand IOPS, throughput, and latency differences. Part 3 - RAM and CPU: DDR4 speeds: 2133-3600 MHz; DDR5: 4800-8000 MHz; dual-channel mode doubles memory bandwidth when matching sticks in correct slots; CPU cache hierarchy: L1 (fastest, smallest), L2, L3 (shared); multi-core CPUs: each core is an independent processor; hyper-threading doubles logical cores; thermal paste between CPU and cooler ensures heat transfer. Part 4 - Display and Peripherals: Monitor connections: HDMI, DisplayPort, USB-C/Thunderbolt, DVI (legacy), VGA (legacy); resolution standards: 1080p, 1440p, 4K; refresh rate affects smoothness (60Hz, 144Hz, 240Hz); KVM switches share keyboard/video/mouse across multiple computers; printers: laser (page printer, uses toner), inkjet (per-page, uses ink cartridges); laser print process: processing, charging, exposing, developing, transferring, fusing, cleaning. Part 5 - Networking Fundamentals: OSI model layers: Physical, Data Link, Network, Transport, Session, Presentation, Application; TCP vs UDP: TCP is reliable (3-way handshake), UDP is fast and connectionless; IP addressing: IPv4 (32-bit, dotted decimal), IPv6 (128-bit, hexadecimal); subnet masks divide network and host portions; private IP ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16; DHCP assigns addresses dynamically; DNS resolves hostnames to IPs. Part 6 - Network Hardware: Switch connects devices within the same network using MAC addresses (Layer 2); router connects networks using IP addresses (Layer 3); hub broadcasts to all ports (legacy, avoid); access point provides wireless connectivity; managed switches support VLAN configuration; PoE (Power over Ethernet) switches power IP cameras and phones via Cat cable; patch panels organize cable terminations in server rooms. Part 7 - Wireless Networking: 802.11 standards: 802.11n (Wi-Fi 4, 600Mbps), 802.11ac (Wi-Fi 5, 3.5Gbps), 802.11ax (Wi-Fi 6, 9.6Gbps); 2.4GHz band has greater range but more interference; 5GHz band has more speed and channels but less range; 6GHz (Wi-Fi 6E) adds additional clean spectrum; security: WPA2-AES (minimum), WPA3-SAE (current best); SSID, channel selection, and power output affect SOHO network performance. Part 8 - Mobile Devices: iOS and Android hardware components: SoC (system on chip), GPS, accelerometer, gyroscope, proximity sensor, biometrics (fingerprint, Face ID); MDM (Mobile Device Management) enables corporate policies, remote wipe, and app management on employee devices; BYOD (Bring Your Own Device) policies balance employee privacy with corporate security; mobile device troubleshooting: restart, factory reset, backup/restore from cloud.',
          workedExample: 'Build and configure a SOHO network: managed switch with VLANs, wireless access point with WPA3, and DHCP/DNS configuration.',
          workedExampleSteps: [
            'Step 1: Plan network — VLAN 10: corporate devices (192.168.10.0/24); VLAN 20: guest WiFi (192.168.20.0/24); VLAN 30: IoT devices (192.168.30.0/24).',
            'Step 2: Configure managed switch — create VLANs; set trunk ports to router (all VLANs tagged); set access ports to appropriate VLAN per device.',
            'Step 3: Router VLAN subinterfaces — eth0.10, eth0.20, eth0.30 each with gateway IP and DHCP pool for its subnet.',
            'Step 4: Firewall rules — VLAN 20 (guest) can access internet only, cannot reach VLAN 10; VLAN 30 (IoT) cannot reach VLAN 10 or 20.',
            'Step 5: Access point — SSID "Corporate" on VLAN 10 with WPA3-Enterprise (802.1X to RADIUS server); SSID "Guest" on VLAN 20 with WPA3-Personal.',
            'Step 6: DNS — internal DNS resolver for .local domains; conditional forwarding to 1.1.1.1 for public domains.',
            'Step 7: Test — laptop on Corporate SSID gets 192.168.10.x; can reach file server; cannot reach guest subnet.',
            'Step 8: Document network diagram with IP scheme, VLAN assignments, and cable runs — essential for future troubleshooting.'
          ],
          commonMistake: 'Using the same flat network for all devices — segmenting with VLANs prevents compromised IoT devices from reaching corporate systems and limits the blast radius of any security incident.',
          practiceTask: 'Draw a SOHO network diagram for a 20-person office: switch, router, wireless AP, and 3 VLANs (staff, guest, IoT). Label IP ranges, VLAN IDs, and security settings for each. Identify the purpose of each hardware component.',
          progressCheckQuestion: 'RAID 1 protects data by:',
          progressCheckOptions: ['Striping data across drives for speed', 'Mirroring identical data on two drives — if one fails, the other continues without data loss', 'Distributing data with parity across 3+ drives', 'Compressing data to increase effective capacity'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'RAID 1 mirrors data — two drives hold identical copies. If one fails, the system continues without data loss, though effective capacity is 50% of total.',
          quizQuestions: [
            { question: 'NVMe M.2 SSDs differ from SATA SSDs in that:', options: ['They use a different physical connector only', 'NVMe uses the PCIe bus providing 3-7x faster sequential read speeds compared to SATA interface', 'SATA is faster for random reads', 'They are interchangeable with identical performance'], correctOptionIndex: 1, explanation: 'NVMe uses PCIe lanes instead of the SATA controller — eliminating the SATA bottleneck for dramatically higher throughput.' },
            { question: 'WPA3-SAE improves on WPA2 by:', options: ['Increasing wireless range', 'Protecting against offline dictionary attacks with simultaneous authentication of equals handshake', 'Supporting more concurrent devices', 'Using a shorter encryption key'], correctOptionIndex: 1, explanation: 'WPA3-SAE prevents offline brute-force attacks on captured handshakes — a major weakness of WPA2-PSK.' },
            { question: 'DHCP in a network provides:', options: ['Domain name resolution for hostnames', 'Automatic IP address assignment, subnet mask, gateway, and DNS server configuration to clients', 'Encryption for network traffic', 'Authentication for wireless connections'], correctOptionIndex: 1, explanation: 'DHCP automates IPv4/IPv6 configuration — without it, every device would need manual static IP configuration.' },
            { question: 'A managed switch with VLANs provides:', options: ['Faster internet speeds', 'Network segmentation isolating traffic between device groups for security and performance', 'Wireless access point functionality', 'Automatic firewall rule creation'], correctOptionIndex: 1, explanation: 'VLANs segment a physical network into logical isolated networks — critical for separating corporate, guest, and IoT traffic.' }
          ]
        },
        {
          title: 'Virtualization, Cloud, and Troubleshooting',
          objective: 'Explain virtualization types, configure virtual machines, apply cloud computing concepts, and troubleshoot hardware and network issues systematically.',
          hours: 18,
          lesson: 'Part 1 - Virtualization Concepts: Type 1 hypervisor (bare metal) runs directly on hardware — VMware ESXi, Hyper-V, Xen — better performance for production; Type 2 hypervisor runs on a host OS — VirtualBox, VMware Workstation — suitable for development and testing; containers (Docker) share the OS kernel — lighter than VMs; VMs provide full OS isolation — better for running different operating systems on one host. Part 2 - Virtual Machine Configuration: Virtual CPU (vCPU) allocation — typically match physical cores; RAM allocation — balance between VM needs and host requirements; virtual disk: dynamic (grows as used) vs fixed (preallocated); virtual network adapters: NAT (VM shares host IP), Bridged (VM gets own IP on network), Host-Only (VMs communicate with each other but not external network); snapshots capture VM state for rollback. Part 3 - Cloud Computing Concepts: On-demand self-service, broad network access, resource pooling, rapid elasticity, and measured service (NIST definition); deployment models: public, private, hybrid; service models: IaaS, PaaS, SaaS; cloud applications: Microsoft 365, Google Workspace, Salesforce; cloud storage: OneDrive, Google Drive, iCloud; synchronization across devices; bandwidth and latency affect cloud application performance. Part 4 - Troubleshooting Methodology: CompTIA A+ six-step process: (1) Identify the problem — question the user, observe symptoms, check recent changes; (2) Establish a theory of probable cause — simplest explanation first; (3) Test the theory; (4) Establish a plan of action; (5) Verify full functionality; (6) Document findings; asking open-ended questions vs closed questions; reproduce the problem before fixing it. Part 5 - Hardware Troubleshooting: No POST — check power supply, RAM seating, CPU; beep codes indicate specific component failures (varies by BIOS vendor); blue screen of death (BSOD) on Windows — note stop code, update drivers, check RAM with MemTest86; overheating — check thermal paste, clean dust from fans and heatsinks, verify fan operation; hard drive failure — listen for clicking, run SMART diagnostics with CrystalDiskInfo; power supply failure — test output voltages with multimeter. Part 6 - Network Troubleshooting Tools: ping tests connectivity to a host; traceroute/tracert shows path hops and latency; ipconfig/ifconfig displays current IP configuration; nslookup/dig tests DNS resolution; netstat shows active connections and listening ports; Wireshark captures and analyzes network packets; Wi-Fi analyzer shows channel utilization and signal strength; cable tester verifies physical layer connectivity. Part 7 - Laptop and Mobile Troubleshooting: Laptop battery — calibrate by full discharge/charge cycle; replace if capacity drops below 80%; screen — check display adapter, backlight (dim screen), video cable connection; thermal throttling from blocked vents; keyboard spill — immediate power off, remove battery, dry before reassembling; mobile device touchscreen unresponsive — restart, screen protector interference, digitizer replacement. Part 8 - Printer Troubleshooting: Laser printer ghosting — drum unit needs replacement; paper jams — check all paper paths, use correct paper type; stripes or lines — dirty drum or toner cartridge issue; faded print — low toner or drum worn; inkjet clogged nozzles — run print head cleaning cycle; printer offline — check USB/network connection, restart print spooler service (Windows: services.msc); shared printers — verify sharing permissions and firewall rules.',
          workedExample: 'Systematically troubleshoot a user reported "No internet, works on my phone" issue through the six-step methodology.',
          workedExampleSteps: [
            'Step 1: Identify — user says PC has no internet. Phone on same WiFi works. Ask: "Did anything change recently? Does it say connected but no internet?"',
            'Step 2: Observe — Windows shows "Connected, no internet." ipconfig shows 169.254.x.x — APIPA address, meaning DHCP failed.',
            'Step 3: Theory — DHCP server not responding to this specific machine, or static IP conflict, or DHCP client service stopped.',
            'Step 4: Test simplest first — ipconfig /release then /renew. "DHCP request timed out." Check services.msc — DHCP Client service: stopped. Start it.',
            'Step 5: ipconfig /renew succeeds — gets 192.168.1.x. ping 8.8.8.8 succeeds. Browser works.',
            'Step 6: Theory confirmed — DHCP Client service was stopped (possibly by a Windows update or user action).',
            'Step 7: Plan — set DHCP Client service to Automatic startup to prevent recurrence; check event log for what stopped it.',
            'Step 8: Document — ticket: "User: no internet. Root cause: DHCP Client service stopped. Fix: started service, set to Automatic. Duration: 15 min."'
          ],
          commonMistake: 'Skipping the documentation step — good ticket documentation saves hours the next time the same issue occurs, enables trend analysis, and demonstrates the value of IT support to management.',
          practiceTask: 'Using VirtualBox, create a Windows 10 VM with NAT networking. Simulate a network troubleshooting scenario by disabling DHCP and documenting the six-step troubleshooting process to restore connectivity.',
          progressCheckQuestion: 'The first step in the CompTIA A+ troubleshooting methodology is:',
          progressCheckOptions: ['Establish a plan of action', 'Identify the problem by gathering information from the user and observing symptoms', 'Test the most likely theory first', 'Document findings in the ticket system'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'Gathering complete information before forming theories prevents wasted effort on the wrong problem — ask good questions, reproduce the issue, and note recent changes.',
          quizQuestions: [
            { question: 'Type 1 vs Type 2 hypervisors:', options: ['Type 2 is faster for production workloads', 'Type 1 runs on bare metal for better performance; Type 2 runs on a host OS for development convenience', 'They have identical performance characteristics', 'Type 1 only supports Linux guests'], correctOptionIndex: 1, explanation: 'Type 1 hypervisors eliminate the host OS overhead — better for production servers; Type 2 is easier to set up for testing.' },
            { question: 'A 169.254.x.x IP address on a Windows PC means:', options: ['The machine has a static IP configured', 'APIPA — DHCP failed so the OS self-assigned a link-local address; no internet access', 'IPv6 is enabled alongside IPv4', 'The VPN is connected'], correctOptionIndex: 1, explanation: 'APIPA addresses indicate DHCP failure — check DHCP service, DHCP server, and network connectivity to the DHCP server.' },
            { question: 'traceroute/tracert is used to:', options: ['Test DNS resolution for a hostname', 'Show the network path and latency at each hop between the source and destination', 'Display current network interface configuration', 'Test wireless signal strength'], correctOptionIndex: 1, explanation: 'traceroute identifies where in the network path latency or packet loss is occurring — narrows down routing issues.' },
            { question: 'VM snapshot functionality allows:', options: ['Increasing VM disk size without downtime', 'Capturing VM state to enable rollback to a known-good configuration', 'Migrating VMs between physical hosts', 'Sharing a VM between multiple users simultaneously'], correctOptionIndex: 1, explanation: 'Snapshots are rollback points — take one before major changes so you can revert if something goes wrong.' }
          ]
        },
        {
          title: 'Operating Systems: Windows, macOS, and Linux',
          objective: 'Install and configure Windows, macOS, and Linux; manage users and permissions; use command-line tools; and administer Active Directory and Group Policy.',
          hours: 22,
          lesson: 'Part 1 - Windows Installation and Editions: Clean install vs upgrade; Windows Home/Pro/Enterprise editions — Pro adds domain join, BitLocker, and Hyper-V; UEFI vs legacy BIOS boot mode; GPT vs MBR partition style — UEFI requires GPT for drives > 2TB; answer file (unattend.xml) for unattended deployments; Windows Activation via retail key, volume licensing, or KMS. Part 2 - Windows Administration Tools: Settings app (modern) vs Control Panel (legacy); Task Manager: processes, performance, startup programs; Resource Monitor for detailed CPU/memory/disk/network usage; Event Viewer: Application, System, Security, Setup logs — critical source for troubleshooting; Services (services.msc): automatic, manual, disabled startup types; Registry Editor (regedit): HKLM (machine-wide settings), HKCU (current user settings). Part 3 - Active Directory and Group Policy: Active Directory (AD) is Microsoft\'s directory service for centralized user and computer management; domain join enables centralized authentication; OU (Organizational Unit) structures organize users and computers; Group Policy Objects (GPOs) push configurations to computers and users — password policies, software restrictions, desktop lockdown; RSAT tools enable AD management from Windows workstations. Part 4 - Windows Command Line: dir (list files), cd (change directory), copy/xcopy/robocopy (file operations), del/rmdir, ipconfig /all, netstat -an, sfc /scannow (System File Checker), chkdsk /f (disk error check), diskpart (disk management), tasklist/taskkill, net user/group (user management), gpupdate /force (apply group policy). Part 5 - macOS Features: Finder is the file manager; System Preferences/System Settings for configuration; Terminal with zsh shell; Spotlight search (Cmd+Space); Time Machine for backups; FileVault for full-disk encryption; Gatekeeper controls app installations; iCloud synchronizes data across Apple devices; macOS updates via Software Update; disk management with Disk Utility; user management via System Settings > Users and Groups. Part 6 - Linux Fundamentals: Filesystem hierarchy: /etc (configuration), /home (user directories), /var (logs, variable data), /tmp (temporary), /usr/bin (user commands), /sbin (system commands); essential commands: ls, cd, pwd, cp, mv, rm, mkdir, cat, grep, find, chmod, chown, sudo; package management: apt (Debian/Ubuntu), yum/dnf (RHEL/CentOS/Fedora), pacman (Arch); text editors: nano (beginner-friendly), vim (powerful). Part 7 - File Systems and Permissions: Windows: NTFS supports permissions, encryption, journaling, large files; FAT32 (compatibility, 4GB file limit); exFAT (flash drives, no file size limit); Linux: ext4 (most common), xfs, btrfs; NTFS permissions: Read, Write, Execute, Modify, Full Control; Linux permissions: owner-group-other with read(4), write(2), execute(1) octal notation; chmod 755 sets owner rwx, group r-x, other r-x. Part 8 - OS Troubleshooting Concepts: Windows Safe Mode boots with minimal drivers to isolate software conflicts; System Restore rolls back system files and registry to a restore point; Windows Recovery Environment (WinRE) for startup repair; Linux single-user mode for root access without full boot; disk errors: chkdsk on Windows, fsck on Linux; performance issues: identify CPU/memory-hungry processes in Task Manager or htop; profile startup programs and services that slow boot.',
          workedExample: 'Set up a Windows workstation joined to an Active Directory domain with GPO-applied security policies and user account configuration.',
          workedExampleSteps: [
            'Step 1: Install Windows 11 Pro — UEFI boot, GPT disk, activate with volume key.',
            'Step 2: Join domain — Settings > System > About > Join a domain; enter domain.local; provide domain admin credentials; restart.',
            'Step 3: Log in with domain credentials (DOMAIN\\username); verify user profile created in C:\\Users.',
            'Step 4: Active Directory — create OU "Workstations/IT"; move computer object to this OU.',
            'Step 5: Create GPO "IT Security Policy" linked to Workstations OU — password complexity enabled, screen lock after 10 min, disable USB storage, enable BitLocker.',
            'Step 6: gpupdate /force on workstation — verify policies applied with gpresult /r.',
            'Step 7: Create standard user (no local admin); add to "IT Users" security group; verify can log in and run standard apps but cannot install software.',
            'Step 8: Event Viewer — check Security log for successful logon events (Event ID 4624) and failed logon attempts (4625).'
          ],
          commonMistake: 'Giving all users local administrator rights — standard user accounts with UAC prompting for admin tasks is the principle of least privilege for desktop security; local admin rights allow malware to persist and spread.',
          practiceTask: 'Install Ubuntu Server in VirtualBox. Configure a new user with sudo access. Use apt to install nginx. Configure a basic firewall with ufw (allow 80, 443, 22; deny all else). View and rotate logs. Document all commands used.',
          progressCheckQuestion: 'Linux file permission 755 (rwxr-xr-x) means:',
          progressCheckOptions: ['Owner has read only; group has write; other has execute', 'Owner has read/write/execute; group has read/execute; other has read/execute', 'Everyone has full read/write/execute access', 'Owner has all permissions; group and other have none'],
          correctOptionIndex: 1,
          progressCheckExplanation: '7 = rwx (owner), 5 = r-x (group), 5 = r-x (other). Common for executables and directories where execute is needed to traverse.',
          quizQuestions: [
            { question: 'NTFS vs FAT32 on Windows:', options: ['FAT32 supports larger files and permissions', 'NTFS supports permissions, encryption, journaling, and files > 4GB; FAT32 is limited to 4GB file size', 'They have identical capabilities on modern Windows', 'FAT32 is required for the Windows system drive'], correctOptionIndex: 1, explanation: 'NTFS is the modern Windows file system; FAT32 is used for compatibility (USB drives, older systems) but lacks security features.' },
            { question: 'Group Policy Objects (GPOs) in Active Directory allow:', options: ['Installing applications on individual computers only', 'Pushing configuration settings to thousands of computers and users centrally from a domain controller', 'Only password policy enforcement', 'Management of non-Windows devices only'], correctOptionIndex: 1, explanation: 'GPOs are the primary mechanism for centralized Windows configuration — enforcing security, software, and user experience settings.' },
            { question: 'Windows Event Viewer Security log Event ID 4625 indicates:', options: ['A successful user logon', 'A failed logon attempt — useful for detecting brute-force attacks', 'A service started', 'A Group Policy update'], correctOptionIndex: 1, explanation: 'Monitoring 4625 events (failed logons) helps detect unauthorized access attempts and brute-force attacks.' },
            { question: 'Windows Safe Mode is used to:', options: ['Speed up startup', 'Boot with minimal drivers to isolate software/driver conflicts when normal boot fails', 'Recover deleted files', 'Access the recovery environment from a USB drive'], correctOptionIndex: 1, explanation: 'Safe Mode loads only essential drivers — if the system works in Safe Mode, a third-party driver or startup program is the cause of the issue.' }
          ]
        },
        {
          title: 'Security, Operational Procedures, and Professionalism',
          objective: 'Apply endpoint security best practices, remove malware, implement BitLocker encryption, document changes, and demonstrate professional communication skills.',
          hours: 18,
          lesson: 'Part 1 - Security Threats Overview: Malware types: virus (attaches to files), worm (self-propagating network), trojan (disguised as legitimate software), ransomware (encrypts files for ransom), spyware (steals data), adware (delivers unwanted ads), rootkit (hides in OS), keylogger (captures keystrokes); social engineering: phishing (email), vishing (voice), smishing (SMS), tailgating (physical access); zero-day exploits target unpatched vulnerabilities. Part 2 - Malware Removal Procedure: CompTIA A+ six-step malware removal: (1) Identify and research malware symptoms; (2) Quarantine infected system — disconnect from network; (3) Disable System Restore to prevent reinfection from restore points; (4) Remediate — boot to safe mode, run multiple AV/malware scanners (Malwarebytes, Windows Defender offline scan); (5) Schedule scans and enable real-time protection; (6) Enable System Restore, create new restore point, educate the user. Part 3 - Windows Security: BitLocker full-disk encryption — requires TPM 2.0 chip; recovery key must be saved before encryption; EFS (Encrypting File System) encrypts individual files/folders; Windows Defender Antivirus with real-time protection; Windows Firewall with Advanced Security — inbound and outbound rules; UAC (User Account Control) prompts for admin elevation; Windows Hello biometric authentication; Windows Update and patch management. Part 4 - Authentication Methods: Multi-factor authentication (MFA): something you know (password), something you have (token/authenticator app), something you are (biometric); password best practices: length > complexity, passphrases, no reuse, password manager; single sign-on (SSO) authenticates once for multiple services; RADIUS provides centralized authentication for VPN and wireless; LDAP queries directory services for authentication. Part 5 - Physical Security: Door locks, server rack locks, cable locks for laptops; mantrap/airlock prevents tailgating; badge readers with access logs; surveillance cameras; environmental controls — UPS (uninterruptible power supply) for power failures, HVAC for temperature and humidity, fire suppression (FM-200, not water) for server rooms; data destruction: degaussing, shredding, and secure erase for HDDs; SSDs require cryptographic erase or physical destruction. Part 6 - Documentation and Change Management: Asset inventory tracks all hardware and software; network diagrams document physical and logical topology; runbooks document procedures; ITIL-aligned change management: change request, impact assessment, approval, scheduled maintenance window, rollback plan, post-change testing; ticketing systems (ServiceNow, Jira) track requests, incidents, and problems; SLA compliance measured by response and resolution times. Part 7 - Regulatory Compliance: GDPR (EU): data privacy rights, breach notification within 72 hours, data minimization; HIPAA (US healthcare): PHI protection, access controls, audit trails, encryption; PCI DSS: cardholder data protection, network segmentation, regular scans; SOX (financial): accurate financial reporting, access controls; compliance applies to data the organization handles — IT must implement and document technical controls. Part 8 - Professional Communication: Active listening — do not interrupt, summarize to confirm understanding; plain language — avoid jargon with non-technical users; empathy — acknowledge frustration before troubleshooting; follow up — confirm the issue is resolved before closing the ticket; clear written communication in tickets — what was reported, what was found, what was done, resolution time; respect user privacy — do not share user data or issues with others.',
          workedExample: 'Execute the 6-step malware removal procedure on a ransomware-infected Windows workstation.',
          workedExampleSteps: [
            'Step 1: Identify — user reports "all my files say .encrypted and there is a ransom note on the desktop." Research: LockBit 3.0 ransomware, spreads via network shares.',
            'Step 2: Quarantine immediately — unplug ethernet cable and disable WiFi; prevent spread to network shares.',
            'Step 3: Disable System Restore on the infected machine to prevent reinfection from infected restore points.',
            'Step 4: Boot from Windows PE USB; run Malwarebytes offline scan; run Windows Defender offline scan; remove all detected threats.',
            'Step 5: Assess damage — check network shares for encrypted files; identify infection vector (check email logs — likely phishing attachment).',
            'Step 6: Recovery decision — if backups exist, restore from last clean backup (verify no ransomware in backup first); if no backup, evaluate decryption tools from nomoreransom.org.',
            'Step 7: Re-enable System Restore; create new clean restore point; ensure Windows Defender real-time protection is on; verify all patches applied.',
            'Step 8: User education — explain phishing identification; document incident with timeline, scope, and remediation steps; report to management; update AV definitions on all machines.'
          ],
          commonMistake: 'Not quarantining immediately upon ransomware detection — every second connected to the network gives ransomware time to encrypt shared drives and spread to other computers; disconnect first, troubleshoot second.',
          practiceTask: 'Enable BitLocker on a Windows test machine or VM. Save the recovery key. Verify encryption with manage-bde -status. Simulate a lost key scenario and recover using the recovery key. Document the procedure.',
          progressCheckQuestion: 'The CompTIA A+ malware removal step to perform IMMEDIATELY after identifying ransomware is:',
          progressCheckOptions: ['Run antivirus software', 'Quarantine the infected system by disconnecting it from the network', 'Disable System Restore', 'Restore from backup'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'Ransomware spreads across network shares in seconds — isolating the machine immediately limits the damage scope before any other remediation steps.',
          quizQuestions: [
            { question: 'BitLocker requires what hardware component to store encryption keys securely?', options: ['A dedicated GPU', 'A TPM (Trusted Platform Module) chip — prevents boot without correct hardware/PIN', 'An NVMe drive specifically', 'A biometric reader'], correctOptionIndex: 1, explanation: 'TPM binds the BitLocker encryption key to the specific hardware configuration — the encrypted drive cannot be read in a different machine.' },
            { question: 'Social engineering phishing attacks primarily target:', options: ['Network firewall vulnerabilities', 'Human psychology — tricking users into revealing credentials or installing malware via deceptive emails', 'Unpatched server software', 'Physical access to server rooms'], correctOptionIndex: 1, explanation: 'Phishing exploits human trust and urgency — technical defenses are bypassed when a user willingly provides credentials.' },
            { question: 'ITIL change management requires a rollback plan because:', options: ['It is a regulatory legal requirement', 'Changes can cause unforeseen issues — a documented rollback enables quick restoration of service', 'All changes automatically fail', 'Rollback plans reduce implementation time'], correctOptionIndex: 1, explanation: 'Every change carries risk — a tested rollback plan limits downtime if the change causes unexpected problems.' },
            { question: 'Data destruction for SSDs requires:', options: ['Degaussing with a strong magnet', 'Cryptographic erase or physical destruction — degaussing does not work on SSDs', 'Standard Windows format command', 'Overwriting with zeros three times'], correctOptionIndex: 1, explanation: 'SSDs use wear-leveling that retains data after standard deletion; cryptographic erase destroys the encryption key making data irrecoverable.' }
          ]
        }
      ],
      finalAssessment: [
        { question: 'RAID 1 provides data protection through:', options: ['Striping for speed with no redundancy', 'Mirroring — identical data on two drives; if one fails, no data loss', 'Parity across 3+ drives', 'Compression for efficiency'], correctOptionIndex: 1, explanation: 'RAID 1 mirrors — 50% capacity, maximum single-drive fault tolerance.' },
        { question: 'WPA3-SAE improves on WPA2-PSK by:', options: ['Providing faster throughput', 'Preventing offline dictionary attacks on captured handshakes with simultaneous authentication', 'Supporting more frequency bands', 'Using a shorter but stronger key'], correctOptionIndex: 1, explanation: 'WPA3\'s SAE handshake makes offline brute force impractical — a major WPA2-PSK weakness.' },
        { question: 'APIPA address (169.254.x.x) on a PC indicates:', options: ['A VPN is connected', 'DHCP failed — the OS self-assigned a link-local address; no routing to internet', 'IPv6 is configured', 'Static IP is in use'], correctOptionIndex: 1, explanation: 'APIPA is the automatic fallback when DHCP is unreachable — check the DHCP service and network connectivity.' },
        { question: 'CompTIA A+ troubleshooting step 1 is:', options: ['Establish a theory', 'Identify the problem by questioning the user and observing symptoms', 'Test the most probable cause', 'Document findings'], correctOptionIndex: 1, explanation: 'Information gathering prevents wasted effort on the wrong problem — reproduce before diagnosing.' },
        { question: 'Type 1 hypervisors (ESXi, Hyper-V) differ from Type 2 (VirtualBox) in that:', options: ['Type 1 is slower due to extra abstraction', 'Type 1 runs on bare metal for better performance; Type 2 runs on a host OS', 'Type 2 is for production; Type 1 for development', 'They are equivalent in all modern implementations'], correctOptionIndex: 1, explanation: 'Bare metal eliminates host OS overhead — Type 1 is the production hypervisor; Type 2 is convenient for development.' },
        { question: 'Active Directory Group Policy enables:', options: ['Physical access card configuration', 'Centrally pushing configuration settings to thousands of domain computers', 'Internet routing decisions', 'DNS record management only'], correctOptionIndex: 1, explanation: 'GPOs are the primary enterprise Windows configuration management tool.' },
        { question: 'Linux file permission 644 means:', options: ['Owner rwx; group r-x; other r-x', 'Owner rw-; group r--; other r-- (read/write for owner, read-only for others)', 'Full access for all users', 'Owner read-only; group and other have no access'], correctOptionIndex: 1, explanation: '6=rw-, 4=r--, 4=r-- — common for web content files readable by web server.' },
        { question: 'BitLocker full-disk encryption requires:', options: ['An NVMe SSD specifically', 'TPM 2.0 chip to bind encryption key to hardware — prevents reading the drive in another machine', 'Windows 11 exclusively', 'An Active Directory domain'], correctOptionIndex: 1, explanation: 'TPM ties the encryption to the specific device hardware — stolen drives cannot be decrypted in another system.' },
        { question: 'Ransomware first response is:', options: ['Run antivirus immediately', 'Quarantine by disconnecting from the network to prevent spread', 'Disable System Restore', 'Pay the ransom to assess damage'], correctOptionIndex: 1, explanation: 'Isolation limits spread to network shares — always disconnect before any other action.' },
        { question: 'ITIL change management rollback plan:', options: ['Is only needed for major changes', 'Documents how to restore the previous state if the change causes unexpected issues', 'Is created after the change is implemented', 'Replaces testing in controlled environments'], correctOptionIndex: 1, explanation: 'Every change needs a rollback plan — it limits the impact window when things go wrong.' },
        { question: 'Multi-factor authentication combines:', options: ['Two passwords from different services', 'Something you know + something you have + something you are — any two of three factors', 'Username and email address', 'Two security questions'], correctOptionIndex: 1, explanation: 'MFA requires multiple independent factors — knowing the password alone is insufficient even if stolen.' },
        { question: 'NVMe M.2 is faster than SATA SSD because:', options: ['It uses faster NAND chips exclusively', 'It connects via PCIe bus bypassing the SATA controller bottleneck', 'It operates at higher temperatures', 'It uses a proprietary encryption protocol'], correctOptionIndex: 1, explanation: 'PCIe lanes provide significantly higher bandwidth than the SATA interface — NVMe achieves 3,500+ MB/s vs SATA\'s 600 MB/s ceiling.' },
        { question: 'Windows Event Viewer Security log monitors:', options: ['Application crashes', 'Security events including logon successes (4624), failures (4625), and privilege use', 'Network performance', 'Hardware driver errors'], correctOptionIndex: 1, explanation: 'Security log is the audit trail for authentication and authorization events.' },
        { question: 'SSD data destruction requires:', options: ['Degaussing with a strong magnet', 'Cryptographic erase or physical destruction — degaussing is ineffective on flash storage', 'Overwriting with zeros 7 times', 'Standard Windows format is sufficient'], correctOptionIndex: 1, explanation: 'Flash storage is immune to magnetic degaussing — cryptographic erase or physical shredding are required.' },
        { question: 'VLANs in network design provide:', options: ['Faster wireless speeds', 'Network segmentation — logical isolation of traffic groups (staff, guest, IoT) for security', 'Automatic IP address assignment', 'Encryption of network traffic between devices'], correctOptionIndex: 1, explanation: 'VLANs limit the attack surface — compromised IoT devices cannot reach corporate systems on a different VLAN.' }
      ],
      interviewPrep: [
        'Walk through the CompTIA A+ 6-step troubleshooting methodology with a real example — describe a scenario where you identified the problem, formed a theory, tested it, and documented the resolution.',
        'Explain the difference between RAID 0, RAID 1, RAID 5, and RAID 10 — when you would choose each, and what happens when a drive fails in each configuration.',
        'Describe your process for setting up a SOHO network for a 20-person office — hardware selection, VLAN design, wireless security, and firewall rules.',
        'Walk through the 6-step malware removal procedure for a ransomware infection — what you would do in the first 5 minutes and how you would prevent reinfection.',
        'Explain Active Directory, domain join, GPOs, and OUs — describe how you would set up a new Windows workstation for a domain user with least-privilege permissions.',
        'Describe BitLocker, how it works with TPM, and your process for enabling it across an organization — including key backup and recovery procedures.',
        'Explain the difference between phishing, vishing, smishing, and tailgating attacks — describe technical and user-education controls you would implement to defend against each.',
        'Walk through ITIL change management — what documentation you require before a change, how you conduct the change window, and what you do if the change causes unexpected issues.',
        'Explain the difference between TCP and UDP — give examples of applications that use each and why the choice of protocol matters for troubleshooting.',
        'Describe GDPR and HIPAA and how they affect IT support responsibilities — what data handling, access logging, and breach notification requirements you need to implement.'
      ]
    });
  }

  // ── CYBERSECURITY FOUNDATIONS (CompTIA Security+ SY0-701 aligned, ~70 hrs) ─
  if (/cyber|cybersecurity/i.test(name)) {
    return buildCourse({
      courseTitle: 'Cybersecurity Foundations',
      subtitle: 'Aligned to the CompTIA Security+ SY0-701 exam objectives — the most widely held baseline security certification, required for US DoD 8570 compliance and 350,000+ job postings.',
      difficulty: 'Intermediate',
      estimatedDuration: '9 weeks (8 hrs/week) | ~70 hours total',
      marketDemand: 'Cybersecurity engineers earn a median of $113,000 USD with a projected 32% job growth by 2032 — the fastest of any tech discipline. Security+ is listed as a preferred or required certification in 350,000+ job postings globally.',
      overview: 'This pathway aligns to CompTIA Security+ SY0-701 exam domains.\n\nModule 1 (~18 hrs): General security concepts — threat landscape, cryptography, PKI, and security architecture.\nModule 2 (~18 hrs): Threats, vulnerabilities, and network security — attacks, scanning, and network defenses.\nModule 3 (~18 hrs): Identity, access management, cloud security, and endpoint protection.\nModule 4 (~16 hrs): Security operations, incident response, governance, risk, and compliance.',
      learningOutcomes: [
        'Explain the cybersecurity threat landscape including attack types, threat actors, and attack vectors.',
        'Describe cryptographic algorithms and apply PKI concepts including certificates and TLS.',
        'Analyze network traffic for security threats and configure defensive network controls.',
        'Implement identity and access management controls including MFA, SSO, and PAM.',
        'Apply security monitoring, incident response procedures, and digital forensics principles.',
        'Explain governance, risk, compliance, and business continuity frameworks.'
      ],
      resumeSignals: [
        'CompTIA Security+ SY0-701 certified',
        'Performed vulnerability assessment with Nessus; identified 3 critical CVEs; coordinated patching within SLA window',
        'Configured SIEM (Splunk) correlation rules detecting brute-force and lateral movement patterns',
        'Implemented zero-trust network access (ZTNA) replacing legacy VPN for remote workforce',
        'Developed incident response playbook for phishing and ransomware scenarios with tested RTO of 4 hours'
      ],
      modules: [
        {
          title: 'Security Concepts, Cryptography, and Architecture',
          objective: 'Explain the CIA triad, threat actor types, and attack frameworks; describe cryptographic algorithms; and apply PKI, zero trust, and defense-in-depth principles.',
          hours: 18,
          lesson: 'Part 1 - CIA Triad and Security Concepts: Confidentiality — only authorized parties access data (encryption, access controls); Integrity — data is accurate and unmodified (hashing, digital signatures); Availability — systems and data accessible when needed (redundancy, backups, DDoS protection); non-repudiation — actions cannot be denied (digital signatures, audit logs); AAA framework: Authentication, Authorization, Accounting. Part 2 - Threat Actor Types: Nation-state: well-funded, sophisticated, long-term espionage; APT (Advanced Persistent Threat) maintains long-term stealthy presence; cybercriminals: financially motivated ransomware and fraud; hacktivists: ideologically motivated, DDoS and defacement; insider threats: employees with legitimate access — accidental or malicious; script kiddies: low skill, use existing tools; supply chain attacks compromise third-party software or hardware before delivery. Part 3 - Attack Frameworks: MITRE ATT&CK matrix catalogues adversary tactics and techniques with real-world examples — reconnaissance, resource development, initial access, execution, persistence, privilege escalation, defense evasion, lateral movement, collection, exfiltration; Cyber Kill Chain: reconnaissance, weaponization, delivery, exploitation, installation, C2, actions on objectives; Diamond Model: adversary, capability, infrastructure, victim. Part 4 - Cryptography Fundamentals: Symmetric encryption uses the same key for encrypt/decrypt — fast; AES-256 is the current standard; key distribution problem; Asymmetric encryption uses a key pair (public/private) — RSA, ECC; slower but solves key distribution; hybrid approach: asymmetric to exchange symmetric key, then symmetric for bulk data; hashing is one-way: SHA-256, SHA-3; MD5 and SHA-1 are broken — do not use for security; bcrypt/Argon2 for passwords. Part 5 - PKI and Certificates: Certificate Authority (CA) issues X.509 digital certificates; certificates bind a public key to an identity with CA signature; certificate chain: Root CA -> Intermediate CA -> End-entity cert; TLS handshake: server presents cert, client verifies CA signature, establishes session key; certificate revocation: CRL (Certificate Revocation List) or OCSP (Online Certificate Status Protocol); wildcard certificates cover *.domain.com; SAN certificates cover multiple hostnames. Part 6 - Security Architecture: Defense-in-depth applies multiple security layers — network perimeter, endpoint security, application security, data security; zero trust: never trust, always verify — assume breach, verify explicitly, use least privilege; micro-segmentation limits lateral movement; secure by design builds security in from inception not as an afterthought; data classification: public, internal, confidential, restricted — drives access controls and handling procedures. Part 7 - Physical Security Concepts: Security zones — perimeter, secure zone, restricted zone; bollards and barriers prevent vehicle attacks; biometric access systems; CCTV with analytics; hot/cold aisles in data centers reduce cooling costs; environmental monitoring for temperature/humidity; electromagnetic shielding (Faraday cage) prevents RF attacks; secure disposal of decommissioned hardware. Part 8 - Resilience and Recovery: High availability with redundant components (RAID, clustering, load balancing); Recovery Time Objective (RTO): maximum acceptable downtime; Recovery Point Objective (RPO): maximum acceptable data loss; backup strategies: full, incremental, differential; 3-2-1 backup rule: 3 copies, 2 different media, 1 offsite; disaster recovery site types: hot (immediate failover), warm (hours to activate), cold (days to activate); business continuity planning (BCP) maintains critical operations.',
          workedExample: 'Explain TLS 1.3 handshake using PKI concepts — certificate validation, key exchange, and session establishment.',
          workedExampleSteps: [
            'Step 1: Client sends ClientHello — supported cipher suites (TLS_AES_256_GCM_SHA384), TLS version, random value.',
            'Step 2: Server responds ServerHello — selected cipher suite, TLS 1.3, server random; Certificate (X.509 with public key signed by CA).',
            'Step 3: Client validates certificate — verify CA signature chain to trusted root CA; check expiry; verify CN/SAN matches hostname.',
            'Step 4: Check OCSP/CRL — verify cert not revoked; modern browsers use OCSP Stapling (server sends fresh OCSP response).',
            'Step 5: TLS 1.3 key exchange — both sides use Diffie-Hellman ephemeral (DHE) to derive shared session key without transmitting it.',
            'Step 6: Session keys derived — separate keys for client->server and server->client; AES-256-GCM for symmetric encryption.',
            'Step 7: Handshake complete — all subsequent data encrypted with session keys; TLS 1.3 achieves 1-RTT (one round trip) vs TLS 1.2 2-RTT.',
            'Step 8: Perfect Forward Secrecy (PFS) — ephemeral keys mean past sessions cannot be decrypted even if server private key is later compromised.'
          ],
          commonMistake: 'Confusing authentication and authorization — authentication verifies identity (who you are); authorization determines what you can do (what you are allowed); both are required, and failing to separate them leads to privilege escalation vulnerabilities.',
          practiceTask: 'Create a self-signed certificate with OpenSSL. Inspect its fields (CN, SAN, validity, public key, signature algorithm). Explain each field\'s security purpose. Set up a local HTTPS server and connect to it.',
          progressCheckQuestion: 'Perfect Forward Secrecy (PFS) in TLS means:',
          progressCheckOptions: ['TLS certificates never expire', 'Past encrypted sessions cannot be decrypted even if the server private key is compromised later', 'The same session key is reused for efficiency', 'Forward secrecy prevents certificate revocation'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'PFS uses ephemeral Diffie-Hellman key exchange — unique session keys are generated each session and discarded, so compromising the long-term private key does not expose past sessions.',
          quizQuestions: [
            { question: 'AES-256 is classified as what type of encryption?', options: ['Asymmetric — uses a public/private key pair', 'Symmetric — uses the same key to encrypt and decrypt', 'Hashing — one-way, not reversible', 'Key exchange — only used to establish session keys'], correctOptionIndex: 1, explanation: 'AES is symmetric — fast bulk encryption used for data-at-rest and data-in-transit after key exchange.' },
            { question: 'The MITRE ATT&CK framework provides:', options: ['Vulnerability severity scoring', 'A matrix of adversary tactics and techniques observed in real attacks — used for detection and threat modeling', 'Penetration testing methodology', 'Compliance assessment criteria'], correctOptionIndex: 1, explanation: 'ATT&CK is the most comprehensive real-world attacker technique database — used by defenders to map detection coverage.' },
            { question: 'Zero trust security assumes:', options: ['Internal network traffic is trusted by default', 'No implicit trust based on network location — every access request is verified regardless of origin', 'Only cloud workloads need verification', 'VPN provides sufficient security for remote access'], correctOptionIndex: 1, explanation: 'Zero trust eliminates the concept of a trusted internal network — breach is assumed, and all access is verified continuously.' },
            { question: 'The 3-2-1 backup rule requires:', options: ['3 full backups per week, 2 partial, 1 archive', '3 copies of data, on 2 different storage types, with 1 copy stored offsite', '3 recovery tests per year', 'Backups encrypted with 3 keys'], correctOptionIndex: 1, explanation: '3-2-1 protects against multiple failure scenarios — media failure, local disaster, and ransomware encrypting local backups.' }
          ]
        },
        {
          title: 'Threats, Vulnerabilities, and Network Security',
          objective: 'Describe common attack types, perform and interpret vulnerability scanning, configure network security controls (firewalls, IDS/IPS, SIEM), and understand network attack defenses.',
          hours: 18,
          lesson: 'Part 1 - Social Engineering Attacks: Phishing: mass email mimicking trusted entities to steal credentials; spear phishing: targeted at specific individuals using personal details; whaling: targets executives; vishing: voice-based phishing; smishing: SMS phishing; pretexting: fabricated scenario to extract information; baiting: physical media (USB) left to be found; quid pro quo: offering something in exchange for information; indicators: urgency, suspicious links/attachments, mismatched sender domains. Part 2 - Malware Attack Types: Fileless malware runs in memory using legitimate tools (PowerShell, WMI) — evades file-based AV; command and control (C2) infrastructure for botnet control; rootkits replace OS components to hide presence; cryptominer uses victim CPU for cryptocurrency; logic bomb triggers malicious action on a condition; RAT (Remote Access Trojan) provides backdoor access; polymorphic malware changes signature to evade detection. Part 3 - Network Attacks: DDoS (Distributed Denial of Service): volumetric (flood bandwidth), protocol (exhaust state tables), application layer (HTTP flood); amplification attacks use DNS/NTP/SSDP to amplify traffic; man-in-the-middle (MitM): ARP spoofing, rogue access points; replay attacks reuse captured authentication tokens; VLAN hopping exploits misconfigured trunk ports; DNS poisoning injects false DNS records; BGP hijacking redirects internet traffic. Part 4 - Application Attacks: SQL injection: unparameterized queries allow attacker SQL execution; XSS (Cross-site scripting): stored/reflected/DOM — injecting scripts into web pages; CSRF (Cross-site request forgery): tricks authenticated users into making unintended requests; buffer overflow: writing past allocated memory into adjacent memory; directory traversal: ../../../etc/passwd path manipulation; IDOR (Insecure Direct Object Reference): accessing resources by changing object ID without authorization. Part 5 - Vulnerability Scanning: CVE (Common Vulnerabilities and Exposures) identifies known vulnerabilities; CVSS (Common Vulnerability Scoring System) scores severity 0-10 (Critical 9-10, High 7-8.9); Nessus, OpenVAS, and Qualys perform credentialed and unauthenticated scans; false positives require manual verification; penetration testing goes beyond scanning — actively exploits vulnerabilities; vulnerability disclosure: responsible disclosure vs full disclosure timelines; patch management closes vulnerabilities. Part 6 - Firewalls and IDS/IPS: Packet filtering firewall: stateless, inspects headers only; stateful inspection: tracks connection state; next-generation firewall (NGFW): application awareness, user identity, SSL inspection, and threat feeds; IDS (Intrusion Detection System): monitors and alerts, does not block; IPS (Intrusion Prevention System): monitors and blocks inline; signature-based detection matches known patterns; anomaly-based detection identifies deviations from baseline; Snort/Suricata are open-source IDS/IPS. Part 7 - Network Security Controls: Network segmentation with VLANs limits lateral movement; DMZ (demilitarized zone) isolates public-facing servers from the internal network; 802.1X port-based NAC (Network Access Control) authenticates devices before granting network access; honeypots attract attackers to gather intelligence; jump server/bastion host is the single entry point for administrative access to internal systems; NTA (Network Traffic Analysis) baselines normal behavior to detect anomalies. Part 8 - SIEM and Log Management: SIEM (Security Information and Event Management) aggregates logs from multiple sources and correlates events into alerts; Splunk, IBM QRadar, Microsoft Sentinel are commercial SIEMs; correlation rules detect attack patterns: multiple failed logins from same IP, login from new geography, lateral movement indicators; log retention requirements: GDPR 30 days minimum; PCI DSS 12 months; log sources: firewall, AD, EDR, DNS, web proxy; UEBA (User and Entity Behavior Analytics) detects insider threats.',
          workedExample: 'Analyze a simulated attack from phishing email to lateral movement using the Cyber Kill Chain and MITRE ATT&CK.',
          workedExampleSteps: [
            'Step 1: Reconnaissance — attacker scrapes LinkedIn for target email addresses and org chart.',
            'Step 2: Weaponization — crafts spear phishing email with malicious Office document exploiting macro vulnerability.',
            'Step 3: Delivery — sends phishing email with urgency: "Invoice due today — ACTION REQUIRED".',
            'Step 4: Exploitation — victim enables macros; macro executes PowerShell (T1059.001) downloading Cobalt Strike beacon.',
            'Step 5: Installation — beacon persists via scheduled task (T1053.005); C2 beacons over HTTPS to avoid detection.',
            'Step 6: C2 — attacker sends commands; harvests credentials with Mimikatz (T1003.001).',
            'Step 7: Lateral movement — PtH (pass the hash) (T1550.002) to domain controller; extracts AD database (NTDS.dit).',
            'Step 8: SIEM detection opportunities: email gateway (suspicious attachment), EDR (PowerShell spawning child process), SIEM (unusual LSASS memory access, DC authentication spike).'
          ],
          commonMistake: 'Relying only on signature-based AV — modern attacks use fileless techniques and polymorphic malware that evade signature detection; EDR (Endpoint Detection and Response) with behavioral analysis is needed to detect techniques, not just known malware files.',
          practiceTask: 'Set up a local lab with DVWA (Damn Vulnerable Web Application). Exploit SQL injection to extract data from the database. Exploit a stored XSS vulnerability. Document each attack and the defense that would prevent it.',
          progressCheckQuestion: 'SQL injection attacks are prevented by:',
          progressCheckOptions: ['Using a firewall on port 443', 'Parameterized queries (prepared statements) that separate SQL structure from user data', 'Encrypting the database at rest', 'Rate limiting login attempts'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'Parameterized queries ensure user input is treated as data, never as SQL syntax — the fundamental and complete prevention for SQL injection.',
          quizQuestions: [
            { question: 'A SIEM system differs from a simple log collector in that:', options: ['SIEMs only collect Windows event logs', 'SIEMs correlate events across multiple sources to detect attack patterns, not just store logs', 'Log collectors alert in real time; SIEMs do not', 'They are identical tools with different pricing'], correctOptionIndex: 1, explanation: 'SIEM adds intelligence — correlating events from firewall, AD, endpoints, and DNS to detect multi-step attacks invisible in individual logs.' },
            { question: 'A DMZ in network architecture:', options: ['Encrypts all internet traffic', 'Creates an isolated zone for public-facing servers between two firewalls — limiting exposure of the internal network', 'Is a physical security area', 'Provides remote VPN access'], correctOptionIndex: 1, explanation: 'DMZ isolates public-facing services — if a web server is compromised, attackers face another firewall before reaching internal systems.' },
            { question: 'CVSS score of 9.8 indicates:', options: ['Low priority, patch in next quarterly cycle', 'Critical severity — patch immediately, these are often actively exploited', 'High but not urgent vulnerability', 'A theoretical vulnerability with no known exploit'], correctOptionIndex: 1, explanation: 'CVSS 9.0-10.0 is Critical — these vulnerabilities often have public exploits and are actively targeted; patch within 24-48 hours.' },
            { question: 'Fileless malware is harder to detect because:', options: ['It uses 256-bit encryption', 'It runs entirely in memory using legitimate system tools, leaving no file for signature-based AV to detect', 'It targets only Linux systems', 'It only attacks through physical access'], correctOptionIndex: 1, explanation: 'Fileless malware uses PowerShell, WMI, and other built-in tools — behavioral EDR is required to detect the technique, not a file.' }
          ]
        },
        {
          title: 'Identity, Access Management, Cloud Security, and Endpoint Protection',
          objective: 'Implement identity and access management controls including MFA, PAM, and SSO; apply cloud security principles; and configure endpoint protection and hardening.',
          hours: 18,
          lesson: 'Part 1 - Identity and Access Management Concepts: Identification: claiming an identity (username); Authentication: proving the identity (password, MFA); Authorization: what the identity can access (RBAC, ABAC); Accounting: logging actions for audit; Identification and Authentication (I&A) together — one without the other is incomplete; non-repudiation links actions to authenticated identities. Part 2 - Authentication Protocols: LDAP (Lightweight Directory Access Protocol) queries directory services (AD) for authentication; Kerberos is the default Windows domain authentication protocol — tickets prevent password transmission; SAML (Security Assertion Markup Language) enables SSO for web applications via XML assertions; OAuth 2.0 authorization delegation; OIDC (OpenID Connect) adds identity to OAuth 2.0; RADIUS centralizes authentication for VPN and 802.1X wireless. Part 3 - Multi-Factor Authentication: MFA requires 2+ factors from different categories; authenticator apps (TOTP: RFC 6238) generate time-based OTPs; hardware security keys (FIDO2/WebAuthn, YubiKey) are phishing-resistant — the gold standard; SMS OTP is deprecated for high-security use (SIM swapping); biometrics: fingerprint, Face ID, retina scan; passwordless authentication eliminates shared secrets; step-up authentication triggers additional verification for sensitive actions. Part 4 - Privileged Access Management: PAM (Privileged Access Management) controls, monitors, and audits privileged account usage; just-in-time (JIT) access grants elevated privileges only when needed and removes them automatically; password vaulting stores admin credentials and rotates them automatically; session recording provides audit trail of privileged sessions; least privilege: no account should have more permissions than needed for its role; separate admin accounts from daily-use accounts. Part 5 - Cloud Security Architecture: Shared responsibility model shifts with service type; CSPM (Cloud Security Posture Management) continuously checks for cloud misconfigurations; CWPP (Cloud Workload Protection Platform) secures VMs and containers; CASB (Cloud Access Security Broker) enforces policies for cloud SaaS usage; secure cloud configuration: disable default credentials, enable MFA, block public bucket access, encrypt at rest; Cloud Security Alliance (CSA) Cloud Controls Matrix provides comprehensive cloud security controls. Part 6 - Endpoint Protection: EDR (Endpoint Detection and Response) provides behavioral monitoring, threat hunting, and rapid containment; zero-trust endpoint: MDM-managed, compliant before network access; application control (whitelisting) allows only approved applications; patch management: vulnerability window is from CVE disclosure to patch application; host-based firewall blocks unauthorized connections; disk encryption (BitLocker/FileVault) protects data if device is stolen; UEFI Secure Boot prevents bootkits. Part 7 - OS Hardening: Remove unnecessary services and applications; change default passwords and disable default accounts; enable host-based firewalls; apply latest patches; configure audit logging; disable AutoRun/AutoPlay; CIS Benchmarks provide prescriptive hardening guidelines for Windows, Linux, and cloud platforms; STIGs (Security Technical Implementation Guides) are DoD hardening standards; configuration drift occurs when hardened systems change over time — remediated by compliance scanning. Part 8 - Email and Web Security: SPF (Sender Policy Framework) specifies authorized mail servers for a domain; DKIM (DomainKeys Identified Mail) signs email with a private key — receiving server verifies with public key in DNS; DMARC (Domain-based Message Authentication Reporting and Conformance) enforces SPF+DKIM and reports spoofing attempts; URL filtering blocks known malicious sites; sandboxing detonates attachments in isolation before delivery; web proxy with SSL inspection inspects encrypted traffic for threats.',
          workedExample: 'Design a Zero Trust identity architecture: MFA for all users, PAM for admins, SAML SSO for SaaS, and device compliance gating.',
          workedExampleSteps: [
            'Step 1: Identity provider — Azure AD or Okta as the central IdP; all users in IdP; no local AD-only authentication.',
            'Step 2: MFA enforcement — conditional access policy: require MFA for all applications; FIDO2 hardware keys for admins and privileged users; TOTP for standard users.',
            'Step 3: SAML SSO — configure SAML 2.0 integration for all SaaS apps (Salesforce, GitHub, Slack, Jira); users authenticate once to IdP; no separate app passwords.',
            'Step 4: Device compliance — MDM (Intune/Jamf) manages all devices; conditional access denies access from unmanaged or non-compliant devices.',
            'Step 5: PAM — CyberArk or BeyondTrust for admin accounts; admin credentials vaulted and rotated; sessions recorded; JIT access for privileged tasks.',
            'Step 6: Network access — ZTNA replaces VPN; users connect to specific applications not the whole network; access granted per application based on identity + device compliance.',
            'Step 7: Monitoring — all authentication events logged to SIEM; alert on impossible travel, new device login, and admin session anomalies.',
            'Step 8: Email security — SPF, DKIM, and DMARC configured; DMARC policy: p=quarantine; monitor reports for spoofing attempts.'
          ],
          commonMistake: 'Using SMS OTP as MFA for privileged accounts — SIM swapping attacks allow attackers to receive SMS codes by hijacking the victim\'s phone number; use FIDO2 hardware security keys or authenticator apps for any account with elevated privileges.',
          practiceTask: 'Set up MFA on a test Google/Microsoft account using an authenticator app. Configure DMARC, DKIM, and SPF for a domain (use a free testing domain). Verify email authentication headers with mail-tester.com.',
          progressCheckQuestion: 'FIDO2/WebAuthn security keys are preferred over SMS OTP because:',
          progressCheckOptions: ['They are cheaper to deploy', 'They are phishing-resistant — the key verifies the domain during authentication, preventing credential theft on fake sites', 'SMS OTP is not supported by most services', 'FIDO2 keys last longer before replacement'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'FIDO2 keys perform domain-bound authentication — they will not authenticate on a phishing site; SMS codes can be stolen by phishing or SIM swapping.',
          quizQuestions: [
            { question: 'PAM (Privileged Access Management) just-in-time access means:', options: ['Admin tasks are performed immediately without approval', 'Elevated privileges are granted only when needed for a specific task and removed automatically after', 'Admin accounts are shared to save licenses', 'JIT provides read-only access to all systems'], correctOptionIndex: 1, explanation: 'JIT minimizes the window of opportunity for privilege abuse — standing privileged access is a major attack vector.' },
            { question: 'CASB (Cloud Access Security Broker) is used to:', options: ['Replace firewall for cloud workloads', 'Enforce security policies for cloud SaaS applications — visibility and control over shadow IT', 'Provide VPN connectivity to cloud', 'Scan cloud VM images for vulnerabilities'], correctOptionIndex: 1, explanation: 'CASB gives visibility into what SaaS apps employees use (including unauthorized shadow IT) and enforces DLP and access policies.' },
            { question: 'CIS Benchmarks provide:', options: ['CVE vulnerability database', 'Prescriptive hardening guidelines for OS, cloud, and applications with specific configuration settings', 'Penetration testing methodology', 'Compliance frameworks for specific industries'], correctOptionIndex: 1, explanation: 'CIS Benchmarks are step-by-step configuration guides consensus-developed to harden specific platforms against known attack techniques.' },
            { question: 'DMARC email security policy enforces:', options: ['Email encryption in transit', 'SPF and DKIM alignment, specifying action (none/quarantine/reject) for failing messages and providing reports', 'Password policies for email accounts', 'Spam filtering based on content analysis'], correctOptionIndex: 1, explanation: 'DMARC ties together SPF and DKIM, telling receiving servers what to do with emails that fail authentication — preventing email spoofing.' }
          ]
        },
        {
          title: 'Security Operations, Incident Response, and Governance',
          objective: 'Apply security monitoring and incident response procedures, explain digital forensics principles, and describe governance, risk, compliance, and business continuity frameworks.',
          hours: 16,
          lesson: 'Part 1 - Security Operations Center (SOC): SOC is the centralized team monitoring and responding to security events; tiers: Tier 1 (alert triage, initial analysis), Tier 2 (investigation, incident handling), Tier 3 (threat hunting, advanced analysis); SIEM provides the primary interface; ticketing system tracks investigations; playbooks define standard responses; KPIs: MTTD (Mean Time to Detect), MTTR (Mean Time to Respond), false positive rate. Part 2 - Incident Response Process: NIST SP 800-61 phases: Preparation (policies, tools, training, playbooks), Detection and Analysis (identify incident, classify severity), Containment (isolate affected systems), Eradication (remove root cause — malware, attacker access), Recovery (restore systems, verify integrity), Post-Incident Activity (lessons learned, update defenses); document everything with timestamps throughout. Part 3 - Digital Forensics Principles: Order of volatility — collect most volatile evidence first: CPU registers and cache, RAM, network connections, running processes, disk, remote logs; chain of custody documents who handled evidence and when; write blockers prevent modification of evidence drives; forensic imaging creates a bit-for-bit copy; hash verification (MD5, SHA-256) proves evidence integrity; live forensics vs dead forensics tradeoffs. Part 4 - Threat Hunting: Proactive search for hidden threats not detected by automated tools; hypothesis-based hunting starts with an assumption (e.g., "attacker is using Living off the Land techniques"); IoC (Indicators of Compromise): known-bad IPs, domains, file hashes; IoA (Indicators of Attack): behavioral patterns regardless of specific tool; threat intelligence feeds enrich alerts with context; STIX/TAXII standards for threat intelligence sharing between organizations. Part 5 - Risk Management: Risk = Threat × Vulnerability × Impact; risk treatment: accept (tolerate), avoid (eliminate), transfer (insurance), mitigate (controls); qualitative vs quantitative risk analysis; risk register documents identified risks with likelihood, impact, and treatment; inherent risk (before controls) vs residual risk (after controls); risk appetite defines the level of risk an organization tolerates; third-party risk management extends to suppliers and partners. Part 6 - Governance and Compliance Frameworks: NIST Cybersecurity Framework (CSF) 2.0: Identify, Protect, Detect, Respond, Recover, and new Govern function; ISO 27001 information security management system standard; SOC 2 Type I (point-in-time) and Type II (6-12 month audit) for service organizations; PCI DSS 4.0 for payment card data; GDPR for EU personal data; HIPAA for US healthcare PHI; regulatory compliance demonstrates minimum security baseline. Part 7 - Business Continuity and Disaster Recovery: BIA (Business Impact Analysis) identifies critical processes and their RTO/RPO; BCP (Business Continuity Plan) maintains operations during disruption; DRP (Disaster Recovery Plan) restores IT systems after a disaster; tabletop exercises test plans without actual disruption; full-scale exercises test real failover; test frequency: annually at minimum; common failure to plan for: ransomware encrypting backups, single-vendor dependency, and key-person dependency. Part 8 - Security Policies and Awareness: Acceptable use policy (AUP) defines appropriate system use; data classification policy; password policy; BYOD policy; security awareness training reduces phishing click rates by 80%+ with regular simulated phishing campaigns; insider threat program monitors for data exfiltration indicators; security culture: psychological safety, leadership buy-in, and blame-free reporting of mistakes enables learning.',
          workedExample: 'Execute the NIST IR lifecycle for a confirmed ransomware incident — from detection through post-incident review.',
          workedExampleSteps: [
            'Step 1: Detection — SIEM alert: unusual SMB traffic pattern + EDR alert: known ransomware dropper hash on HR workstation.',
            'Step 2: Analysis — confirm incident severity (high: ransomware with lateral movement potential); identify affected systems; escalate to IR team.',
            'Step 3: Containment — isolate HR workstation from network via EDR; emergency firewall rule blocking C2 IP range; check network logs for lateral movement.',
            'Step 4: Eradication — reimage affected workstation (do not trust it); reset all accounts with sessions on that machine; patch exploited vulnerability (CVE-XXXX).',
            'Step 5: Recovery — restore HR data from last known-good backup (verify backup integrity with hash); phased reconnection with monitoring.',
            'Step 6: Verify — confirm no remaining C2 connections from any host; scan entire environment with updated IOCs.',
            'Step 7: Post-incident — blameless retrospective; root cause: phishing email with enabled macro; timeline: 4 hours detection to containment.',
            'Step 8: Improvements: deploy email sandboxing; disable macros via GPO; increase SIEM alert sensitivity for process injection; update IR playbook with lessons learned.'
          ],
          commonMistake: 'Skipping post-incident review — the lessons-learned step is where recurring incidents are prevented; without it, the same attack succeeds again; document root cause, timeline, what worked, what did not, and specific improvement actions.',
          practiceTask: 'Conduct a tabletop exercise: scenario is a phishing attack leading to ransomware. Walk through NIST IR phases — who is called, what actions are taken, what is communicated to leadership, and what improvements would prevent recurrence.',
          progressCheckQuestion: 'The NIST Incident Response phase that directly follows Eradication is:',
          progressCheckOptions: ['Detection and Analysis', 'Preparation', 'Recovery', 'Post-Incident Activity'],
          correctOptionIndex: 2,
          progressCheckExplanation: 'After removing the root cause (Eradication), systems are restored to operational status (Recovery) — then verified before returning to production. Post-Incident is the final phase.',
          quizQuestions: [
            { question: 'Order of volatility in digital forensics means:', options: ['Collect evidence from longest to shortest retention time', 'Collect most volatile evidence first — CPU/RAM before disk — as it is lost when power is removed', 'Preserve evidence in order of legal priority', 'Volatile evidence is the least reliable and collected last'], correctOptionIndex: 1, explanation: 'RAM and running processes are lost on shutdown — always capture volatile evidence before disk imaging in live forensics.' },
            { question: 'NIST CSF 2.0 new function "Govern" addresses:', options: ['Network governance controls', 'Organizational context, risk management strategy, and cybersecurity policy — the foundation enabling all other functions', 'Only GDPR compliance requirements', 'Governing cloud provider contracts'], correctOptionIndex: 1, explanation: 'Govern (new in CSF 2.0) establishes the organization\'s cybersecurity risk management strategy, expectations, and policy.' },
            { question: 'BIA (Business Impact Analysis) determines:', options: ['The cost of implementing security controls', 'Critical processes, their RTO/RPO requirements, and financial/operational impact of disruption', 'Insurance premiums for cyber liability', 'Security awareness training effectiveness'], correctOptionIndex: 1, explanation: 'BIA prioritizes recovery efforts — knowing which systems have 1-hour vs 24-hour RTO determines investment in resilience.' },
            { question: 'Threat hunting (proactive) differs from SIEM monitoring (reactive) in that:', options: ['Threat hunting uses different logs', 'Threat hunting actively searches for hidden threats using hypotheses; SIEM passively alerts on known patterns', 'SIEM is more accurate than threat hunting', 'They are equivalent with different tooling'], correctOptionIndex: 1, explanation: 'Sophisticated attackers evade automated detections — threat hunters use human-driven hypothesis-based investigation to find what automated tools miss.' }
          ]
        }
      ],
      finalAssessment: [
        { question: 'The CIA triad stands for:', options: ['Compliance, Integrity, Availability', 'Confidentiality, Integrity, Availability — the three core information security properties', 'Certification, Identity, Authentication', 'Control, Investigate, Audit'], correctOptionIndex: 1, explanation: 'CIA triad is the foundation of information security — every control maps to one or more of these three properties.' },
        { question: 'AES-256 is:', options: ['An asymmetric encryption algorithm', 'A symmetric encryption algorithm using the same key for encrypt and decrypt', 'A hashing algorithm producing 256-bit digests', 'A key exchange protocol'], correctOptionIndex: 1, explanation: 'AES is symmetric — fast, used for bulk data encryption; asymmetric (RSA) is used for key exchange.' },
        { question: 'MITRE ATT&CK is:', options: ['A vulnerability severity scoring system', 'A matrix of real-world adversary tactics and techniques used for detection and threat modeling', 'A penetration testing certification', 'A network intrusion prevention system'], correctOptionIndex: 1, explanation: 'ATT&CK catalogues specific techniques attackers use — enabling defenders to map detection coverage.' },
        { question: 'Perfect Forward Secrecy in TLS means:', options: ['TLS certificates never expire', 'Past sessions cannot be decrypted even if the server private key is later compromised', 'Session keys are reused for efficiency', 'Only TLS 1.3 provides encryption'], correctOptionIndex: 1, explanation: 'Ephemeral key exchange means each session has a unique key — past sessions remain private forever.' },
        { question: 'SQL injection is prevented by:', options: ['Firewall on port 443', 'Parameterized queries separating SQL structure from user-supplied data', 'Database encryption at rest', 'Rate limiting API requests'], correctOptionIndex: 1, explanation: 'Parameterized queries make injection impossible — user data is always treated as a value, never as SQL code.' },
        { question: 'A SIEM correlates security events to:', options: ['Store logs in encrypted format', 'Detect multi-step attacks invisible in individual log sources by correlating across sources', 'Replace firewall logs', 'Provide compliance documentation automatically'], correctOptionIndex: 1, explanation: 'Correlation across firewall, AD, EDR, and DNS logs reveals attack patterns no single source shows.' },
        { question: 'Zero trust security principle:', options: ['Internal network is trusted by default', 'No implicit trust based on network location — verify every access request regardless of origin', 'VPN provides sufficient protection', 'Trust is established once and maintained indefinitely'], correctOptionIndex: 1, explanation: 'Zero trust assumes breach and verifies explicitly — critical for hybrid and cloud environments.' },
        { question: 'FIDO2/WebAuthn is preferred over SMS OTP because:', options: ['FIDO2 is cheaper', 'FIDO2 is phishing-resistant — binds authentication to the correct domain', 'SMS is not supported by major services', 'FIDO2 requires no user interaction'], correctOptionIndex: 1, explanation: 'FIDO2 keys authenticate to the origin domain — phishing sites cannot steal the credential.' },
        { question: 'NIST IR Recovery phase follows:', options: ['Detection and Analysis', 'Preparation', 'Eradication', 'Post-Incident Activity'], correctOptionIndex: 2, explanation: 'After removing the root cause (Eradication), systems are restored (Recovery).' },
        { question: 'Order of volatility in forensics means:', options: ['Collect permanent storage first', 'Collect most volatile (RAM, network state) first — lost when power is removed', 'Only volatile evidence is admissible', 'Disk is collected before RAM'], correctOptionIndex: 1, explanation: 'RAM and process state vanish at shutdown — collect before disk imaging in live forensics.' },
        { question: 'BIA (Business Impact Analysis) identifies:', options: ['Cost of security controls', 'Critical processes, RTO/RPO, and impact of disruption — priorities recovery investment', 'Insurance requirements', 'Phishing simulation frequency'], correctOptionIndex: 1, explanation: 'BIA tells you what matters most and how quickly it must be restored — foundation of DR planning.' },
        { question: 'DMARC email security:', options: ['Encrypts email content', 'Enforces SPF+DKIM alignment and specifies action for failing messages — prevents spoofing', 'Applies rate limiting to outbound email', 'Requires recipient MFA'], correctOptionIndex: 1, explanation: 'DMARC prevents domain spoofing by enforcing email authentication and reporting failures.' },
        { question: 'CIS Benchmarks provide:', options: ['Vulnerability severity scores', 'Prescriptive hardening configuration guides for specific platforms', 'Penetration testing tools', 'Industry compliance certifications'], correctOptionIndex: 1, explanation: 'CIS Benchmarks are step-by-step hardening guides — implement them to close configuration-based attack surfaces.' },
        { question: 'Fileless malware evades detection by:', options: ['Using strong encryption', 'Running in memory using legitimate system tools — no file on disk for AV to detect', 'Targeting only outdated systems', 'Using encrypted C2 channels only'], correctOptionIndex: 1, explanation: 'Behavioral EDR detects the technique (e.g., PowerShell downloading and executing code) — signature AV misses it entirely.' },
        { question: 'Risk mitigation vs risk transfer:', options: ['They are identical risk treatments', 'Mitigation reduces probability or impact with controls; transfer shifts risk to a third party (insurance)', 'Transfer eliminates risk completely', 'Mitigation always costs more than transfer'], correctOptionIndex: 1, explanation: 'Organizations use both — technical controls mitigate; cyber insurance transfers residual risk.' }
      ],
      interviewPrep: [
        'Explain the CIA triad with concrete examples of a control that addresses each property — and describe a scenario where two CIA properties conflict.',
        'Walk through the TLS 1.3 handshake — what happens at each step, what perfect forward secrecy provides, and how certificate validation works.',
        'Describe the Cyber Kill Chain for a ransomware attack — what happens at each stage and where a defender can break the chain.',
        'Explain SQL injection, XSS, and CSRF — describe the attack mechanism and the specific prevention for each.',
        'Walk through the NIST Incident Response lifecycle for a phishing attack leading to account compromise — what you do at each phase and what evidence you preserve.',
        'Describe zero trust architecture — what it replaces, the key principles (verify explicitly, least privilege, assume breach), and how you would implement it for a hybrid cloud organization.',
        'Explain what a SIEM does, what correlation rules you would write to detect brute force and lateral movement, and how you would reduce the false positive rate.',
        'Describe DMARC, DKIM, and SPF — how they work together to prevent email spoofing and how you would configure them for a new domain.',
        'Explain governance, risk, and compliance — describe NIST CSF 2.0 functions, how a risk register works, and how you differentiate between risk acceptance, mitigation, transfer, and avoidance.',
        'Walk through digital forensics evidence handling — order of volatility, chain of custody, write blocker use, forensic imaging, and hash verification for a compromised Windows workstation.'
      ]
    });
  }


  if (/network.fund/i.test(name)) {
    return buildCourse({
      courseTitle: 'Networking Fundamentals',
      subtitle: 'Aligned to CompTIA Network+ N10-009 objectives for network design, operations, and troubleshooting.',
      difficulty: 'Intermediate',
      estimatedDuration: '9 weeks (8 hrs/week) | ~70 hours total',
      marketDemand: 'Network operations and cloud networking roles remain essential across every industry. Network+ is a recognized baseline credential for NOC, support, and infrastructure roles.',
      overview: 'This pathway aligns to Network+ N10-009 domains. Module 1 covers network models and media. Module 2 covers switching, routing, and wireless. Module 3 covers IP services and routing behavior. Module 4 covers monitoring, security, and troubleshooting operations.',
      learningOutcomes: [
        'Explain OSI and TCP/IP models and map protocols to layers.',
        'Configure and verify switching, VLAN, and routing fundamentals.',
        'Apply IPv4 and IPv6 addressing and troubleshoot common connectivity issues.',
        'Implement core network services including DNS, DHCP, and NAT.',
        'Use packet and path tools to isolate outages quickly.',
        'Document and secure small enterprise network designs.'
      ],
      resumeSignals: [
        'CompTIA Network+ N10-009 aligned training completed',
        'Configured VLAN segmentation and inter-VLAN routing in a lab environment',
        'Troubleshot DNS and DHCP outages using packet and log analysis',
        'Built dual-stack IPv4/IPv6 office network design documentation',
        'Implemented baseline network hardening and monitoring practices'
      ],
      modules: [
        {
          title: 'Network Models, Media, and Topologies',
          objective: 'Understand protocol models, cable standards, device roles, and topology tradeoffs for stable network design.',
          hours: 17,
          lesson: 'Part 1 - OSI and TCP/IP: Learn the seven-layer OSI model and the four-layer TCP/IP model and map real protocols to each layer. Part 2 - Frames, Packets, Segments: Differentiate L2 frames, L3 packets, and L4 segments in end-to-end communication. Part 3 - Physical Media: Compare copper, fiber, and wireless tradeoffs for throughput, distance, and interference tolerance. Part 4 - Cabling Standards: Apply T568A and T568B termination standards and understand straight-through versus crossover usage. Part 5 - Topologies: Compare star, mesh, hub-and-spoke, and hybrid topology patterns by resiliency and cost. Part 6 - Core Devices: Explain switch, router, firewall, load balancer, and access point functions in architecture diagrams. Part 7 - Ports and Protocols: Memorize common service ports including DNS, HTTP/S, SSH, RDP, and SMTP. Part 8 - Documentation Basics: Build network diagrams and device inventories that accelerate troubleshooting and change control.',
          workedExample: 'Design a 3-floor office network with segmented VLANs, uplink redundancy, and mixed copper/fiber runs.',
          workedExampleSteps: [
            'Define floor-by-floor endpoint count, growth targets, and bandwidth assumptions.',
            'Select access switch count and port density with PoE budgeting for phones and APs.',
            'Assign VLANs for users, voice, guests, and management traffic.',
            'Plan fiber uplinks to core with redundant paths and spanning-tree root placement.',
            'Document addressing blocks for each VLAN and gateway placement.',
            'Draw logical and physical diagrams and annotate critical dependencies.'
          ],
          commonMistake: 'Mixing management and user traffic on a flat network; segmentation is required for security and operational clarity.',
          practiceTask: 'Create a network diagram for a 50-user office that includes VLANs, AP placement, and uplink redundancy.',
          progressCheckQuestion: 'Which OSI layer is responsible for routing between networks?',
          progressCheckOptions: ['Data Link', 'Network', 'Transport', 'Session'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'Layer 3 handles logical addressing and routing decisions between networks.',
          quizQuestions: [
            { question: 'What is the primary purpose of VLANs?', options: ['Increase ISP speed', 'Logically segment broadcast domains for security and performance', 'Encrypt all traffic automatically', 'Replace firewalls completely'], correctOptionIndex: 1, explanation: 'VLANs separate traffic groups and reduce unnecessary broadcast scope.' },
            { question: 'Fiber is preferred over copper when:', options: ['Very short distance only', 'Long-distance, high-throughput links with low electromagnetic interference', 'Powering PoE cameras', 'You need cheaper patch cables only'], correctOptionIndex: 1, explanation: 'Fiber supports greater distance and bandwidth with stronger EMI resistance.' },
            { question: 'TCP differs from UDP because TCP:', options: ['Is always faster', 'Provides reliable, ordered delivery with acknowledgments', 'Requires no handshake', 'Runs only on private networks'], correctOptionIndex: 1, explanation: 'TCP emphasizes reliability and sequence guarantees.' },
            { question: 'A network baseline document should include:', options: ['Only switch vendor names', 'Topology, addressing plan, device roles, and key dependencies', 'Only wireless SSIDs', 'Only firewall rules'], correctOptionIndex: 1, explanation: 'Operational documentation must include architecture and configuration context.' }
          ]
        },
        {
          title: 'Switching, Routing, and Wireless Operations',
          objective: 'Configure switching and routing behavior, secure wireless access, and validate pathing in enterprise networks.',
          hours: 18,
          lesson: 'Part 1 - Switching Behavior: Learn MAC tables, flooding, learning, and forwarding. Part 2 - Spanning Tree: Prevent loops and understand root bridge election and convergence behavior. Part 3 - Trunking: Configure 802.1Q trunks and native VLAN settings safely. Part 4 - Inter-VLAN Routing: Route between VLANs using Layer 3 interfaces or router-on-a-stick. Part 5 - Routing Basics: Compare static routes and dynamic routing concepts for scale. Part 6 - Wireless Standards: Understand 802.11 generations and frequency-band tradeoffs. Part 7 - WLAN Security: Apply WPA3, enterprise authentication, and guest isolation controls. Part 8 - Validation: Use ping, traceroute, and interface counters to validate routing and wireless health.',
          workedExample: 'Implement VLAN and inter-VLAN routing for users, guests, and voice traffic with WLAN separation.',
          workedExampleSteps: [
            'Create VLAN 10, 20, and 30 and map switch access ports by user type.',
            'Configure trunk ports to carry required VLANs only.',
            'Set SVI gateways for each VLAN on Layer 3 switch.',
            'Apply ACLs to restrict guest VLAN from internal services.',
            'Map enterprise SSID to user VLAN and guest SSID to guest VLAN.',
            'Verify end-to-end connectivity and intended segmentation outcomes.'
          ],
          commonMistake: 'Allowing all VLANs on every trunk by default; prune trunks to the minimum required set.',
          practiceTask: 'Build a lab with two switches and one L3 gateway; configure VLANs, trunking, and ACL-based guest isolation.',
          progressCheckQuestion: 'What is the role of spanning tree in switched networks?',
          progressCheckOptions: ['Assign IP addresses', 'Prevent Layer 2 loops', 'Encrypt wireless traffic', 'Resolve DNS names'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'Spanning Tree Protocol blocks redundant L2 paths to prevent broadcast storms.',
          quizQuestions: [
            { question: 'A trunk port is used to:', options: ['Carry a single access VLAN only', 'Carry traffic for multiple VLANs with tagging', 'Provide DHCP service', 'Terminate VPN tunnels'], correctOptionIndex: 1, explanation: '802.1Q trunks transport multiple VLANs across inter-switch links.' },
            { question: 'Inter-VLAN routing requires:', options: ['Only Layer 2 switches', 'A Layer 3 interface or router to route between subnets', 'No gateway addresses', 'DNS records first'], correctOptionIndex: 1, explanation: 'Traffic between VLANs must be routed by Layer 3 logic.' },
            { question: 'WPA3 enterprise typically uses:', options: ['Open authentication only', '802.1X with centralized authentication', 'Shared keys with no rotation', 'MAC flooding controls'], correctOptionIndex: 1, explanation: 'Enterprise WLANs use 802.1X and identity-based authentication.' },
            { question: 'Traceroute is useful for:', options: ['Changing routes', 'Identifying path hops and latency locations', 'Encrypting packets', 'Assigning DNS records'], correctOptionIndex: 1, explanation: 'Traceroute reveals routing path and delay per hop.' }
          ]
        },
        {
          title: 'Addressing, Services, and Routing Behavior',
          objective: 'Apply IP addressing and subnetting, configure key network services, and diagnose name-resolution and pathing faults.',
          hours: 18,
          lesson: 'Part 1 - IPv4 Addressing: Calculate network, broadcast, and usable host ranges using CIDR. Part 2 - Subnetting: Break larger blocks into efficient subnet designs for departments and environments. Part 3 - IPv6 Fundamentals: Understand global unicast, link-local, and SLAAC concepts. Part 4 - DHCP: Configure scopes, reservations, and lease policies. Part 5 - DNS: Explain recursive resolution, record types, and cache behavior. Part 6 - NAT/PAT: Translate addresses for internet access and understand state tracking. Part 7 - Routing Decisions: Compare longest-prefix match and default route behavior. Part 8 - Service Troubleshooting: Isolate issues across DHCP, DNS, and gateway pathing with command-line tools.',
          workedExample: 'Troubleshoot an outage where users can ping gateway but cannot browse by domain names.',
          workedExampleSteps: [
            'Confirm local IP, subnet, gateway, and DNS settings from client.',
            'Test gateway reachability and internet IP reachability separately.',
            'Run DNS lookup for affected domains and inspect resolver response.',
            'Check DHCP options for incorrect DNS server distribution.',
            'Validate upstream resolver health and forwarding configuration.',
            'Restore service and document root cause and preventive control.'
          ],
          commonMistake: 'Assuming internet outage when issue is DNS-only; test IP and name resolution independently.',
          practiceTask: 'Subnet a /24 into four equal networks and configure DHCP scopes and DNS settings for each.',
          progressCheckQuestion: 'If users can reach 8.8.8.8 but not example.com, the likely issue is:',
          progressCheckOptions: ['Cable failure', 'DNS resolution problem', 'Spanning tree loop', 'NAT disabled on host'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'IP reachability with failed hostname access usually indicates DNS failure.',
          quizQuestions: [
            { question: 'What does CIDR /26 represent in IPv4?', options: ['26 hosts per subnet', '26 network bits and 6 host bits', '26 subnets exactly', '26-byte header'], correctOptionIndex: 1, explanation: 'Prefix length /26 leaves 6 host bits in a 32-bit IPv4 address.' },
            { question: 'DHCP primarily provides:', options: ['Encryption keys', 'Automatic IP configuration and lease management', 'Route optimization', 'Packet inspection'], correctOptionIndex: 1, explanation: 'DHCP assigns addresses and related options like DNS and gateway.' },
            { question: 'Longest-prefix match means routers choose:', options: ['The cheapest route only', 'The route with the most specific matching subnet', 'The oldest route', 'The static route always'], correctOptionIndex: 1, explanation: 'More specific prefixes take precedence in routing decisions.' },
            { question: 'AAAA DNS record maps:', options: ['IPv4 to hostname', 'Hostname to IPv6 address', 'Mail host priority', 'Reverse lookup zone'], correctOptionIndex: 1, explanation: 'AAAA records contain IPv6 address mappings.' }
          ]
        },
        {
          title: 'Network Security, Monitoring, and Troubleshooting Operations',
          objective: 'Apply secure network controls, monitor performance indicators, and execute structured troubleshooting workflows.',
          hours: 17,
          lesson: 'Part 1 - Network Hardening: Disable unused services and secure management planes. Part 2 - ACLs and Firewalls: Filter traffic by source, destination, and service intent. Part 3 - Segmentation Strategy: Use VLAN and zone-based architecture to contain risk. Part 4 - Monitoring Stack: Track interface health, latency, loss, and error metrics. Part 5 - Logs and Telemetry: Use syslog, NetFlow, and SNMP for visibility and trend analysis. Part 6 - Troubleshooting Method: Follow identify, isolate, test, and verify stages consistently. Part 7 - Incident Escalation: Escalate with evidence and clear blast-radius summaries. Part 8 - Post-Incident Review: Capture root cause, action items, and documentation updates.',
          workedExample: 'Resolve intermittent packet loss affecting VoIP calls in a branch office.',
          workedExampleSteps: [
            'Collect baseline latency and packet-loss metrics during normal and peak windows.',
            'Inspect interface utilization, CRC errors, and duplex mismatch indicators.',
            'Validate QoS policy for voice queue prioritization and shaping.',
            'Trace route path and compare ISP handoff behavior under load.',
            'Implement corrective change in maintenance window and verify call quality.',
            'Publish incident summary with prevention actions and monitoring thresholds.'
          ],
          commonMistake: 'Changing multiple variables at once during troubleshooting; isolate one change at a time.',
          practiceTask: 'Create a troubleshooting runbook for high-latency incidents and include required evidence at each step.',
          progressCheckQuestion: 'Which telemetry source best summarizes top talkers and traffic patterns?',
          progressCheckOptions: ['ARP table', 'NetFlow', 'DNS cache', 'Spanning-tree table'],
          correctOptionIndex: 1,
          progressCheckExplanation: 'NetFlow provides flow-level visibility for traffic analysis and capacity planning.',
          quizQuestions: [
            { question: 'ACLs are used to:', options: ['Assign IP addresses', 'Permit or deny traffic based on policy criteria', 'Improve signal strength', 'Build backups'], correctOptionIndex: 1, explanation: 'ACLs enforce traffic policy at network boundaries.' },
            { question: 'SNMP is commonly used for:', options: ['Packet encryption', 'Device monitoring and management telemetry', 'Name resolution', 'Web proxying'], correctOptionIndex: 1, explanation: 'SNMP exposes health and performance counters.' },
            { question: 'A good troubleshooting workflow should be:', options: ['Ad hoc and intuition-only', 'Structured, evidence-driven, and documented', 'Focused only on user reports', 'Based only on reboots'], correctOptionIndex: 1, explanation: 'Consistent method reduces MTTR and repeat failures.' },
            { question: 'Post-incident reviews should produce:', options: ['Only blame assignment', 'Root cause, corrective actions, and updated runbooks', 'Only executive summaries', 'No technical details'], correctOptionIndex: 1, explanation: 'The goal is durable improvement and knowledge capture.' }
          ]
        }
      ],
      finalAssessment: [
        { question: 'Which layer handles routing in OSI?', options: ['L2', 'L3', 'L4', 'L7'], correctOptionIndex: 1, explanation: 'Routing is a Layer 3 function.' },
        { question: 'VLANs primarily provide:', options: ['Power delivery', 'Logical segmentation', 'Encryption', 'DNS failover'], correctOptionIndex: 1, explanation: 'VLANs separate broadcast domains and policy zones.' },
        { question: 'A trunk port carries:', options: ['Only one untagged VLAN always', 'Multiple tagged VLANs', 'Only management traffic', 'Only voice traffic'], correctOptionIndex: 1, explanation: 'Trunks carry multiple VLANs using tags.' },
        { question: 'Users reach IPs but not hostnames. Suspect:', options: ['DHCP lease time', 'DNS failure', 'Power outage', 'Switch loop'], correctOptionIndex: 1, explanation: 'This pattern indicates name-resolution issues.' },
        { question: 'DHCP assigns:', options: ['Only gateway', 'IP, mask, gateway, DNS options', 'MAC addresses', 'Routing protocol neighbors'], correctOptionIndex: 1, explanation: 'DHCP distributes core host configuration values.' },
        { question: 'Longest-prefix match selects:', options: ['Default route first', 'Most specific route', 'Oldest route', 'Static route only'], correctOptionIndex: 1, explanation: 'Routing tables prioritize most specific prefix match.' },
        { question: 'Spanning Tree prevents:', options: ['DNS poisoning', 'Layer 2 loops', 'ARP requests', 'NAT overload'], correctOptionIndex: 1, explanation: 'STP blocks redundant L2 loops to avoid storms.' },
        { question: 'NetFlow helps with:', options: ['Password policy', 'Traffic pattern analysis', 'Cable testing', 'Firmware flashing'], correctOptionIndex: 1, explanation: 'Flow telemetry identifies heavy traffic and anomalies.' },
        { question: 'WPA3 enterprise commonly uses:', options: ['Open auth only', '802.1X auth', 'Shared office password', 'No encryption'], correctOptionIndex: 1, explanation: 'Enterprise wireless uses identity-based authentication.' },
        { question: 'A core troubleshooting principle is:', options: ['Change everything quickly', 'Isolate one variable at a time', 'Skip verification', 'Ignore documentation'], correctOptionIndex: 1, explanation: 'Controlled changes preserve causal evidence.' },
        { question: 'IPv6 AAAA records map:', options: ['MX priority', 'Hostnames to IPv6 addresses', 'Reverse ARP', 'DHCP options'], correctOptionIndex: 1, explanation: 'AAAA is the IPv6 forward lookup record.' },
        { question: 'Inter-VLAN communication requires:', options: ['Only L2 switch', 'Layer 3 routing', 'NTP server', 'Cable tester'], correctOptionIndex: 1, explanation: 'Traffic between VLANs must be routed.' },
        { question: 'ACL best practice is:', options: ['Permit all by default everywhere', 'Allow least privilege traffic required', 'Block DNS first', 'Use no logging'], correctOptionIndex: 1, explanation: 'Least privilege reduces exposure and blast radius.' },
        { question: 'An effective runbook should include:', options: ['Only screenshots', 'Steps, commands, decision points, and rollback', 'No owners', 'No thresholds'], correctOptionIndex: 1, explanation: 'Operational runbooks must be executable and auditable.' },
        { question: 'Root-cause analysis is performed:', options: ['Before incident detection', 'After containment and restoration', 'Only during onboarding', 'Only yearly'], correctOptionIndex: 1, explanation: 'RCA is a post-incident activity to prevent recurrence.' }
      ],
      interviewPrep: [
        'Explain OSI versus TCP/IP models and map common protocols to each layer.',
        'Walk through how you would design VLAN segmentation for a 100-user office.',
        'Describe your method for diagnosing DNS versus routing versus DHCP failures.',
        'Explain trunking and inter-VLAN routing with a practical implementation example.',
        'Discuss how you prioritize alerts in a NOC environment under load.',
        'Describe metrics you monitor to detect congestion before users report impact.',
        'Explain the difference between static and dynamic routing in operations.',
        'Walk through a real packet-loss incident and your evidence-driven triage process.',
        'Describe how you secure management access to network devices.',
        'Explain what makes post-incident documentation useful for future responders.'
      ]
    });
  }

  if (/soc.analyst/i.test(name)) {
    return buildCourse({
      courseTitle: 'SOC Analyst Basics',
      subtitle: 'Aligned to SOC operations and CompTIA CySA+ style threat detection and incident triage practices.',
      difficulty: 'Intermediate',
      estimatedDuration: '7 weeks (8 hrs/week) | ~55 hours total',
      marketDemand: 'SOC analysts are in sustained demand as organizations scale threat monitoring and incident response capabilities.',
      overview: 'This pathway builds entry-level SOC competency: SIEM triage, IOC analysis, incident response, and reporting. Modules cover log analysis, incident handling, vulnerability management, and SOC operations improvement.',
      learningOutcomes: [
        'Triage SIEM alerts and distinguish false positives from actionable incidents.',
        'Interpret endpoint, identity, and network telemetry for investigation.',
        'Apply incident response procedures and evidence-handling fundamentals.',
        'Prioritize vulnerabilities with business context and exploitability.',
        'Document incidents with clear timelines and containment actions.',
        'Contribute to detection-rule tuning and SOC process improvement.'
      ],
      resumeSignals: [
        'Built SIEM detections for brute-force and suspicious PowerShell activity',
        'Performed phishing incident triage with complete timeline documentation',
        'Prioritized vulnerability backlog using CVSS plus asset criticality',
        'Created SOC runbook for endpoint containment workflows',
        'Produced weekly SOC metrics dashboard (MTTD, MTTR, false-positive rate)'
      ],
      modules: [
        { title: 'Threat Intelligence and SIEM Triage', objective: 'Use threat context and log correlation to triage and classify alerts accurately.', hours: 14, lesson: 'Part 1 - SOC Mission: Understand Tier 1 triage goals and escalation criteria. Part 2 - Alert Context: Correlate identity, endpoint, and network signals. Part 3 - IOC Types: Analyze malicious hashes, domains, and IP indicators. Part 4 - SIEM Workflows: Use search, timeline pivots, and saved queries. Part 5 - Baselines: Compare alerts against expected behavior and business context. Part 6 - False Positives: Recognize noisy detections and common benign triggers. Part 7 - Prioritization: Use severity, confidence, and asset criticality scoring. Part 8 - Escalation: Prepare concise investigation handoff with evidence.', workedExample: 'Triage suspicious login sequence with impossible travel and elevated privilege events.', workedExampleSteps: ['Collect login logs and account metadata.', 'Validate geo-IP and device fingerprint anomalies.', 'Check MFA challenge outcomes and conditional-access logs.', 'Review privilege-change events near login window.', 'Classify severity and decide containment recommendation.', 'Escalate with timeline and evidence artifacts.'], commonMistake: 'Escalating without validating account context; always check travel, VPN, and service account behavior first.', practiceTask: 'Create a SIEM triage checklist for identity-related alerts with escalation thresholds.', progressCheckQuestion: 'Which factor most improves triage quality?', progressCheckOptions: ['More alerts', 'Context from multiple telemetry sources', 'Longer ticket titles', 'Immediate escalation'], correctOptionIndex: 1, progressCheckExplanation: 'Cross-source context reduces false positives and improves confidence.', quizQuestions: [{ question: 'An IOC is:', options: ['A compliance framework', 'An indicator associated with malicious activity', 'A backup policy', 'A firewall mode'], correctOptionIndex: 1, explanation: 'IOCs are observable artifacts linked to threats.' }, { question: 'Best first action for high-volume noisy alert:', options: ['Disable SIEM', 'Investigate detection logic and baseline behavior', 'Ignore all alerts', 'Escalate everything'], correctOptionIndex: 1, explanation: 'Tune detections with baseline understanding to reduce noise safely.' }, { question: 'Tier 1 SOC role typically focuses on:', options: ['Malware reverse engineering only', 'Initial triage and escalation', 'Executive reporting only', 'Cloud architecture design'], correctOptionIndex: 1, explanation: 'Tier 1 handles first-pass alert review and routing.' }, { question: 'Asset criticality affects:', options: ['Packet size', 'Alert priority decisions', 'NTP settings', 'Hash algorithms'], correctOptionIndex: 1, explanation: 'Same event is higher risk on critical assets.' }] },
        { title: 'Incident Response and Digital Forensics Basics', objective: 'Apply containment and evidence-preservation steps for common SOC incidents.', hours: 14, lesson: 'Part 1 - IR Lifecycle: Follow preparation, detection, containment, eradication, recovery, and lessons learned. Part 2 - Severity Models: Assign severity based on scope and business impact. Part 3 - Containment Strategy: Isolate endpoints and revoke sessions quickly. Part 4 - Evidence Handling: Preserve chain of custody and timestamps. Part 5 - Memory and Disk Concepts: Understand volatile versus persistent evidence. Part 6 - Communication: Coordinate with IT, legal, and leadership appropriately. Part 7 - Recovery Validation: Confirm persistence mechanisms are removed. Part 8 - Retrospectives: Capture root cause and control improvements.', workedExample: 'Respond to phishing-to-malware incident affecting one finance endpoint.', workedExampleSteps: ['Confirm malicious email and execution artifacts.', 'Isolate endpoint from network and revoke tokens.', 'Collect endpoint and email logs for timeline.', 'Run malware scan and persistence checks.', 'Restore system and validate user access safely.', 'Complete incident report and lessons learned.'], commonMistake: 'Skipping chain-of-custody tracking during urgent incidents.', practiceTask: 'Run a tabletop and produce a one-page incident timeline with decisions and owners.', progressCheckQuestion: 'What should happen immediately after confirmed active compromise?', progressCheckOptions: ['Wait for weekly patch cycle', 'Contain affected assets', 'Archive logs first only', 'Close the ticket'], correctOptionIndex: 1, progressCheckExplanation: 'Containment limits spread before full eradication.', quizQuestions: [{ question: 'Chain of custody is used to:', options: ['Encrypt backups', 'Track evidence handling integrity', 'Prioritize tickets', 'Assign CVSS scores'], correctOptionIndex: 1, explanation: 'It preserves legal and investigative integrity.' }, { question: 'Containment occurs before:', options: ['Detection', 'Eradication and recovery', 'Preparation', 'Asset inventory'], correctOptionIndex: 1, explanation: 'Containment limits blast radius before full cleanup.' }, { question: 'Volatile evidence includes:', options: ['Printed policies', 'Memory-resident process data', 'Archived backups only', 'Hardware invoices'], correctOptionIndex: 1, explanation: 'Volatile data is lost quickly and should be captured early.' }, { question: 'IR lessons learned should produce:', options: ['Only blame assignment', 'Control updates and playbook improvements', 'No documentation', 'Ticket deletion'], correctOptionIndex: 1, explanation: 'Post-incident improvement is a core output.' }] },
        { title: 'Vulnerability Management and Prioritization', objective: 'Assess, prioritize, and track remediation of vulnerabilities using risk-based methods.', hours: 13, lesson: 'Part 1 - Scan Types: Compare authenticated and unauthenticated scanning. Part 2 - Severity Scoring: Use CVSS with exploitability and business context. Part 3 - Validation: Confirm true positives and identify false positives. Part 4 - Prioritization: Rank by internet exposure, exploit availability, and asset value. Part 5 - Remediation Plans: Coordinate patching, compensating controls, and exceptions. Part 6 - SLA Tracking: Define timelines by severity and environment type. Part 7 - Reporting: Summarize backlog trends and risk reduction metrics. Part 8 - Continuous Improvement: Tune scanning coverage and remediation workflows.', workedExample: 'Prioritize 120 findings for a production web stack with limited maintenance windows.', workedExampleSteps: ['Group findings by asset criticality and internet exposure.', 'Identify actively exploited CVEs from threat intel feeds.', 'Flag compensating controls already in place.', 'Schedule critical fixes in nearest maintenance window.', 'Create exception path for non-remediable legacy components.', 'Report residual risk and due dates to stakeholders.'], commonMistake: 'Patching purely by CVSS without business context.', practiceTask: 'Create a risk-prioritized remediation queue from a sample scan report.', progressCheckQuestion: 'Best remediation order is driven by:', progressCheckOptions: ['Alphabetical CVE order', 'Risk: exploitability plus business impact', 'Ticket age only', 'Random assignment'], correctOptionIndex: 1, progressCheckExplanation: 'Risk-based prioritization reduces actual exposure fastest.', quizQuestions: [{ question: 'Authenticated scans provide:', options: ['No additional value', 'Deeper visibility into host-level weaknesses', 'Only network latency metrics', 'Email delivery status'], correctOptionIndex: 1, explanation: 'Credentials enable richer vulnerability discovery.' }, { question: 'A compensating control is:', options: ['Ignoring a vulnerability', 'Alternative safeguard reducing risk when direct fix is delayed', 'A replacement password', 'A backup schedule'], correctOptionIndex: 1, explanation: 'Compensating controls lower risk until remediation is complete.' }, { question: 'Exploit availability should affect:', options: ['Logo design', 'Remediation priority', 'Subnet mask', 'Disk quota'], correctOptionIndex: 1, explanation: 'Public exploit code increases immediate risk.' }, { question: 'Vulnerability SLA should be:', options: ['Undefined', 'Aligned to severity and business criticality', 'Same for all findings', 'Only annual'], correctOptionIndex: 1, explanation: 'Different risk levels require different remediation timelines.' }] },
        { title: 'SOC Operations, Reporting, and Threat Hunting', objective: 'Operate SOC workflows, report meaningful metrics, and perform basic hypothesis-driven threat hunts.', hours: 14, lesson: 'Part 1 - SOC Metrics: Track MTTD, MTTR, backlog, and false-positive rate. Part 2 - Shift Handoffs: Preserve context through clear handoff notes. Part 3 - Detection Engineering: Tune rules and reduce alert fatigue. Part 4 - Hunt Planning: Define hypotheses based on ATT&CK techniques. Part 5 - Data Sources: Leverage endpoint, identity, DNS, and proxy telemetry. Part 6 - Hunt Execution: Query and pivot systematically for indicators of attack. Part 7 - Reporting: Communicate risk and outcomes to technical and business audiences. Part 8 - Automation: Introduce SOAR playbooks for repetitive response tasks.', workedExample: 'Run a hunt for suspicious PowerShell usage tied to credential theft techniques.', workedExampleSteps: ['Define hunt hypothesis and ATT&CK mapping.', 'Query process lineage and encoded command patterns.', 'Pivot to user and host context for anomaly scoring.', 'Correlate with authentication anomalies and lateral movement signals.', 'Document findings and propose new detection rule.', 'Present hunt report with confidence and next actions.'], commonMistake: 'Running hunts without a clear hypothesis and scope.', practiceTask: 'Draft a monthly SOC report template covering metrics, incidents, and improvement actions.', progressCheckQuestion: 'A useful SOC metric for response speed is:', progressCheckOptions: ['Average ticket title length', 'MTTR', 'Total employee count', 'Firewall vendor version'], correctOptionIndex: 1, progressCheckExplanation: 'MTTR measures time to respond and recover.', quizQuestions: [{ question: 'Threat hunting is best described as:', options: ['Waiting for SIEM alerts only', 'Proactive search for adversary behavior', 'Patching firmware only', 'Compliance evidence collection'], correctOptionIndex: 1, explanation: 'Hunting proactively looks for undetected activity.' }, { question: 'Detection tuning primarily aims to:', options: ['Increase false positives', 'Improve signal quality and reduce analyst fatigue', 'Reduce log ingestion to zero', 'Block all internet traffic'], correctOptionIndex: 1, explanation: 'Quality detections improve speed and confidence.' }, { question: 'SOAR is useful for:', options: ['Manual note-taking only', 'Automating repeatable response workflows', 'Replacing SIEM storage', 'Routing physical cables'], correctOptionIndex: 1, explanation: 'SOAR automates deterministic investigation and response steps.' }, { question: 'Good shift handoff notes include:', options: ['Only incident IDs', 'Current status, evidence, pending actions, and risks', 'No context', 'Personal opinions only'], correctOptionIndex: 1, explanation: 'Continuity depends on clear operational context.' }] }
      ],
      finalAssessment: [
        { question: 'Tier 1 SOC responsibility includes:', options: ['Kernel exploit development', 'Initial alert triage and escalation', 'C-suite budget planning', 'Database indexing'], correctOptionIndex: 1, explanation: 'Tier 1 focuses on triage and routing.' },
        { question: 'IOC stands for:', options: ['Indicator of Compliance', 'Indicator of Compromise', 'Index of Correlation', 'Incident of Concern'], correctOptionIndex: 1, explanation: 'IOC is an artifact linked to malicious activity.' },
        { question: 'Containment in IR aims to:', options: ['Assign blame', 'Limit spread and impact', 'Close all tickets', 'Ignore logs'], correctOptionIndex: 1, explanation: 'Containment reduces blast radius quickly.' },
        { question: 'Chain of custody ensures:', options: ['Faster network speeds', 'Evidence integrity tracking', 'Lower patch counts', 'Smaller SIEM costs'], correctOptionIndex: 1, explanation: 'Evidence handling must be traceable and defensible.' },
        { question: 'Risk-based vulnerability prioritization uses:', options: ['CVSS only', 'Exploitability plus business impact', 'Alphabetical ordering', 'Ticket age only'], correctOptionIndex: 1, explanation: 'Risk context improves remediation outcomes.' },
        { question: 'False positives should be addressed by:', options: ['Ignoring alerts permanently', 'Detection tuning and baseline validation', 'Deleting all rules', 'Escalating every event'], correctOptionIndex: 1, explanation: 'Tuning preserves detection value while reducing noise.' },
        { question: 'MTTD measures:', options: ['Mean time to deploy', 'Mean time to detect', 'Managed ticket tracking depth', 'Monthly threat taxonomy data'], correctOptionIndex: 1, explanation: 'MTTD tracks detection speed.' },
        { question: 'Threat hunting is:', options: ['Compliance audit only', 'Proactive search for hidden adversary behavior', 'Patch scheduling only', 'Password reset process'], correctOptionIndex: 1, explanation: 'Hunting looks beyond triggered alerts.' },
        { question: 'SOAR platforms are used for:', options: ['Switch routing protocols', 'Automating repetitive response tasks', 'Replacing endpoint agents', 'Cabling management'], correctOptionIndex: 1, explanation: 'SOAR improves speed and consistency in response playbooks.' },
        { question: 'A high-quality escalation includes:', options: ['No evidence', 'Timeline, indicators, severity, and recommended action', 'Only a screenshot', 'Only user complaint text'], correctOptionIndex: 1, explanation: 'Structured escalation reduces delays for higher-tier analysts.' },
        { question: 'Volatile evidence is:', options: ['Never useful', 'Likely to disappear quickly, such as memory state', 'Stored only in backups', 'Archived policy docs'], correctOptionIndex: 1, explanation: 'Volatile data should be captured early.' },
        { question: 'Post-incident review should produce:', options: ['No output', 'Concrete control and playbook improvements', 'Only executive praise', 'Ticket deletion'], correctOptionIndex: 1, explanation: 'Learning outputs prevent recurrence.' },
        { question: 'Asset criticality affects:', options: ['Color of dashboard', 'Incident priority and response urgency', 'DNS TTL values', 'Hash function selection'], correctOptionIndex: 1, explanation: 'Critical systems increase business impact.' },
        { question: 'A practical SOC dashboard should track:', options: ['Coffee consumption', 'MTTD, MTTR, backlog, severity trends', 'Employee birthdays', 'Office occupancy'], correctOptionIndex: 1, explanation: 'Operational metrics must reflect response health.' },
        { question: 'Best first step in a hunt is:', options: ['Query random logs', 'Define a clear hypothesis and scope', 'Disable detections', 'Notify media'], correctOptionIndex: 1, explanation: 'Structured hypotheses improve hunt quality and repeatability.' }
      ],
      interviewPrep: [
        'Walk through your triage process for a suspicious login alert with partial evidence.',
        'Explain how you determine whether an alert is a false positive.',
        'Describe your escalation criteria and what a complete handoff includes.',
        'Explain the difference between IOC- and behavior-based detection.',
        'Describe an incident timeline you would build for phishing-to-malware flow.',
        'Explain how you prioritize vulnerabilities beyond CVSS score alone.',
        'Discuss SOC metrics you trust and how you improve them over time.',
        'Describe a simple threat hunt hypothesis and expected telemetry.',
        'Explain evidence-handling basics and why chain of custody matters.',
        'Describe how automation should be introduced without creating blind spots.'
      ]
    });
  }

  if (/cloud.sec/i.test(name)) {
    return buildCourse({
      courseTitle: 'Cloud Security',
      subtitle: 'Aligned to AWS Security and CCSP-style concepts for securing cloud workloads and identities.',
      difficulty: 'Advanced',
      estimatedDuration: '7 weeks (7 hrs/week) | ~50 hours total',
      marketDemand: 'Cloud security expertise is a top hiring priority as workloads and sensitive data move to multi-cloud platforms.',
      overview: 'This pathway covers cloud threat modeling, IAM controls, encryption and key management, network security in cloud, and governance/compliance posture management.',
      learningOutcomes: ['Apply shared responsibility and threat modeling in cloud environments.', 'Design least-privilege IAM and secrets controls.', 'Implement encryption and key lifecycle practices.', 'Secure cloud network boundaries and workload access.', 'Use posture management and logging for continuous assurance.', 'Map controls to compliance and audit requirements.'],
      resumeSignals: ['Designed least-privilege IAM role model for cloud workloads', 'Implemented centralized key management and secret rotation', 'Configured cloud WAF and DDoS protections for public endpoints', 'Deployed posture checks for misconfiguration detection', 'Built cloud incident response runbook and audit evidence pack'],
      modules: [
        { title: 'Cloud Threat Landscape and Responsibility Model', objective: 'Understand cloud attack surface and shared responsibility boundaries.', hours: 12, lesson: 'Part 1 - Shared Responsibility: Distinguish provider and customer security obligations by service model. Part 2 - Identity-Centric Risk: Understand why identity misconfiguration drives major cloud incidents. Part 3 - Misconfiguration Patterns: Public storage, excessive permissions, and exposed management interfaces. Part 4 - Data Classification: Map sensitivity tiers to control requirements. Part 5 - Logging Foundations: Enable account, network, and workload audit trails. Part 6 - Multi-Account Strategy: Isolate environments and reduce blast radius. Part 7 - Threat Modeling: Analyze trust boundaries and privilege paths. Part 8 - Control Prioritization: Sequence remediation by impact and exploitability.', workedExample: 'Assess a misconfigured storage incident and redesign controls.', workedExampleSteps: ['Identify exposed resource and access path.', 'Trace ownership and inherited permissions.', 'Apply least-privilege policy and block-public defaults.', 'Enable object-level access logging and alerting.', 'Rotate credentials and review dependent workloads.', 'Document lessons and preventive guardrails.'], commonMistake: 'Treating cloud perimeter as sufficient while ignoring identity and policy drift.', practiceTask: 'Build a shared-responsibility matrix for IaaS, PaaS, and SaaS workloads.', progressCheckQuestion: 'Most cloud breaches are commonly linked to:', progressCheckOptions: ['Cooling failures', 'Misconfiguration and excessive permissions', 'Fiber cuts only', 'Hardware theft only'], correctOptionIndex: 1, progressCheckExplanation: 'Identity and configuration errors are a dominant root cause.' , quizQuestions: [{ question: 'Shared responsibility means:', options: ['Provider secures everything', 'Security duties are split between provider and customer', 'Customer secures only endpoints', 'No security model is needed'], correctOptionIndex: 1, explanation: 'Control ownership depends on service model.' }, { question: 'A public storage bucket with sensitive data indicates:', options: ['Expected default behavior', 'Configuration risk requiring immediate remediation', 'Network latency issue', 'Billing optimization'], correctOptionIndex: 1, explanation: 'Public exposure of sensitive data is a high-severity control failure.' }, { question: 'Multi-account cloud architecture helps by:', options: ['Reducing logs', 'Containing blast radius and improving governance', 'Disabling IAM', 'Avoiding backups'], correctOptionIndex: 1, explanation: 'Account separation limits lateral impact.' }, { question: 'Threat modeling helps teams:', options: ['Skip testing', 'Identify likely attack paths and prioritize controls', 'Reduce documentation', 'Eliminate compliance needs'], correctOptionIndex: 1, explanation: 'Threat modeling focuses defense investment.' }] },
        { title: 'IAM, Encryption, and Secrets Management', objective: 'Implement robust identity and cryptographic controls for cloud resources.', hours: 13, lesson: 'Part 1 - IAM Principles: Enforce least privilege and separation of duties. Part 2 - Role Design: Use short-lived role assumptions rather than long-term static keys. Part 3 - Policy Evaluation: Understand explicit deny precedence and permission boundaries. Part 4 - MFA and Conditional Access: Add context-aware controls for privileged actions. Part 5 - Key Management: Use managed KMS and define rotation and revocation procedures. Part 6 - Encryption Strategy: Apply encryption at rest and in transit for all sensitive data. Part 7 - Secrets Management: Replace embedded credentials with managed secret stores. Part 8 - Auditability: Log and alert on privileged activity and key usage anomalies.', workedExample: 'Migrate a legacy app from static credentials to role-based access with managed secrets.', workedExampleSteps: ['Inventory hardcoded secrets and privilege scope.', 'Create workload role with least-privilege policies.', 'Store credentials in managed secret service.', 'Update app runtime to retrieve secrets securely.', 'Enable key rotation and access logging.', 'Validate access paths and remove legacy credentials.'], commonMistake: 'Leaving static access keys active after migrating to roles.', practiceTask: 'Write least-privilege policy for an app that reads one bucket and writes one queue.', progressCheckQuestion: 'Best practice for cloud workloads is to use:', progressCheckOptions: ['Long-lived root keys', 'Short-lived role credentials', 'Shared admin account', 'No authentication'], correctOptionIndex: 1, progressCheckExplanation: 'Ephemeral role credentials reduce key exposure risk.', quizQuestions: [{ question: 'Permission boundaries are used to:', options: ['Grant network routes', 'Constrain maximum permissions of identities', 'Increase storage size', 'Disable logging'], correctOptionIndex: 1, explanation: 'Boundaries limit privilege expansion.' }, { question: 'Managed secret stores help by:', options: ['Disabling encryption', 'Centralizing secret lifecycle and access control', 'Eliminating IAM', 'Removing MFA'], correctOptionIndex: 1, explanation: 'Secret management reduces credential leakage risks.' }, { question: 'KMS key rotation primarily supports:', options: ['Lower latency', 'Cryptographic hygiene and reduced key compromise impact', 'More CPU cores', 'Larger packets'], correctOptionIndex: 1, explanation: 'Rotation limits long-term exposure of any single key.' }, { question: 'Explicit deny in IAM policy evaluation:', options: ['Is ignored', 'Overrides allows', 'Applies only to root', 'Disables MFA'], correctOptionIndex: 1, explanation: 'Explicit deny takes precedence over allows.' }] },
        { title: 'Cloud Network Security and Incident Response', objective: 'Secure cloud network paths and execute cloud-specific incident workflows.', hours: 13, lesson: 'Part 1 - Segmentation: Isolate workloads with subnet and security-group patterns. Part 2 - Ingress Controls: Use WAF and API gateways for external exposure. Part 3 - Egress Controls: Restrict outbound paths and detect data exfiltration. Part 4 - DDoS Mitigation: Apply managed protections and traffic scrubbing services. Part 5 - Private Connectivity: Use private endpoints for service-to-service traffic. Part 6 - Detection: Correlate account activity with network anomalies. Part 7 - Cloud IR: Automate quarantine and credential revocation workflows. Part 8 - Recovery: Restore from immutable backups and validate remediation.', workedExample: 'Contain suspicious cloud API activity indicating credential misuse.', workedExampleSteps: ['Detect anomalous API calls from unfamiliar geolocation.', 'Temporarily revoke compromised credentials.', 'Isolate affected compute resources and storage access.', 'Review audit logs for lateral movement indicators.', 'Reissue credentials and enforce stronger conditional access.', 'Publish incident report and hardening actions.'], commonMistake: 'Focusing only on ingress controls while ignoring outbound exfiltration paths.', practiceTask: 'Design cloud network policy with private subnets, controlled egress, and WAF front-end.', progressCheckQuestion: 'A high-value first containment action for compromised cloud credentials is:', progressCheckOptions: ['Increase storage', 'Revoke or disable credentials immediately', 'Delete all logs', 'Restart user laptop'], correctOptionIndex: 1, progressCheckExplanation: 'Credential containment stops active abuse quickly.', quizQuestions: [{ question: 'WAF is primarily used to:', options: ['Assign IAM roles', 'Protect web applications from common attacks', 'Store encryption keys', 'Manage DNS zones'], correctOptionIndex: 1, explanation: 'WAF filters malicious HTTP patterns and abuse.' }, { question: 'Private endpoints help by:', options: ['Exposing services publicly', 'Keeping service traffic off public internet paths', 'Disabling encryption', 'Replacing IAM'], correctOptionIndex: 1, explanation: 'Private connectivity reduces exposure and interception risk.' }, { question: 'Cloud IR differs because it often uses:', options: ['Paper logs only', 'API-driven automated containment', 'No evidence collection', 'No identity actions'], correctOptionIndex: 1, explanation: 'Cloud APIs enable fast scripted containment actions.' }, { question: 'Immutable backups are valuable because:', options: ['They are cheaper only', 'They resist tampering and ransomware alteration', 'They remove need for DR tests', 'They disable encryption'], correctOptionIndex: 1, explanation: 'Immutability strengthens recovery reliability.' }] },
        { title: 'Compliance, Governance, and Security Posture', objective: 'Map controls to frameworks and operationalize continuous cloud assurance.', hours: 12, lesson: 'Part 1 - Governance Model: Define policy ownership and cloud guardrails. Part 2 - Framework Mapping: Align controls to ISO, SOC 2, and sector-specific requirements. Part 3 - Posture Management: Run continuous checks for drift and noncompliance. Part 4 - Evidence Automation: Collect artifacts for audits continuously. Part 5 - Risk Register: Track cloud-specific risks and remediation plans. Part 6 - Exception Handling: Document temporary deviations with expiry and owner. Part 7 - Executive Reporting: Translate technical findings into risk language. Part 8 - Maturity Roadmap: Plan staged improvements to cloud security capabilities.', workedExample: 'Prepare a cloud security audit packet for SOC 2 review.', workedExampleSteps: ['Map required controls to cloud services and owners.', 'Collect policy documents and technical evidence artifacts.', 'Export access and key-usage audit logs.', 'Validate remediation status for known findings.', 'Compile exceptions with approvals and expiry dates.', 'Deliver executive-ready risk summary and readiness status.'], commonMistake: 'Treating compliance as a one-time audit project instead of continuous operation.', practiceTask: 'Create a control-to-service matrix for 10 key cloud security controls.', progressCheckQuestion: 'Continuous posture management is used to detect:', progressCheckOptions: ['Only billing anomalies', 'Configuration drift and policy violations', 'Office attendance', 'Patch notes only'], correctOptionIndex: 1, progressCheckExplanation: 'Posture checks continuously identify drift and violations.', quizQuestions: [{ question: 'A security exception should include:', options: ['No expiry', 'Owner, justification, compensating control, and expiry date', 'Only ticket ID', 'Only severity score'], correctOptionIndex: 1, explanation: 'Exceptions require governance and accountability.' }, { question: 'Evidence automation improves audits by:', options: ['Reducing transparency', 'Producing consistent, timely proof of control operation', 'Eliminating controls', 'Replacing risk assessments'], correctOptionIndex: 1, explanation: 'Automated evidence reduces scramble and improves accuracy.' }, { question: 'Cloud governance guardrails are intended to:', options: ['Block all development', 'Prevent high-risk configurations by default', 'Disable logging', 'Replace IAM'], correctOptionIndex: 1, explanation: 'Guardrails reduce preventable security mistakes.' }, { question: 'Executive reporting should focus on:', options: ['Raw logs only', 'Business risk, trend, and remediation status', 'CLI syntax', 'Tool branding'], correctOptionIndex: 1, explanation: 'Leaders need risk-informed decisions, not raw telemetry.' }] }
      ],
      finalAssessment: [
        { question: 'Shared responsibility in cloud means:', options: ['Provider handles everything', 'Responsibilities are split by service model', 'Customer handles only passwords', 'No model exists'], correctOptionIndex: 1, explanation: 'Control ownership depends on IaaS/PaaS/SaaS context.' },
        { question: 'Most frequent cloud security root cause is:', options: ['Cooling faults', 'Misconfiguration and excessive privilege', 'Fiber break', 'GPU shortage'], correctOptionIndex: 1, explanation: 'Identity and config failures dominate breach reports.' },
        { question: 'Preferred credential model for workloads:', options: ['Static shared keys', 'Short-lived role credentials', 'Root account use', 'No auth'], correctOptionIndex: 1, explanation: 'Ephemeral role credentials reduce key leakage risk.' },
        { question: 'Explicit deny in IAM policy evaluation:', options: ['Is optional', 'Overrides allows', 'Applies only to guests', 'Disables logs'], correctOptionIndex: 1, explanation: 'Deny has precedence.' },
        { question: 'Managed secrets improve security by:', options: ['Embedding credentials in code', 'Centralizing rotation and access control', 'Disabling MFA', 'Increasing latency only'], correctOptionIndex: 1, explanation: 'Secret lifecycle governance reduces exposure.' },
        { question: 'WAF mainly protects:', options: ['Kernel memory', 'Web application HTTP attack surface', 'Storage costs', 'Backup integrity'], correctOptionIndex: 1, explanation: 'WAF filters malicious web traffic patterns.' },
        { question: 'Private service endpoints reduce:', options: ['IAM complexity only', 'Public exposure of service traffic', 'Need for monitoring', 'All latency'], correctOptionIndex: 1, explanation: 'Private paths keep traffic off public internet.' },
        { question: 'First action for compromised cloud keys:', options: ['Wait for maintenance', 'Revoke/disable credentials', 'Delete logs', 'Restart API gateway'], correctOptionIndex: 1, explanation: 'Credential containment is immediate priority.' },
        { question: 'Immutable backups are critical because they:', options: ['Reduce compute cost only', 'Resist ransomware tampering', 'Replace DR testing', 'Eliminate RPO'], correctOptionIndex: 1, explanation: 'Immutability strengthens trustworthy recovery.' },
        { question: 'Posture management primarily detects:', options: ['Office absence', 'Configuration drift and policy violations', 'Printer errors', 'Vendor invoices'], correctOptionIndex: 1, explanation: 'Continuous checks identify control drift early.' },
        { question: 'Cloud guardrails should:', options: ['Allow risky defaults', 'Block high-risk configurations by default', 'Disable all services', 'Ignore exceptions'], correctOptionIndex: 1, explanation: 'Preventive policy controls reduce common failures.' },
        { question: 'Security exceptions must include:', options: ['No owner', 'Owner, mitigation, and expiration', 'Only CVE ID', 'Only chat messages'], correctOptionIndex: 1, explanation: 'Exceptions require accountability and bounded duration.' },
        { question: 'Audit evidence automation helps by:', options: ['Removing controls', 'Producing timely and consistent proof of control operation', 'Replacing governance', 'Eliminating logs'], correctOptionIndex: 1, explanation: 'Evidence readiness supports continuous compliance.' },
        { question: 'Effective cloud risk reporting should be:', options: ['Tool-centric only', 'Business-risk oriented with trends and actions', 'Ad hoc', 'CLI-only'], correctOptionIndex: 1, explanation: 'Leaders need risk impact and remediation progress.' },
        { question: 'A mature cloud security program is:', options: ['One-time project', 'Continuous governance and improvement practice', 'Tool purchase only', 'Audit-season activity'], correctOptionIndex: 1, explanation: 'Security maturity depends on continuous operations.' }
      ],
      interviewPrep: ['Explain shared responsibility with IaaS/PaaS examples.', 'Describe how you design least-privilege IAM for a new cloud application.', 'Walk through replacing static credentials with role-based access.', 'Explain how you secure public web workloads with WAF and private backends.', 'Describe cloud-specific incident response actions for key compromise.', 'Explain why and how to implement secrets management and key rotation.', 'Discuss posture management and how you reduce configuration drift.', 'Describe your audit evidence strategy for SOC 2 cloud controls.', 'Explain how you prioritize cloud findings by risk and business impact.', 'Describe a governance guardrail you would enforce from day one.']
    });
  }

  if (/data.analyt/i.test(name)) {
    return buildCourse({
      courseTitle: 'Data Analytics',
      subtitle: 'Aligned to the Google Data Analytics pathway: Ask, Prepare, Process, Analyze, Share, and Act.',
      difficulty: 'Beginner',
      estimatedDuration: '12 weeks (7-8 hrs/week) | ~90 hours total',
      marketDemand: 'Data analysts are in high demand across business, finance, healthcare, and operations teams. Strong SQL and dashboarding skills are core hiring criteria.',
      overview: 'This pathway covers the full analytics lifecycle from business questioning to stakeholder action. Modules include foundations, data prep and SQL, analysis and visualization, and communication plus job readiness.',
      learningOutcomes: ['Frame business questions into measurable analytics objectives.', 'Clean and transform data using spreadsheet and SQL workflows.', 'Analyze trends and performance with reproducible queries.', 'Build clear dashboards and narrative visualizations.', 'Communicate findings with decision-focused storytelling.', 'Produce portfolio-ready analytics case studies.'],
      resumeSignals: ['Completed end-to-end analytics project from question to recommendation', 'Wrote SQL queries with joins, CTEs, and window functions', 'Built interactive dashboard with KPI trend views', 'Documented data-cleaning workflow and assumptions', 'Presented findings to non-technical stakeholders with action plan'],
      modules: [
        { title: 'Ask and Prepare: Analytics Foundations', objective: 'Define business problems, identify stakeholders, and plan data requirements.', hours: 22, lesson: 'Part 1 - Analytics Mindset: Move from opinions to evidence-based decision support. Part 2 - Ask Phase: Convert broad goals into SMART analytical questions. Part 3 - Stakeholders: Clarify who decides and what success looks like. Part 4 - Metrics: Choose leading and lagging indicators aligned to goals. Part 5 - Data Landscape: Inventory available internal and external data sources. Part 6 - Data Ethics: Address privacy, bias, and responsible use requirements. Part 7 - Scoping: Define timeline, assumptions, and constraints. Part 8 - Project Charter: Document objective, hypotheses, and deliverables.', workedExample: 'Define a retention-analysis project for a subscription app.', workedExampleSteps: ['Interview product and finance stakeholders.', 'Translate churn concern into measurable KPI questions.', 'Identify required event, billing, and support datasets.', 'Define segmentation dimensions and time windows.', 'Document assumptions and data limitations.', 'Publish project charter and analysis plan.'], commonMistake: 'Starting with dashboards before clarifying decisions and questions.', practiceTask: 'Write an analytics brief with 3 business questions and required data sources.', progressCheckQuestion: 'A strong analytics question should be:', progressCheckOptions: ['Vague and broad', 'Specific, measurable, and decision-oriented', 'Tool-focused', 'Based on one anecdote'], correctOptionIndex: 1, progressCheckExplanation: 'Clear questions drive useful analysis and recommendations.', quizQuestions: [{ question: 'Primary purpose of analytics is to:', options: ['Create more charts', 'Support better decisions with evidence', 'Store more data', 'Replace stakeholders'], correctOptionIndex: 1, explanation: 'Analytics informs decisions, not visuals alone.' }, { question: 'A KPI should be:', options: ['Unrelated to goals', 'Directly tied to business outcomes', 'Changed daily without reason', 'Private to analysts only'], correctOptionIndex: 1, explanation: 'KPIs must align to outcomes and accountability.' }, { question: 'Stakeholder alignment is important because:', options: ['It delays work', 'It ensures analysis answers the right business question', 'It removes need for data', 'It replaces SQL'], correctOptionIndex: 1, explanation: 'Misaligned questions lead to low-impact analysis.' }, { question: 'Data ethics includes:', options: ['Ignoring bias', 'Privacy, fairness, and responsible data use', 'Maximizing volume only', 'No documentation'], correctOptionIndex: 1, explanation: 'Responsible analytics includes governance and fairness.' }] },
        { title: 'Prepare and Process: SQL and Data Cleaning', objective: 'Clean, validate, and transform raw data into analysis-ready datasets.', hours: 22, lesson: 'Part 1 - Data Quality Dimensions: Evaluate completeness, accuracy, consistency, timeliness, and validity. Part 2 - Spreadsheet Cleaning: Standardize formats, remove duplicates, and handle missing values. Part 3 - SQL Foundations: SELECT, WHERE, GROUP BY, ORDER BY, and aggregation. Part 4 - Joins and Relationships: Combine tables correctly with key-awareness. Part 5 - CTEs and Subqueries: Build readable multi-step transformations. Part 6 - Window Functions: Use ranking and moving averages for trend insight. Part 7 - Validation Checks: Compare row counts, null rates, and control totals. Part 8 - Reproducibility: Save scripts and transformation logic for repeat runs.', workedExample: 'Clean and join sales, customer, and support tables to build monthly retention dataset.', workedExampleSteps: ['Profile data quality issues by table.', 'Normalize date and currency formats.', 'Deduplicate customer IDs with business rules.', 'Join tables and verify key uniqueness.', 'Build retention cohorts with SQL CTEs.', 'Validate outputs against finance control totals.'], commonMistake: 'Manual one-off cleaning with no reproducible script.', practiceTask: 'Write SQL to produce monthly active users by segment with quality checks.', progressCheckQuestion: 'A key benefit of SQL scripts over manual edits is:', progressCheckOptions: ['More colors in output', 'Reproducibility and auditability', 'No need for validation', 'Faster internet'], correctOptionIndex: 1, progressCheckExplanation: 'Scripts provide repeatable and reviewable transformations.', quizQuestions: [{ question: 'A LEFT JOIN returns:', options: ['Only matching right rows', 'All left rows plus matched right rows', 'Only unmatched rows', 'Cartesian product'], correctOptionIndex: 1, explanation: 'LEFT JOIN preserves all records from the left table.' }, { question: 'Window functions are useful for:', options: ['Deleting tables', 'Rankings and rolling calculations without collapsing detail', 'Setting permissions', 'Encrypting columns'], correctOptionIndex: 1, explanation: 'Window functions add analytic context across row partitions.' }, { question: 'Data validation should include:', options: ['No checks', 'Control totals and null-rate checks', 'Only chart review', 'Only formatting'], correctOptionIndex: 1, explanation: 'Validation prevents silent transformation errors.' }, { question: 'Deduplication rules should be:', options: ['Random', 'Documented and business-aligned', 'Hidden from team', 'Based on color'], correctOptionIndex: 1, explanation: 'Clear dedupe logic ensures trustworthy outputs.' }] },
        { title: 'Analyze and Share: Insight Generation and Visualization', objective: 'Perform analytical exploration and communicate insights through dashboards and narrative visuals.', hours: 23, lesson: 'Part 1 - Exploratory Analysis: Detect trends, anomalies, and segment behavior patterns. Part 2 - Comparative Analysis: Benchmark periods, cohorts, and groups. Part 3 - Statistical Basics: Understand distributions, variance, and simple significance checks. Part 4 - KPI Trees: Break top-line outcomes into driver metrics. Part 5 - Visualization Principles: Choose chart types by message and audience. Part 6 - Dashboard Design: Build clear layouts with hierarchy and filters. Part 7 - Storytelling: Frame insight, implication, and recommendation. Part 8 - Quality Review: Validate labels, definitions, and interpretation before sharing.', workedExample: 'Build churn dashboard showing retention trends, segment risk, and intervention opportunities.', workedExampleSteps: ['Calculate retention and churn rates by cohort.', 'Segment churn by plan, region, and tenure.', 'Visualize trend breaks and potential causal events.', 'Create dashboard filters for stakeholder exploration.', 'Write executive summary of key drivers.', 'Propose prioritized retention interventions.'], commonMistake: 'Presenting many charts without clear recommendation hierarchy.', practiceTask: 'Build a one-page dashboard with 5 KPIs and a short executive narrative.', progressCheckQuestion: 'A strong dashboard should prioritize:', progressCheckOptions: ['Maximum chart count', 'Decision clarity and KPI context', 'Complex colors only', 'Raw SQL text'], correctOptionIndex: 1, progressCheckExplanation: 'Dashboards should accelerate decisions, not overwhelm viewers.', quizQuestions: [{ question: 'Best chart for trend over time is often:', options: ['Pie chart', 'Line chart', 'Treemap', 'Word cloud'], correctOptionIndex: 1, explanation: 'Line charts show temporal movement clearly.' }, { question: 'A KPI tree helps by:', options: ['Adding animations', 'Connecting outcomes to underlying drivers', 'Replacing data cleaning', 'Reducing sample size'], correctOptionIndex: 1, explanation: 'Driver decomposition supports targeted actions.' }, { question: 'Good storytelling includes:', options: ['Only data dumps', 'Insight, implication, and recommendation', 'No business context', 'No assumptions'], correctOptionIndex: 1, explanation: 'Actionable communication links analysis to decisions.' }, { question: 'Before sharing results you should:', options: ['Skip QA', 'Validate metric definitions and values', 'Hide assumptions', 'Use random labels'], correctOptionIndex: 1, explanation: 'Quality checks protect credibility.' }] },
        { title: 'Act: Decision Support and Career Readiness', objective: 'Turn analysis into action plans and prepare portfolio and interview artifacts.', hours: 23, lesson: 'Part 1 - Decision Frameworks: Translate findings into options and tradeoffs. Part 2 - Action Planning: Define owners, timeline, and expected impact. Part 3 - Experimentation Basics: Use A/B principles for intervention validation. Part 4 - Communication Formats: Tailor updates for executives, operators, and technical peers. Part 5 - Portfolio Building: Package projects with data, method, and outcomes. Part 6 - Interview Preparation: Explain SQL choices and dashboard decisions clearly. Part 7 - Tool Expansion: Introduce Python pandas for scalable analysis workflows. Part 8 - Continuous Improvement: Establish feedback loops and post-implementation measurement.', workedExample: 'Deliver retention recommendation plan and define experiment success metrics.', workedExampleSteps: ['Prioritize top two interventions by expected impact.', 'Define success KPIs and guardrail metrics.', 'Create rollout and ownership plan.', 'Design A/B test and sample requirements.', 'Prepare executive readout and implementation checklist.', 'Track post-launch outcomes and iterate.'], commonMistake: 'Stopping at analysis without ownership and implementation plan.', practiceTask: 'Create a portfolio case-study page for one completed analytics project.', progressCheckQuestion: 'A recommendation is strongest when it includes:', progressCheckOptions: ['Only charts', 'Owner, timeline, KPI target, and risk notes', 'No assumptions', 'Only SQL script'], correctOptionIndex: 1, progressCheckExplanation: 'Execution details make recommendations actionable.', quizQuestions: [{ question: 'A/B testing is used to:', options: ['Store data', 'Measure causal impact of a change', 'Compress files', 'Assign permissions'], correctOptionIndex: 1, explanation: 'Experiments isolate effect of interventions.' }, { question: 'Portfolio case studies should emphasize:', options: ['Tool logos only', 'Problem, method, findings, impact', 'Raw data only', 'No business context'], correctOptionIndex: 1, explanation: 'Hiring managers assess end-to-end thinking and outcomes.' }, { question: 'Executive communication should be:', options: ['Deeply technical by default', 'Concise, decision-focused, and impact-oriented', 'Unstructured', 'Metric-free'], correctOptionIndex: 1, explanation: 'Leaders need implications and choices quickly.' }, { question: 'Post-implementation analytics should:', options: ['Be skipped', 'Measure actual impact and iterate', 'Only count page views', 'Avoid stakeholder feedback'], correctOptionIndex: 1, explanation: 'Closed-loop measurement validates value delivered.' }] }
      ],
      finalAssessment: [
        { question: 'Analytics Ask phase focuses on:', options: ['Tool setup only', 'Defining clear business questions', 'Chart styling', 'Data warehousing only'], correctOptionIndex: 1, explanation: 'Clear questions drive meaningful analysis.' },
        { question: 'A reproducible transformation workflow is best done with:', options: ['Manual copy-paste only', 'Documented SQL scripts', 'Screenshots', 'Untracked edits'], correctOptionIndex: 1, explanation: 'Scripts preserve repeatability and auditability.' },
        { question: 'A LEFT JOIN preserves:', options: ['Only right table rows', 'All rows from left table', 'Only matched rows from both', 'No nulls ever'], correctOptionIndex: 1, explanation: 'Left table rows remain even when right side is missing.' },
        { question: 'Window functions are ideal for:', options: ['Dropping tables', 'Running totals and rankings', 'User authentication', 'DNS updates'], correctOptionIndex: 1, explanation: 'Window functions compute analytics across partitions.' },
        { question: 'A dashboard should optimize for:', options: ['Visual complexity', 'Decision clarity', 'Animation density', 'Metric ambiguity'], correctOptionIndex: 1, explanation: 'Clarity and actionability are primary.' },
        { question: 'Storytelling in analytics requires:', options: ['Only charts', 'Insight plus implication plus recommendation', 'No assumptions', 'No audience context'], correctOptionIndex: 1, explanation: 'Narrative links evidence to action.' },
        { question: 'A KPI tree helps teams:', options: ['Hide drivers', 'Connect outcomes to operational levers', 'Eliminate data prep', 'Avoid stakeholders'], correctOptionIndex: 1, explanation: 'Driver mapping supports targeted interventions.' },
        { question: 'Best practice before sharing results:', options: ['Skip validation', 'Verify metric definitions and totals', 'Change units randomly', 'Remove caveats'], correctOptionIndex: 1, explanation: 'QA prevents avoidable credibility loss.' },
        { question: 'Strong recommendations include:', options: ['No owner', 'Owner, timeline, KPI target, and risk', 'Only screenshots', 'Only SQL'], correctOptionIndex: 1, explanation: 'Execution details increase implementation success.' },
        { question: 'A/B testing helps determine:', options: ['Data storage size', 'Whether an intervention caused observed change', 'Dashboard color quality', 'Schema naming'], correctOptionIndex: 1, explanation: 'Experiments improve causal confidence.' },
        { question: 'Portfolio case studies should present:', options: ['Tool list only', 'Problem, approach, result, and impact', 'No context', 'No outcomes'], correctOptionIndex: 1, explanation: 'End-to-end storytelling is hiring-relevant.' },
        { question: 'Post-launch measurement is used to:', options: ['Close project immediately', 'Validate impact and iterate', 'Delete data', 'Avoid stakeholders'], correctOptionIndex: 1, explanation: 'Continuous learning improves decisions over time.' },
        { question: 'Data ethics includes:', options: ['Ignore bias', 'Privacy, fairness, and responsible use', 'Collect everything forever', 'No governance'], correctOptionIndex: 1, explanation: 'Ethical practice is essential in analytics.' },
        { question: 'Control totals are used for:', options: ['Branding', 'Data validation after transformations', 'User access', 'Network uptime'], correctOptionIndex: 1, explanation: 'Control checks catch transformation errors.' },
        { question: 'Analysts create value when they:', options: ['Only build charts', 'Enable better decisions with evidence', 'Avoid recommendations', 'Hide assumptions'], correctOptionIndex: 1, explanation: 'Decision impact is the core outcome.' }
      ],
      interviewPrep: ['Describe an end-to-end analytics project from question to action.', 'Explain how you clean and validate messy data before analysis.', 'Walk through SQL choices in one project and why they were appropriate.', 'Describe a dashboard you built and the decisions it supported.', 'Explain how you handle conflicting stakeholder requests on metrics.', 'Discuss a time you changed recommendation after new evidence appeared.', 'Explain how you validate that post-launch impact is real.', 'Describe tradeoffs between speed and rigor in analysis timelines.', 'Show how you communicate uncertainty and assumptions to executives.', 'Explain what makes an analytics portfolio case study compelling.']
    });
  }

  if (/operations.manag/i.test(name)) {
    return buildCourse({
      courseTitle: 'Operations Management',
      subtitle: 'Aligned to APICS CPIM-style operations, planning, quality, and continuous improvement concepts.',
      difficulty: 'Intermediate',
      estimatedDuration: '7 weeks (7 hrs/week) | ~50 hours total',
      marketDemand: 'Operations leaders are needed across manufacturing, logistics, healthcare, and services to improve cost, speed, and quality outcomes.',
      overview: 'This pathway covers operations strategy, process and capacity planning, supply chain and inventory management, quality and Lean thinking, and KPI-driven improvement.',
      learningOutcomes: ['Map and improve end-to-end operating processes.', 'Apply demand and capacity planning methods.', 'Use inventory control techniques and service-level tradeoffs.', 'Implement Lean and quality improvement tools.', 'Track and manage operations KPIs effectively.', 'Lead operational change with structured execution.'],
      resumeSignals: ['Mapped and improved core fulfillment workflow reducing cycle time', 'Built demand planning model with forecast error tracking', 'Implemented ABC inventory policy and reorder controls', 'Led Lean waste-reduction initiative with measurable savings', 'Created operations KPI dashboard for leadership review'],
      modules: [
        { title: 'Operations Strategy and Process Design', objective: 'Align operations design to business strategy and customer outcomes.', hours: 12, lesson: 'Part 1 - Operations Role: Link process design to business value and customer experience. Part 2 - Process Mapping: Build SIPOC and swimlane maps for visibility. Part 3 - Capacity Concepts: Understand bottlenecks, utilization, and throughput. Part 4 - Constraint Management: Improve flow by addressing system bottlenecks. Part 5 - Standard Work: Document repeatable procedures for consistency. Part 6 - Variability: Reduce variation and rework in process steps. Part 7 - Service vs Manufacturing: Apply context-appropriate operating models. Part 8 - Governance: Define owners and review cadence for process health.', workedExample: 'Redesign order-to-fulfillment flow to reduce lead time and handoff delays.', workedExampleSteps: ['Map current-state process and handoffs.', 'Measure cycle time and queue delays.', 'Identify bottleneck stage and root causes.', 'Design future-state flow with reduced rework.', 'Define KPI targets and owners.', 'Pilot and monitor improvements for 4 weeks.'], commonMistake: 'Optimizing one department while harming end-to-end flow.', practiceTask: 'Create current-state and future-state process maps for a service workflow.', progressCheckQuestion: 'A process bottleneck is:', progressCheckOptions: ['Fastest step', 'Constraint limiting overall throughput', 'Any manual task', 'Any approval step'], correctOptionIndex: 1, progressCheckExplanation: 'System throughput is constrained by its bottleneck.', quizQuestions: [{ question: 'SIPOC helps teams:', options: ['Encrypt data', 'Define suppliers, inputs, process, outputs, customers', 'Build SQL models', 'Manage payroll'], correctOptionIndex: 1, explanation: 'SIPOC clarifies process boundaries and stakeholders.' }, { question: 'Throughput is best improved by:', options: ['Ignoring bottlenecks', 'Addressing the system constraint first', 'Adding random steps', 'Increasing meetings'], correctOptionIndex: 1, explanation: 'Constraint-focused improvement yields largest impact.' }, { question: 'Standard work is valuable because it:', options: ['Prevents training', 'Reduces variation and improves consistency', 'Removes accountability', 'Eliminates KPIs'], correctOptionIndex: 1, explanation: 'Consistent execution supports quality and scaling.' }, { question: 'Utilization near 100% often causes:', options: ['Lower wait times', 'Queue growth and delay risk', 'Perfect flow', 'No variability'], correctOptionIndex: 1, explanation: 'High utilization leaves little buffer for variability.' }] },
        { title: 'Supply Chain, Inventory, and Forecasting', objective: 'Manage inventory and planning decisions with service-level and cost tradeoffs.', hours: 13, lesson: 'Part 1 - Supply Chain Basics: Understand sourcing, production, and distribution dependencies. Part 2 - Inventory Roles: Separate cycle, safety, and pipeline inventory needs. Part 3 - ABC Classification: Prioritize control by item value and movement. Part 4 - Reorder Policies: Set reorder points and EOQ assumptions. Part 5 - Forecasting: Use trend and seasonality-aware methods. Part 6 - Forecast Accuracy: Track MAPE and bias over time. Part 7 - S&OP: Align demand and supply plans cross-functionally. Part 8 - Risk Buffers: Plan for supplier and transport uncertainty.', workedExample: 'Set inventory policy for 200 SKUs with service targets and lead-time risk.', workedExampleSteps: ['Classify SKUs by ABC value contribution.', 'Estimate demand variability and lead-time ranges.', 'Set safety stock targets by service level.', 'Define reorder points and review cadence.', 'Track stockout and carrying cost outcomes.', 'Adjust policy monthly using forecast error metrics.'], commonMistake: 'Using one inventory policy for all SKU classes.', practiceTask: 'Create ABC inventory table and propose reorder points for each class.', progressCheckQuestion: 'Safety stock is primarily used to:', progressCheckOptions: ['Increase storage cost only', 'Buffer demand or lead-time uncertainty', 'Replace forecasting', 'Eliminate supplier management'], correctOptionIndex: 1, progressCheckExplanation: 'Safety stock protects service levels under variability.', quizQuestions: [{ question: 'ABC analysis groups items by:', options: ['Color', 'Value and importance contribution', 'Shelf size', 'Supplier country only'], correctOptionIndex: 1, explanation: 'ABC enables differentiated control by business impact.' }, { question: 'MAPE measures:', options: ['Machine uptime', 'Forecast error magnitude in percentage terms', 'Inventory turns', 'Labor utilization'], correctOptionIndex: 1, explanation: 'MAPE tracks forecast accuracy quality.' }, { question: 'S&OP is used to:', options: ['Only approve invoices', 'Align demand, supply, and finance plans', 'Replace warehousing', 'Eliminate forecasts'], correctOptionIndex: 1, explanation: 'S&OP synchronizes cross-functional plans.' }, { question: 'Reorder point depends on:', options: ['Company logo', 'Demand during lead time plus safety stock', 'Office hours', 'Number of suppliers only'], correctOptionIndex: 1, explanation: 'ROP should cover expected demand and uncertainty.' }] },
        { title: 'Quality Management, Lean, and Six Sigma Basics', objective: 'Use structured quality and waste-reduction methods to improve process reliability.', hours: 13, lesson: 'Part 1 - Quality Concepts: Distinguish quality assurance versus quality control. Part 2 - Lean Principles: Identify and remove non-value-added work. Part 3 - 8 Wastes: Spot defects, waiting, motion, and overproduction patterns. Part 4 - Root Cause Tools: Use 5 Whys and fishbone diagrams. Part 5 - PDCA and DMAIC: Apply iterative improvement cycles. Part 6 - Process Capability Basics: Understand variation and defect trends. Part 7 - Control Plans: Sustain gains with standards and monitoring. Part 8 - Team Enablement: Build frontline participation in improvement work.', workedExample: 'Reduce return-processing defects through root-cause and control-plan redesign.', workedExampleSteps: ['Measure baseline defect and rework rates.', 'Run 5 Whys and fishbone with cross-functional team.', 'Pilot two corrective actions on high-volume lane.', 'Track defect rate changes and process adherence.', 'Document standard work updates and training.', 'Implement control chart monitoring and review cadence.'], commonMistake: 'Jumping to solutions without validated root-cause analysis.', practiceTask: 'Run a mini DMAIC on a recurring process defect and report results.', progressCheckQuestion: '5 Whys technique is used to:', progressCheckOptions: ['Forecast demand', 'Find underlying root cause', 'Design dashboards', 'Create contracts'], correctOptionIndex: 1, progressCheckExplanation: '5 Whys helps trace symptoms back to root causes.', quizQuestions: [{ question: 'Lean focuses on:', options: ['More approvals', 'Eliminating waste and improving flow', 'Higher inventory always', 'No standard work'], correctOptionIndex: 1, explanation: 'Lean targets non-value-added activity reduction.' }, { question: 'DMAIC stands for:', options: ['Design, Manage, Align, Integrate, Control', 'Define, Measure, Analyze, Improve, Control', 'Develop, Monitor, Assess, Improve, Check', 'Detect, Model, Act, Implement, Close'], correctOptionIndex: 1, explanation: 'DMAIC is the classic Six Sigma improvement structure.' }, { question: 'Fishbone diagram helps teams:', options: ['Encrypt logs', 'Categorize potential causes of a problem', 'Sort inventory', 'Assign passwords'], correctOptionIndex: 1, explanation: 'It organizes cause categories for root-cause exploration.' }, { question: 'Control plans are intended to:', options: ['End measurement', 'Sustain improvements over time', 'Avoid ownership', 'Replace training'], correctOptionIndex: 1, explanation: 'Controls keep gains from eroding.' }] },
        { title: 'Performance Management and Change Execution', objective: 'Use KPIs and structured change methods to sustain operational improvements.', hours: 12, lesson: 'Part 1 - KPI Design: Build balanced metrics for cost, speed, quality, and service. Part 2 - Dashboarding: Present trends and exceptions for rapid decisions. Part 3 - Governance Rhythm: Hold regular performance reviews with action tracking. Part 4 - Change Management: Address adoption risks and stakeholder resistance. Part 5 - Pilot and Scale: Validate changes before broad rollout. Part 6 - Capability Building: Train teams on new procedures and expectations. Part 7 - Benefits Tracking: Compare projected versus realized outcomes. Part 8 - Continuous Improvement Culture: Embed learning loops and ownership.', workedExample: 'Launch KPI governance for regional fulfillment with monthly improvement sprints.', workedExampleSteps: ['Define KPI dictionary and data source ownership.', 'Set target thresholds and escalation criteria.', 'Run first review meeting and assign action owners.', 'Pilot one workflow change in selected region.', 'Measure results and refine rollout plan.', 'Scale and institutionalize review cadence.'], commonMistake: 'Tracking too many KPIs without clear action thresholds.', practiceTask: 'Design an operations scorecard with five KPIs and escalation rules.', progressCheckQuestion: 'A useful KPI should be:', progressCheckOptions: ['Ambiguous and unowned', 'Clearly defined with owner and action threshold', 'Updated yearly only', 'Disconnected from goals'], correctOptionIndex: 1, progressCheckExplanation: 'Actionable KPI definitions drive execution quality.', quizQuestions: [{ question: 'Good performance governance requires:', options: ['No owners', 'Regular review cadence and action tracking', 'Only yearly meetings', 'No escalation logic'], correctOptionIndex: 1, explanation: 'Governance converts metrics into outcomes.' }, { question: 'Pilot-first rollout helps by:', options: ['Increasing risk', 'Validating changes before broad deployment', 'Avoiding measurement', 'Removing feedback'], correctOptionIndex: 1, explanation: 'Pilots reduce scale risk and improve design.' }, { question: 'Benefits tracking compares:', options: ['Colors and fonts', 'Expected versus realized outcomes', 'Only costs', 'Only headcount'], correctOptionIndex: 1, explanation: 'Outcome tracking confirms actual value delivered.' }, { question: 'Change resistance is reduced by:', options: ['No communication', 'Early stakeholder involvement and clear rationale', 'Sudden policy drops', 'Removing training'], correctOptionIndex: 1, explanation: 'Adoption improves with engagement and clarity.' }] }
      ],
      finalAssessment: [
        { question: 'A bottleneck is:', options: ['Fastest process step', 'Constraint limiting total throughput', 'Any manual task', 'Any report'], correctOptionIndex: 1, explanation: 'System flow is constrained by bottlenecks.' },
        { question: 'SIPOC is used to:', options: ['Encrypt process data', 'Define process boundaries and stakeholders', 'Run SQL joins', 'Manage DNS'], correctOptionIndex: 1, explanation: 'SIPOC maps supplier-input-output relationships.' },
        { question: 'Safety stock is intended to:', options: ['Increase waste', 'Buffer variability in demand or lead time', 'Eliminate forecasting', 'Replace replenishment'], correctOptionIndex: 1, explanation: 'Safety stock protects service-level targets.' },
        { question: 'ABC inventory classification prioritizes by:', options: ['Packaging type', 'Value and impact', 'Shelf location', 'Supplier logos'], correctOptionIndex: 1, explanation: 'ABC differentiates controls by business value.' },
        { question: 'MAPE is a metric for:', options: ['Machine health', 'Forecast error percentage', 'Employee retention', 'Network latency'], correctOptionIndex: 1, explanation: 'MAPE measures forecast accuracy.' },
        { question: 'Lean improvement focuses on:', options: ['More approvals', 'Waste elimination and flow improvement', 'Higher inventory by default', 'No standards'], correctOptionIndex: 1, explanation: 'Lean removes non-value-added work.' },
        { question: 'DMAIC includes:', options: ['Define, Measure, Analyze, Improve, Control', 'Deploy, Monitor, Archive, Integrate, Close', 'Design, Merge, Apply, Improve, Certify', 'Define, Measure, Assess, Inspect, Close'], correctOptionIndex: 0, explanation: 'DMAIC is the core Six Sigma cycle.' },
        { question: '5 Whys is used for:', options: ['Budgeting', 'Root-cause analysis', 'Forecasting', 'Capacity planning only'], correctOptionIndex: 1, explanation: '5 Whys surfaces underlying causes.' },
        { question: 'A strong KPI should have:', options: ['No owner', 'Definition, owner, and action threshold', 'Only a chart', 'No target'], correctOptionIndex: 1, explanation: 'Actionability requires ownership and thresholds.' },
        { question: 'Pilot before full rollout helps:', options: ['Increase rollout failure risk', 'Validate impact and reduce scale risk', 'Skip training', 'Delay all decisions'], correctOptionIndex: 1, explanation: 'Pilots enable safer implementation.' },
        { question: 'Constraint management suggests improving:', options: ['Random steps', 'The bottleneck first', 'Lowest-cost step only', 'Only reporting'], correctOptionIndex: 1, explanation: 'Improving constraints yields largest throughput gains.' },
        { question: 'Control plans are created to:', options: ['End monitoring', 'Sustain process gains', 'Avoid audits', 'Replace owners'], correctOptionIndex: 1, explanation: 'Control mechanisms maintain improvement over time.' },
        { question: 'S&OP aligns:', options: ['Only procurement', 'Demand, supply, and financial planning', 'Only warehouse shifts', 'Only transport rates'], correctOptionIndex: 1, explanation: 'S&OP coordinates cross-functional plans.' },
        { question: 'Benefit realization means:', options: ['Estimating gains only', 'Tracking actual outcomes after implementation', 'Closing project early', 'Skipping metrics'], correctOptionIndex: 1, explanation: 'Operational value must be measured, not assumed.' },
        { question: 'Change adoption improves with:', options: ['Silence and surprise', 'Clear communication, training, and stakeholder engagement', 'No governance', 'No feedback'], correctOptionIndex: 1, explanation: 'People adoption determines outcome durability.' }
      ],
      interviewPrep: ['Explain how you identify and manage process bottlenecks.', 'Describe an operations KPI scorecard you would implement first.', 'Walk through setting reorder points with uncertain demand.', 'Discuss how you prioritize improvement projects across teams.', 'Explain Lean waste categories with practical examples.', 'Describe a root-cause analysis you would run for recurring defects.', 'Explain how you sustain process improvements after pilot success.', 'Discuss S&OP and how it reduces cross-functional conflicts.', 'Describe tradeoffs between service level and inventory carrying cost.', 'Explain how you communicate operational risk to leadership.']
    });
  }

  if (/process.auto|rpa/i.test(name)) {
    return buildCourse({
      courseTitle: 'Process Automation (RPA)',
      subtitle: 'Aligned to UiPath-style RPA Associate concepts for building, testing, and deploying business automations.',
      difficulty: 'Beginner',
      estimatedDuration: '6 weeks (6-7 hrs/week) | ~40 hours total',
      marketDemand: 'RPA skills are in demand in finance, customer operations, HR, and compliance teams pursuing cost and cycle-time reduction.',
      overview: 'This pathway covers automation candidate selection, UiPath Studio workflows, data and document automation, and deployment/governance practices.',
      learningOutcomes: ['Identify high-value automation opportunities and assess feasibility.', 'Build UiPath workflows using sequences, flowcharts, and reusable components.', 'Automate data extraction and transformation from spreadsheets and web systems.', 'Implement exception handling and resilient selectors.', 'Test, deploy, and monitor bots in controlled environments.', 'Document automation ROI and handover runbooks.'],
      resumeSignals: ['Built end-to-end invoice-processing bot with exception handling', 'Automated web form data entry with resilient selectors', 'Integrated email and spreadsheet workflows in UiPath Studio', 'Implemented test cases and logs for bot reliability', 'Documented automation ROI and operational runbook'],
      modules: [
        { title: 'RPA Fundamentals and Process Selection', objective: 'Select and scope automation opportunities using value and feasibility criteria.', hours: 10, lesson: 'Part 1 - RPA Definition: Understand software bots for repetitive rule-based tasks. Part 2 - Candidate Criteria: Select high-volume, low-variance, stable processes. Part 3 - Process Mapping: Capture current-state steps and exceptions. Part 4 - Feasibility Assessment: Evaluate data quality, system stability, and access constraints. Part 5 - ROI Modeling: Estimate time savings, cost, and error reduction. Part 6 - Governance Basics: Define ownership and change-control expectations. Part 7 - Human-in-the-loop: Identify approval points and exception routing. Part 8 - Prioritization: Rank opportunities by impact and complexity.', workedExample: 'Evaluate accounts-payable invoice entry as first automation candidate.', workedExampleSteps: ['Map manual process and touchpoints.', 'Count monthly volume and average handling time.', 'List exception categories and rates.', 'Assess system stability and selector risk.', 'Estimate effort and expected ROI.', 'Recommend pilot scope and success criteria.'], commonMistake: 'Automating unstable processes without first simplifying them.', practiceTask: 'Score three candidate processes with impact/complexity matrix and choose one pilot.', progressCheckQuestion: 'Best first automation candidates are usually:', progressCheckOptions: ['Highly creative tasks', 'Rule-based, repetitive, high-volume workflows', 'Unstable processes with frequent policy change', 'Tasks requiring constant judgment'], correctOptionIndex: 1, progressCheckExplanation: 'RPA performs best on stable, rules-driven processes.', quizQuestions: [{ question: 'RPA is strongest for:', options: ['Strategic planning', 'Repetitive rule-based digital tasks', 'Art direction', 'Hardware repair'], correctOptionIndex: 1, explanation: 'Bots excel in deterministic repetitive workflows.' }, { question: 'A good automation feasibility check includes:', options: ['Logo review', 'Exception rates and system stability', 'Office seating plan', 'Server room temperature'], correctOptionIndex: 1, explanation: 'High exception rates can break brittle automations.' }, { question: 'ROI estimate should include:', options: ['Only software license cost', 'Time saved, error reduction, and maintenance effort', 'No assumptions', 'Only developer hours'], correctOptionIndex: 1, explanation: 'Balanced ROI includes benefit and ongoing support cost.' }, { question: 'Human-in-the-loop is used when:', options: ['No exceptions exist', 'Approvals or judgment steps are required', 'Bots replace all controls', 'Data is always clean'], correctOptionIndex: 1, explanation: 'Some steps should remain under human supervision.' }] },
        { title: 'UiPath Studio Workflow Development', objective: 'Build maintainable automation workflows with robust selectors and control flow.', hours: 10, lesson: 'Part 1 - Studio Basics: Understand projects, packages, and activity panels. Part 2 - Sequences and Flowcharts: Choose control structures by process complexity. Part 3 - Variables and Arguments: Manage data passing and scope cleanly. Part 4 - Selectors: Build stable selectors for UI automation resilience. Part 5 - Data Manipulation: Use assignments, loops, and conditions. Part 6 - Exception Handling: Apply try-catch and retry scopes. Part 7 - Logging: Emit actionable log messages for operations support. Part 8 - Reusability: Create modular components and shared workflows.', workedExample: 'Automate CRM record updates from daily CSV import.', workedExampleSteps: ['Read source CSV and validate required columns.', 'Loop through records and perform CRM lookup.', 'Update fields with conditional logic.', 'Handle missing-record exceptions and retries.', 'Log success and failure outcomes by record.', 'Export exception report for manual follow-up.'], commonMistake: 'Using brittle selectors tied to volatile UI attributes.', practiceTask: 'Build a workflow that reads spreadsheet rows and submits web form entries with retry logic.', progressCheckQuestion: 'Reliable selectors should prioritize:', progressCheckOptions: ['Dynamic random IDs', 'Stable attributes and hierarchy anchors', 'Color properties only', 'Screen coordinates'], correctOptionIndex: 1, progressCheckExplanation: 'Stable selectors reduce breakage after UI changes.', quizQuestions: [{ question: 'Try-catch blocks are used to:', options: ['Improve UI speed', 'Handle runtime exceptions gracefully', 'Store credentials', 'Build dashboards'], correctOptionIndex: 1, explanation: 'Exception handling preserves controlled workflow behavior.' }, { question: 'Flowcharts are most useful when:', options: ['No branching exists', 'Process contains multiple decisions and paths', 'Only one linear step exists', 'No variables are needed'], correctOptionIndex: 1, explanation: 'Flowcharts improve readability for branched logic.' }, { question: 'Retry scopes help with:', options: ['Permanent logic errors', 'Transient UI or timing failures', 'License tracking', 'File compression'], correctOptionIndex: 1, explanation: 'Retries handle intermittent automation flakiness.' }, { question: 'Good logging should include:', options: ['Only success messages', 'Context-rich messages for traceability', 'No timestamps', 'No identifiers'], correctOptionIndex: 1, explanation: 'Operational support depends on meaningful logs.' }] },
        { title: 'Data, Documents, and Integration Automation', objective: 'Automate document and data flows across files, email, and web systems.', hours: 10, lesson: 'Part 1 - Spreadsheet Automation: Read, transform, and write structured tabular data. Part 2 - Email Automation: Parse attachments, classify messages, and route actions. Part 3 - PDF and OCR Basics: Extract text from semi-structured documents. Part 4 - Web Data Extraction: Scrape table content and paginate safely. Part 5 - API Integration Concepts: Use REST calls for reliable machine interfaces when available. Part 6 - Data Validation: Enforce quality checks before downstream updates. Part 7 - Exception Queues: Route failures for human review. Part 8 - Security Hygiene: Protect credentials and sensitive data in automation pipelines.', workedExample: 'Automate inbound invoice email triage and ERP entry preparation.', workedExampleSteps: ['Monitor mailbox for invoice subject patterns.', 'Extract attachments and OCR key fields.', 'Validate vendor and amount format rules.', 'Append valid entries to ERP import sheet.', 'Route invalid items to exception queue.', 'Send summary report to operations owner.'], commonMistake: 'Automating OCR-heavy documents without confidence thresholds and review queues.', practiceTask: 'Build an email-to-spreadsheet automation with validation and exception routing.', progressCheckQuestion: 'When OCR confidence is low, best practice is to:', progressCheckOptions: ['Force auto-posting', 'Route to human validation', 'Delete record', 'Retry forever'], correctOptionIndex: 1, progressCheckExplanation: 'Low-confidence extraction should be human-reviewed to avoid bad data propagation.', quizQuestions: [{ question: 'API-based automation is often preferred because:', options: ['Harder to maintain', 'More stable than UI scraping when interfaces are available', 'No authentication needed', 'No logging required'], correctOptionIndex: 1, explanation: 'APIs reduce UI fragility and improve reliability.' }, { question: 'Exception queues are useful for:', options: ['Hiding failures', 'Separating cases requiring manual review', 'Increasing bot errors', 'Disabling alerts'], correctOptionIndex: 1, explanation: 'Queues create controlled handling for non-happy paths.' }, { question: 'Data validation before posting is important to:', options: ['Slow down bots', 'Prevent downstream data quality issues', 'Remove governance', 'Avoid logs'], correctOptionIndex: 1, explanation: 'Validation reduces costly correction work later.' }, { question: 'Credential storage should use:', options: ['Plain text files', 'Secure vault/credential manager', 'Shared spreadsheet', 'Code comments'], correctOptionIndex: 1, explanation: 'Secrets must be centrally managed and protected.' }] },
        { title: 'Testing, Deployment, and RPA Operations', objective: 'Test automations, deploy safely, and operate bots with governance and monitoring.', hours: 10, lesson: 'Part 1 - Test Design: Define positive, negative, and edge-case scenarios. Part 2 - UAT: Validate business acceptance with process owners. Part 3 - Deployment Pipelines: Promote bots from dev to test to production. Part 4 - Scheduling: Configure orchestrated bot runs and dependencies. Part 5 - Monitoring: Track run success rate, duration, and exception trends. Part 6 - Incident Handling: Respond to bot failures with clear runbooks. Part 7 - Change Management: Version workflows and manage release approvals. Part 8 - Value Tracking: Measure realized savings and quality outcomes over time.', workedExample: 'Deploy invoice bot to production with schedule, alerts, and rollback plan.', workedExampleSteps: ['Create test suite for core and exception paths.', 'Execute UAT with AP operations users.', 'Package release and deploy via orchestrator.', 'Configure schedule and failure alert notifications.', 'Monitor first-week runs and tune selectors.', 'Document rollback and support runbook.'], commonMistake: 'Skipping UAT and discovering process exceptions in production.', practiceTask: 'Create an RPA deployment checklist including tests, approvals, rollback, and monitoring metrics.', progressCheckQuestion: 'A production-ready bot should have:', progressCheckOptions: ['No logging', 'Test coverage, monitoring, and rollback plan', 'Only happy-path script', 'Manual passwords in code'], correctOptionIndex: 1, progressCheckExplanation: 'Operational readiness requires testing, observability, and recovery plans.', quizQuestions: [{ question: 'UAT confirms:', options: ['Developer preferences', 'Business process acceptance and readiness', 'Network topology', 'License type'], correctOptionIndex: 1, explanation: 'UAT validates real-world fit and expected outcomes.' }, { question: 'Rollback plans are needed because:', options: ['Deployments never fail', 'Changes can introduce unexpected failures', 'Bots self-heal always', 'Monitoring is optional'], correctOptionIndex: 1, explanation: 'Rollback reduces downtime and business disruption risk.' }, { question: 'Key operational metric for RPA is:', options: ['Font size', 'Run success rate and exception volume', 'Desk occupancy', 'Email signature length'], correctOptionIndex: 1, explanation: 'Reliability and exception trends indicate operational health.' }, { question: 'Version control in RPA helps:', options: ['Increase random edits', 'Track changes and support safe releases', 'Remove approvals', 'Disable testing'], correctOptionIndex: 1, explanation: 'Versioning improves governance and traceability.' }] }
      ],
      finalAssessment: [
        { question: 'Best first automation candidates are:', options: ['Creative tasks', 'Rule-based repetitive workflows', 'Unstable judgment-heavy tasks', 'Undefined processes'], correctOptionIndex: 1, explanation: 'RPA excels where rules are clear and repeatable.' },
        { question: 'Process mapping before automation is important to:', options: ['Add delays', 'Identify steps, exceptions, and improvement opportunities', 'Avoid ROI analysis', 'Replace testing'], correctOptionIndex: 1, explanation: 'Mapping prevents automating broken workflows.' },
        { question: 'Stable selectors should avoid:', options: ['Anchored attributes', 'Volatile dynamic IDs', 'Hierarchy context', 'Consistent labels'], correctOptionIndex: 1, explanation: 'Dynamic IDs often break after UI updates.' },
        { question: 'Exception handling in bots uses:', options: ['No controls', 'Try-catch and retry patterns', 'Only screenshots', 'Manual edits only'], correctOptionIndex: 1, explanation: 'Structured handling keeps bots resilient.' },
        { question: 'OCR low-confidence records should:', options: ['Auto-post immediately', 'Go to human review queue', 'Be deleted', 'Be ignored'], correctOptionIndex: 1, explanation: 'Human review protects data quality.' },
        { question: 'API integrations are often preferred because:', options: ['Less stable', 'More reliable than UI automation when available', 'No auth needed', 'No testing needed'], correctOptionIndex: 1, explanation: 'APIs reduce fragility and improve consistency.' },
        { question: 'Credential best practice for bots is:', options: ['Plain text in script', 'Secure vault-managed secrets', 'Shared spreadsheet', 'Hardcoded constants'], correctOptionIndex: 1, explanation: 'Secret management is mandatory for secure automation.' },
        { question: 'UAT primarily validates:', options: ['Developer style', 'Business readiness and expected outcomes', 'Network speed', 'Licensing terms'], correctOptionIndex: 1, explanation: 'UAT confirms practical process fit.' },
        { question: 'A deployment rollback plan is needed because:', options: ['Deployments cannot fail', 'Unexpected production issues can occur', 'Bots never change', 'Monitoring replaces rollback'], correctOptionIndex: 1, explanation: 'Rollback reduces operational risk during release.' },
        { question: 'RPA monitoring should track:', options: ['Theme color', 'Success rate, duration, and exceptions', 'Keyboard type', 'Office location'], correctOptionIndex: 1, explanation: 'These metrics indicate reliability and support load.' },
        { question: 'Version control supports:', options: ['Untracked edits', 'Traceable releases and safer collaboration', 'No approvals', 'No testing'], correctOptionIndex: 1, explanation: 'Versioning provides auditability and release safety.' },
        { question: 'Human-in-the-loop is useful when:', options: ['No exceptions exist', 'Judgment or approval is required', 'All data is perfect', 'No governance is needed'], correctOptionIndex: 1, explanation: 'Certain decisions should remain with humans.' },
        { question: 'A strong RPA runbook includes:', options: ['Only screenshots', 'Dependencies, failure modes, recovery steps, and owners', 'No contacts', 'No schedule details'], correctOptionIndex: 1, explanation: 'Runbooks enable reliable operations handoff.' },
        { question: 'ROI tracking after go-live should:', options: ['Stop immediately', 'Compare expected vs actual savings and quality outcomes', 'Ignore exceptions', 'Measure only login count'], correctOptionIndex: 1, explanation: 'Value realization must be verified post-deployment.' },
        { question: 'Automation governance prevents:', options: ['Any innovation', 'Uncontrolled changes and operational risk', 'All maintenance', 'All exceptions'], correctOptionIndex: 1, explanation: 'Governance balances speed with reliability and control.' }
      ],
      interviewPrep: ['Describe how you choose the first process to automate and why.', 'Walk through building a resilient selector strategy in UiPath.', 'Explain exception-handling design for a bot with variable input quality.', 'Describe when to use API integration instead of UI automation.', 'Explain how you test an automation before production release.', 'Discuss how you measure bot performance and business impact.', 'Describe a rollback plan for failed bot deployment.', 'Explain governance controls needed for enterprise RPA programs.', 'Discuss how you document handoff for operations support teams.', 'Explain a case where automation should not be used.']
    });
  }


    if (name === 'csec english a') {
      return buildCourse({
        courseTitle: 'CSEC English A',
        subtitle: 'Comprehension, grammar, and essay writing with practical testing.',
        marketDemand: 'Strong English performance supports scholarships, interviews, and almost every profession.',
        overview: 'This course teaches CSEC English A as a skill course: read critically, write clearly, and revise effectively.',
        learningOutcomes: [
          'Answer comprehension questions with evidence from passages.',
          'Use grammar and punctuation accurately in formal writing.',
          'Structure expository and argumentative essays effectively.',
          'Edit and improve weak writing under timed conditions.'
        ],
        modules: [
          {
            title: 'Reading Comprehension Strategies',
            objective: 'Find main idea, tone, and supporting evidence in passages.',
            lesson: 'Annotate key phrases, identify author intent, and quote directly to support answers.',
            workedExample: 'If a question asks for evidence, include a short quote and explain its meaning.',
            commonMistake: 'Answering from memory instead of referencing the passage.',
            practiceTask: 'Read one short passage and write two evidence-based responses.',
            progressCheckQuestion: 'What should you include in a strong comprehension answer?',
            progressCheckOptions: ['Only your opinion', 'A quote or detail from the passage', 'A longer question', 'A list of synonyms'],
            correctOptionIndex: 1,
            progressCheckExplanation: 'Strong answers reference and explain passage evidence.'
          },
          {
            title: 'Grammar and Sentence Control',
            objective: 'Apply subject-verb agreement, tense consistency, and punctuation correctly.',
            lesson: 'Check each sentence for one clear subject, correct tense, and punctuation that clarifies meaning.',
            workedExample: 'He go to school daily should be He goes to school daily.',
            commonMistake: 'Mixing past and present tenses in the same paragraph.',
            practiceTask: 'Rewrite five incorrect sentences into correct standard English.',
            progressCheckQuestion: 'Choose the correct sentence.',
            progressCheckOptions: ['She walk to class every day.', 'She walks to class every day.', 'She walking to class every day.', 'She walked to class every day now.'],
            correctOptionIndex: 1,
            progressCheckExplanation: 'Singular subject she takes singular present verb walks.'
          },
          {
            title: 'Essay Structure and Development',
            objective: 'Write clear introductions, body paragraphs, and conclusions.',
            lesson: 'Use one main idea per paragraph and support it with explanation and examples.',
            workedExample: 'A strong paragraph starts with a topic sentence, then evidence, then analysis.',
            commonMistake: 'Listing points without explaining why they matter.',
            practiceTask: 'Draft a five-paragraph essay outline on a school-related topic.',
            progressCheckQuestion: 'What is the main role of a topic sentence?',
            progressCheckOptions: ['To end the essay', 'To introduce the paragraph main idea', 'To add quotations only', 'To repeat the question'],
            correctOptionIndex: 1,
            progressCheckExplanation: 'The topic sentence guides the focus of that paragraph.'
          },
          {
            title: 'Editing and Timed Writing',
            objective: 'Improve writing quality under exam time constraints.',
            lesson: 'Reserve final minutes to edit for clarity, grammar, and repetition.',
            workedExample: 'Replace weak words like nice with specific descriptive vocabulary.',
            commonMistake: 'Submitting first draft without proofreading.',
            practiceTask: 'Write a timed 25-minute response and spend 5 minutes editing.',
            progressCheckQuestion: 'What is the best final step before submitting an essay?',
            progressCheckOptions: ['Add more random adjectives', 'Check grammar, clarity, and structure', 'Delete the conclusion', 'Rewrite the question'],
            correctOptionIndex: 1,
            progressCheckExplanation: 'Editing catches avoidable errors and improves marks.'
          }
        ],
        finalAssessment: [
          { question: 'Best evidence in comprehension should come from:', options: ['Your memory', 'The passage text', 'A different article', 'Class notes only'], correctOptionIndex: 1, explanation: 'Use direct evidence from the passage.' },
          { question: 'Choose the correct sentence.', options: ['They was late.', 'They were late.', 'They is late.', 'They be late.'], correctOptionIndex: 1, explanation: 'Plural subject takes were.' },
          { question: 'A body paragraph should include:', options: ['Only one sentence', 'Topic sentence and support', 'Only a quote', 'Only conclusion'], correctOptionIndex: 1, explanation: 'Good paragraphs include claim and support.' },
          { question: 'What improves exam writing most at the end?', options: ['Ignoring punctuation', 'Quick proofreading', 'Changing topic', 'Removing introduction'], correctOptionIndex: 1, explanation: 'Proofreading improves correctness and clarity.' }
        ]
      });
    }

    if (name === 'csec information technology') {
      return buildCourse({
        courseTitle: 'CSEC Information Technology',
        subtitle: 'Digital systems, productivity tools, and applied IT problem-solving.',
        marketDemand: 'IT competence is foundational for modern office, technical, and remote roles.',
        overview: 'This course teaches practical CSEC IT skills through hands-on concepts and checks.',
        modules: [
          { title: 'Computer Systems and Components', objective: 'Identify hardware, software, and system roles.', lesson: 'Understand input, process, output, and storage in real workflows.', workedExample: 'Keyboard is input, CPU processes, monitor outputs, SSD stores.', commonMistake: 'Confusing system software and application software.', practiceTask: 'Classify 10 common devices as input/output/storage/processing.', progressCheckQuestion: 'Which is an example of system software?', progressCheckOptions: ['Word processor', 'Operating system', 'Spreadsheet', 'Presentation app'], correctOptionIndex: 1, progressCheckExplanation: 'Operating systems manage hardware and software resources.' },
          { title: 'Spreadsheets and Data Handling', objective: 'Use formulas and basic analysis functions.', lesson: 'Use SUM, AVERAGE, IF, and sorting for structured data decisions.', workedExample: 'SUM(B2:B10) totals a sales column quickly and accurately.', commonMistake: 'Typing results manually instead of using formulas.', practiceTask: 'Build a grade sheet with averages and pass/fail logic.', progressCheckQuestion: 'Which formula calculates the average in cells C1 to C5?', progressCheckOptions: ['=TOTAL(C1:C5)', '=AVG(C1:C5)', '=AVERAGE(C1:C5)', '=MEAN(C1:C5)'], correctOptionIndex: 2, progressCheckExplanation: 'AVERAGE is the standard spreadsheet function.' },
          { title: 'Networking and Cyber Safety', objective: 'Understand network types and safe digital practices.', lesson: 'Know LAN/WAN basics and apply password, phishing, and data safety habits.', workedExample: 'A school lab network is usually LAN; internet is WAN.', commonMistake: 'Reusing weak passwords across platforms.', practiceTask: 'Create a cyber-safety checklist for students.', progressCheckQuestion: 'Which is the safest password practice?', progressCheckOptions: ['Use birthday only', 'Use one password everywhere', 'Use long unique passwords', 'Share password with friends'], correctOptionIndex: 2, progressCheckExplanation: 'Unique long passwords reduce breach risk.' },
          { title: 'Problem Solving and Algorithm Basics', objective: 'Break tasks into step-by-step logic.', lesson: 'Use flowchart-style thinking: input, process, output, decision.', workedExample: 'Student grade program: input marks, compute average, output grade.', commonMistake: 'Skipping edge-case checks before final output.', practiceTask: 'Write pseudocode to classify scores as pass/fail.', progressCheckQuestion: 'An algorithm is best described as:', progressCheckOptions: ['A random guess', 'A step-by-step procedure', 'A hardware device', 'A network cable'], correctOptionIndex: 1, progressCheckExplanation: 'Algorithms are ordered procedures for solving problems.' }
        ],
        finalAssessment: [
          { question: 'Which item is an output device?', options: ['Keyboard', 'Scanner', 'Monitor', 'Microphone'], correctOptionIndex: 2, explanation: 'Monitor displays output.' },
          { question: 'Which function returns an average?', options: ['=SUM()', '=AVERAGE()', '=COUNT()', '=IF()'], correctOptionIndex: 1, explanation: 'AVERAGE computes mean value.' },
          { question: 'LAN stands for:', options: ['Long Access Node', 'Local Area Network', 'Linked Application Network', 'Logical Array Network'], correctOptionIndex: 1, explanation: 'LAN means Local Area Network.' },
          { question: 'A strong password is:', options: ['Short and simple', 'Same on all sites', 'Unique and complex', 'Shared with team'], correctOptionIndex: 2, explanation: 'Unique complexity improves security.' }
        ]
      });
    }

    if (name === 'csec principles of accounts' || name === 'cape accounting') {
      const isCape = name.includes('cape');
      return buildCourse({
        courseTitle: isCape ? 'CAPE Accounting' : 'CSEC Principles of Accounts',
        subtitle: isCape ? 'Financial statements, controls, and analysis for advanced accounting.' : 'Double entry, ledgers, and financial statement basics.',
        difficulty: isCape ? 'Advanced' : 'Intermediate',
        marketDemand: 'Accounting skills are in demand across business, finance, and entrepreneurship.',
        overview: 'This course teaches accounting through transactions, controls, and reporting decisions.',
        modules: [
          { title: 'Double Entry Principles', objective: 'Record transactions with correct debit/credit logic.', lesson: 'Every transaction affects at least two accounts while keeping records balanced.', workedExample: 'Cash sale increases Cash (Dr) and Sales (Cr).', commonMistake: 'Posting both sides of entry to the same direction.', practiceTask: 'Journalize five simple business transactions.', progressCheckQuestion: 'In double entry, each transaction must:', progressCheckOptions: ['Affect one account only', 'Balance debits and credits', 'Use cash account only', 'Avoid ledger posting'], correctOptionIndex: 1, progressCheckExplanation: 'Debits must equal credits for each transaction.' },
          { title: 'Ledgers and Trial Balance', objective: 'Post journal entries and prepare trial balance.', lesson: 'Transfer entries to ledger accounts and verify arithmetic accuracy with trial balance.', workedExample: 'Ledger posting groups transactions by account before statement preparation.', commonMistake: 'Using wrong account titles or mismatched balances.', practiceTask: 'Post a short journal set to ledgers and extract trial balance.', progressCheckQuestion: 'Main purpose of trial balance is to:', progressCheckOptions: ['Calculate tax only', 'Check debit-credit equality', 'Replace financial statements', 'Record inventory counts'], correctOptionIndex: 1, progressCheckExplanation: 'Trial balance checks arithmetic consistency of postings.' },
          { title: isCape ? 'Financial Reporting and Adjustments' : 'Income Statement and Balance Sheet', objective: isCape ? 'Apply accruals, depreciation, and adjustments.' : 'Prepare basic end-of-period statements.', lesson: isCape ? 'Adjustments ensure statements reflect true period performance and position.' : 'Summarize income, expenses, assets, liabilities, and equity correctly.', workedExample: isCape ? 'Prepaid expense adjustment reduces current period expense.' : 'Profit equals revenue minus expenses.', commonMistake: 'Mixing capital and revenue items.', practiceTask: isCape ? 'Prepare adjusted entries for depreciation and accruals.' : 'Prepare simple income statement from trial balance.', progressCheckQuestion: 'Profit is calculated as:', progressCheckOptions: ['Assets - liabilities', 'Revenue - expenses', 'Cash - drawings', 'Sales + expenses'], correctOptionIndex: 1, progressCheckExplanation: 'Profit measures net operating result of the period.' },
          { title: 'Controls and Decision Use', objective: 'Use accounting records to support business decisions.', lesson: 'Interpret ratios and trends to evaluate performance and risk.', workedExample: 'Gross profit margin helps compare efficiency across periods.', commonMistake: 'Relying on one metric without context.', practiceTask: 'Compute and interpret gross profit margin from sample data.', progressCheckQuestion: 'Accounting information is most useful when it is:', progressCheckOptions: ['Late and incomplete', 'Accurate and timely', 'Unverified and informal', 'Hidden from managers'], correctOptionIndex: 1, progressCheckExplanation: 'Decision-making needs accurate and timely information.' }
        ],
        finalAssessment: [
          { question: 'In double entry, total debits must:', options: ['Exceed credits', 'Equal credits', 'Ignore credits', 'Be posted yearly only'], correctOptionIndex: 1, explanation: 'Balance is a core accounting rule.' },
          { question: 'Trial balance helps detect:', options: ['All fraud automatically', 'Debit-credit imbalances', 'Cash theft only', 'Inventory quality'], correctOptionIndex: 1, explanation: 'It checks arithmetic posting equality.' },
          { question: 'Profit equals:', options: ['Revenue - expenses', 'Assets - liabilities', 'Capital + drawings', 'Expenses - revenue'], correctOptionIndex: 0, explanation: 'Net profit is revenue less expenses.' },
          { question: 'Best quality of financial info is:', options: ['Vague and delayed', 'Accurate and timely', 'Unstructured', 'Private to one person'], correctOptionIndex: 1, explanation: 'Useful information must be accurate and timely.' }
        ]
      });
    }

    if (name === 'cape biology' || name === 'cape chemistry' || name === 'cape economics' || name === 'communication studies') {
      if (name === 'cape biology') {
        return buildCourse({
          courseTitle: 'CAPE Biology',
          subtitle: 'Cells, genetics, physiology, and ecology for advanced science readiness.',
          marketDemand: 'Biology supports nursing, medicine, laboratory science, and public health pathways.',
          overview: 'This course teaches CAPE Biology through concept links, examples, and objective checks.',
          modules: [
            { title: 'Cell Structure and Function', objective: 'Explain organelles and transport processes.', lesson: 'Connect each organelle to its role in cellular survival and efficiency.', workedExample: 'Mitochondria support ATP production for active transport.', commonMistake: 'Listing organelles without function relationships.', practiceTask: 'Match five organelles to key functions.', progressCheckQuestion: 'Which organelle is primarily responsible for ATP production?', progressCheckOptions: ['Nucleus', 'Mitochondrion', 'Ribosome', 'Golgi body'], correctOptionIndex: 1, progressCheckExplanation: 'Mitochondria produce ATP in aerobic respiration.' },
            { title: 'Genetics and Inheritance', objective: 'Apply genotype-phenotype and inheritance patterns.', lesson: 'Use Punnett squares to model probability of offspring traits.', workedExample: 'Hh x Hh gives 1 HH : 2 Hh : 1 hh genotype ratio.', commonMistake: 'Confusing dominant trait frequency with genotype frequency.', practiceTask: 'Complete one monohybrid cross and explain probabilities.', progressCheckQuestion: 'A heterozygous cross Hh x Hh yields what chance of hh?', progressCheckOptions: ['0%', '25%', '50%', '75%'], correctOptionIndex: 1, progressCheckExplanation: 'One of four outcomes is hh in monohybrid cross.' },
            { title: 'Human Physiology', objective: 'Explain homeostasis and system interactions.', lesson: 'Understand how nervous, endocrine, respiratory, and circulatory systems coordinate.', workedExample: 'During exercise, breathing and heart rate increase to meet oxygen demand.', commonMistake: 'Treating systems as isolated rather than interdependent.', practiceTask: 'Trace oxygen pathway from inhalation to cellular use.', progressCheckQuestion: 'Homeostasis means:', progressCheckOptions: ['Permanent body temperature rise', 'Stable internal conditions', 'Only digestion', 'Only blood pressure control'], correctOptionIndex: 1, progressCheckExplanation: 'Homeostasis maintains internal balance.' },
            { title: 'Ecology and Sustainability', objective: 'Analyze ecosystems, energy flow, and human impact.', lesson: 'Use food chains/webs and population interactions to explain ecosystem changes.', workedExample: 'Removing a predator can increase prey population and destabilize vegetation.', commonMistake: 'Ignoring indirect effects in ecosystem change.', practiceTask: 'Draw a local food web and identify two human-impact risks.', progressCheckQuestion: 'Primary producers in ecosystems are usually:', progressCheckOptions: ['Carnivores', 'Plants and algae', 'Top predators', 'Decomposers only'], correctOptionIndex: 1, progressCheckExplanation: 'Producers convert light to chemical energy.' }
          ],
          finalAssessment: [
            { question: 'ATP is mainly produced in:', options: ['Nucleus', 'Mitochondria', 'Lysosome', 'Chloroplast'], correctOptionIndex: 1, explanation: 'Mitochondria are ATP production sites.' },
            { question: 'Hh x Hh gives hh probability of:', options: ['25%', '50%', '75%', '100%'], correctOptionIndex: 0, explanation: 'One of four genotype outcomes is hh.' },
            { question: 'Homeostasis refers to:', options: ['Growth only', 'Stable internal conditions', 'Genetic mutation', 'Protein synthesis only'], correctOptionIndex: 1, explanation: 'Homeostasis keeps internal conditions stable.' },
            { question: 'Producers are:', options: ['Predators', 'Plants/algae', 'Decomposers only', 'Scavengers'], correctOptionIndex: 1, explanation: 'Producers form ecosystem energy base.' }
          ]
        });
      }

      if (name === 'cape chemistry') {
        return buildCourse({
          courseTitle: 'CAPE Chemistry',
          subtitle: 'Atomic structure, bonding, calculations, and reaction analysis.',
          marketDemand: 'Chemistry supports medicine, pharmacy, engineering, and lab-science tracks.',
          overview: 'This course teaches CAPE Chemistry with exam-style methods and checks.',
          modules: [
            { title: 'Atomic Structure and Periodicity', objective: 'Relate electron arrangement to chemical behavior.', lesson: 'Use periodic trends to predict reactivity and bonding tendencies.', workedExample: 'Group I metals lose one electron easily and are highly reactive.', commonMistake: 'Confusing atomic number with mass number.', practiceTask: 'Compare periodic trends for radius and ionization energy.', progressCheckQuestion: 'Atomic number equals the number of:', progressCheckOptions: ['Neutrons', 'Protons', 'Electrons plus neutrons', 'Nucleons only'], correctOptionIndex: 1, progressCheckExplanation: 'Atomic number is defined by proton count.' },
            { title: 'Bonding and Structure', objective: 'Distinguish ionic, covalent, and metallic bonding.', lesson: 'Identify bond type from element properties and electronegativity differences.', workedExample: 'NaCl forms ionic bonds through electron transfer.', commonMistake: 'Classifying all compounds with nonmetals as ionic.', practiceTask: 'Classify ten compounds by dominant bond type.', progressCheckQuestion: 'Which compound is mainly ionic?', progressCheckOptions: ['H2O', 'CO2', 'NaCl', 'CH4'], correctOptionIndex: 2, progressCheckExplanation: 'NaCl is ionic due to metal-nonmetal electron transfer.' },
            { title: 'Stoichiometry', objective: 'Use mole relationships in balanced equations.', lesson: 'Convert between mass, moles, and particles to solve reaction quantities.', workedExample: 'Moles = mass / molar mass.', commonMistake: 'Using unbalanced equations for mole ratio problems.', practiceTask: 'Calculate moles in 18 g of water.', progressCheckQuestion: 'Molar mass of H2O is:', progressCheckOptions: ['16 g/mol', '18 g/mol', '20 g/mol', '2 g/mol'], correctOptionIndex: 1, progressCheckExplanation: '2(1) + 16 = 18 g/mol.' },
            { title: 'Acids, Bases, and Titration', objective: 'Interpret pH and neutralization calculations.', lesson: 'Acids donate H+, bases accept H+ or produce OH- in aqueous solutions.', workedExample: 'Strong acid plus strong base can produce salt and water.', commonMistake: 'Assuming all acids are equally strong.', practiceTask: 'Solve one neutralization calculation from sample titration data.', progressCheckQuestion: 'pH values below 7 are:', progressCheckOptions: ['Basic', 'Neutral', 'Acidic', 'Always strong only'], correctOptionIndex: 2, progressCheckExplanation: 'pH below 7 indicates acidic solution.' }
          ],
          finalAssessment: [
            { question: 'Atomic number represents:', options: ['Neutron count', 'Proton count', 'Mass number', 'Electron shells'], correctOptionIndex: 1, explanation: 'Proton count defines element identity.' },
            { question: 'NaCl bonding is mainly:', options: ['Covalent', 'Metallic', 'Ionic', 'Hydrogen'], correctOptionIndex: 2, explanation: 'Electron transfer gives ionic bond.' },
            { question: 'Molar mass of H2O is:', options: ['16', '18', '20', '2'], correctOptionIndex: 1, explanation: 'Water molar mass is 18 g/mol.' },
            { question: 'A solution with pH 3 is:', options: ['Neutral', 'Basic', 'Acidic', 'Buffer only'], correctOptionIndex: 2, explanation: 'pH less than 7 is acidic.' }
          ]
        });
      }

      if (name === 'cape economics') {
        return buildCourse({
          courseTitle: 'CAPE Economics',
          subtitle: 'Micro and macro concepts for policy and business decisions.',
          marketDemand: 'Economics supports strategy, policy, business, and finance pathways.',
          overview: 'This course teaches CAPE Economics with practical decision-focused examples and tests.',
          modules: [
            { title: 'Demand, Supply, and Equilibrium', objective: 'Model price/quantity behavior in markets.', lesson: 'Demand slopes downward, supply slopes upward; intersection gives equilibrium.', workedExample: 'If demand rises and supply is fixed, price tends to increase.', commonMistake: 'Confusing movement along curve with curve shift.', practiceTask: 'Draw demand/supply shifts for two market scenarios.', progressCheckQuestion: 'A rightward shift in demand usually causes:', progressCheckOptions: ['Lower price', 'Higher equilibrium price', 'No change', 'Immediate shortage of money'], correctOptionIndex: 1, progressCheckExplanation: 'Higher demand increases equilibrium price ceteris paribus.' },
            { title: 'Elasticity', objective: 'Calculate and interpret elasticity values.', lesson: 'Elasticity measures responsiveness of quantity to price or income changes.', workedExample: 'If quantity changes a lot from small price change, demand is elastic.', commonMistake: 'Using absolute change instead of percentage change.', practiceTask: 'Classify elasticity from sample percentage data.', progressCheckQuestion: 'Price elasticity greater than 1 means:', progressCheckOptions: ['Inelastic demand', 'Unit elastic demand', 'Elastic demand', 'No relationship'], correctOptionIndex: 2, progressCheckExplanation: 'Values above 1 indicate elastic demand.' },
            { title: 'Macroeconomic Indicators', objective: 'Interpret GDP, inflation, and unemployment trends.', lesson: 'Use indicators together to evaluate economic performance, not in isolation.', workedExample: 'High inflation with low growth can reduce purchasing power.', commonMistake: 'Treating GDP growth alone as complete welfare measure.', practiceTask: 'Review a data table and identify major macro risks.', progressCheckQuestion: 'Inflation primarily tracks:', progressCheckOptions: ['Employment count', 'General price level change', 'Export quantity only', 'Interest payments only'], correctOptionIndex: 1, progressCheckExplanation: 'Inflation is change in general price level.' },
            { title: 'Fiscal and Monetary Policy', objective: 'Evaluate policy tools and expected effects.', lesson: 'Governments use fiscal policy; central banks use monetary policy to stabilize economy.', workedExample: 'Higher interest rates can reduce borrowing-driven demand.', commonMistake: 'Assuming one policy tool solves every macro problem quickly.', practiceTask: 'Propose one fiscal and one monetary response for high inflation.', progressCheckQuestion: 'Who usually controls monetary policy?', progressCheckOptions: ['Schools', 'Central bank', 'Private firms', 'Tourism board'], correctOptionIndex: 1, progressCheckExplanation: 'Central banks set key monetary tools.' }
          ],
          finalAssessment: [
            { question: 'Demand and supply intersection gives:', options: ['Elasticity point', 'Equilibrium', 'GDP', 'Inflation rate'], correctOptionIndex: 1, explanation: 'Intersection determines equilibrium.' },
            { question: 'Elasticity > 1 implies:', options: ['Inelastic', 'Elastic', 'Unitary only', 'No demand'], correctOptionIndex: 1, explanation: 'Above 1 means elastic response.' },
            { question: 'Inflation measures:', options: ['Job quality', 'General price level changes', 'Population growth', 'Interest income'], correctOptionIndex: 1, explanation: 'Inflation tracks price level movement.' },
            { question: 'Monetary policy is typically managed by:', options: ['Parliament only', 'Central bank', 'Private NGOs', 'Courts'], correctOptionIndex: 1, explanation: 'Central bank controls key monetary levers.' }
          ]
        });
      }

      return buildCourse({
        courseTitle: 'Communication Studies',
        subtitle: 'Audience analysis, message design, and effective delivery.',
        marketDemand: 'Communication skills are critical in leadership, business, media, and service roles.',
        overview: 'This course teaches communication as a practical performance skill with assessments.',
        modules: [
          { title: 'Audience and Purpose', objective: 'Adapt message to audience needs and context.', lesson: 'Define who you are speaking to and what action you want from them.', workedExample: 'A formal presentation needs different language than peer discussion.', commonMistake: 'Using same tone for all audiences.', practiceTask: 'Rewrite one message for teacher, peer, and employer audiences.', progressCheckQuestion: 'Best first step before preparing a speech is:', progressCheckOptions: ['Choose fancy words', 'Identify audience and purpose', 'Memorize random facts', 'Design slides first'], correctOptionIndex: 1, progressCheckExplanation: 'Audience and purpose guide all message choices.' },
          { title: 'Structure and Clarity', objective: 'Organize openings, body points, and closing effectively.', lesson: 'Use clear transitions and one key message per section.', workedExample: 'Tell them what you will say, say it, then summarize.', commonMistake: 'Jumping between points without transitions.', practiceTask: 'Create a 3-point speaking outline for a social issue.', progressCheckQuestion: 'A clear closing should:', progressCheckOptions: ['Introduce new major ideas', 'Summarize key message and call to action', 'Ignore audience', 'Repeat opening only'], correctOptionIndex: 1, progressCheckExplanation: 'Strong closings reinforce purpose and action.' },
          { title: 'Verbal and Non-Verbal Delivery', objective: 'Improve voice, pacing, and body language.', lesson: 'Control pace, eye contact, posture, and emphasis for confidence and clarity.', workedExample: 'Pausing briefly after key points improves listener retention.', commonMistake: 'Speaking too fast and avoiding eye contact.', practiceTask: 'Record a 2-minute presentation and self-evaluate delivery.', progressCheckQuestion: 'Effective pacing helps because it:', progressCheckOptions: ['Confuses listeners', 'Improves understanding', 'Removes key points', 'Eliminates need for structure'], correctOptionIndex: 1, progressCheckExplanation: 'Clear pacing helps audience follow ideas.' },
          { title: 'Critical Media and Argumentation', objective: 'Evaluate claims and evidence in public communication.', lesson: 'Differentiate facts, opinions, and weak reasoning patterns.', workedExample: 'A claim without verifiable evidence should be questioned.', commonMistake: 'Accepting persuasive tone as proof.', practiceTask: 'Analyze one article and identify claim, evidence, and assumptions.', progressCheckQuestion: 'A strong argument needs:', progressCheckOptions: ['Only emotion', 'Clear claim with evidence', 'Loud delivery', 'Complex vocabulary only'], correctOptionIndex: 1, progressCheckExplanation: 'Evidence-backed claims are core to strong argumentation.' }
        ],
        finalAssessment: [
          { question: 'Before writing a speech, identify:', options: ['Slide colors', 'Audience and purpose', 'Quotes only', 'Background music'], correctOptionIndex: 1, explanation: 'Audience and purpose determine strategy.' },
          { question: 'A strong conclusion should:', options: ['Add unrelated ideas', 'Summarize and call to action', 'End abruptly', 'Repeat every sentence'], correctOptionIndex: 1, explanation: 'Conclusions reinforce key message.' },
          { question: 'Good pacing in speaking:', options: ['Reduces comprehension', 'Improves comprehension', 'Removes confidence', 'Increases confusion'], correctOptionIndex: 1, explanation: 'Pacing supports audience processing.' },
          { question: 'Strong arguments require:', options: ['Evidence', 'Only emotion', 'Only speed', 'Only visuals'], correctOptionIndex: 0, explanation: 'Evidence supports validity of claims.' }
        ]
      });
    }

    if (name === 'heart customer service' || name === 'heart practical nursing support' || name === 'nvq-j electrical installation' || name === 'nvq-j welding and fabrication') {
      if (name === 'heart customer service') {
        return buildCourse({
          courseTitle: 'HEART Customer Service',
          subtitle: 'Service standards, communication, and issue resolution skills.',
          marketDemand: 'Customer service competence supports BPO, hospitality, retail, and front-office work.',
          overview: 'This course trains practical customer-facing behaviors and quality outcomes.',
          modules: [
            { title: 'Service Fundamentals', objective: 'Apply professional service standards consistently.', lesson: 'Use greeting, listening, clarity, and closure structure in every interaction.', workedExample: 'Confirm the customer issue before proposing a solution.', commonMistake: 'Responding before fully understanding customer concern.', practiceTask: 'Role-play three customer interaction openings.', progressCheckQuestion: 'Best first service behavior is to:', progressCheckOptions: ['Interrupt quickly', 'Listen and confirm issue', 'Transfer immediately', 'Use scripted apology only'], correctOptionIndex: 1, progressCheckExplanation: 'Listening and confirmation prevent misunderstanding.' },
            { title: 'Complaint Handling and Recovery', objective: 'De-escalate issues and resolve professionally.', lesson: 'Use empathy, clear next steps, and time expectations to rebuild trust.', workedExample: 'A calm acknowledgment plus timeline lowers frustration quickly.', commonMistake: 'Defensive language that blames the customer.', practiceTask: 'Write a 5-step recovery response for delayed service.', progressCheckQuestion: 'In complaint recovery, you should first:', progressCheckOptions: ['Blame policy', 'Acknowledge concern', 'End the call', 'Ignore emotion'], correctOptionIndex: 1, progressCheckExplanation: 'Acknowledgment opens the path to resolution.' },
            { title: 'Professional Communication', objective: 'Use clear, respectful, and concise language.', lesson: 'Short, specific messages reduce errors and improve customer confidence.', workedExample: 'State what will happen, by when, and who is responsible.', commonMistake: 'Using vague timelines like soon with no date/time.', practiceTask: 'Rewrite three unclear messages into clear service updates.', progressCheckQuestion: 'A clear service update should include:', progressCheckOptions: ['No timeline', 'Action and timeline', 'Only apology', 'Only customer name'], correctOptionIndex: 1, progressCheckExplanation: 'Action + timeline creates confidence.' },
            { title: 'Quality and Performance', objective: 'Track service quality using measurable indicators.', lesson: 'Use first-response time, resolution rate, and customer satisfaction to improve performance.', workedExample: 'Weekly review of repeat complaints can reveal process gaps.', commonMistake: 'Focusing only on speed while ignoring resolution quality.', practiceTask: 'Create a mini quality dashboard with three KPIs.', progressCheckQuestion: 'Which metric best reflects solved issues?', progressCheckOptions: ['Call volume only', 'Resolution rate', 'Shift length', 'Email count only'], correctOptionIndex: 1, progressCheckExplanation: 'Resolution rate reflects outcome quality.' }
          ],
          finalAssessment: [
            { question: 'Best first step in service call is:', options: ['Argue quickly', 'Listen and confirm need', 'Transfer immediately', 'Ignore tone'], correctOptionIndex: 1, explanation: 'Understanding first improves resolution quality.' },
            { question: 'Complaint handling starts with:', options: ['Defending policy', 'Acknowledgment and empathy', 'Closing call', 'Escalation always'], correctOptionIndex: 1, explanation: 'Empathy and acknowledgment de-escalate conflict.' },
            { question: 'Clear update should include:', options: ['No action', 'Action and timeline', 'Only apology', 'Only greeting'], correctOptionIndex: 1, explanation: 'Customers need concrete next steps.' },
            { question: 'Resolution quality is best tracked by:', options: ['Shift hours', 'Resolution rate', 'Desk location', 'Login time'], correctOptionIndex: 1, explanation: 'Resolution rate captures solved outcomes.' }
          ]
        });
      }

      if (name === 'heart practical nursing support') {
        return buildCourse({
          courseTitle: 'HEART Practical Nursing Support',
          subtitle: 'Patient care basics, safety, communication, and documentation.',
          marketDemand: 'Practical nursing support skills are needed in clinics, care homes, and hospitals.',
          overview: 'This course teaches safe and professional patient-support fundamentals.',
          modules: [
            { title: 'Infection Prevention and Hygiene', objective: 'Apply basic infection control procedures.', lesson: 'Hand hygiene, PPE use, and clean technique reduce transmission risk.', workedExample: 'Handwashing before and after each patient contact is mandatory.', commonMistake: 'Touching clean surfaces with contaminated gloves.', practiceTask: 'List and practice 6 hand hygiene moments.', progressCheckQuestion: 'Most effective routine infection control action is:', progressCheckOptions: ['Skipping gloves', 'Frequent hand hygiene', 'Reusing masks all week', 'Avoiding documentation'], correctOptionIndex: 1, progressCheckExplanation: 'Hand hygiene is core infection prevention practice.' },
            { title: 'Basic Patient Observation', objective: 'Observe and report patient condition changes accurately.', lesson: 'Record vital signs and escalate unusual findings promptly.', workedExample: 'A sudden breathing change should be reported immediately.', commonMistake: 'Delaying escalation when signs are abnormal.', practiceTask: 'Practice recording and reporting a mock vital-sign chart.', progressCheckQuestion: 'If a patient shows sudden distress, you should:', progressCheckOptions: ['Wait until shift ends', 'Report immediately to supervisor', 'Ignore and continue routine', 'Only write it later'], correctOptionIndex: 1, progressCheckExplanation: 'Rapid escalation protects patient safety.' },
            { title: 'Patient Communication and Dignity', objective: 'Communicate respectfully and protect patient dignity.', lesson: 'Use clear explanations, consent language, and privacy-centered behavior.', workedExample: 'Explain each care step before performing it.', commonMistake: 'Discussing patient details in public spaces.', practiceTask: 'Role-play respectful communication in two care scenarios.', progressCheckQuestion: 'Good patient communication should be:', progressCheckOptions: ['Rushed and unclear', 'Clear and respectful', 'Only technical', 'Non-verbal only'], correctOptionIndex: 1, progressCheckExplanation: 'Patients need clarity and respect for trust and safety.' },
            { title: 'Documentation and Handover', objective: 'Record care actions clearly for continuity.', lesson: 'Accurate notes and concise handovers reduce treatment errors.', workedExample: 'Document time, observation, action, and who was informed.', commonMistake: 'Using vague notes without times or actions.', practiceTask: 'Complete one structured handover note from a sample case.', progressCheckQuestion: 'Strong handover notes should include:', progressCheckOptions: ['Guesswork only', 'Clear observations and actions', 'No timing', 'Only personal opinions'], correctOptionIndex: 1, progressCheckExplanation: 'Clear factual records support continuity of care.' }
          ],
          finalAssessment: [
            { question: 'Key infection prevention routine is:', options: ['Skipping PPE', 'Regular hand hygiene', 'Avoiding cleaning', 'Sharing gloves'], correctOptionIndex: 1, explanation: 'Hand hygiene is essential.' },
            { question: 'Sudden patient distress requires:', options: ['Delayed reporting', 'Immediate escalation', 'No action', 'Shift-end note only'], correctOptionIndex: 1, explanation: 'Immediate escalation protects patient.' },
            { question: 'Respectful care communication is:', options: ['Clear and respectful', 'Fast and vague', 'Silent only', 'Technical jargon only'], correctOptionIndex: 0, explanation: 'Patients need understandable respectful communication.' },
            { question: 'Good documentation should be:', options: ['Vague', 'Timed and factual', 'Opinion-only', 'Optional'], correctOptionIndex: 1, explanation: 'Factual timed notes improve continuity.' }
          ]
        });
      }

      if (name === 'nvq-j electrical installation') {
        return buildCourse({
          courseTitle: 'NVQ-J Electrical Installation',
          subtitle: 'Safety, circuit fundamentals, wiring practice, and testing.',
          marketDemand: 'Electrical installation skills support construction, facilities, and technical migration pathways.',
          overview: 'This course teaches practical electrical installation foundations with trade-safe discipline.',
          modules: [
            { title: 'Electrical Safety and Regulations', objective: 'Apply foundational safety procedures consistently.', lesson: 'Lockout/tagout, insulation checks, and PPE use prevent severe accidents.', workedExample: 'Always isolate supply before touching conductors.', commonMistake: 'Testing live circuits without proper isolation protocol.', practiceTask: 'Create a pre-work safety checklist for a simple installation task.', progressCheckQuestion: 'First step before electrical work is to:', progressCheckOptions: ['Start wiring immediately', 'Isolate and verify supply is off', 'Measure current with bare hands', 'Skip PPE'], correctOptionIndex: 1, progressCheckExplanation: 'Isolation and verification are mandatory before work.' },
            { title: 'Circuit Fundamentals', objective: 'Understand current, voltage, resistance, and simple circuits.', lesson: 'Use Ohm law relationships and component roles to troubleshoot basic systems.', workedExample: 'V = I x R links voltage, current, and resistance.', commonMistake: 'Confusing series and parallel behavior.', practiceTask: 'Solve three basic Ohm law calculation problems.', progressCheckQuestion: 'Ohm law is:', progressCheckOptions: ['P = IV', 'V = IR', 'E = mc^2', 'F = ma'], correctOptionIndex: 1, progressCheckExplanation: 'V = IR is the core Ohm law formula.' },
            { title: 'Wiring and Installation Practice', objective: 'Execute basic domestic wiring correctly.', lesson: 'Follow wiring diagrams and maintain neat, secure terminations.', workedExample: 'Proper color coding supports safe maintenance and fault tracing.', commonMistake: 'Loose terminations causing overheating risk.', practiceTask: 'Draft a wiring plan for one light and one socket circuit.', progressCheckQuestion: 'A poor connection commonly causes:', progressCheckOptions: ['Better efficiency', 'Overheating', 'Lower resistance always', 'No effect'], correctOptionIndex: 1, progressCheckExplanation: 'Loose/poor connections can overheat and fail.' },
            { title: 'Testing and Fault Finding', objective: 'Use basic test procedures for continuity and safety.', lesson: 'Test continuity, insulation, and polarity before handover.', workedExample: 'Continuity confirms complete path in intended conductors.', commonMistake: 'Skipping tests after installation work.', practiceTask: 'Prepare a test report template for simple circuit checks.', progressCheckQuestion: 'Testing should be done:', progressCheckOptions: ['Only if fault appears', 'Before handover every time', 'Never on small jobs', 'Only by customer'], correctOptionIndex: 1, progressCheckExplanation: 'Testing is mandatory before commissioning/handover.' }
          ],
          finalAssessment: [
            { question: 'Before electrical work, first action is:', options: ['Begin wiring', 'Isolate and verify supply', 'Skip PPE', 'Touch conductors'], correctOptionIndex: 1, explanation: 'Isolation and verification first.' },
            { question: 'Ohm law is:', options: ['V=IR', 'P=IV only', 'Q=mcΔT', 'F=ma'], correctOptionIndex: 0, explanation: 'V=IR relates voltage, current, resistance.' },
            { question: 'Loose terminations often cause:', options: ['Cooling', 'Overheating', 'No effect', 'Automatic grounding'], correctOptionIndex: 1, explanation: 'Poor contact increases heat risk.' },
            { question: 'Circuit testing should occur:', options: ['Before handover', 'Only if asked', 'Never', 'After payment only'], correctOptionIndex: 0, explanation: 'Test before handover to ensure safety.' }
          ]
        });
      }

      return buildCourse({
        courseTitle: 'NVQ-J Welding and Fabrication',
        subtitle: 'Safety, welding process control, joint prep, and quality inspection.',
        marketDemand: 'Welding and fabrication skills support construction, manufacturing, and industrial maintenance roles.',
        overview: 'This course teaches practical welding/fabrication fundamentals with quality-focused testing.',
        modules: [
          { title: 'Workshop Safety and Setup', objective: 'Apply PPE and workshop safety standards.', lesson: 'Control sparks, fumes, heat, and workspace hazards before work begins.', workedExample: 'Face shield, gloves, and proper ventilation are baseline requirements.', commonMistake: 'Ignoring ventilation and fume management.', practiceTask: 'Perform a complete pre-weld safety setup checklist.', progressCheckQuestion: 'Essential welding PPE includes:', progressCheckOptions: ['Open shoes', 'Face shield and gloves', 'No eye protection', 'Short sleeves only'], correctOptionIndex: 1, progressCheckExplanation: 'Face and hand protection are essential.' },
          { title: 'Joint Preparation and Fit-up', objective: 'Prepare clean, accurate joints before welding.', lesson: 'Good fit-up and material prep determine weld quality before arc starts.', workedExample: 'Remove rust/oil to avoid weak contaminated welds.', commonMistake: 'Welding over dirty metal surfaces.', practiceTask: 'Prepare and align two sample joints for butt and fillet welds.', progressCheckQuestion: 'Clean metal surfaces are important because they:', progressCheckOptions: ['Reduce weld quality', 'Improve weld integrity', 'Increase contamination', 'Have no impact'], correctOptionIndex: 1, progressCheckExplanation: 'Clean prep improves penetration and strength.' },
          { title: 'Welding Technique and Control', objective: 'Control angle, speed, and heat input for consistent welds.', lesson: 'Maintain correct torch/electrode angle and travel speed for bead quality.', workedExample: 'Too slow travel can overheat and deform material.', commonMistake: 'Inconsistent speed producing uneven bead shape.', practiceTask: 'Run three practice beads while adjusting speed and angle.', progressCheckQuestion: 'Excessively slow travel speed can cause:', progressCheckOptions: ['Cooler weld only', 'Overheating and distortion', 'No change', 'Automatic perfect bead'], correctOptionIndex: 1, progressCheckExplanation: 'Slow travel increases heat input and distortion risk.' },
          { title: 'Inspection and Rework', objective: 'Identify weld defects and apply corrective steps.', lesson: 'Inspect for porosity, undercut, cracks, and incomplete fusion.', workedExample: 'Visible porosity often indicates shielding or contamination issues.', commonMistake: 'Accepting cosmetic bead appearance without structural inspection.', practiceTask: 'Inspect sample welds and document at least three defects and corrections.', progressCheckQuestion: 'A key quality step after welding is:', progressCheckOptions: ['Skip inspection', 'Inspect and document defects', 'Paint immediately only', 'Store tools only'], correctOptionIndex: 1, progressCheckExplanation: 'Inspection validates quality and safety before release.' }
        ],
        finalAssessment: [
          { question: 'Core welding PPE is:', options: ['Face shield and gloves', 'No eye protection', 'Open shoes', 'Short sleeves only'], correctOptionIndex: 0, explanation: 'Proper PPE is mandatory for safety.' },
          { question: 'Clean joint surfaces generally:', options: ['Reduce weld quality', 'Improve weld quality', 'Cause defects', 'Do nothing'], correctOptionIndex: 1, explanation: 'Clean prep improves bond quality.' },
          { question: 'Very slow travel speed can lead to:', options: ['Better cooling', 'Overheating/distortion', 'No effect', 'Perfect weld always'], correctOptionIndex: 1, explanation: 'Slow speed increases heat input.' },
          { question: 'After welding, you should:', options: ['Skip checks', 'Inspect for defects', 'Ignore porosity', 'Only paint'], correctOptionIndex: 1, explanation: 'Inspection ensures structural quality.' }
        ]
      });
    }

    return null;
  }

  function getLocalCurriculumCourse(topicName) {
    const name = String(topicName || '').trim();
    if (!name) return null;

    for (const pack of LOCAL_CURRICULUM_COURSES) {
      const patterns = asArray(pack?.match);
      if (patterns.some((pattern) => pattern instanceof RegExp && pattern.test(name))) {
        return pack.course ? JSON.parse(JSON.stringify(pack.course)) : null;
      }
    }
    return buildSubjectTemplateCourse(name);
  }

  function applyLocalCurriculumOverrides(remoteCourse, topicName) {
    const curated = getLocalCurriculumCourse(topicName)
      || getLocalCurriculumCourse(remoteCourse?.courseTitle)
      || getLocalCurriculumCourse(remoteCourse?.topic);

    if (!curated) return remoteCourse;

    return {
      ...(remoteCourse || {}),
      ...curated,
      modules: asArray(curated.modules).length ? curated.modules : asArray(remoteCourse?.modules),
      finalAssessment: asArray(curated.finalAssessment).length ? curated.finalAssessment : asArray(remoteCourse?.finalAssessment)
    };
  }

  function apiPath(path) {
    return typeof apiUrl === 'function' ? apiUrl(path) : path;
  }

  function getToken() {
    return (typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token')) || '';
  }

  function asArray(value) {
    return Array.isArray(value)
      ? value.filter((item) => item !== null && item !== undefined && item !== '')
      : [];
  }

  function renderList(target, items) {
    if (!target) return;
    const list = asArray(items);
    if (!list.length) {
      target.innerHTML = '<li>No details available yet.</li>';
      return;
    }
    target.innerHTML = list.map((item) => `<li style="margin-bottom:8px;">${escapeHtml(String(item))}</li>`).join('');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderStructuredLessonHtml(lessonText) {
    const text = String(lessonText || '').trim();
    if (!text) {
      return '<div style="color:#9fb0c7;font-size:0.92rem;line-height:1.6;">Lesson details will appear here.</div>';
    }

    const normalized = text
      .replace(/\s+(Week\s+\d+\s*-)/gi, '||$1')
      .replace(/\s+(Part\s+\d+\s*-)/gi, '||$1');
    const segments = normalized
      .split('||')
      .map((segment) => String(segment || '').trim())
      .filter(Boolean);

    if (!segments.length || segments.length === 1) {
      return `<p style="margin:0;color:#d0d9e7;line-height:1.7;">${escapeHtml(text)}</p>`;
    }

    return `
      <ul style="margin:0;padding-left:18px;color:#d0d9e7;line-height:1.62;display:grid;gap:8px;">
        ${segments.map((segment) => `<li>${escapeHtml(segment)}</li>`).join('')}
      </ul>
    `;
  }

  function getBestVoice(voices) {
    if (!Array.isArray(voices) || !voices.length) return null;

    const noveltyPatterns = [
      /bad news/i,
      /bahh/i,
      /bells/i,
      /boing/i,
      /bubbles/i,
      /jester/i,
      /organ/i,
      /trinoids/i,
      /whisper/i,
      /wobble/i,
      /zarvox/i,
      /superstar/i,
      /junior/i
    ];

    const preferredNames = [
      /samantha/i,
      /karen/i,
      /moira/i,
      /daniel/i,
      /google us english/i,
      /microsoft.*aria/i,
      /microsoft.*jenny/i,
      /alloy/i,
      /nova/i
    ];

    const scored = voices.map((voice) => {
      const name = String(voice?.name || '');
      const lang = String(voice?.lang || '').toLowerCase();
      let score = 0;

      if (/^en[-_]/i.test(lang)) score += 15;
      if (voice?.localService) score += 3;
      if (preferredNames.some((pattern) => pattern.test(name))) score += 20;
      if (noveltyPatterns.some((pattern) => pattern.test(name))) score -= 30;

      return { voice, score };
    });

    scored.sort((left, right) => right.score - left.score);
    return scored[0]?.voice || voices[0] || null;
  }

  function populateVoiceOptions() {
    if (!audioVoiceSelect || !window.speechSynthesis) return;
    const voices = window.speechSynthesis.getVoices()
      .filter((voice) => voice && voice.name)
      .sort((left, right) => String(left.name).localeCompare(String(right.name)));

    audioState.voices = voices;
    const rememberedVoice = String(localStorage.getItem(AUDIO_VOICE_PREF_KEY) || '').trim();
    const previousSelection = audioState.selectedVoice || audioVoiceSelect.value || rememberedVoice || '';
    const options = ['<option value="">System Default</option>']
      .concat(voices.map((voice) => `<option value="${String(voice.voiceURI || voice.name)}">${String(voice.name)}${voice.lang ? ` (${voice.lang})` : ''}</option>`));

    audioVoiceSelect.innerHTML = options.join('');
    const hasPrevious = voices.some((voice) => String(voice.voiceURI || voice.name) === previousSelection);
    const bestVoice = getBestVoice(voices);
    const defaultVoiceKey = String(bestVoice?.voiceURI || bestVoice?.name || '');
    audioVoiceSelect.value = hasPrevious ? previousSelection : defaultVoiceKey;
    audioState.selectedVoice = audioVoiceSelect.value;
  }

  function getSelectedVoice() {
    const voiceKey = String(audioState.selectedVoice || '').trim();
    if (!voiceKey) return null;
    return audioState.voices.find((voice) => String(voice.voiceURI || voice.name) === voiceKey) || null;
  }

  function updateProgressUi() {
    const total = Number(progressState.totalModules || 0);
    const completed = progressState.completedModules.size;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const certificateUnlocked = total > 0 && completed === total && progressState.assessmentCompleted === true;

    if (progressSummary) {
      progressSummary.textContent = `${completed} of ${total} modules completed`;
    }
    if (progressPercent) {
      progressPercent.textContent = `${percent}%`;
    }
    if (progressBar) {
      progressBar.style.width = `${percent}%`;
    }
    const barLabel = document.getElementById('courseProgressBarLabel');
    if (barLabel) barLabel.textContent = `${percent}%`;

    if (certificateBtn) {
      certificateBtn.style.display = certificateUnlocked ? 'inline-block' : 'none';
    }
  }

  function updateProgressiveSections() {
    const hasModules = progressState.totalModules > 0;
    const allModulesComplete = hasModules && progressState.completedModules.size >= progressState.totalModules;
    const assessmentComplete = progressState.assessmentCompleted === true;

    if (practiceSection) practiceSection.hidden = !allModulesComplete;
    if (capstoneSection) capstoneSection.hidden = !allModulesComplete;
    if (mockExamsSection) mockExamsSection.hidden = !allModulesComplete;
    if (assessmentSection) assessmentSection.hidden = !allModulesComplete;
    if (interviewPrepSection) interviewPrepSection.hidden = !(allModulesComplete && assessmentComplete);
  }

  function getProgressCheckExplanation(idx) {
    const directExplanation = String(progressState.answerExplanations[idx] || '').trim();
    if (directExplanation) return directExplanation;
    const moduleItem = progressState.allModules?.[idx] || null;
    const objective = String(moduleItem?.objective || '').trim();
    if (objective) {
      return `This matches the objective of the module: ${objective}`;
    }
    return 'This answer best reflects the core lesson from the module.';
  }

  function getConceptDefinition(answerText) {
    const normalized = String(answerText || '').toLowerCase();
    if (normalized.includes('supervised learning')) {
      return 'Supervised learning is a machine-learning approach where a model is trained on labeled data (input-output pairs) so it can learn patterns and predict outcomes for new, unseen data.';
    }
    if (normalized.includes('unsupervised learning')) {
      return 'Unsupervised learning trains on unlabeled data to discover hidden structure, such as clusters, relationships, or lower-dimensional representations, without known target outputs.';
    }
    if (normalized.includes('reinforcement learning')) {
      return 'Reinforcement learning trains an agent through trial and error using rewards and penalties, so it can optimize long-term decision making in an environment.';
    }
    return '';
  }

  function isGenericProgressExplanation(text) {
    const normalized = String(text || '').toLowerCase();
    if (!normalized.trim()) return true;
    return normalized.includes('matches the core objective of this module')
      || normalized.includes('best reflects the core lesson')
      || normalized.startsWith('the best answer is');
  }

  function stripObjectiveClause(text) {
    return String(text || '')
      .replace(/because it matches the core objective of this module:\s*[^.]+\.?\s*/ig, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function buildDetailedProgressExplanation(correctAnswer, explanation) {
    const answer = String(correctAnswer || '').trim();
    const base = stripObjectiveClause(String(explanation || '').trim());
    const definition = getConceptDefinition(answer);

    if (definition && answer) {
      return `The best answer is "${answer}." ${definition}`;
    }

    if (answer && (isGenericProgressExplanation(base) || !base)) {
      return `The best answer is "${answer}."`;
    }

    return base;
  }

  function formatProgressCheckFeedback(isCorrect, correctAnswer, explanation) {
    const detailedExplanation = buildDetailedProgressExplanation(correctAnswer, explanation);
    if (isCorrect) {
      return detailedExplanation || (correctAnswer ? `The correct answer is "${correctAnswer}".` : 'Well done.');
    }
    if (detailedExplanation && detailedExplanation.toLowerCase().startsWith('the best answer is')) {
      return detailedExplanation;
    }
    const answerLine = correctAnswer ? `The correct answer is "${correctAnswer}".` : '';
    return [answerLine, detailedExplanation].filter(Boolean).join(' ');
  }

  function setResultHtml(resultWrap, isCorrect, message, idx) {
    const color = isCorrect ? '#86efac' : '#fda4af';
    const icon = isCorrect ? '✓' : '✗';
    const label = isCorrect ? 'Correct' : 'Not quite';
    let remediationMarkup = '';
    if (!isCorrect && idx !== undefined) {
      remediationMarkup = `<div style="margin-top:8px;"><button type="button" data-progress-remediate-btn="${Number(idx)}" style="background:#1d4ed8;border:1px solid #60a5fa;color:#dbeafe;border-radius:6px;padding:7px 10px;cursor:pointer;font-size:0.8rem;font-weight:700;">Start targeted remediation</button></div>`;
    }
    resultWrap.innerHTML = `<span style="font-weight:700;color:${color};">${icon} ${escapeHtml(label)}.</span> <span style="color:#d0d9e7;">${escapeHtml(message)}</span>${remediationMarkup}`;
    if (!isCorrect && idx !== undefined) {
      const continueBtn = document.querySelector(`button[data-progress-continue-btn="${idx}"]`);
      if (continueBtn) continueBtn.style.display = 'none';
      const correctIndex = progressState.answerKey[idx];
      const selectedInput = document.querySelector(`input[name="module-progress-check-${idx}"]:checked`);
      if (selectedInput) {
        const selectedLabel = selectedInput.closest('label');
        if (selectedLabel) {
          selectedLabel.style.background = '#3b0a0a';
          selectedLabel.style.borderColor = '#ef4444';
          selectedLabel.style.color = '#fca5a5';
        }
      }
      if (Number.isInteger(correctIndex)) {
        const correctInput = document.querySelector(`input[name="module-progress-check-${idx}"][value="${correctIndex}"]`);
        if (correctInput) {
          const correctLabel = correctInput.closest('label');
          if (correctLabel) {
            correctLabel.style.background = '#052e16';
            correctLabel.style.borderColor = '#22c55e';
            correctLabel.style.color = '#86efac';
          }
        }
      }
    }
  }

  function queueProgressAdvance(idx, completedModules, feedbackMessage) {
    let numericIdx = Number(idx);
    if (!Number.isInteger(numericIdx) || numericIdx < 0) {
      const fallbackBtn = document.querySelector('button[data-progress-check-btn][disabled]');
      const fallbackIdx = Number(fallbackBtn?.getAttribute('data-progress-check-btn'));
      numericIdx = Number.isInteger(fallbackIdx) && fallbackIdx >= 0 ? fallbackIdx : 0;
    }

    const moduleCount = Number(progressState.totalModules || progressState.allModules?.length || (numericIdx + 1) || 0);
    if ((!progressState.totalModules || progressState.totalModules < 1) && moduleCount > 0) {
      progressState.totalModules = moduleCount;
    }

    const normalizedFromPayload = asArray(completedModules)
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 0 && (moduleCount > 0 ? n < moduleCount : true));

    // Always include locally known progress + current module so Continue reliably advances.
    const normalized = Array.from(new Set([
      ...Array.from(progressState.completedModules),
      ...normalizedFromPayload,
      numericIdx
    ]))
      .filter((n) => Number.isInteger(n) && n >= 0 && (moduleCount > 0 ? n < moduleCount : true))
      .sort((a, b) => a - b);

    const contiguous = moduleCount > 0 ? normalizeCompletedSequence(normalized, moduleCount) : normalized;
    const forcedContiguous = [];
    for (let i = 0; i <= numericIdx; i += 1) forcedContiguous.push(i);
    const nextCompleted = forcedContiguous.length ? forcedContiguous : contiguous;
    progressState.completedModules = new Set(nextCompleted);
    saveStoredProgress();
    updateProgressUi();

    progressState.pendingAdvance = {
      idx: numericIdx,
      completedModules: nextCompleted,
      nextIndex: Math.min(nextCompleted.length, Math.max(0, moduleCount - 1)),
      feedbackMessage: String(feedbackMessage || '').trim()
    };

    const answerInputs = document.querySelectorAll(`input[data-progress-check-option="${numericIdx}"]`);
    const submitButton = document.querySelector(`button[data-progress-check-btn="${numericIdx}"]`);
    const resultWrap = document.querySelector(`div[data-progress-check-result="${numericIdx}"]`);

    answerInputs.forEach((input) => {
      input.disabled = true;
    });

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Correct!';
      submitButton.style.opacity = '0.75';
      submitButton.style.cursor = 'default';
    }

    const continueButton = document.querySelector(`button[data-progress-continue-btn="${numericIdx}"]`);
    if (continueButton) {
      continueButton.style.display = 'inline-flex';
      continueButton.disabled = false;
    }

    if (resultWrap) {
      setResultHtml(resultWrap, true, feedbackMessage);
    }
  }

  function finalizeProgressAdvance(idx) {
    if (progressState.autoAdvanceTimer) {
      window.clearTimeout(progressState.autoAdvanceTimer);
      progressState.autoAdvanceTimer = null;
    }

    const pending = progressState.pendingAdvance;
    const numericIdx = Number(idx);
    if (!Number.isInteger(numericIdx) || numericIdx < 0) return;
    const beforeSize = progressState.completedModules.size;

    // Fallback progression in case pending state is stale/missing in the browser.
    if (!pending || Number(pending.idx) !== numericIdx) {
      const fallbackCompleted = Array.from(new Set([
        ...Array.from(progressState.completedModules),
        numericIdx
      ]))
        .filter((n) => Number.isInteger(n) && n >= 0 && n < progressState.totalModules)
        .sort((a, b) => a - b);
      progressState.pendingAdvance = null;
      applyCompletedModules(fallbackCompleted, numericIdx);
      return;
    }

    progressState.pendingAdvance = null;
    applyCompletedModules(pending.completedModules, numericIdx);

    if (Number.isInteger(pending.nextIndex) && pending.nextIndex >= 0) {
      progressState.currentModuleIndex = pending.nextIndex;
      renderModuleAccordion();
      renderProgressiveContent();
      updateProgressiveSections();
    }

    // Defensive fallback: if state did not advance (for example, duplicate click handler race), force contiguous progress.
    if (progressState.completedModules.size <= beforeSize && progressState.totalModules > 0) {
      const forced = [];
      for (let i = 0; i <= numericIdx && i < progressState.totalModules; i += 1) forced.push(i);
      applyCompletedModules(forced, numericIdx);
    }
  }

  // Expose a direct fallback handler so Continue works even if delegated click listeners fail.
  window.handleCourseContinue = function handleCourseContinue(idx) {
    finalizeProgressAdvance(idx);
  };

  function resetModuleAudioButtons() {
    document.querySelectorAll('button[data-module-lesson-btn]').forEach((button) => {
      button.style.background = '#0f172a';
      button.style.borderColor = '#2a3954';
      button.style.color = '#d0d9e7';
    });
    document.querySelectorAll('button[data-module-lesson-pause-btn]').forEach((button) => {
      button.textContent = 'Pause Lesson';
      button.disabled = true;
      button.style.opacity = '0.65';
      button.style.cursor = 'default';
    });
  }

  function setModuleAudioControls(idx, partKey, isPlaying) {
    document.querySelectorAll(`button[data-module-lesson-btn="${idx}"]`).forEach((button) => {
      const buttonPartKey = button.getAttribute('data-module-lesson-part');
      const isActive = isPlaying && buttonPartKey === partKey;
      button.style.background = isActive ? '#0f766e' : '#0f172a';
      button.style.borderColor = isActive ? '#14b8a6' : '#2a3954';
      button.style.color = isActive ? '#ecfeff' : '#d0d9e7';
    });
    const pauseButton = document.querySelector(`button[data-module-lesson-pause-btn="${idx}"]`);
    if (pauseButton) {
      pauseButton.disabled = !isPlaying;
      pauseButton.style.opacity = isPlaying ? '1' : '0.65';
      pauseButton.style.cursor = isPlaying ? 'pointer' : 'default';
      pauseButton.textContent = audioState.isPaused ? 'Resume Lesson' : 'Pause Lesson';
    }
  }

  function setLessonStage(idx, title, body) {
    const titleEl = document.querySelector(`div[data-module-lesson-stage-title="${idx}"]`);
    const bodyEl = document.querySelector(`div[data-module-lesson-stage-body="${idx}"]`);
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.textContent = body;
  }

  function clearFollowAlongHighlights() {
    if (audioState.followAlongElements.length) {
      audioState.followAlongElements.forEach((el) => {
        el.style.boxShadow = '';
        el.style.backgroundColor = '';
      });
    }
    audioState.followAlongElements = [];
    audioState.followAlongPartKey = '';
  }

  function setFollowAlongStatus(idx, text) {
    const followStatus = document.querySelector(`div[data-module-audio-follow-status="${idx}"]`);
    if (followStatus) followStatus.textContent = text;
  }

  function setFollowAlongHighlight(idx, partKey) {
    if (!Number.isInteger(idx) || idx < 0 || !partKey) return;
    if (audioState.followAlongPartKey === partKey) return;

    clearFollowAlongHighlights();

    const targets = Array.from(document.querySelectorAll(`[data-module-follow-idx="${idx}"][data-module-follow-part="${partKey}"]`));
    if (!targets.length) return;

    targets.forEach((el) => {
      el.style.boxShadow = '0 0 0 2px rgba(56, 189, 248, 0.45)';
      el.style.backgroundColor = 'rgba(14, 116, 144, 0.18)';
    });
    audioState.followAlongElements = targets;
    audioState.followAlongPartKey = partKey;

    const labelMap = {
      title: 'Title',
      objective: 'Objective',
      lesson: 'Lesson',
      workedExample: 'Worked Example',
      commonMistake: 'Common Mistake',
      practiceTask: 'Practice Task',
      progressCheck: 'Progress Check'
    };
    setFollowAlongStatus(idx, `Follow along: ${labelMap[partKey] || 'Section'}.`);
    targets[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function getFollowAlongPartForChar(segments, charIndex) {
    const numericCharIndex = Number(charIndex);
    if (!Array.isArray(segments) || !Number.isFinite(numericCharIndex) || numericCharIndex < 0) return '';
    const match = segments.find((segment) => numericCharIndex >= Number(segment.start) && numericCharIndex < Number(segment.end));
    return match ? String(match.key || '') : '';
  }

  function stopModuleAudio() {
    const previousModuleIndex = audioState.activeModuleIndex;
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    audioState.activeModuleIndex = null;
    audioState.activePartKey = '';
    audioState.utterance = null;
    audioState.isPaused = false;
    audioState.followAlongSegments = [];
    clearFollowAlongHighlights();
    if (Number.isInteger(previousModuleIndex)) {
      setFollowAlongStatus(previousModuleIndex, 'Lesson player stopped.');
    }
    resetModuleAudioButtons();
  }

  function playModuleAudio(idx, partKey, restart = false) {
    if (!restart && audioState.activeModuleIndex === idx && audioState.activePartKey === partKey) {
      stopModuleAudio();
      return;
    }

    const moduleItem = asArray(progressState.allModules)[idx];
    const lessonSection = getModuleLessonSections(moduleItem).find((section) => section.key === partKey);
    const narration = String(lessonSection?.narration || '').trim();
    if (!narration || !lessonSection) return;

    stopModuleAudio();

    const utterance = new SpeechSynthesisUtterance(narration);
    utterance.rate = audioState.rate;
    utterance.pitch = 1;
    utterance.voice = getSelectedVoice();
    utterance.onend = stopModuleAudio;
    utterance.onerror = stopModuleAudio;

    audioState.activeModuleIndex = idx;
    audioState.activePartKey = partKey;
    audioState.utterance = utterance;
    audioState.isPaused = false;
    audioState.followAlongSegments = [];
    clearFollowAlongHighlights();
    setModuleAudioControls(idx, partKey, true);
    setLessonStage(idx, `${lessonSection.label} Lesson`, lessonSection.preview);
    setFollowAlongHighlight(idx, partKey);
    setFollowAlongStatus(idx, `Teaching ${lessonSection.label.toLowerCase()}...`);
    window.speechSynthesis.speak(utterance);
  }

  function startModuleAudio(idx, partKey) {
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
      alert('Lesson playback is not supported in this browser.');
      return;
    }

    playModuleAudio(idx, partKey, false);
  }

  function togglePauseModuleAudio(idx) {
    if (!window.speechSynthesis || audioState.activeModuleIndex !== idx || !audioState.utterance) {
      return;
    }

    if (window.speechSynthesis.paused || audioState.isPaused) {
      window.speechSynthesis.resume();
      audioState.isPaused = false;
      setFollowAlongStatus(idx, 'Lesson player resumed.');
    } else {
      window.speechSynthesis.pause();
      audioState.isPaused = true;
      setFollowAlongStatus(idx, 'Lesson player paused.');
    }

    setModuleAudioControls(idx, audioState.activePartKey, true);
  }

  function updateAudioRate(nextRate) {
    const parsed = Number(nextRate);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    audioState.rate = parsed;

    if (audioState.activeModuleIndex !== null && audioState.activePartKey) {
      playModuleAudio(audioState.activeModuleIndex, audioState.activePartKey, true);
    }
  }

  function setPassedModuleUi(idx, source) {
    const moduleStatus = document.querySelector(`[data-module-status-indicator="${idx}"]`);
    const answerInputs = document.querySelectorAll(`input[data-progress-check-option="${idx}"]`);
    const button = document.querySelector(`button[data-progress-check-btn="${idx}"]`);
    const resultWrap = document.querySelector(`div[data-progress-check-result="${idx}"]`);

    if (moduleStatus) {
      moduleStatus.setAttribute('data-completed', 'true');
      moduleStatus.style.background = '#22c55e';
      moduleStatus.style.borderColor = '#22c55e';
      moduleStatus.innerHTML = '<span style="display:block;width:6px;height:10px;border:solid #052e16;border-width:0 2px 2px 0;transform:rotate(45deg);"></span>';
    }
    answerInputs.forEach((input) => {
      input.disabled = true;
    });
    if (button) {
      button.disabled = true;
      button.textContent = 'Passed';
      button.style.opacity = '0.75';
      button.style.cursor = 'default';
    }
    if (resultWrap) {
      resultWrap.textContent = source === 'restored'
        ? 'Passed previously. Module remains completed.'
        : 'Correct. Module marked as completed.';
      resultWrap.style.color = '#86efac';
    }
  }

  function applyCompletedModules(completedModules, freshIdx) {
    const numericFreshIdx = Number(freshIdx);
    const moduleCount = Number(progressState.totalModules || progressState.allModules?.length || (numericFreshIdx + 1) || 0);
    if ((!progressState.totalModules || progressState.totalModules < 1) && moduleCount > 0) {
      progressState.totalModules = moduleCount;
    }
    const normalized = asArray(completedModules)
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 0 && (moduleCount > 0 ? n < moduleCount : true));

    if (Number.isInteger(numericFreshIdx) && numericFreshIdx >= 0 && (moduleCount > 0 ? numericFreshIdx < moduleCount : true)) {
      if (!normalized.includes(numericFreshIdx)) normalized.push(numericFreshIdx);
    }

    normalized.sort((a, b) => a - b);
    const contiguous = moduleCount > 0 ? normalizeCompletedSequence(normalized, moduleCount) : normalized;

    progressState.pendingAdvance = null;
    progressState.completedModules = new Set(contiguous);
    progressState.practiceUnlockedModules = new Set(contiguous);
    progressState.currentModuleIndex = contiguous.length >= moduleCount ? Math.max(0, moduleCount - 1) : contiguous.length;
    saveStoredProgress();
    contiguous.forEach((completedIdx) => {
      const mastery = getModuleMasteryState(completedIdx);
      mastery.quizPassed = true;
      mastery.transferPassed = true;
      if (!mastery.transferFeedback) mastery.transferFeedback = 'Previously completed module.';
    });
    contiguous.forEach((completedIdx) => setPassedModuleUi(completedIdx, completedIdx === freshIdx ? 'fresh' : 'restored'));
    updateProgressUi();
    renderModuleAccordion();
    renderProgressiveContent();
    updateProgressiveSections();
    
    const isAllComplete = progressState.completedModules.size >= progressState.totalModules;
    if (isAllComplete && assessment) {
      renderAssessment(progressState.assessmentItems || []);
    }
  }

  function resolveLocalCorrectOptionIndex(idx) {
    const candidate = Number(progressState.answerKey[idx]);
    return Number.isInteger(candidate) && candidate >= 0 ? candidate : null;
  }

  function applyLocalProgressCheck(idx, selectedOptionIndex, resultWrap) {
    const correctOptionIndex = resolveLocalCorrectOptionIndex(idx);
    if (!Number.isInteger(correctOptionIndex)) {
      resultWrap.textContent = 'Answer validation is unavailable right now. Refresh the course and try again.';
      resultWrap.style.color = '#fbbf24';
      return false;
    }

    const correctAnswer = String(progressState.allModules?.[idx]?.progressCheckOptions?.[correctOptionIndex] || '').trim();
    const explanation = getProgressCheckExplanation(idx);

    if (selectedOptionIndex !== correctOptionIndex) {
      progressState.lastProgressFeedback = null;
      const masteryOnMiss = getModuleMasteryState(idx);
      masteryOnMiss.quizPassed = false;
      setResultHtml(resultWrap, false, formatProgressCheckFeedback(false, correctAnswer, explanation), idx);
      return false;
    }

    const mastery = getModuleMasteryState(idx);
    mastery.quizPassed = true;

    if (!mastery.transferPassed) {
      setResultHtml(resultWrap, true, 'Checkpoint passed. Complete the transfer task below to prove applied mastery and unlock continue.', idx);
      return true;
    }

    const completedModules = Array.from(new Set([
      ...progressState.completedModules,
      idx
    ])).sort((left, right) => left - right);

    progressState.lastProgressFeedback = null;
    queueProgressAdvance(idx, completedModules, formatProgressCheckFeedback(true, correctAnswer, explanation));
    return true;
  }

  function runMultiQuestionQuiz(idx) {
    const moduleItem = progressState.allModules?.[idx];
    const quizQuestions = asArray(moduleItem?.quizQuestions);
    if (!quizQuestions.length) {
      runProgressCheck(idx);
      return;
    }

    const resultWrap = document.querySelector(`div[data-quiz-result="${idx}"]`);
    if (!resultWrap) return;

    const results = quizQuestions.map((q, qIdx) => {
      const selected = document.querySelector(`input[name="module-quiz-${idx}-${qIdx}"]:checked`);
      const selectedVal = selected ? Number(selected.value) : null;
      const isCorrect = Number.isInteger(selectedVal) && selectedVal === Number(q.correctOptionIndex);
      return { isCorrect, selectedVal, correctOptionIndex: Number(q.correctOptionIndex), explanation: String(q.explanation || '') };
    });

    const total = quizQuestions.length;
    const allAnswered = results.every((r) => Number.isInteger(r.selectedVal));
    if (!allAnswered) {
      resultWrap.innerHTML = '<span style="color:#fda4af;font-weight:700;">Answer all questions before submitting the quiz.</span>';
      return;
    }

    const correct = results.filter((r) => r.isCorrect).length;
    const requiredCorrect = Math.ceil(total * 0.75);
    const passed = correct >= requiredCorrect;
    const mastery = getModuleMasteryState(idx);
    mastery.quizPassed = passed;
    mastery.quizScore = `${correct}/${total}`;

    // Per-question visual feedback
    results.forEach((result, qIdx) => {
      document.querySelectorAll(`input[name="module-quiz-${idx}-${qIdx}"]`).forEach((inp) => { inp.disabled = true; });
      if (!result.isCorrect) {
        const wrongInput = document.querySelector(`input[name="module-quiz-${idx}-${qIdx}"]:checked`);
        if (wrongInput) {
          const wrongLabel = wrongInput.closest('label');
          if (wrongLabel) { wrongLabel.style.background = '#3b0a0a'; wrongLabel.style.borderColor = '#ef4444'; wrongLabel.style.color = '#fca5a5'; }
        }
      }
      const correctInput = document.querySelector(`input[name="module-quiz-${idx}-${qIdx}"][value="${result.correctOptionIndex}"]`);
      if (correctInput) {
        const correctLabel = correctInput.closest('label');
        if (correctLabel) { correctLabel.style.background = '#052e16'; correctLabel.style.borderColor = '#22c55e'; correctLabel.style.color = '#86efac'; }
      }
    });

    const submitBtn = document.querySelector(`button[data-module-quiz-submit-btn="${idx}"]`);
    if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.75'; submitBtn.style.cursor = 'default'; }

    const scoreColor = passed ? '#86efac' : '#fda4af';
    const scoreIcon = passed ? '✓' : '✗';
    const scoreLabel = passed ? 'Passed' : `Not yet \u2014 need ${requiredCorrect}/${total} to pass`;

    let resultHtml = `<div style="margin-top:4px;"><span style="font-weight:700;color:${scoreColor};">${scoreIcon} Quiz Score: ${correct}/${total} \u2014 ${scoreLabel}.</span>`;

    if (passed && !mastery.transferPassed) {
      resultHtml += ` <span style="color:#d0d9e7;">Complete the transfer task to unlock continue.</span>`;
    } else if (passed && mastery.transferPassed) {
      const completedModules = Array.from(new Set([...progressState.completedModules, idx])).sort((a, b) => a - b);
      progressState.lastProgressFeedback = null;
      queueProgressAdvance(idx, completedModules, `Quiz passed (${correct}/${total}). Great work!`);
    } else {
      resultHtml += ` <span style="color:#fde68a;">Review the answers above, then retry.</span>`;
      setTimeout(() => {
        const btn = document.querySelector(`button[data-module-quiz-submit-btn="${idx}"]`);
        if (btn) { btn.disabled = false; btn.textContent = 'Retry Quiz'; btn.style.opacity = '1'; btn.style.cursor = 'pointer'; }
        document.querySelectorAll(`input[name^="module-quiz-${idx}-"]`).forEach((inp) => { inp.disabled = false; inp.checked = false; });
        document.querySelectorAll(`[data-quiz-panel="${idx}"] label`).forEach((lbl) => { lbl.style.background = '#111c31'; lbl.style.borderColor = '#2a3954'; lbl.style.color = '#d0d9e7'; });
      }, 3000);
    }

    resultHtml += '</div>';
    resultWrap.innerHTML = resultHtml;
  }

  function runTransferSubmission(idx) {
    const input = document.querySelector(`textarea[data-transfer-response="${idx}"]`);
    const feedback = document.querySelector(`div[data-transfer-feedback="${idx}"]`);
    if (!input || !feedback) return;

    const mastery = getModuleMasteryState(idx);
    const result = validateTransferResponse(idx, input.value);
    mastery.transferText = String(input.value || '').trim();

    if (!result.ok) {
      mastery.transferPassed = false;
      mastery.transferFeedback = result.message;
      feedback.innerHTML = `<span style="font-weight:700;color:#fda4af;">Needs revision.</span> <span style="color:#d0d9e7;">${escapeHtml(result.message)}</span>`;
      return;
    }

    mastery.transferPassed = true;
    mastery.transferFeedback = result.message;
    feedback.innerHTML = `<span style="font-weight:700;color:#86efac;">Transfer accepted.</span> <span style="color:#d0d9e7;">${escapeHtml(result.message)}</span>`;

    if (mastery.quizPassed && !progressState.completedModules.has(idx)) {
      const completedModules = Array.from(new Set([
        ...progressState.completedModules,
        idx
      ])).sort((left, right) => left - right);
      queueProgressAdvance(idx, completedModules, 'Mastery complete: checkpoint + transfer task validated. Continue to next module.');
    }
  }

  function runCourseDiagnostic() {
    const questions = asArray(progressState.diagnosticQuestions);
    const resultWrap = document.querySelector('[data-course-diagnostic-result]');
    if (!resultWrap || !questions.length) return;

    const selectedAnswers = questions.map((_, idx) => {
      const selected = document.querySelector(`input[name="course-diagnostic-${idx}"]:checked`);
      return selected ? Number(selected.value) : null;
    });

    const allAnswered = selectedAnswers.every((value) => Number.isInteger(value));
    if (!allAnswered) {
      resultWrap.innerHTML = '<span style="font-weight:700;color:#fda4af;">Answer all diagnostic questions first.</span>';
      return;
    }

    const outcome = gradeDiagnostic(selectedAnswers);
    const score = Number(outcome.score || 0);
    const total = Number(outcome.total || 0);
    const percent = Number(outcome.percent || 0);
    const recommendedStartIndex = percent >= 67
      ? Math.min(1, Math.max(0, Number(progressState.totalModules || 1) - 1))
      : 0;

    progressState.diagnosticCompleted = true;
    progressState.diagnosticScore = score;
    progressState.recommendedStartIndex = recommendedStartIndex;
    if (progressState.completedModules.size === 0) {
      progressState.currentModuleIndex = recommendedStartIndex;
    }

    saveStoredDiagnostic({
      completed: true,
      score,
      total,
      recommendedStartIndex
    });

    const recommendation = recommendedStartIndex > 0
      ? `You scored ${score}/${total}. Start at Module ${recommendedStartIndex + 1} and use refresher review on demand.`
      : `You scored ${score}/${total}. Start at Module 1 for foundation-first sequencing.`;
    resultWrap.innerHTML = `<span style="font-weight:700;color:#86efac;">Diagnostic complete.</span> <span style="color:#d0d9e7;">${escapeHtml(recommendation)}</span>`;
    renderModuleAccordion();
    renderProgressiveContent();
  }

  function setCourseLoadingState(isLoading, buttonLabel) {
    if (!refreshCourseBtn) return;
    refreshCourseBtn.disabled = isLoading;
    refreshCourseBtn.textContent = isLoading ? (buttonLabel || 'Refreshing...') : 'Refresh Course';
    refreshCourseBtn.style.opacity = isLoading ? '0.75' : '1';
    refreshCourseBtn.style.cursor = isLoading ? 'default' : 'pointer';
  }

  async function runProgressCheck(idx) {
    if (!progressState.diagnosticCompleted) {
      const resultWrapLocked = document.querySelector(`div[data-progress-check-result="${idx}"]`);
      if (resultWrapLocked) {
        resultWrapLocked.innerHTML = '<span style="font-weight:700;color:#fbbf24;">Complete the placement diagnostic first.</span>';
      }
      return;
    }

    if (progressState.pendingAdvance && Number(progressState.pendingAdvance.idx) === Number(idx)) {
      return;
    }

    if (progressState.completedModules.has(idx)) {
      setPassedModuleUi(idx, 'restored');
      return;
    }

    const token = getToken();
    const selectedOption = document.querySelector(`input[name="module-progress-check-${idx}"]:checked`);
    const resultWrap = document.querySelector(`div[data-progress-check-result="${idx}"]`);
    const button = document.querySelector(`button[data-progress-check-btn="${idx}"]`);
    if (!resultWrap || !button) return;

    if (!selectedOption) {
      resultWrap.textContent = 'Select an answer first.';
      resultWrap.style.color = '#fda4af';
      return;
    }

    const selectedOptionIndex = Number(selectedOption.value);
    const fallbackCorrectAnswer = String(progressState.allModules?.[idx]?.progressCheckOptions?.[Number(progressState.answerKey[idx])] || '').trim();
    const fallbackExplanation = getProgressCheckExplanation(idx);

    // Local/normalized curriculum packs validate in-browser and do not depend on API session tokens.
    if (progressState.preferLocalProgressCheck || String(progressState.sessionToken || '').startsWith('local-')) {
      const usedLocalFallback = applyLocalProgressCheck(idx, selectedOptionIndex, resultWrap);
      if (usedLocalFallback) {
        const mastery = getModuleMasteryState(idx);
        if (mastery.transferPassed) {
          setResultHtml(resultWrap, true, formatProgressCheckFeedback(true, fallbackCorrectAnswer, fallbackExplanation));
        }
      }
      return;
    }

    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = 'Checking...';
    let timeoutId = null;

    try {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      timeoutId = controller
        ? window.setTimeout(() => controller.abort(), PROGRESS_CHECK_TIMEOUT_MS)
        : null;
      const response = await fetch(apiPath('/api/learning/course-progress-check'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        signal: controller?.signal,
        body: JSON.stringify({
          topic,
          moduleIndex: idx,
          selectedOptionIndex,
          sessionToken: progressState.sessionToken
        })
      });
      if (timeoutId) window.clearTimeout(timeoutId);

      const payload = await response.json();
      if (response.ok && payload?.passed) {
        const mastery = getModuleMasteryState(idx);
        mastery.quizPassed = true;
        const feedbackMsg = formatProgressCheckFeedback(
          true,
          String(payload?.correctOptionText || fallbackCorrectAnswer).trim(),
          String(payload?.explanation || fallbackExplanation).trim()
        );
        progressState.lastProgressFeedback = null;
        if (mastery.transferPassed) {
          queueProgressAdvance(idx, payload?.completedModules, feedbackMsg);
        } else {
          setResultHtml(resultWrap, true, 'Checkpoint passed. Complete the transfer task below to prove applied mastery and unlock continue.', idx);
        }
        return;
      }

      if (response.status === 409 || response.status === 404) {
        // 409 = session expired; 404 = scaffold module the server doesn't know about — use local answer key
        const usedLocalFallback = applyLocalProgressCheck(idx, selectedOptionIndex, resultWrap);
        if (usedLocalFallback) {
          const mastery = getModuleMasteryState(idx);
          if (mastery.transferPassed) {
            setResultHtml(resultWrap, true, formatProgressCheckFeedback(true, fallbackCorrectAnswer, fallbackExplanation));
          }
        } else if (response.status === 409) {
          resultWrap.textContent = String(payload?.error || 'Session expired. Reload the course.');
          resultWrap.style.color = '#fbbf24';
        } else {
          resultWrap.textContent = 'Answer check unavailable. Try refreshing the course.';
          resultWrap.style.color = '#fbbf24';
        }
      } else if (response.status === 400 && payload?.error) {
        progressState.lastProgressFeedback = null;
        resultWrap.textContent = String(payload.error);
        resultWrap.style.color = '#fda4af';
      } else {
        progressState.lastProgressFeedback = null;
        const mastery = getModuleMasteryState(idx);
        mastery.quizPassed = false;
        const wrongMsg = formatProgressCheckFeedback(
          false,
          String(payload?.correctOptionText || fallbackCorrectAnswer).trim(),
          String(payload?.explanation || fallbackExplanation).trim()
        );
        setResultHtml(resultWrap, false, wrongMsg, idx);
      }
    } catch (error) {
      const usedLocalFallback = applyLocalProgressCheck(idx, selectedOptionIndex, resultWrap);
      if (usedLocalFallback) {
        const mastery = getModuleMasteryState(idx);
        if (mastery.transferPassed) {
          setResultHtml(resultWrap, true, formatProgressCheckFeedback(true, fallbackCorrectAnswer, fallbackExplanation));
        }
      } else if (error?.name === 'AbortError') {
        progressState.lastProgressFeedback = null;
        resultWrap.textContent = 'Validation took too long. Refresh the course and try again.';
        resultWrap.style.color = '#fbbf24';
      } else {
        progressState.lastProgressFeedback = null;
        resultWrap.textContent = 'Check failed. Please try again.';
        resultWrap.style.color = '#fda4af';
      }
    } finally {
      const isPending = progressState.pendingAdvance && Number(progressState.pendingAdvance.idx) === Number(idx);
      if (!progressState.completedModules.has(idx) && !isPending) {
        button.disabled = false;
        button.textContent = originalLabel;
      }
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  }

  async function loadProgress() {
    const token = getToken();
    if (progressState.preferLocalProgressCheck || String(progressState.sessionToken || '').startsWith('local-')) {
      updateProgressUi();
      return;
    }
    if (!token || !topic || progressState.totalModules <= 0) {
      updateProgressUi();
      return;
    }

    try {
      const response = await fetch(apiPath(`/api/learning/course-progress?topic=${encodeURIComponent(topic)}`), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        updateProgressUi();
        return;
      }

      const payload = await response.json();
      const remoteCompleted = asArray(payload?.completedModules)
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 0 && n < progressState.totalModules);

      const mergedCompleted = Array.from(new Set([
        ...Array.from(progressState.completedModules),
        ...remoteCompleted
      ]))
        .filter((n) => Number.isInteger(n) && n >= 0 && n < progressState.totalModules)
        .sort((a, b) => a - b);

      const contiguous = normalizeCompletedSequence(mergedCompleted, progressState.totalModules);
      progressState.completedModules = new Set(contiguous);
      progressState.practiceUnlockedModules = new Set(contiguous);

      document.querySelectorAll('[data-module-status-indicator]').forEach((indicator) => {
        const idx = Number(indicator.getAttribute('data-module-status-indicator'));
        const isCompleted = progressState.completedModules.has(idx);
        indicator.setAttribute('data-completed', isCompleted ? 'true' : 'false');
        indicator.style.background = isCompleted ? '#22c55e' : 'rgba(148, 163, 184, 0.15)';
        indicator.style.borderColor = isCompleted ? '#22c55e' : 'rgba(148, 163, 184, 0.35)';
        indicator.innerHTML = isCompleted
          ? '<span style="display:block;width:6px;height:10px;border:solid #052e16;border-width:0 2px 2px 0;transform:rotate(45deg);"></span>'
          : '';
      });

      contiguous.forEach((idx) => setPassedModuleUi(idx, 'restored'));

      updateProgressUi();
      renderModuleAccordion();
      renderProgressiveContent();
      updateProgressiveSections();
      if (progressState.completedModules.size >= progressState.totalModules) {
        renderMockExams(progressState.mockExams || []);
        renderAssessment(progressState.assessmentItems || []);
      }
    } catch (error) {
      updateProgressUi();
    }
  }

  function bindProgressHandlers() {
    if (moduleHandlersBound || !modules) return;
    moduleHandlersBound = true;

    modules.addEventListener('click', async function (event) {
      const diagnosticBtn = event.target.closest('button[data-course-diagnostic-submit]');
      if (diagnosticBtn) {
        event.preventDefault();
        runCourseDiagnostic();
        return;
      }

      const remediateBtn = event.target.closest('button[data-progress-remediate-btn]');
      if (remediateBtn) {
        event.preventDefault();
        const idx = Number(remediateBtn.getAttribute('data-progress-remediate-btn'));
        const guidance = buildRemediationGuidance(idx);
        setLessonStage(idx, 'Targeted Remediation', guidance.join(' '));
        setFollowAlongStatus(idx, 'Remediation loaded: review objective, example, then retry.');
        return;
      }

      const transferBtn = event.target.closest('button[data-transfer-submit-btn]');
      if (transferBtn) {
        event.preventDefault();
        const idx = Number(transferBtn.getAttribute('data-transfer-submit-btn'));
        runTransferSubmission(idx);
        return;
      }

      const continueButton = event.target.closest('button[data-progress-continue-btn]');
      if (continueButton) {
        event.preventDefault();
        const idx = Number(continueButton.getAttribute('data-progress-continue-btn'));
        finalizeProgressAdvance(idx);
        return;
      }

      const progressButton = event.target.closest('button[data-progress-check-btn]');
      if (progressButton) {
        event.preventDefault();
        const idx = Number(progressButton.getAttribute('data-progress-check-btn'));
        await runProgressCheck(idx);
        return;
      }

      const quizSubmitButton = event.target.closest('button[data-module-quiz-submit-btn]');
      if (quizSubmitButton) {
        event.preventDefault();
        const idx = Number(quizSubmitButton.getAttribute('data-module-quiz-submit-btn'));
        runMultiQuestionQuiz(idx);
        return;
      }

      const lessonButton = event.target.closest('button[data-module-lesson-btn]');
      if (lessonButton) {
        const idx = Number(lessonButton.getAttribute('data-module-lesson-btn'));
        const partKey = String(lessonButton.getAttribute('data-module-lesson-part') || 'lesson');
        startModuleAudio(idx, partKey);
        return;
      }

      const pauseButton = event.target.closest('button[data-module-lesson-pause-btn]');
      if (pauseButton) {
        const idx = Number(pauseButton.getAttribute('data-module-lesson-pause-btn'));
        togglePauseModuleAudio(idx);
      }
    });

    modules.addEventListener('change', function (event) {
      const rateSelect = event.target.closest('select[data-module-lesson-rate]');
      if (!rateSelect) return;
      updateAudioRate(rateSelect.value);
    });

    const accordionEl = document.getElementById('courseModuleAccordion');
    if (accordionEl) {
      accordionEl.addEventListener('click', function (event) {
        const summary = event.target.closest('summary[data-week-summary]');
        if (!summary) return;
        const idx = Number(summary.getAttribute('data-week-summary'));
        if (!Number.isInteger(idx) || idx < 0) return;

        // Delay to allow native <details> toggle state to settle first.
        setTimeout(() => {
          progressState.currentModuleIndex = idx;
          renderModuleAccordion();
          renderProgressiveContent();
          updateProgressiveSections();
        }, 0);
      });
    }

    if (audioVoiceSelect) {
      audioVoiceSelect.addEventListener('change', function () {
        audioState.selectedVoice = audioVoiceSelect.value;
        try {
          localStorage.setItem(AUDIO_VOICE_PREF_KEY, audioState.selectedVoice || '');
        } catch (error) {
          // Ignore storage failures in restricted browser contexts.
        }
        if (audioState.activeModuleIndex !== null && audioState.activePartKey) {
          playModuleAudio(audioState.activeModuleIndex, audioState.activePartKey, true);
        }
      });
    }

    if (assessment) {
      assessment.addEventListener('click', async function (event) {
        const prevBtn = event.target.closest('[data-assessment-prev-page]');
        if (prevBtn) {
          if (progressState.assessmentCurrentPage > 1) {
            progressState.assessmentCurrentPage -= 1;
            renderAssessment(progressState.assessmentItems || []);
            assessment.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          return;
        }

        const nextBtn = event.target.closest('[data-assessment-next-page]');
        if (nextBtn) {
          const totalPages = Math.ceil(asArray(progressState.assessmentItems).length / 10);
          if (progressState.assessmentCurrentPage < totalPages) {
            progressState.assessmentCurrentPage += 1;
            renderAssessment(progressState.assessmentItems || []);
            assessment.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          return;
        }

        const submitBtn = event.target.closest('#submitAssessmentBtn');
        if (!submitBtn) return;

        const answers = progressState.assessmentAnswers.slice();
        let hasObjectiveQuestions = false;

        const allAnswered = progressState.assessmentItems.every((item, idx) => {
          const options = asArray(item?.options);
          if (options.length >= 2) {
            hasObjectiveQuestions = true;
            return Number.isInteger(answers[idx]);
          }
          return String(answers[idx] || '').trim().length > 0;
        });
        const resultDiv = document.getElementById('assessmentResult');
        if (!resultDiv) return;

        if (!allAnswered) {
          resultDiv.innerHTML = '<span style="color:#fda4af;">Please answer all questions before submitting.</span>';
          return;
        }

        progressState.assessmentAnswers = answers;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        resultDiv.innerHTML = '<span style="color:#93c5fd;">Processing assessment...</span>';

        setTimeout(() => {
          const outcome = calculateCertificationOutcome(progressState.assessmentItems, answers, progressState.certificationPlan);

          progressState.assessmentScore = outcome.score;
          progressState.assessmentGrade = outcome.letterGrade;
          progressState.assessmentCompleted = !hasObjectiveQuestions || outcome.passed;

          if (!progressState.assessmentCompleted) {
            resultDiv.innerHTML = `
              <div style="color:#fda4af;line-height:1.8;">
                <strong>Assessment Result: ${outcome.score}% (${outcome.letterGrade})</strong>
                <p style="margin:8px 0 0;">Grading scale: A (90-100), B (80-89), C (70-79), D (60-69), F (&lt;60).</p>
                <p style="margin:8px 0 10px;">You did not pass yet. Certification requires an overall score of ${outcome.overallPassMark}% and ${outcome.domainPassMark}% in each domain. Review the feedback below, revisit your weak modules, then retry.</p>
                ${renderDomainBreakdown(outcome.domainBreakdown, outcome.domainPassMark)}
                ${outcome.reviewRows.length ? `<div style="margin-top:12px;">${outcome.reviewRows.join('')}</div>` : ''}
              </div>
            `;
            submitBtn.disabled = false;
            submitBtn.textContent = 'Retry Assessment';
            updateProgressUi();
            updateProgressiveSections();
            renderInterviewPrep(progressState.interviewPrepItems);
            return;
          }

          resultDiv.innerHTML = `
            <div style="color:#86efac;line-height:1.8;">
              <strong>✓ Assessment Complete!</strong>
              <p style="margin:8px 0 0;">Score: ${outcome.score}% (${outcome.letterGrade}). You met the overall pass mark of ${outcome.overallPassMark}% and the domain threshold of ${outcome.domainPassMark}% across the certification domains.</p>
              <p style="margin:8px 0 0;">Grading scale: A (90-100), B (80-89), C (70-79), D (60-69), F (&lt;60).</p>
              ${renderDomainBreakdown(outcome.domainBreakdown, outcome.domainPassMark)}
            </div>
          `;
          if (outcome.reviewRows.length) {
            resultDiv.innerHTML += `<div style="margin-top:10px;">${outcome.reviewRows.join('')}</div>`;
          }
          submitBtn.style.display = 'none';
          updateProgressUi();
          updateProgressiveSections();
          renderInterviewPrep(progressState.interviewPrepItems);
        }, 1200);
      });

      assessment.addEventListener('change', function (event) {
        const choice = event.target.closest('[data-assessment-choice]');
        if (choice) {
          const idx = Number(choice.getAttribute('data-assessment-choice'));
          const optionIndex = Number(choice.value);
          if (Number.isInteger(idx) && idx >= 0) {
            progressState.assessmentAnswers[idx] = optionIndex;
          }
          return;
        }

        const answer = event.target.closest('[data-assessment-answer]');
        if (answer) {
          const idx = Number(answer.getAttribute('data-assessment-answer'));
          if (Number.isInteger(idx) && idx >= 0) {
            progressState.assessmentAnswers[idx] = String(answer.value || '').trim();
          }
        }
      });
    }

    if (practiceBank) {
      practiceBank.addEventListener('click', function (event) {
        const revealBtn = event.target.closest('[data-practice-toggle-answer]');
        if (revealBtn) {
          const idx = String(revealBtn.getAttribute('data-practice-toggle-answer') || '');
          progressState.practiceRevealState[idx] = !progressState.practiceRevealState[idx];
          renderPracticeBank(progressState.practiceBankItems || []);
          return;
        }

        if (event.target.closest('[data-practice-prev-page]')) {
          if (progressState.practiceBankPage > 1) {
            progressState.practiceBankPage -= 1;
            renderPracticeBank(progressState.practiceBankItems || []);
            practiceBank.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          return;
        }

        if (event.target.closest('[data-practice-next-page]')) {
          const totalPages = Math.ceil(asArray(progressState.practiceBankItems).length / 10);
          if (progressState.practiceBankPage < totalPages) {
            progressState.practiceBankPage += 1;
            renderPracticeBank(progressState.practiceBankItems || []);
            practiceBank.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    }

    if (mockExams) {
      mockExams.addEventListener('click', function (event) {
        const startBtn = event.target.closest('[data-start-mock-exam]');
        if (startBtn) {
          startMockExam(Number(startBtn.getAttribute('data-start-mock-exam')));
          return;
        }

        if (event.target.closest('[data-mock-prev-page]')) {
          if (progressState.activeMockExam && progressState.activeMockExam.currentPage > 1) {
            progressState.activeMockExam.currentPage -= 1;
            renderMockExams(progressState.mockExams || []);
          }
          return;
        }

        if (event.target.closest('[data-mock-next-page]')) {
          const active = progressState.activeMockExam;
          if (active) {
            const exam = progressState.mockExams[active.examIndex];
            const totalPages = Math.ceil(asArray(exam?.questions).length / 10);
            if (active.currentPage < totalPages) {
              active.currentPage += 1;
              renderMockExams(progressState.mockExams || []);
            }
          }
          return;
        }

        if (event.target.closest('[data-submit-mock-exam]')) {
          submitActiveMockExam(false);
        }
      });

      mockExams.addEventListener('change', function (event) {
        const choice = event.target.closest('[data-mock-choice]');
        if (!choice || !progressState.activeMockExam) return;
        const idx = Number(choice.getAttribute('data-mock-choice'));
        const optionIndex = Number(choice.value);
        if (Number.isInteger(idx) && idx >= 0) {
          progressState.activeMockExam.answers[idx] = optionIndex;
        }
      });
    }
  }

  function renderInterviewPrep(items) {
    if (!interviewPrep) return;

    const isAllModuleComplete = progressState.totalModules > 0 && progressState.completedModules.size >= progressState.totalModules;
    const isAssessmentComplete = progressState.assessmentCompleted === true;

    if (!isAllModuleComplete) {
      interviewPrep.innerHTML = '<li style="color:#9fb0c7;">Complete the course and final assessment to unlock interview prep.</li>';
      return;
    }

    if (!isAssessmentComplete) {
      const plan = progressState.certificationPlan || createCertificationPlan(getCourseCoverageTargets(topic || ''), null);
      interviewPrep.innerHTML = `<li style="color:#9fb0c7;">Earn the required certification thresholds to unlock interview prep and your certificate: ${plan.overallPassMark}% overall and ${plan.domainPassMark}% in each certification domain.</li>`;
      return;
    }

    const list = asArray(items);
    if (!list.length) {
      interviewPrep.innerHTML = '<li>No interview prep available.</li>';
      return;
    }

    interviewPrep.innerHTML = list.map((item) => `<li style="margin-bottom:12px;color:#d0d9e7;line-height:1.6;">${escapeHtml(String(item))}</li>`).join('');
  }

  function getModuleReasoningFromAssessment(moduleIdx) {
    if (!progressState.assessmentItems || !progressState.assessmentItems[moduleIdx]) return '';
    const assessmentItem = progressState.assessmentItems[moduleIdx];
    return String(assessmentItem?.answer || '').slice(0, 200);
  }

  function buildModuleNarrationEntry(moduleItem, index) {
    const options = asArray(moduleItem?.progressCheckOptions)
      .map((option, optionIndex) => `Option ${optionIndex + 1}. ${String(option)}`)
      .join(' ');

    const segmentsSource = [
      { key: 'title', text: `Module ${index + 1}. ${String(moduleItem?.title || `Module ${index + 1}`)}.` },
      { key: 'objective', text: `Objective. ${String(moduleItem?.objective || '')}` },
      { key: 'lesson', text: `Lesson. ${String(moduleItem?.lesson || '')}` },
      { key: 'workedExample', text: `Worked example. ${String(moduleItem?.workedExample || '')}` },
      { key: 'commonMistake', text: `Common mistake. ${String(moduleItem?.commonMistake || '')}` },
      { key: 'practiceTask', text: `Practice task. ${String(moduleItem?.practiceTask || '')}` },
      { key: 'progressCheck', text: `Progress check. ${String(moduleItem?.progressCheckQuestion || '')}` },
      { key: 'progressCheck', text: options }
    ].filter((item) => String(item.text || '').trim());

    const segments = [];
    let narration = '';

    segmentsSource.forEach((item) => {
      const segmentText = String(item.text || '').trim();
      if (!segmentText) return;
      const nextText = narration ? `${narration} ${segmentText}` : segmentText;
      const start = narration ? narration.length + 1 : 0;
      const end = nextText.length;
      segments.push({ key: item.key, start, end });
      narration = nextText;
    });

    return { narration, segments };
  }

  function renderModules(modulesData) {
    const list = asArray(modulesData);
    if (!modules) return;

    progressState.totalModules = list.length;
    progressState.allModules = list;
    progressState.completedModules = new Set(loadStoredProgress(list.length));
    progressState.currentModuleIndex = Math.min(progressState.completedModules.size, Math.max(0, list.length - 1));
    progressState.answerKey = list.map((moduleItem) => Number(moduleItem?.correctOptionIndex));
    progressState.answerExplanations = list.map((moduleItem, index) => String(moduleItem?.progressCheckExplanation || getModuleReasoningFromAssessment(index) || '').trim());
    progressState.assessmentCompleted = false;
    progressState.assessmentAnswers = [];
    progressState.assessmentScore = null;
    progressState.assessmentGrade = null;
    progressState.assessmentCurrentPage = 1;
    progressState.lastProgressFeedback = null;
    progressState.practiceUnlockedModules = new Set(Array.from(progressState.completedModules));
    progressState.practiceBankPage = 1;
    progressState.practiceRevealState = {};
    progressState.activeMockExam = null;
    progressState.moduleMastery = {};
    progressState.diagnosticQuestions = generateDiagnosticQuestions(list);

    const savedDiagnostic = loadStoredDiagnostic();
    if (savedDiagnostic && savedDiagnostic.completed && savedDiagnostic.total > 0) {
      progressState.diagnosticCompleted = true;
      progressState.diagnosticScore = Math.max(0, Number(savedDiagnostic.score || 0));
      progressState.recommendedStartIndex = Math.max(0, Number(savedDiagnostic.recommendedStartIndex || 0));
    } else {
      progressState.diagnosticCompleted = false;
      progressState.diagnosticScore = null;
      progressState.recommendedStartIndex = 0;
    }

    Array.from(progressState.completedModules).forEach((idx) => {
      const mastery = getModuleMasteryState(idx);
      mastery.quizPassed = true;
      mastery.transferPassed = true;
      mastery.transferFeedback = 'Previously completed module.';
    });

    if (progressState.diagnosticCompleted && progressState.completedModules.size === 0) {
      const targetIndex = Math.max(0, Math.min(progressState.recommendedStartIndex, Math.max(0, list.length - 1)));
      progressState.currentModuleIndex = targetIndex;
    }
    const narrationData = list.map((moduleItem, index) => buildModuleNarrationEntry(moduleItem, index));
    progressState.moduleNarration = narrationData.map((entry) => entry.narration);
    progressState.moduleNarrationSegments = narrationData.map((entry) => entry.segments);
    updateProgressUi();
    renderModuleAccordion();
    renderProgressiveContent();
    updateProgressiveSections();
  }

  function getModuleLessonSections(moduleItem) {
    const steps = asArray(moduleItem?.workedExampleSteps).map((step, index) => `Step ${index + 1}: ${String(step)}`);
    return [
      {
        key: 'objective',
        label: 'Objective',
        preview: String(moduleItem?.objective || 'Understand what this module is designed to teach.'),
        narration: `Objective. ${String(moduleItem?.objective || 'Understand what this module is designed to teach.')}`
      },
      {
        key: 'lesson',
        label: 'Lesson',
        preview: String(moduleItem?.lesson || 'Core lesson content is not available.'),
        narration: `Lesson. ${String(moduleItem?.lesson || 'Core lesson content is not available.')}`
      },
      {
        key: 'workedExample',
        label: 'Example',
        preview: String(moduleItem?.workedExample || 'Worked example is not available.'),
        narration: `Worked example. ${String(moduleItem?.workedExample || 'Worked example is not available.')} ${steps.join(' ')}`.trim()
      },
      {
        key: 'commonMistake',
        label: 'Mistake',
        preview: String(moduleItem?.commonMistake || 'There is no common mistake listed for this module.'),
        narration: `Common mistake to avoid. ${String(moduleItem?.commonMistake || 'There is no common mistake listed for this module.')}`
      },
      {
        key: 'practiceTask',
        label: 'Practice',
        preview: String(moduleItem?.practiceTask || 'Practice task is not available.'),
        narration: `Practice task. ${String(moduleItem?.practiceTask || 'Practice task is not available.')}`
      },
      {
        key: 'progressCheck',
        label: 'Checkpoint',
        preview: String(moduleItem?.progressCheckQuestion || 'Checkpoint question is not available.'),
        narration: `Checkpoint question. ${String(moduleItem?.progressCheckQuestion || 'Checkpoint question is not available.')}`
      }
    ];
  }

  function renderModuleAccordion() {
    const accordionEl = document.getElementById('courseModuleAccordion');
    const headingEl = document.getElementById('moduleCountHeading');
    const statEl = document.getElementById('moduleCountStat');
    if (!accordionEl || !progressState.allModules) return;

    const list = progressState.allModules;
    const currentIdx = Math.max(0, Math.min(Number(progressState.currentModuleIndex || 0), list.length - 1));
    const diagnosticDone = Boolean(progressState.diagnosticCompleted);

    if (headingEl) headingEl.textContent = `There are ${list.length} modules in this course`;
    if (statEl) statEl.textContent = `${list.length} modules`;

    // Display a realistic checkpoint cadence: two graded checkpoints per module plus final certification.
    const assessmentDetail = document.getElementById('assessmentCountDetail');
    if (assessmentDetail) assessmentDetail.textContent = `${list.length * 2} module checkpoints + final certification assessment`;

    accordionEl.innerHTML = list.map((mod, idx) => {
      const title = escapeHtml(String(mod?.title || `Module ${idx + 1}`));
      const objective = escapeHtml(String(mod?.objective || 'Module objective will appear here.'));
      const isCompleted = progressState.completedModules.has(idx);
      const isCurrent = idx === currentIdx && !isCompleted;
      const isLocked = !isCompleted && (diagnosticDone ? idx > currentIdx : false);

      let statusIcon, statusColor;
      if (isCompleted) {
        statusIcon = '✓';
        statusColor = '#22c55e';
      } else if (isCurrent) {
        statusIcon = '▶';
        statusColor = '#60a5fa';
      } else {
        statusIcon = '○';
        statusColor = '#475569';
      }

      const itemClass = [
        'crs-week-item',
        isCompleted ? 'is-complete' : '',
        isCurrent ? 'is-current' : '',
        isLocked ? 'is-locked' : ''
      ].filter(Boolean).join(' ');

      const hoursPerModule = mod.hours ? `~${mod.hours}` : Math.round(10 / Math.max(1, list.length) * 10) / 10;
      const defaultOpen = (isCurrent || (!diagnosticDone && idx === 0)) ? 'open' : '';
      const statusText = isCompleted
        ? 'Completed'
        : (isCurrent ? 'Current active week' : (isLocked ? 'Locked until previous week passes' : 'Available now'));

      return `
        <details class="${itemClass}" data-week-item="${idx}" ${defaultOpen}>
          <summary class="crs-week-summary" data-week-summary="${idx}">
            <div class="crs-week-left">
              <span class="crs-week-status-icon" style="color:${statusColor};">${statusIcon}</span>
              <div>
                <h3 class="crs-week-title">Week ${idx + 1}: ${title}</h3>
                <div class="crs-week-meta">Week ${idx + 1} &bull; ~${hoursPerModule} hours to complete</div>
              </div>
            </div>
            <div class="crs-week-right">
              <span class="crs-week-detail-label">Module details</span>
              <span class="crs-week-chevron">▼</span>
            </div>
          </summary>
          <div class="crs-week-body">
            ${isCurrent ? '<div class="crs-week-active-indicator">&#8595; Active week — full lesson content is shown below.</div>' : ''}
            <div class="crs-week-meta">Status: ${statusText}</div>
            <p class="crs-week-objective"><strong>Objective:</strong> ${objective}</p>
          </div>
        </details>
      `;
    }).join('');
  }

  function renderProgressiveContent() {
    if (!modules || !progressState.allModules) return;
    const list = progressState.allModules;
    if (!list.length) {
      modules.innerHTML = '<div class="module-item"><p>Modules are not available right now.</p></div>';
      return;
    }

    const completed = progressState.completedModules.size;
    const currentIdx = Math.max(0, Math.min(Number(progressState.currentModuleIndex || 0), list.length - 1));
    const currentModule = list[currentIdx];
    const isAllComplete = completed >= list.length;

    let html = '';

    if (!progressState.diagnosticCompleted && progressState.diagnosticQuestions.length) {
      const diagnosticRows = progressState.diagnosticQuestions.map((question, qIdx) => `
        <div style="padding:12px;border-radius:8px;background:#0b1220;border:1px solid #273449;">
          <div style="color:#d0d9e7;font-weight:700;margin-bottom:8px;line-height:1.5;">${qIdx + 1}. ${escapeHtml(question.question)}</div>
          <div style="display:grid;gap:8px;">
            ${question.options.map((option, oIdx) => `
              <label style="display:grid;grid-template-columns:18px minmax(0,1fr);column-gap:10px;align-items:flex-start;padding:8px 10px;border-radius:8px;background:#111c31;border:1px solid #2a3954;color:#d0d9e7;cursor:pointer;">
                <input type="radio" name="course-diagnostic-${qIdx}" value="${oIdx}" style="margin-top:3px;accent-color:#10b981;" />
                <span>${escapeHtml(String(option))}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `).join('');

      html += `
        <section class="module-item" style="border-color:#0ea5e9;background:#0b1a2e;">
          <h4 style="margin:0 0 8px 0;color:#bfdbfe;">Placement Diagnostic (3 minutes)</h4>
          <p style="margin:0 0 12px 0;color:#cbd5e1;line-height:1.6;">Complete this quick check first. It places you on a foundation-first or accelerated path so learning is adaptive.</p>
          <div style="display:grid;gap:10px;">${diagnosticRows}</div>
          <div style="display:flex;flex-direction:column;align-items:flex-start;gap:8px;margin-top:12px;">
            <button type="button" data-course-diagnostic-submit="1" style="background:#2563eb;border:none;color:#fff;border-radius:8px;padding:9px 12px;cursor:pointer;font-size:0.85rem;font-weight:700;">Submit Diagnostic</button>
            <div data-course-diagnostic-result style="color:#9fb0c7;font-size:0.85rem;line-height:1.5;">Your recommended starting module will appear here.</div>
          </div>
        </section>
      `;
    } else if (progressState.diagnosticCompleted && Number.isFinite(progressState.diagnosticScore)) {
      const total = Math.max(1, asArray(progressState.diagnosticQuestions).length);
      const score = Number(progressState.diagnosticScore || 0);
      const recommended = Number(progressState.recommendedStartIndex || 0);
      html += `<div style="margin-bottom:16px;padding:12px;border-radius:10px;background:#052e2b;border:1px solid #0f766e;color:#99f6e4;"><strong>Placement complete:</strong> ${score}/${total}. Recommended start: Module ${recommended + 1}.</div>`;
    }

    if (progressState.lastProgressFeedback?.message) {
      const isSuccess = progressState.lastProgressFeedback.type === 'success';
      const fbIcon = isSuccess ? '✓' : '✗';
      const fbLabel = isSuccess ? 'Correct' : 'Not quite';
      const fbMsg = escapeHtml(progressState.lastProgressFeedback.message);
      html += `<div style="margin-bottom:16px;padding:14px;border-radius:10px;border:1px solid ${isSuccess ? '#10b981' : '#f59e0b'};background:${isSuccess ? '#052e25' : '#3b1d12'};line-height:1.6;"><span style="font-weight:700;color:${isSuccess ? '#86efac' : '#fda4af'}">${fbIcon} ${fbLabel}.</span> <span style="color:${isSuccess ? '#a7f3d0' : '#fde68a'}">${fbMsg}</span></div>`;
    }

    if (completed > 0) {
      html += `<div style="margin-bottom:20px;padding:14px;border-radius:10px;background:#0d2438;border:1px solid #0ea5e9;color:#7dd3fc;">
        <strong style="font-size:0.9rem;">Progress:</strong> ${completed} of ${list.length} modules completed ✓
      </div>`;
    }

    if (isAllComplete) {
      html += `<div style="margin-bottom:20px;padding:16px;border-radius:10px;background:#065f46;border:1px solid #10b981;color:#a7f3d0;text-align:center;font-weight:700;font-size:1rem;">
        🎉 All modules complete! Your capstone project and final assessment are now unlocked below.
      </div>`;
    } else {
      const index = currentIdx;
      const moduleItem = currentModule;
      const title = escapeHtml(String(moduleItem?.title || `Module ${index + 1}`));
      const objective = escapeHtml(String(moduleItem?.objective || ''));
      const lesson = String(moduleItem?.lesson || '');
      const lessonStructuredHtml = renderStructuredLessonHtml(lesson);
      const workedExample = escapeHtml(String(moduleItem?.workedExample || ''));
      const workedExampleSteps = asArray(moduleItem?.workedExampleSteps);
      const workedExampleStepsHtml = workedExampleSteps.length
        ? `<div class="crs-example-walkthrough" style="display:block;width:100%;max-width:100%;min-width:0;margin-top:8px;padding:10px;border-radius:8px;background:#0b1220;border:1px solid #273449;">
            <div style="color:#93c5fd;font-weight:700;font-size:0.86rem;margin-bottom:6px;">Step-by-Step Example Walkthrough</div>
            <ol style="margin:0;padding-left:18px;color:#d0d9e7;line-height:1.55;display:grid;gap:4px;width:100%;max-width:100%;min-width:0;overflow-wrap:anywhere;word-break:break-word;">
              ${workedExampleSteps.map((step) => `<li>${escapeHtml(String(step))}</li>`).join('')}
            </ol>
          </div>`
        : '';
      const commonMistake = escapeHtml(String(moduleItem?.commonMistake || ''));
      const practiceTask = escapeHtml(String(moduleItem?.practiceTask || ''));
      const colabLink = String(moduleItem?.colabLink || '').trim();
      const labTitle = String(moduleItem?.labTitle || '').trim();
      const labInstructions = String(moduleItem?.labInstructions || '').trim();
      const quizQuestionsData = asArray(moduleItem?.quizQuestions);
      const hasMultiQuiz = quizQuestionsData.length > 0;
      const progressCheckQuestion = escapeHtml(String(moduleItem?.progressCheckQuestion || `In one sentence, what is the key takeaway of module ${index + 1}?`));
      const progressCheckOptions = asArray(moduleItem?.progressCheckOptions).slice(0, 4);
      const mastery = getModuleMasteryState(index);
      const diagnosticLocked = !progressState.diagnosticCompleted;
      const pendingAdvance = progressState.pendingAdvance && Number(progressState.pendingAdvance.idx) === index
        ? progressState.pendingAdvance
        : null;
      const optionMarkup = progressCheckOptions.map((option, optionIndex) => `
        <label style="display:grid;grid-template-columns:18px minmax(0,1fr);align-items:flex-start;column-gap:10px;width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;background:#111c31;border:1px solid #2a3954;cursor:pointer;color:#d0d9e7;overflow:hidden;">
          <input type="radio" name="module-progress-check-${index}" data-progress-check-option="${index}" value="${optionIndex}" ${(pendingAdvance || diagnosticLocked) ? 'disabled' : ''} style="margin-top:3px;accent-color:#2563eb;" />
          <span style="line-height:1.5;word-break:break-word;overflow-wrap:anywhere;white-space:normal;min-width:0;max-width:100%;flex:1 1 auto;display:block;">${escapeHtml(String(option))}</span>
        </label>
      `).join('');
      const pendingResultMarkup = pendingAdvance
        ? `<span style="font-weight:700;color:#86efac;">✓ Correct.</span> <span style="color:#d0d9e7;">${escapeHtml(String(pendingAdvance.feedbackMessage || ''))}</span>`
        : '';

      const colabPanelHtml = colabLink ? `
        <div style="margin:10px 0 12px;padding:14px;border-radius:10px;background:#0c1a2e;border:1px solid #f59e0b;display:grid;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#fbbf24;background:#3d2500;border:1px solid #f59e0b;border-radius:6px;padding:3px 8px;">Coding Lab</span>
            <span style="font-weight:700;color:#fde68a;font-size:0.9rem;">${escapeHtml(labTitle)}</span>
          </div>
          <p style="margin:0;color:#d0d9e7;font-size:0.87rem;line-height:1.6;">${escapeHtml(labInstructions)}</p>
          <a href="${escapeHtml(colabLink)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:6px;background:#f59e0b;color:#0c0a00;font-weight:700;font-size:0.84rem;border-radius:8px;padding:8px 14px;text-decoration:none;width:fit-content;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            Open Notebook in Colab
          </a>
        </div>
      ` : '';

      const multiQuizHtml = hasMultiQuiz ? `
        <div data-module-follow-idx="${index}" data-module-follow-part="progressCheck" style="margin-top:12px;padding:12px;border-radius:10px;background:#0b1220;border:1px solid #273449;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
            <span style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#c4b5fd;background:#1e1040;border:1px solid #7c3aed;border-radius:6px;padding:3px 8px;">Checkpoint Quiz (1 of 2)</span>
            <span style="font-size:0.82rem;color:#94a3b8;">Pass at least 75% (${Math.ceil(quizQuestionsData.length * 0.75)} of ${quizQuestionsData.length}) to unlock Checkpoint 2.</span>
          </div>
          <div data-quiz-panel="${index}" style="display:grid;gap:10px;margin-top:10px;">
            ${quizQuestionsData.map((q, qIdx) => `
              <div style="padding:12px;border-radius:8px;background:#0b1220;border:1px solid #273449;">
                <div style="color:#d0d9e7;font-weight:700;margin-bottom:8px;line-height:1.5;font-size:0.9rem;">${qIdx + 1}. ${escapeHtml(String(q.question || ''))}</div>
                <div style="display:grid;gap:6px;">
                  ${asArray(q.options).map((opt, oIdx) => `
                    <label style="display:grid;grid-template-columns:18px minmax(0,1fr);column-gap:10px;align-items:flex-start;padding:8px 10px;border-radius:8px;background:#111c31;border:1px solid #2a3954;color:#d0d9e7;cursor:pointer;transition:border-color 0.15s;">
                      <input type="radio" name="module-quiz-${index}-${qIdx}" value="${oIdx}" ${(pendingAdvance || diagnosticLocked) ? 'disabled' : ''} style="margin-top:3px;accent-color:#7c3aed;" />
                      <span style="line-height:1.5;word-break:break-word;">${escapeHtml(String(opt))}</span>
                    </label>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-start;gap:8px;margin-top:10px;">
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              <button type="button" data-module-quiz-submit-btn="${index}" ${(pendingAdvance || diagnosticLocked) ? 'disabled' : ''} style="background:#7c3aed;border:none;color:#fff;border-radius:6px;padding:8px 14px;${(pendingAdvance || diagnosticLocked) ? 'opacity:0.75;cursor:default;' : 'cursor:pointer;'}font-size:0.84rem;font-weight:700;">${pendingAdvance ? 'Quiz Passed ✓' : (diagnosticLocked ? 'Complete Diagnostic First' : 'Submit Quiz')}</button>
              <button type="button" data-progress-continue-btn="${index}" style="display:${pendingAdvance ? 'inline-flex' : 'none'};background:#0f766e;border:1px solid #14b8a6;color:#ecfeff;border-radius:6px;padding:8px 14px;cursor:pointer;font-size:0.84rem;font-weight:700;">Continue to Next Module</button>
            </div>
            <div data-quiz-result="${index}" style="font-size:0.85rem;color:#9fb0c7;line-height:1.5;word-break:break-word;width:100%;">${pendingAdvance ? pendingResultMarkup : ''}</div>
            <div data-progress-check-result="${index}" style="display:none;"></div>
          </div>
        </div>
      ` : `
        <div data-module-follow-idx="${index}" data-module-follow-part="progressCheck" style="margin-top:12px;padding:10px;border-radius:8px;background:#0b1220;border:1px solid #273449;">
          <div style="font-size:0.82rem;color:#c4b5fd;font-weight:700;margin-bottom:6px;">End-of-Module Practice</div>
          <div style="color:#d0d9e7;font-size:calc(0.9rem + 2pt);line-height:1.55;margin-bottom:8px;">${progressCheckQuestion}</div>
          <div style="display:grid;gap:8px;margin-bottom:10px;">${optionMarkup}</div>
          <div style="display:flex;flex-direction:column;align-items:flex-start;gap:8px;">
            <button type="button" data-progress-check-btn="${index}" ${(pendingAdvance || diagnosticLocked) ? 'disabled' : ''} style="background:#7c3aed;border:none;color:#fff;border-radius:6px;padding:7px 10px;${(pendingAdvance || diagnosticLocked) ? 'opacity:0.75;cursor:default;' : 'cursor:pointer;'}font-size:0.82rem;font-weight:700;">${pendingAdvance ? 'Correct!' : (diagnosticLocked ? 'Complete Diagnostic First' : 'Submit Answer')}</button>
            <button type="button" data-progress-continue-btn="${index}" style="display:${pendingAdvance ? 'inline-flex' : 'none'};background:#0f766e;border:1px solid #14b8a6;color:#ecfeff;border-radius:6px;padding:7px 10px;cursor:pointer;font-size:0.82rem;font-weight:700;">Continue to Next Module</button>
            <div data-progress-check-result="${index}" style="font-size:calc(0.82rem + 2pt);color:#9fb0c7;line-height:1.5;word-break:break-word;overflow-wrap:anywhere;width:100%;">${pendingResultMarkup}</div>
          </div>
        </div>
      `;

      html += `
        <section class="module-item">
          <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:10px;margin-bottom:8px;">
            <h4 data-module-follow-idx="${index}" data-module-follow-part="title" style="margin:0;min-width:0;">Module ${index + 1} of ${list.length}: ${title}</h4>
            <div style="display:inline-flex;align-items:center;gap:8px;justify-self:end;max-width:100%;color:#93c5fd;font-size:0.82rem;padding:6px 10px;border-radius:999px;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.35);">
              <span aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;flex:0 0 14px;border-radius:50%;background:#60a5fa;color:#fff;font-size:0.7rem;font-weight:700;">↓</span>
              <span style="white-space:normal;word-break:break-word;line-height:1.2;">Current</span>
            </div>
          </div>
          <p data-module-follow-idx="${index}" data-module-follow-part="objective"><strong style="color:#93c5fd;">Objective:</strong> ${objective}</p>
          <div data-module-follow-idx="${index}" data-module-follow-part="lesson" style="margin:0 0 12px 0;padding:12px;border-radius:10px;background:#0b1220;border:1px solid #273449;">
            <div style="color:#93c5fd;font-weight:700;font-size:0.85rem;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em;">Lesson Breakdown</div>
            ${lessonStructuredHtml}
          </div>
          <div data-module-follow-idx="${index}" data-module-follow-part="workedExample">
            <p><strong style="color:#93c5fd;">Example (What this means in practice):</strong> ${workedExample}</p>
            ${workedExampleStepsHtml}
          </div>
          <p data-module-follow-idx="${index}" data-module-follow-part="commonMistake"><strong style="color:#fda4af;">Common Mistake:</strong> ${commonMistake}</p>
          <p data-module-follow-idx="${index}" data-module-follow-part="practiceTask"><strong style="color:#86efac;">Practice Task:</strong> ${practiceTask}</p>
          ${colabPanelHtml}
          <div style="margin:10px 0 12px;padding:12px;border-radius:10px;background:#0b1220;border:1px solid #273449;">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:10px;">
              <div>
                <div style="font-size:0.82rem;color:#7dd3fc;text-transform:uppercase;letter-spacing:0.04em;font-weight:700;margin-bottom:4px;">Module Lesson Player</div>
                <div style="color:#cbd5e1;font-size:0.9rem;line-height:1.5;">Each section has its own guided lesson so the learner can watch one concept at a time.</div>
              </div>
              <label style="display:inline-flex;align-items:center;gap:6px;color:#cbd5e1;font-size:0.8rem;">
                Speed
                <select data-module-lesson-rate="${index}" style="background:#0f172a;border:1px solid #2a3954;color:#f1f5f9;border-radius:8px;padding:7px 10px;">
                  <option value="0.9">0.9x</option>
                  <option value="1" selected>1.0x</option>
                  <option value="1.15">1.15x</option>
                  <option value="1.3">1.3x</option>
                </select>
              </label>
            </div>
            <div data-module-lesson-stage="${index}" style="margin-bottom:10px;padding:14px;border-radius:10px;background:linear-gradient(135deg,#0f172a,#10263a);border:1px solid #1f4c6d;min-height:120px;">
              <div style="font-size:0.78rem;color:#7dd3fc;text-transform:uppercase;letter-spacing:0.04em;font-weight:700;margin-bottom:6px;">Guided Lesson</div>
              <div data-module-lesson-stage-title="${index}" style="font-size:1rem;color:#e2e8f0;font-weight:700;margin-bottom:8px;">Choose a section to start.</div>
              <div data-module-lesson-stage-body="${index}" style="font-size:0.92rem;color:#cbd5e1;line-height:1.6;">Pick Objective, Lesson, Example, Mistake, Practice, or Checkpoint to teach that section inside this module.</div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;">
              ${getModuleLessonSections(moduleItem).map((section) => `<button type="button" data-module-lesson-btn="${index}" data-module-lesson-part="${section.key}" style="background:#0f172a;border:1px solid #2a3954;color:#d0d9e7;border-radius:8px;padding:10px 12px;cursor:pointer;font-size:0.82rem;font-weight:700;text-align:left;">${escapeHtml(section.label)}</button>`).join('')}
            </div>
            <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0 0 0;">
              <button type="button" data-module-lesson-pause-btn="${index}" disabled style="background:#1e293b;border:1px solid #475569;color:#e2e8f0;border-radius:8px;padding:8px 12px;cursor:default;font-size:0.82rem;font-weight:700;opacity:0.65;">Pause Lesson</button>
            </div>
          </div>
          <div data-module-audio-follow-status="${index}" style="margin:-2px 0 10px;color:#7dd3fc;font-size:0.8rem;font-weight:700;">Lesson player ready: choose a section to begin.</div>
          <div style="margin:0 0 10px;padding:10px;border-radius:8px;background:#0b1220;border:1px solid #273449;">
            <div style="font-size:0.82rem;color:#c4b5fd;font-weight:700;margin-bottom:6px;">Transfer Task (Checkpoint 2 of 2)</div>
            <div style="color:#d0d9e7;font-size:0.85rem;line-height:1.55;margin-bottom:8px;">Apply this module in a new scenario. Explain your approach, decisions, and why they align with the objective.</div>
            <textarea data-transfer-response="${index}" placeholder="Write your transfer response (minimum 120 characters)..." style="width:100%;min-height:86px;padding:10px;background:#111c31;border:1px solid #2a3954;border-radius:8px;color:#d0d9e7;font-family:inherit;font-size:0.88rem;resize:vertical;">${escapeHtml(String(mastery.transferText || ''))}</textarea>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px;">
              <button type="button" data-transfer-submit-btn="${index}" ${diagnosticLocked ? 'disabled' : ''} style="background:#0f766e;border:1px solid #14b8a6;color:#ecfeff;border-radius:6px;padding:7px 10px;${diagnosticLocked ? 'opacity:0.65;cursor:default;' : 'cursor:pointer;'}font-size:0.82rem;font-weight:700;">Validate Transfer Task</button>
              <span style="font-size:0.8rem;color:${mastery.transferPassed ? '#86efac' : '#fbbf24'};font-weight:700;">${mastery.transferPassed ? 'Transfer status: Passed' : 'Transfer status: Pending'}</span>
            </div>
            <div data-transfer-feedback="${index}" style="margin-top:6px;color:#9fb0c7;font-size:0.82rem;line-height:1.5;">${escapeHtml(String(mastery.transferFeedback || 'Validate transfer mastery before unlock.'))}</div>
          </div>
          ${multiQuizHtml}
        </section>
      `;
    }

    modules.innerHTML = html;
  }

  function formatCountdown(totalMs) {
    const safeMs = Math.max(0, Number(totalMs || 0));
    const totalSeconds = Math.ceil(safeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function renderDomainBreakdown(domainBreakdown, threshold) {
    const rows = asArray(domainBreakdown);
    if (!rows.length) return '';
    return `
      <div style="display:grid;gap:8px;margin-top:12px;">
        ${rows.map((row) => {
          const passed = Number(row?.score || 0) >= Number(threshold || 0);
          return `<div style="padding:10px 12px;border-radius:8px;background:${passed ? '#052e16' : '#2f1313'};border:1px solid ${passed ? '#166534' : '#7f1d1d'};">
            <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
              <strong style="color:${passed ? '#86efac' : '#fda4af'};">${escapeHtml(String(row?.label || 'Domain'))}</strong>
              <span style="color:#d0d9e7;">${Number(row?.score || 0)}% (${Number(row?.correct || 0)}/${Number(row?.total || 0)})</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    `;
  }

  function calculateCertificationOutcome(items, answers, certificationPlan) {
    const rows = asArray(items);
    const plan = certificationPlan || createCertificationPlan(getCourseCoverageTargets(topic || ''), null);
    const domains = asArray(plan?.domains).length ? asArray(plan.domains) : CERTIFICATION_DOMAINS;
    const domainMap = new Map(domains.map((domain) => [String(domain.key), {
      key: String(domain.key),
      label: String(domain.label),
      correct: 0,
      total: 0
    }]));
    const reviewRows = [];
    let correct = 0;
    let total = 0;

    rows.forEach((item, index) => {
      const options = asArray(item?.options);
      if (options.length < 2) return;
      const selectedIndex = Number(answers[index]);
      const correctIndex = Number(item?.correctOptionIndex);
      const selectedText = String(options[selectedIndex] || 'No answer selected');
      const correctText = String(options[correctIndex] || 'N/A');
      const isCorrect = selectedIndex === correctIndex;
      const fallbackDomain = domains[index % domains.length] || CERTIFICATION_DOMAINS[0];
      const domainKey = String(item?.domainKey || fallbackDomain.key);
      const domainLabel = String(item?.domainLabel || fallbackDomain.label);
      const existing = domainMap.get(domainKey) || { key: domainKey, label: domainLabel, correct: 0, total: 0 };
      existing.label = domainLabel;
      existing.total += 1;
      if (isCorrect) {
        existing.correct += 1;
        correct += 1;
      } else if (reviewRows.length < 25) {
        reviewRows.push(`
          <div style="margin-bottom:10px;padding:10px;border-radius:8px;border:1px solid #7f1d1d;background:#2f1313;">
            <div style="font-weight:700;color:#fda4af;margin-bottom:4px;">Question ${index + 1}: Incorrect</div>
            <div style="color:#d0d9e7;"><strong>Your answer:</strong> ${escapeHtml(selectedText)}</div>
            <div style="color:#bfdbfe;"><strong>Correct answer:</strong> ${escapeHtml(correctText)}</div>
            ${item?.explanation ? `<div style="color:#cbd5e1;"><strong>Why:</strong> ${escapeHtml(String(item.explanation))}</div>` : ''}
          </div>
        `);
      }
      total += 1;
      domainMap.set(domainKey, existing);
    });

    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const letterGrade = score >= 90 ? 'A'
      : score >= 80 ? 'B'
        : score >= 70 ? 'C'
          : score >= 60 ? 'D'
            : 'F';
    const domainBreakdown = Array.from(domainMap.values())
      .filter((row) => row.total > 0)
      .map((row) => ({
        ...row,
        score: row.total > 0 ? Math.round((row.correct / row.total) * 100) : 0
      }));
    const failingDomains = domainBreakdown.filter((row) => row.score < Number(plan.domainPassMark || 0));
    const passed = score >= Number(plan.overallPassMark || 0) && failingDomains.length === 0;

    return {
      score,
      letterGrade,
      correct,
      total,
      passed,
      overallPassMark: Number(plan.overallPassMark || 0),
      domainPassMark: Number(plan.domainPassMark || 0),
      domainBreakdown,
      failingDomains,
      reviewRows
    };
  }

  function renderPracticeBank(rows) {
    const items = asArray(rows);
    if (!practiceBank) return;
    const isAllModuleComplete = progressState.totalModules > 0 && progressState.completedModules.size >= progressState.totalModules;
    if (!isAllModuleComplete) {
      practiceBank.innerHTML = '<div class="module-item"><p style="color:#9fb0c7;">Practice questions unlock only after you complete all course modules.</p></div>';
      return;
    }
    if (!items.length) {
      practiceBank.innerHTML = '<div class="module-item"><p>Practice questions are not available yet.</p></div>';
      return;
    }

    progressState.practiceBankItems = items;
    const pageSize = 10;
    const totalPages = Math.ceil(items.length / pageSize);
    const currentPage = Math.max(1, Math.min(Number(progressState.practiceBankPage || 1), totalPages));
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, items.length);
    const pageItems = items.slice(startIdx, endIdx);
    const paginationHtml = totalPages > 1 ? `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-radius:8px;background:#0d2438;border:1px solid #0ea5e9;margin-bottom:16px;gap:12px;flex-wrap:wrap;">
        <button type="button" data-practice-prev-page style="background:#3b82f6;border:none;color:#fff;border-radius:6px;padding:8px 12px;cursor:pointer;font-size:0.85rem;font-weight:700;${currentPage <= 1 ? 'opacity:0.5;cursor:not-allowed;' : ''}">← Previous</button>
        <span style="color:#93c5fd;font-size:0.9rem;font-weight:700;">Practice ${startIdx + 1}–${endIdx} of ${items.length}</span>
        <button type="button" data-practice-next-page style="background:#3b82f6;border:none;color:#fff;border-radius:6px;padding:8px 12px;cursor:pointer;font-size:0.85rem;font-weight:700;${currentPage >= totalPages ? 'opacity:0.5;cursor:not-allowed;' : ''}">Next →</button>
      </div>
    ` : '';

    practiceBank.innerHTML = `
      <div style="padding:14px;border-radius:10px;background:#0d2438;border:1px solid #0ea5e9;color:#7dd3fc;margin-bottom:16px;font-size:0.9rem;">
        <strong>Practice Bank:</strong> Work through ${items.length} answer-rationalized questions before attempting the mocks and final exam.
      </div>
      ${paginationHtml}
      ${pageItems.map((item, pageIdx) => {
        const globalIdx = startIdx + pageIdx;
        const options = asArray(item?.options);
        const revealKey = String(globalIdx);
        const isRevealed = progressState.practiceRevealState[revealKey] === true;
        const correctIndex = Number(item?.correctOptionIndex);
        return `
          <div class="module-item">
            <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:8px;">
              <strong style="color:#c4b5fd;">Practice Question ${globalIdx + 1}</strong>
              <span style="color:#93c5fd;font-size:0.82rem;">${escapeHtml(String(item?.domainLabel || 'Certification domain'))}</span>
            </div>
            <p style="margin-bottom:10px;">${escapeHtml(String(item?.question || ''))}</p>
            <div style="display:grid;gap:8px;">
              ${options.map((option, optionIndex) => `<div style="padding:10px 12px;border-radius:8px;background:${isRevealed && optionIndex === correctIndex ? '#052e16' : '#111c31'};border:1px solid ${isRevealed && optionIndex === correctIndex ? '#166534' : '#2a3954'};color:#d0d9e7;">${escapeHtml(String(option))}</div>`).join('')}
            </div>
            <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;margin-top:12px;">
              <button type="button" data-practice-toggle-answer="${globalIdx}" style="background:#10b981;border:none;color:#fff;border-radius:6px;padding:8px 12px;cursor:pointer;font-size:0.85rem;font-weight:700;">${isRevealed ? 'Hide Answer' : 'Reveal Answer'}</button>
              ${isRevealed ? `<div style="color:#d0d9e7;font-size:0.88rem;line-height:1.55;flex:1 1 360px;"><strong style="color:#86efac;">Best answer:</strong> ${escapeHtml(String(options[correctIndex] || ''))}<br /><strong style="color:#93c5fd;">Why:</strong> ${escapeHtml(String(item?.explanation || ''))}</div>` : ''}
            </div>
          </div>
        `;
      }).join('')}
      ${paginationHtml}
    `;
  }

  function clearMockExamTimer() {
    if (progressState.mockExamTimerId) {
      window.clearInterval(progressState.mockExamTimerId);
      progressState.mockExamTimerId = null;
    }
  }

  function submitActiveMockExam(expired) {
    const active = progressState.activeMockExam;
    if (!active) return;
    const exam = progressState.mockExams[active.examIndex];
    if (!exam) return;

    const outcome = calculateCertificationOutcome(exam.questions, active.answers, progressState.certificationPlan);
    progressState.mockExamResults[String(active.examIndex)] = {
      ...outcome,
      expired: expired === true,
      completedAt: new Date().toISOString()
    };
    progressState.activeMockExam = null;
    clearMockExamTimer();
    renderMockExams(progressState.mockExams);
  }

  function startMockExam(index) {
    const exam = progressState.mockExams[index];
    if (!exam) return;
    clearMockExamTimer();
    progressState.activeMockExam = {
      examIndex: index,
      currentPage: 1,
      startedAt: Date.now(),
      endsAt: Date.now() + (Math.max(1, Number(exam?.timeLimitMinutes || 60)) * 60 * 1000),
      answers: new Array(asArray(exam?.questions).length).fill(null)
    };
    renderMockExams(progressState.mockExams);
    progressState.mockExamTimerId = window.setInterval(() => {
      const current = progressState.activeMockExam;
      if (!current) {
        clearMockExamTimer();
        return;
      }
      const remaining = Number(current.endsAt || 0) - Date.now();
      const timerEl = document.getElementById('activeMockExamTimer');
      if (timerEl) timerEl.textContent = formatCountdown(remaining);
      if (remaining <= 0) submitActiveMockExam(true);
    }, 1000);
  }

  function renderMockExams(exams) {
    const rows = asArray(exams);
    if (!mockExams) return;

    const isAllModuleComplete = progressState.totalModules > 0 && progressState.completedModules.size >= progressState.totalModules;
    if (!isAllModuleComplete) {
      mockExams.innerHTML = '<div class="module-item"><p style="color:#9fb0c7;">Complete all course modules first. Timed mock exams unlock after you finish the teaching pathway.</p></div>';
      return;
    }
    if (!rows.length) {
      mockExams.innerHTML = '<div class="module-item"><p>Timed mock exams are not available yet.</p></div>';
      return;
    }

    const active = progressState.activeMockExam;
    if (active && rows[active.examIndex]) {
      const exam = rows[active.examIndex];
      const questions = asArray(exam?.questions);
      const pageSize = 10;
      const totalPages = Math.ceil(questions.length / pageSize);
      const currentPage = Math.max(1, Math.min(Number(active.currentPage || 1), totalPages));
      const startIdx = (currentPage - 1) * pageSize;
      const endIdx = Math.min(startIdx + pageSize, questions.length);
      const pageItems = questions.slice(startIdx, endIdx);
      const remaining = Number(active.endsAt || 0) - Date.now();
      if (remaining <= 0) {
        submitActiveMockExam(true);
        return;
      }

      mockExams.innerHTML = `
        <div class="module-item" style="border-color:#0ea5e9;">
          <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:12px;">
            <div>
              <h4 style="margin:0 0 6px 0;">${escapeHtml(String(exam?.title || `Timed Mock ${active.examIndex + 1}`))}</h4>
              <p style="margin:0;color:#9fb0c7;">${escapeHtml(String(exam?.description || 'Timed certification readiness check.'))}</p>
            </div>
            <div style="padding:10px 14px;border-radius:999px;background:#3b1d12;border:1px solid #f59e0b;color:#fde68a;font-weight:700;">Time Left: <span id="activeMockExamTimer">${formatCountdown(remaining)}</span></div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-radius:8px;background:#0d2438;border:1px solid #0ea5e9;margin-bottom:16px;gap:12px;flex-wrap:wrap;">
            <button type="button" data-mock-prev-page style="background:#3b82f6;border:none;color:#fff;border-radius:6px;padding:8px 12px;cursor:pointer;font-size:0.85rem;font-weight:700;${currentPage <= 1 ? 'opacity:0.5;cursor:not-allowed;' : ''}">← Previous</button>
            <span style="color:#93c5fd;font-size:0.9rem;font-weight:700;">Mock ${startIdx + 1}–${endIdx} of ${questions.length}</span>
            <button type="button" data-mock-next-page style="background:#3b82f6;border:none;color:#fff;border-radius:6px;padding:8px 12px;cursor:pointer;font-size:0.85rem;font-weight:700;${currentPage >= totalPages ? 'opacity:0.5;cursor:not-allowed;' : ''}">Next →</button>
          </div>
          ${pageItems.map((item, pageIdx) => {
            const globalIdx = startIdx + pageIdx;
            const options = asArray(item?.options);
            const selected = active.answers[globalIdx];
            return `
              <div class="module-item" style="margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:8px;">
                  <strong style="color:#c4b5fd;">Question ${globalIdx + 1}</strong>
                  <span style="color:#93c5fd;font-size:0.82rem;">${escapeHtml(String(item?.domainLabel || 'Certification domain'))}</span>
                </div>
                <p style="margin-bottom:8px;">${escapeHtml(String(item?.question || ''))}</p>
                <div style="display:grid;gap:8px;">
                  ${options.map((option, optionIndex) => `
                    <label style="display:grid;grid-template-columns:18px minmax(0,1fr);align-items:flex-start;column-gap:10px;width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;background:#111c31;border:1px solid #2a3954;cursor:pointer;color:#d0d9e7;overflow:hidden;">
                      <input type="radio" name="mock-question-${globalIdx}" data-mock-choice="${globalIdx}" value="${optionIndex}" ${selected === optionIndex ? 'checked' : ''} style="margin-top:3px;accent-color:#10b981;" />
                      <span>${escapeHtml(String(option))}</span>
                    </label>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
          <button type="button" data-submit-mock-exam style="background:#10b981;border:none;color:#fff;border-radius:6px;padding:10px 16px;cursor:pointer;font-size:0.9rem;font-weight:700;width:100%;">Submit Timed Mock</button>
        </div>
      `;
      return;
    }

    clearMockExamTimer();
    mockExams.innerHTML = rows.map((exam, index) => {
      const result = progressState.mockExamResults[String(index)] || null;
      return `
        <div class="module-item">
          <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start;">
            <div>
              <h4 style="margin:0 0 6px 0;">${escapeHtml(String(exam?.title || `Timed Mock ${index + 1}`))}</h4>
              <p style="margin:0 0 8px 0;">${escapeHtml(String(exam?.description || 'Timed readiness check with rotating questions.'))}</p>
              <p style="margin:0;color:#9fb0c7;">${asArray(exam?.questions).length} questions • ${Math.max(1, Number(exam?.timeLimitMinutes || 60))} minutes</p>
            </div>
            <button type="button" data-start-mock-exam="${index}" style="background:#2563eb;border:none;color:#fff;border-radius:6px;padding:10px 14px;cursor:pointer;font-size:0.9rem;font-weight:700;">Start Mock ${index + 1}</button>
          </div>
          ${result ? `
            <div style="margin-top:12px;padding:12px;border-radius:8px;background:${result.passed ? '#052e16' : '#2f1313'};border:1px solid ${result.passed ? '#166534' : '#7f1d1d'};">
              <div style="font-weight:700;color:${result.passed ? '#86efac' : '#fda4af'};">Latest Result: ${result.score}% (${result.letterGrade})${result.expired ? ' • Time expired' : ''}</div>
              <div style="color:#d0d9e7;margin-top:6px;">Overall pass mark: ${result.overallPassMark}% • Domain pass mark: ${result.domainPassMark}%</div>
              ${renderDomainBreakdown(result.domainBreakdown, result.domainPassMark)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  function renderAssessment(rows) {
    const items = asArray(rows);
    if (!assessment) return;

    const isAllModuleComplete = progressState.totalModules > 0 && progressState.completedModules.size >= progressState.totalModules;

    if (!isAllModuleComplete) {
      assessment.innerHTML = '<div class="module-item"><p style="color:#9fb0c7;">Complete all course modules first. The final assessment will unlock when you finish Module ' + progressState.totalModules + '.</p></div>';
      return;
    }

    if (!items.length) {
      assessment.innerHTML = '<div class="module-item"><p>Assessment questions are not available yet.</p></div>';
      return;
    }

    progressState.assessmentItems = items;
    if (!progressState.assessmentCompleted && progressState.assessmentAnswers.length !== items.length) {
      progressState.assessmentAnswers = new Array(items.length).fill(null);
      progressState.assessmentScore = null;
    }
    const certificationPlan = progressState.certificationPlan || createCertificationPlan(getCourseCoverageTargets(topic || ''), null);

    // Pagination support for large exam sets
    const questionsPerPage = 10;
    const totalPages = Math.ceil(items.length / questionsPerPage);
    const currentPage = Math.max(1, Math.min(Number(progressState.assessmentCurrentPage || 1), totalPages));
    const startIdx = (currentPage - 1) * questionsPerPage;
    const endIdx = Math.min(startIdx + questionsPerPage, items.length);
    const pageItems = items.slice(startIdx, endIdx);

    const hasObjectiveItems = items.some((item) => asArray(item?.options).length >= 2);
    const paginationHtml = totalPages > 1 ? `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-radius:8px;background:#0d2438;border:1px solid #0ea5e9;margin-bottom:16px;gap:12px;flex-wrap:wrap;">
        <button type="button" data-assessment-prev-page style="background:#3b82f6;border:none;color:#fff;border-radius:6px;padding:8px 12px;cursor:pointer;font-size:0.85rem;font-weight:700;${currentPage <= 1 ? 'opacity:0.5;cursor:not-allowed;' : ''}">← Previous</button>
        <span style="color:#93c5fd;font-size:0.9rem;font-weight:700;">Question ${startIdx + 1}–${endIdx} of ${items.length} (Page ${currentPage}/${totalPages})</span>
        <button type="button" data-assessment-next-page style="background:#3b82f6;border:none;color:#fff;border-radius:6px;padding:8px 12px;cursor:pointer;font-size:0.85rem;font-weight:700;${currentPage >= totalPages ? 'opacity:0.5;cursor:not-allowed;' : ''}">Next →</button>
      </div>
    ` : '';

    assessment.innerHTML = `
      <div style="padding:14px;border-radius:10px;background:#0d2438;border:1px solid #0ea5e9;color:#7dd3fc;margin-bottom:16px;font-size:0.9rem;">
        <strong>Final Assessment:</strong> ${hasObjectiveItems
          ? `This certification exam has ${items.length} multiple-choice questions across the full course. To pass, you must meet the overall threshold of ${certificationPlan.overallPassMark}% and the domain threshold of ${certificationPlan.domainPassMark}% in each certification domain.`
          : 'Answer all questions to complete the course and unlock interview prep.'}
      </div>
      ${paginationHtml}
      ${pageItems.map((item, pageIdx) => {
        const globalIdx = startIdx + pageIdx;
        const question = String(item?.question || '');
        const options = asArray(item?.options);
        const selectedValue = progressState.assessmentAnswers[globalIdx];
        const optionMarkup = options.map((option, optionIndex) => `
          <label style="display:grid;grid-template-columns:18px minmax(0,1fr);align-items:flex-start;column-gap:10px;width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;background:#111c31;border:1px solid #2a3954;cursor:pointer;color:#d0d9e7;overflow:hidden;margin-bottom:8px;">
            <input type="radio" name="assessment-question-${globalIdx}" data-assessment-choice="${globalIdx}" value="${optionIndex}" ${selectedValue === optionIndex ? 'checked' : ''} style="margin-top:3px;accent-color:#10b981;" />
            <span style="line-height:1.5;word-break:break-word;overflow-wrap:anywhere;white-space:normal;min-width:0;max-width:100%;flex:1 1 auto;display:block;">${escapeHtml(String(option))}</span>
          </label>
        `).join('');
        return `
          <div class="module-item" style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:8px;"><strong style="color:#c4b5fd;">Question ${globalIdx + 1}:</strong><span style="color:#93c5fd;font-size:0.82rem;">${escapeHtml(String(item?.domainLabel || 'Certification domain'))}</span></div>
            <p style="margin-bottom:8px;">${escapeHtml(question)}</p>
            ${options.length >= 2
              ? `<div style="display:grid;gap:6px;">${optionMarkup}</div>`
              : `<textarea 
                  data-assessment-answer="${globalIdx}"
                  placeholder="Type your answer here..."
                  style="width:100%;min-height:80px;padding:10px;background:#111c31;border:1px solid #2a3954;border-radius:8px;color:#d0d9e7;font-family:inherit;font-size:0.9rem;resize:vertical;"
                >${escapeHtml(String(selectedValue || ''))}</textarea>`}
          </div>
        `;
      }).join('')}
      ${paginationHtml}
      <button type="button" id="submitAssessmentBtn" style="background:#10b981;border:none;color:#fff;border-radius:6px;padding:10px 16px;cursor:pointer;font-size:0.9rem;font-weight:700;margin-top:16px;width:100%;">Submit Assessment (${items.length} Questions)</button>
      <div id="assessmentResult" style="margin-top:12px;font-size:0.9rem;color:#9fb0c7;line-height:1.6;"></div>
    `;
  }

  function renderCourse(course) {
    const scaffoldedCourse = applyFromScratchCourseScaffold(course, topic);
    const sectionedCourse = applyUnifiedSubsectionStructure(scaffoldedCourse, topic);
    const normalizedCourse = applyCourseCoverageNormalization(sectionedCourse, topic);
    progressState.preferLocalProgressCheck = String(normalizedCourse?.progressCheckMode || '').toLowerCase() === 'local';
    const courseTitle = String(normalizedCourse?.courseTitle || topic || 'Course');
    titleMain.textContent = courseTitle;
    titleSide.textContent = courseTitle;
    subtitleSide.textContent = String(normalizedCourse?.subtitle || 'Complete professional course');
    level.textContent = String(normalizedCourse?.difficulty || 'Intermediate');
    duration.textContent = String(normalizedCourse?.estimatedDuration || '10-14 weeks');
    demand.textContent = String(normalizedCourse?.marketDemand || 'High demand in current job market.');
    const aboutText = String(
      normalizedCourse?.overview ||
      normalizedCourse?.description ||
      normalizedCourse?.subtitle ||
      'Build job-ready skills through guided lessons, hands-on practice, and mastery checks.'
    ).trim();
    overview.textContent = aboutText;
    overview.style.display = 'block';
    renderCurriculumMetaPanel(getJamaicaCurriculumMeta(courseTitle, topic));
    renderTeachingFrameworkPanel(courseTitle, topic);

    renderList(outcomes, normalizedCourse?.learningOutcomes);
    renderList(resumeSignals, normalizedCourse?.resumeSignals);
    
    progressState.certificationPlan = normalizedCourse?.certificationPlan || createCertificationPlan(getCourseCoverageTargets(courseTitle), null);
    progressState.practiceBankItems = asArray(normalizedCourse?.practiceBank);
    progressState.mockExams = asArray(normalizedCourse?.mockExams);
    progressState.assessmentItems = asArray(normalizedCourse?.finalAssessment);
    progressState.interviewPrepItems = asArray(normalizedCourse?.interviewPrep);
    
    renderModules(normalizedCourse?.modules);

    const project = normalizedCourse?.capstoneProject || {};
    const deliverables = asArray(project?.deliverables)
      .map((item) => `<li style="margin-bottom:6px;">${String(item)}</li>`)
      .join('');
    capstone.innerHTML = `
      <p><strong style="color:#93c5fd;">Project:</strong> ${String(project?.title || `${courseTitle} Capstone`)}</p>
      <p><strong style="color:#93c5fd;">Scenario:</strong> ${String(project?.scenario || 'Build and deliver an end-to-end practical project.')}</p>
      <p style="margin-bottom:6px;"><strong style="color:#93c5fd;">Deliverables:</strong></p>
      <ul style="margin:0;padding-left:18px;">${deliverables || '<li>Project plan</li><li>Execution artifact</li><li>Results summary</li>'}</ul>
    `;

    renderPracticeBank(progressState.practiceBankItems);
    renderMockExams(progressState.mockExams);
    renderAssessment(progressState.assessmentItems);
    renderInterviewPrep(progressState.interviewPrepItems);
    updateProgressiveSections();
  }

  async function loadLearnerIdentity() {
    const token = getToken();
    if (!token) return;
    try {
      const response = await fetch(apiPath('/api/me'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json();
      const name = String(payload?.user?.name || '').trim();
      if (name) progressState.learnerName = name;
    } catch (error) {
      // Use default learner name.
    }
  }

  function downloadCertificate() {
    if (!certificateBtn) return;
    const total = Number(progressState.totalModules || 0);
    const completed = progressState.completedModules.size;
    if (!total || completed !== total || progressState.assessmentCompleted !== true) return;

    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('Certificate generation is unavailable right now.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();

    doc.setFillColor(247, 250, 252);
    doc.rect(24, 24, width - 48, height - 48, 'F');
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(2);
    doc.rect(24, 24, width - 48, height - 48);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(34);
    doc.setTextColor(15, 23, 42);
    doc.text('RoleRocket AI Certificate of Completion', width / 2, 120, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    doc.setTextColor(51, 65, 85);
    doc.text('This certifies that', width / 2, 168, { align: 'center' });

    doc.setFont('times', 'bold');
    doc.setFontSize(30);
    doc.setTextColor(30, 64, 175);
    doc.text(progressState.learnerName || 'Learner', width / 2, 220, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    doc.setTextColor(51, 65, 85);
    doc.text('has successfully completed the course', width / 2, 260, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(15, 23, 42);
    doc.text(String(topic || 'Professional Course'), width / 2, 302, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(13);
    doc.setTextColor(71, 85, 105);
    doc.text(`Completed modules: ${completed}/${total}`, width / 2, 338, { align: 'center' });
    doc.text(`Final grade: ${String(progressState.assessmentGrade || 'Pass')}${progressState.assessmentScore !== null ? ` (${progressState.assessmentScore}%)` : ''}`, width / 2, 360, { align: 'center' });
    doc.text(`Date: ${new Date().toLocaleDateString()}`, width / 2, 382, { align: 'center' });
    doc.text(`Certificate ID: RR-${String(topic || 'course').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12) || 'COURSE'}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`, width / 2, 404, { align: 'center' });
    doc.text('Issued by RoleRocket AI Learning', width / 2, 426, { align: 'center' });

    const filename = `${String(topic || 'course').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-certificate.pdf`;
    doc.save(filename);
  }

  function renderAccessMessage(message, subtitle) {
    titleMain.textContent = topic || 'Course';
    titleSide.textContent = topic || 'Course';
    subtitleSide.textContent = subtitle || 'Course access required';
    overview.textContent = message;
    overview.style.display = 'block';
    renderCurriculumMetaPanel(null);
    renderTeachingFrameworkPanel(topic || 'Course', topic || 'Course');
    if (modules) {
      modules.innerHTML = '<div class="module-item"><p>Sign in to load modules, audio playback, and progress checks.</p></div>';
    }
    if (capstone) capstone.innerHTML = '<p>Capstone details will appear after course access is confirmed.</p>';
    if (assessment) assessment.innerHTML = '<div class="module-item"><p>Assessment questions will appear after course access is confirmed.</p></div>';
    if (interviewPrep) interviewPrep.innerHTML = '<li>Interview prep unlocks after course access is confirmed.</li>';
    if (capstoneSection) capstoneSection.hidden = true;
    if (assessmentSection) assessmentSection.hidden = true;
    if (interviewPrepSection) interviewPrepSection.hidden = true;
  }

  function isLikelyAdminViewer() {
    try {
      const raw = String(localStorage.getItem('rr_nav_is_admin_v1') || '').toLowerCase();
      return raw === '1' || raw === 'true';
    } catch (_) {
      return false;
    }
  }

  async function loadCourse(forceRefresh = false) {
    if (!topic) {
      titleMain.textContent = 'No course selected';
      titleSide.textContent = 'No course selected';
      overview.textContent = 'Return to the course catalog and choose a course card.';
      overview.style.display = 'block';
      renderTeachingFrameworkPanel('Course', 'Course');
      return;
    }

    setCourseLoadingState(true, forceRefresh ? 'Refreshing...' : 'Loading...');
    if (forceRefresh) {
      clearStoredProgress();
      resetStoredDiagnostic();
    }
    stopModuleAudio();
    progressState.sessionToken = '';
    progressState.moduleNarration = [];
    progressState.pendingAdvance = null;
    progressState.diagnosticCompleted = false;
    progressState.diagnosticScore = null;
    progressState.recommendedStartIndex = 0;
    progressState.moduleMastery = {};
    titleMain.textContent = `Loading ${topic}...`;
    titleSide.textContent = `Loading ${topic}...`;
    subtitleSide.textContent = forceRefresh ? 'Refreshing course version...' : 'Generating complete curriculum...';
    overview.textContent = forceRefresh ? 'Please wait while we create a fresh version of this course.' : 'Please wait while we build your full course.';
    overview.style.display = 'block';
    if (modules) modules.innerHTML = '';
    if (assessment) assessment.innerHTML = '';
    if (capstone) capstone.innerHTML = '';
    if (interviewPrep) interviewPrep.innerHTML = '';
    if (capstoneSection) capstoneSection.hidden = true;
    if (assessmentSection) assessmentSection.hidden = true;
    if (interviewPrepSection) interviewPrepSection.hidden = true;
    if (outcomes) outcomes.innerHTML = '';
    if (resumeSignals) resumeSignals.innerHTML = '';
    renderCurriculumMetaPanel(null);
    renderTeachingFrameworkPanel(topic, topic);

    // Local curriculum packs take priority for known CSEC/CAPE/HEART/NVQ topics.
    const localCourse = getLocalCurriculumCourse(topic);
    if (localCourse) {
      try {
        progressState.sessionToken = `local-${normalizeTopic(topic)}`;
        renderCourse(localCourse);
        bindProgressHandlers();
        await loadProgress();
      } finally {
        setCourseLoadingState(false);
      }
      return;
    }

    try {
      const response = await fetch(apiPath('/api/learning/course-content'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ topic, forceRefresh })
      });

      const payload = await response.json();
      if (!response.ok || !payload?.course) {
        throw new Error((payload && payload.error) || 'Unable to load course.');
      }

      progressState.sessionToken = String(payload?.sessionToken || '').trim();
      const resolvedCourse = applyLocalCurriculumOverrides(payload.course, topic);
      renderCourse(resolvedCourse);
      bindProgressHandlers();
      await loadProgress();
    } catch (error) {
      const message = String(error?.message || 'Unable to load course. Please try again.');
      if (/token|unauthorized|401/i.test(message)) {
        if (isLikelyAdminViewer()) {
          renderAccessMessage('Admin account detected. Please sign in again to refresh your session and continue.', 'Admin sign-in required');
        } else {
          renderAccessMessage('Please sign in again to continue.', 'Sign in required');
        }
      } else if (/403|upgrade to elite/i.test(message)) {
        if (isLikelyAdminViewer()) {
          renderAccessMessage('Admin account detected but learning access was denied by the server. Please sign in again and retry.', 'Admin access check required');
        } else {
          renderAccessMessage('This account does not currently have access to full course content.', 'Access restricted');
        }
      } else {
        titleMain.textContent = topic;
        titleSide.textContent = topic;
        subtitleSide.textContent = 'Course generation failed';
        overview.textContent = message;
        overview.style.display = 'block';
        renderTeachingFrameworkPanel(topic, topic);
      }
    } finally {
      setCourseLoadingState(false);
    }
  }

  if (window.speechSynthesis) {
    populateVoiceOptions();
    window.speechSynthesis.onvoiceschanged = populateVoiceOptions;
  }

  certificateBtn?.addEventListener('click', downloadCertificate);
  refreshCourseBtn?.addEventListener('click', function () {
    const proceed = window.confirm('Refreshing will generate a new version of this course and reset progress if the content changes. Continue?');
    if (!proceed) return;
    loadCourse(true);
  });
  setupSectionTabs();
  loadLearnerIdentity();
  loadCourse();
});
