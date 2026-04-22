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
  const outcomes = document.getElementById('courseOutcomeList');
  const resumeSignals = document.getElementById('courseResumeSignals');
  const modules = document.getElementById('courseModules');
  const capstone = document.getElementById('courseCapstone');
  const assessment = document.getElementById('courseAssessment');
  const interviewPrep = document.getElementById('courseInterviewPrep');
  const capstoneSection = document.getElementById('courseCapstoneSection');
  const assessmentSection = document.getElementById('courseAssessmentSection');
  const interviewPrepSection = document.getElementById('courseInterviewPrepSection');
  const progressSummary = document.getElementById('courseProgressSummary');
  const progressPercent = document.getElementById('courseProgressPercent');
  const progressBar = document.getElementById('courseProgressBar');
  const refreshCourseBtn = document.getElementById('refreshCourseBtn');
  const certificateBtn = document.getElementById('downloadCourseCertificateBtn');
  const audioVoiceSelect = document.getElementById('courseAudioVoiceSelect');

  const progressState = {
    totalModules: 0,
    completedModules: new Set(),
    learnerName: 'Learner',
    sessionToken: '',
    moduleNarration: [],
    answerKey: [],
    answerExplanations: [],
    assessmentCompleted: false,
    assessmentScore: null,
    lastProgressFeedback: null,
    pendingAdvance: null
  };
  let moduleHandlersBound = false;
  const PROGRESS_CHECK_TIMEOUT_MS = 8000;

  const audioState = {
    activeModuleIndex: null,
    utterance: null,
    isPaused: false,
    rate: 0.96,
    voices: [],
    selectedVoice: ''
  };
  const AUDIO_VOICE_PREF_KEY = 'courseAudioVoicePreference';

  const LOCAL_CURRICULUM_COURSES = [
    {
      match: [/^csec mathematics$/i, /^csec math$/i],
      course: {
        courseTitle: 'CSEC Mathematics',
        subtitle: 'Algebra, geometry, trigonometry, and statistics with graded checks.',
        difficulty: 'Intermediate',
        estimatedDuration: '8 weeks',
        marketDemand: 'Required for many CAPE, tertiary, and career pathways.',
        overview: 'This course teaches CSEC Mathematics through concept-first lessons, worked examples, and tested practice.',
        learningOutcomes: [
          'Solve algebraic equations and factorization questions.',
          'Apply geometry and mensuration rules correctly.',
          'Use Pythagoras and trig ratios in right-triangle problems.',
          'Interpret data and calculate basic probability.'
        ],
        modules: [
          {
            title: 'Algebra Foundations',
            objective: 'Simplify expressions and solve linear equations.',
            lesson: 'Collect like terms, use inverse operations, and check your final answer by substitution.',
            workedExample: '2x + 7 = 19 gives 2x = 12, so x = 6.',
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
            commonMistake: 'Choosing numbers that multiply to c but do not add to b.',
            practiceTask: 'Factorize: x^2 + 7x + 12.',
            progressCheckQuestion: 'Factorize x^2 - 9.',
            progressCheckOptions: ['(x - 9)(x + 1)', '(x - 3)(x + 3)', '(x - 3)^2', '(x + 9)(x - 1)'],
            correctOptionIndex: 1,
            progressCheckExplanation: 'Use difference of squares: a^2 - b^2 = (a-b)(a+b).'
          },
          {
            title: 'Geometry and Mensuration',
            objective: 'Use angle facts and area formulas in exam questions.',
            lesson: 'Angles in a triangle sum to 180 deg. Area of rectangle = l x w. Area of circle = pi r^2.',
            workedExample: 'Triangle angles 50 deg and 60 deg leave 70 deg for the third angle.',
            commonMistake: 'Confusing perimeter formulas with area formulas.',
            practiceTask: 'Find area of a rectangle with l = 9 cm and w = 4 cm.',
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
            commonMistake: 'Mixing opposite and adjacent sides when choosing trig ratios.',
            practiceTask: 'Find tan(theta) if opposite = 4 and adjacent = 3.',
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

  function normalizeTopic(topicName) {
    return String(topicName || '').trim().toLowerCase();
  }

  function buildSubjectTemplateCourse(topicName) {
    const name = normalizeTopic(topicName);
    if (!name) return null;

    const buildCourse = (spec) => ({
      courseTitle: spec.courseTitle,
      subtitle: spec.subtitle,
      difficulty: spec.difficulty || 'Intermediate',
      estimatedDuration: spec.estimatedDuration || '6-8 weeks',
      marketDemand: spec.marketDemand,
      overview: spec.overview,
      learningOutcomes: asArray(spec.learningOutcomes),
      resumeSignals: asArray(spec.resumeSignals),
      modules: asArray(spec.modules),
      finalAssessment: asArray(spec.finalAssessment),
      interviewPrep: asArray(spec.interviewPrep)
    });

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
    return Array.isArray(value) ? value.filter(Boolean) : [];
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

    if (progressSummary) {
      progressSummary.textContent = `Progress: ${completed} of ${total} modules completed`;
    }
    if (progressPercent) {
      progressPercent.textContent = `${percent}%`;
    }
    if (progressBar) {
      progressBar.style.width = `${percent}%`;
    }

    if (certificateBtn) {
      certificateBtn.style.display = total > 0 && completed === total ? 'inline-block' : 'none';
    }
  }

  function updateProgressiveSections() {
    const hasModules = progressState.totalModules > 0;
    const allModulesComplete = hasModules && progressState.completedModules.size >= progressState.totalModules;
    const assessmentComplete = progressState.assessmentCompleted === true;

    if (capstoneSection) capstoneSection.hidden = !allModulesComplete;
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

  function setResultHtml(resultWrap, isCorrect, message) {
    const color = isCorrect ? '#86efac' : '#fda4af';
    const icon = isCorrect ? '✓' : '✗';
    const label = isCorrect ? 'Correct' : 'Not quite';
    resultWrap.innerHTML = `<span style="font-weight:700;color:${color};">${icon} ${escapeHtml(label)}.</span> <span style="color:#d0d9e7;">${escapeHtml(message)}</span>`;
  }

  function queueProgressAdvance(idx, completedModules, feedbackMessage) {
    const normalizedFromPayload = asArray(completedModules)
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 0 && n < progressState.totalModules);

    // Always include locally known progress + current module so Continue reliably advances.
    const normalized = Array.from(new Set([
      ...Array.from(progressState.completedModules),
      ...normalizedFromPayload,
      Number(idx)
    ]))
      .filter((n) => Number.isInteger(n) && n >= 0 && n < progressState.totalModules)
      .sort((a, b) => a - b);

    progressState.pendingAdvance = {
      idx,
      completedModules: normalized,
      feedbackMessage: String(feedbackMessage || '').trim()
    };

    const answerInputs = document.querySelectorAll(`input[data-progress-check-option="${idx}"]`);
    const submitButton = document.querySelector(`button[data-progress-check-btn="${idx}"]`);
    const continueButton = document.querySelector(`button[data-progress-continue-btn="${idx}"]`);
    const resultWrap = document.querySelector(`div[data-progress-check-result="${idx}"]`);

    answerInputs.forEach((input) => {
      input.disabled = true;
    });

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Correct!';
      submitButton.style.opacity = '0.75';
      submitButton.style.cursor = 'default';
    }

    if (continueButton) {
      continueButton.style.display = 'inline-flex';
      continueButton.disabled = false;
      continueButton.style.opacity = '1';
      continueButton.style.cursor = 'pointer';

      const isSmallViewport = typeof window.matchMedia === 'function'
        ? window.matchMedia('(max-width: 900px)').matches
        : (window.innerWidth <= 900);
      if (isSmallViewport) {
        window.requestAnimationFrame(() => {
          continueButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
          continueButton.focus({ preventScroll: true });
        });
      }
    }

    if (resultWrap) {
      setResultHtml(resultWrap, true, feedbackMessage);
    }
  }

  function finalizeProgressAdvance(idx) {
    const pending = progressState.pendingAdvance;
    const numericIdx = Number(idx);
    if (!Number.isInteger(numericIdx) || numericIdx < 0) return;

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
  }

  // Expose a direct fallback handler so Continue works even if delegated click listeners fail.
  window.handleCourseContinue = function handleCourseContinue(idx) {
    finalizeProgressAdvance(idx);
  };

  function resetModuleAudioButtons() {
    document.querySelectorAll('button[data-module-audio-play-btn]').forEach((button) => {
      button.textContent = 'Play Audio';
      button.style.opacity = '1';
    });
    document.querySelectorAll('button[data-module-audio-pause-btn]').forEach((button) => {
      button.textContent = 'Pause';
      button.disabled = true;
      button.style.opacity = '0.65';
      button.style.cursor = 'default';
    });
  }

  function setModuleAudioControls(idx, isPlaying) {
    const playButton = document.querySelector(`button[data-module-audio-play-btn="${idx}"]`);
    const pauseButton = document.querySelector(`button[data-module-audio-pause-btn="${idx}"]`);
    if (playButton) {
      playButton.textContent = isPlaying ? 'Stop Audio' : 'Play Audio';
    }
    if (pauseButton) {
      pauseButton.disabled = !isPlaying;
      pauseButton.style.opacity = isPlaying ? '1' : '0.65';
      pauseButton.style.cursor = isPlaying ? 'pointer' : 'default';
      pauseButton.textContent = audioState.isPaused ? 'Resume' : 'Pause';
    }
  }

  function stopModuleAudio() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    audioState.activeModuleIndex = null;
    audioState.utterance = null;
    audioState.isPaused = false;
    resetModuleAudioButtons();
  }

  function playModuleAudio(idx, restart = false) {
    if (!restart && audioState.activeModuleIndex === idx) {
      stopModuleAudio();
      return;
    }

    const narration = String(progressState.moduleNarration[idx] || '').trim();
    if (!narration) return;

    stopModuleAudio();

    const playButton = document.querySelector(`button[data-module-audio-play-btn="${idx}"]`);
    const utterance = new SpeechSynthesisUtterance(narration);
    utterance.rate = audioState.rate;
    utterance.pitch = 1;
    utterance.voice = getSelectedVoice();
    utterance.onend = stopModuleAudio;
    utterance.onerror = stopModuleAudio;

    audioState.activeModuleIndex = idx;
    audioState.utterance = utterance;
    audioState.isPaused = false;
    if (playButton) playButton.textContent = 'Stop Audio';
    setModuleAudioControls(idx, true);
    window.speechSynthesis.speak(utterance);
  }

  function startModuleAudio(idx) {
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
      alert('Audio playback is not supported in this browser.');
      return;
    }

    playModuleAudio(idx, false);
  }

  function togglePauseModuleAudio(idx) {
    if (!window.speechSynthesis || audioState.activeModuleIndex !== idx || !audioState.utterance) {
      return;
    }

    if (window.speechSynthesis.paused || audioState.isPaused) {
      window.speechSynthesis.resume();
      audioState.isPaused = false;
    } else {
      window.speechSynthesis.pause();
      audioState.isPaused = true;
    }

    setModuleAudioControls(idx, true);
  }

  function updateAudioRate(nextRate) {
    const parsed = Number(nextRate);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    audioState.rate = parsed;

    if (audioState.activeModuleIndex !== null) {
      playModuleAudio(audioState.activeModuleIndex, true);
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
    const moduleCount = Number(progressState.totalModules || progressState.allModules?.length || 0);
    const numericFreshIdx = Number(freshIdx);
    const normalized = asArray(completedModules)
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 0 && (moduleCount > 0 ? n < moduleCount : true));

    if (Number.isInteger(numericFreshIdx) && numericFreshIdx >= 0 && (moduleCount > 0 ? numericFreshIdx < moduleCount : true)) {
      if (!normalized.includes(numericFreshIdx)) normalized.push(numericFreshIdx);
    }

    normalized.sort((a, b) => a - b);

    progressState.pendingAdvance = null;
    progressState.completedModules = new Set(normalized);
    normalized.forEach((completedIdx) => setPassedModuleUi(completedIdx, completedIdx === freshIdx ? 'fresh' : 'restored'));
    updateProgressUi();
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
      setResultHtml(resultWrap, false, formatProgressCheckFeedback(false, correctAnswer, explanation));
      return false;
    }

    const completedModules = Array.from(new Set([
      ...progressState.completedModules,
      idx
    ])).sort((left, right) => left - right);

    progressState.lastProgressFeedback = null;
    queueProgressAdvance(idx, completedModules, formatProgressCheckFeedback(true, correctAnswer, explanation));
    return true;
  }

  function setCourseLoadingState(isLoading, buttonLabel) {
    if (!refreshCourseBtn) return;
    refreshCourseBtn.disabled = isLoading;
    refreshCourseBtn.textContent = isLoading ? (buttonLabel || 'Refreshing...') : 'Refresh Course';
    refreshCourseBtn.style.opacity = isLoading ? '0.75' : '1';
    refreshCourseBtn.style.cursor = isLoading ? 'default' : 'pointer';
  }

  async function runProgressCheck(idx) {
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
        const feedbackMsg = formatProgressCheckFeedback(
          true,
          String(payload?.correctOptionText || fallbackCorrectAnswer).trim(),
          String(payload?.explanation || fallbackExplanation).trim()
        );
        progressState.lastProgressFeedback = null;
        queueProgressAdvance(idx, payload?.completedModules, feedbackMsg);
        return;
      }

      if (response.status === 409) {
        resultWrap.textContent = String(payload?.error || 'Session expired. Reload the course.');
        resultWrap.style.color = '#fbbf24';
      } else if (response.status === 400 && payload?.error) {
        progressState.lastProgressFeedback = null;
        resultWrap.textContent = String(payload.error);
        resultWrap.style.color = '#fda4af';
      } else {
        progressState.lastProgressFeedback = null;
        const wrongMsg = formatProgressCheckFeedback(
          false,
          String(payload?.correctOptionText || fallbackCorrectAnswer).trim(),
          String(payload?.explanation || fallbackExplanation).trim()
        );
        setResultHtml(resultWrap, false, wrongMsg);
      }
    } catch (error) {
      const usedLocalFallback = applyLocalProgressCheck(idx, selectedOptionIndex, resultWrap);
      if (usedLocalFallback) {
        setResultHtml(resultWrap, true, formatProgressCheckFeedback(true, fallbackCorrectAnswer, fallbackExplanation));
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

      progressState.completedModules = new Set(mergedCompleted);

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

      mergedCompleted.forEach((idx) => setPassedModuleUi(idx, 'restored'));

      updateProgressUi();
      renderProgressiveContent();
      updateProgressiveSections();
      if (progressState.completedModules.size >= progressState.totalModules) {
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
      const continueButton = event.target.closest('button[data-progress-continue-btn]');
      if (continueButton) {
        const idx = Number(continueButton.getAttribute('data-progress-continue-btn'));
        finalizeProgressAdvance(idx);
        return;
      }

      const progressButton = event.target.closest('button[data-progress-check-btn]');
      if (progressButton) {
        const idx = Number(progressButton.getAttribute('data-progress-check-btn'));
        await runProgressCheck(idx);
        return;
      }

      const playButton = event.target.closest('button[data-module-audio-play-btn]');
      if (playButton) {
        const idx = Number(playButton.getAttribute('data-module-audio-play-btn'));
        startModuleAudio(idx);
        return;
      }

      const pauseButton = event.target.closest('button[data-module-audio-pause-btn]');
      if (pauseButton) {
        const idx = Number(pauseButton.getAttribute('data-module-audio-pause-btn'));
        togglePauseModuleAudio(idx);
      }
    });

    modules.addEventListener('change', function (event) {
      const rateSelect = event.target.closest('select[data-module-audio-rate]');
      if (!rateSelect) return;
      updateAudioRate(rateSelect.value);
    });

    if (audioVoiceSelect) {
      audioVoiceSelect.addEventListener('change', function () {
        audioState.selectedVoice = audioVoiceSelect.value;
        try {
          localStorage.setItem(AUDIO_VOICE_PREF_KEY, audioState.selectedVoice || '');
        } catch (error) {
          // Ignore storage failures in restricted browser contexts.
        }
        if (audioState.activeModuleIndex !== null) {
          playModuleAudio(audioState.activeModuleIndex, true);
        }
      });
    }

    if (assessment) {
      assessment.addEventListener('click', async function (event) {
        const submitBtn = event.target.closest('#submitAssessmentBtn');
        if (!submitBtn) return;

        const answers = new Array(progressState.assessmentItems.length).fill(null);
        let hasObjectiveQuestions = false;

        document.querySelectorAll('[data-assessment-choice]').forEach((input) => {
          if (!input.checked) return;
          const idx = Number(input.getAttribute('data-assessment-choice'));
          const optionIndex = Number(input.value);
          if (Number.isInteger(idx) && idx >= 0) answers[idx] = optionIndex;
        });

        document.querySelectorAll('[data-assessment-answer]').forEach((textarea) => {
          const idx = Number(textarea.getAttribute('data-assessment-answer'));
          answers[idx] = String(textarea.value || '').trim();
        });

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
          const objectiveRows = [];
          let objectiveCorrect = 0;
          let objectiveTotal = 0;

          progressState.assessmentItems.forEach((item, index) => {
            const options = asArray(item?.options);
            if (options.length < 2) return;

            const selectedIndex = Number(answers[index]);
            const correctIndex = Number(item?.correctOptionIndex);
            const selectedText = String(options[selectedIndex] || 'No answer selected');
            const correctText = String(options[correctIndex] || 'N/A');
            const isCorrect = selectedIndex === correctIndex;

            objectiveTotal += 1;
            if (isCorrect) objectiveCorrect += 1;

            objectiveRows.push(`
              <div style="margin-bottom:10px;padding:10px;border-radius:8px;border:1px solid ${isCorrect ? '#14532d' : '#7f1d1d'};background:${isCorrect ? '#052e16' : '#2f1313'};">
                <div style="font-weight:700;color:${isCorrect ? '#86efac' : '#fda4af'};margin-bottom:4px;">Question ${index + 1}: ${isCorrect ? 'Correct' : 'Incorrect'}</div>
                <div style="color:#d0d9e7;"><strong>Your answer:</strong> ${escapeHtml(selectedText)}</div>
                ${isCorrect ? '' : `<div style="color:#bfdbfe;"><strong>Correct answer:</strong> ${escapeHtml(correctText)}</div>`}
                ${item?.explanation ? `<div style="color:#cbd5e1;"><strong>Why:</strong> ${escapeHtml(String(item.explanation))}</div>` : ''}
              </div>
            `);
          });

          const score = objectiveTotal > 0 ? Math.round((objectiveCorrect / objectiveTotal) * 100) : 100;
          const passMark = 70;
          const passed = !hasObjectiveQuestions || score >= passMark;

          progressState.assessmentScore = score;
          progressState.assessmentCompleted = passed;

          if (!passed) {
            resultDiv.innerHTML = `
              <div style="color:#fda4af;line-height:1.8;">
                <strong>Assessment Result: ${score}% (Pass mark: ${passMark}%)</strong>
                <p style="margin:8px 0 10px;">You did not pass yet. Review the feedback below, revisit your weak modules, then retry.</p>
                ${objectiveRows.join('')}
              </div>
            `;
            submitBtn.disabled = false;
            submitBtn.textContent = 'Retry Assessment';
            updateProgressiveSections();
            renderInterviewPrep(progressState.interviewPrepItems);
            return;
          }

          resultDiv.innerHTML = `
            <div style="color:#86efac;line-height:1.8;">
              <strong>✓ Assessment Complete!</strong>
              <p style="margin:8px 0 0;">Score: ${score}%${hasObjectiveQuestions ? ` (Pass mark: ${passMark}%)` : ''}. You have successfully completed all course materials. Scroll down to view your interview preparation resources.</p>
            </div>
          `;
          if (objectiveRows.length) {
            resultDiv.innerHTML += `<div style="margin-top:10px;">${objectiveRows.join('')}</div>`;
          }
          submitBtn.style.display = 'none';
          updateProgressiveSections();
          renderInterviewPrep(progressState.interviewPrepItems);
        }, 1200);
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
      interviewPrep.innerHTML = '<li style="color:#9fb0c7;">Pass the final assessment to unlock interview prep.</li>';
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

  function renderModules(modulesData) {
    const list = asArray(modulesData);
    if (!modules) return;

    progressState.totalModules = list.length;
    progressState.completedModules = new Set();
    progressState.answerKey = list.map((moduleItem) => Number(moduleItem?.correctOptionIndex));
    progressState.answerExplanations = list.map((moduleItem, index) => String(moduleItem?.progressCheckExplanation || getModuleReasoningFromAssessment(index) || '').trim());
    progressState.assessmentCompleted = false;
    progressState.assessmentScore = null;
    progressState.lastProgressFeedback = null;
    progressState.moduleNarration = list.map((moduleItem, index) => {
      const options = asArray(moduleItem?.progressCheckOptions)
        .map((option, optionIndex) => `Option ${optionIndex + 1}. ${String(option)}`)
        .join(' ');
      return [
        `Module ${index + 1}. ${String(moduleItem?.title || `Module ${index + 1}`)}.`,
        `Objective. ${String(moduleItem?.objective || '')}`,
        `Lesson. ${String(moduleItem?.lesson || '')}`,
        `Worked example. ${String(moduleItem?.workedExample || '')}`,
        `Common mistake. ${String(moduleItem?.commonMistake || '')}`,
        `Practice task. ${String(moduleItem?.practiceTask || '')}`,
        `Progress check. ${String(moduleItem?.progressCheckQuestion || '')}`,
        options
      ].filter(Boolean).join(' ');
    });
    progressState.allModules = list;
    updateProgressUi();
    renderProgressiveContent();
    updateProgressiveSections();
  }

  function renderProgressiveContent() {
    if (!modules || !progressState.allModules) return;
    const list = progressState.allModules;
    if (!list.length) {
      modules.innerHTML = '<div class="module-item"><p>Modules are not available right now.</p></div>';
      return;
    }

    const completed = progressState.completedModules.size;
    const currentIdx = Math.min(completed, list.length - 1);
    const currentModule = list[currentIdx];
    const isAllComplete = completed >= list.length;

    let html = '';

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
      const lesson = escapeHtml(String(moduleItem?.lesson || ''));
      const workedExample = escapeHtml(String(moduleItem?.workedExample || ''));
      const commonMistake = escapeHtml(String(moduleItem?.commonMistake || ''));
      const practiceTask = escapeHtml(String(moduleItem?.practiceTask || ''));
      const progressCheckQuestion = escapeHtml(String(moduleItem?.progressCheckQuestion || `In one sentence, what is the key takeaway of module ${index + 1}?`));
      const progressCheckOptions = asArray(moduleItem?.progressCheckOptions).slice(0, 4);
      const pendingAdvance = progressState.pendingAdvance && Number(progressState.pendingAdvance.idx) === index
        ? progressState.pendingAdvance
        : null;
      const optionMarkup = progressCheckOptions.map((option, optionIndex) => `
        <label style="display:grid;grid-template-columns:18px minmax(0,1fr);align-items:flex-start;column-gap:10px;width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;background:#111c31;border:1px solid #2a3954;cursor:pointer;color:#d0d9e7;overflow:hidden;">
          <input type="radio" name="module-progress-check-${index}" data-progress-check-option="${index}" value="${optionIndex}" ${pendingAdvance ? 'disabled' : ''} style="margin-top:3px;accent-color:#2563eb;" />
          <span style="line-height:1.5;word-break:break-word;overflow-wrap:anywhere;white-space:normal;min-width:0;max-width:100%;flex:1 1 auto;display:block;">${escapeHtml(String(option))}</span>
        </label>
      `).join('');
      const pendingResultMarkup = pendingAdvance
        ? `<span style="font-weight:700;color:#86efac;">✓ Correct.</span> <span style="color:#d0d9e7;">${escapeHtml(String(pendingAdvance.feedbackMessage || ''))}</span>`
        : '';

      html += `
        <section class="module-item">
          <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:10px;margin-bottom:8px;">
            <h4 style="margin:0;min-width:0;">Module ${index + 1} of ${list.length}: ${title}</h4>
            <div style="display:inline-flex;align-items:center;gap:8px;justify-self:end;max-width:100%;color:#93c5fd;font-size:0.82rem;padding:6px 10px;border-radius:999px;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.35);">
              <span aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;flex:0 0 14px;border-radius:50%;background:#60a5fa;color:#fff;font-size:0.7rem;font-weight:700;">↓</span>
              <span style="white-space:normal;word-break:break-word;line-height:1.2;">Current</span>
            </div>
          </div>
          <p><strong style="color:#93c5fd;">Objective:</strong> ${objective}</p>
          <p><strong style="color:#93c5fd;">Lesson:</strong> ${lesson}</p>
          <p><strong style="color:#93c5fd;">Worked Example:</strong> ${workedExample}</p>
          <p><strong style="color:#fda4af;">Common Mistake:</strong> ${commonMistake}</p>
          <p><strong style="color:#86efac;">Practice Task:</strong> ${practiceTask}</p>
          <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 12px 0;">
            <button type="button" data-module-audio-play-btn="${index}" style="background:#0f766e;border:1px solid #14b8a6;color:#ecfeff;border-radius:8px;padding:8px 12px;cursor:pointer;font-size:0.82rem;font-weight:700;">Play Audio</button>
            <button type="button" data-module-audio-pause-btn="${index}" disabled style="background:#1e293b;border:1px solid #475569;color:#e2e8f0;border-radius:8px;padding:8px 12px;cursor:default;font-size:0.82rem;font-weight:700;opacity:0.65;">Pause</button>
            <label style="display:inline-flex;align-items:center;gap:6px;color:#cbd5e1;font-size:0.8rem;">
              Speed
              <select data-module-audio-rate="${index}" style="background:#0b1220;border:1px solid #2a3954;color:#f1f5f9;border-radius:8px;padding:7px 10px;">
                <option value="0.9">0.9x</option>
                <option value="1" selected>1.0x</option>
                <option value="1.15">1.15x</option>
                <option value="1.3">1.3x</option>
              </select>
            </label>
          </div>
          <div style="margin-top:12px;padding:10px;border-radius:8px;background:#0b1220;border:1px solid #273449;">
            <div style="font-size:0.82rem;color:#c4b5fd;font-weight:700;margin-bottom:6px;">Progress Check</div>
            <div style="color:#d0d9e7;font-size:calc(0.9rem + 2pt);line-height:1.55;margin-bottom:8px;">${progressCheckQuestion}</div>
            <div style="display:grid;gap:8px;margin-bottom:10px;">${optionMarkup}</div>
            <div style="display:flex;flex-direction:column;align-items:flex-start;gap:8px;">
              <button type="button" data-progress-check-btn="${index}" ${pendingAdvance ? 'disabled' : ''} style="background:#7c3aed;border:none;color:#fff;border-radius:6px;padding:7px 10px;${pendingAdvance ? 'opacity:0.75;cursor:default;' : 'cursor:pointer;'}font-size:0.82rem;font-weight:700;">${pendingAdvance ? 'Correct!' : 'Submit Answer'}</button>
              <button type="button" data-progress-continue-btn="${index}" onclick="window.handleCourseContinue && window.handleCourseContinue(${index})" style="display:${pendingAdvance ? 'inline-flex' : 'none'};background:#0f766e;border:1px solid #14b8a6;color:#ecfeff;border-radius:6px;padding:7px 10px;cursor:pointer;font-size:0.82rem;font-weight:700;">Continue to Next Module</button>
              <div data-progress-check-result="${index}" style="font-size:calc(0.82rem + 2pt);color:#9fb0c7;line-height:1.5;word-break:break-word;overflow-wrap:anywhere;width:100%;">${pendingResultMarkup}</div>
            </div>
          </div>
        </section>
      `;
    }

    modules.innerHTML = html;
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
    if (!progressState.assessmentCompleted) {
      progressState.assessmentAnswers = new Array(items.length).fill(null);
      progressState.assessmentScore = null;
    }

    const hasObjectiveItems = items.some((item) => asArray(item?.options).length >= 2);

    assessment.innerHTML = `
      <div style="padding:14px;border-radius:10px;background:#0d2438;border:1px solid #0ea5e9;color:#7dd3fc;margin-bottom:16px;font-size:0.9rem;">
        <strong>Final Assessment:</strong> ${hasObjectiveItems
          ? 'Pass with at least 70% to unlock interview prep.'
          : 'Answer all questions to complete the course and unlock interview prep.'}
      </div>
      ${items.map((item, i) => {
        const question = String(item?.question || '');
        const options = asArray(item?.options);
        const optionMarkup = options.map((option, optionIndex) => `
          <label style="display:grid;grid-template-columns:18px minmax(0,1fr);align-items:flex-start;column-gap:10px;width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;background:#111c31;border:1px solid #2a3954;cursor:pointer;color:#d0d9e7;overflow:hidden;margin-bottom:8px;">
            <input type="radio" name="assessment-question-${i}" data-assessment-choice="${i}" value="${optionIndex}" style="margin-top:3px;accent-color:#10b981;" />
            <span style="line-height:1.5;word-break:break-word;overflow-wrap:anywhere;white-space:normal;min-width:0;max-width:100%;flex:1 1 auto;display:block;">${escapeHtml(String(option))}</span>
          </label>
        `).join('');
        return `
          <div class="module-item" style="margin-bottom:12px;">
            <p style="margin-bottom:8px;"><strong style="color:#c4b5fd;">Question ${i + 1}:</strong> ${escapeHtml(question)}</p>
            ${options.length >= 2
              ? `<div style="display:grid;gap:6px;">${optionMarkup}</div>`
              : `<textarea 
                  data-assessment-answer="${i}"
                  placeholder="Type your answer here..."
                  style="width:100%;min-height:80px;padding:10px;background:#111c31;border:1px solid #2a3954;border-radius:8px;color:#d0d9e7;font-family:inherit;font-size:0.9rem;resize:vertical;"
                ></textarea>`}
          </div>
        `;
      }).join('')}
      <button type="button" id="submitAssessmentBtn" style="background:#10b981;border:none;color:#fff;border-radius:6px;padding:10px 16px;cursor:pointer;font-size:0.9rem;font-weight:700;margin-top:16px;">Submit Assessment</button>
      <div id="assessmentResult" style="margin-top:12px;font-size:0.9rem;color:#9fb0c7;line-height:1.6;"></div>
    `;
  }

  function renderCourse(course) {
    const courseTitle = String(course?.courseTitle || topic || 'Course');
    titleMain.textContent = courseTitle;
    titleSide.textContent = courseTitle;
    subtitleSide.textContent = String(course?.subtitle || 'Complete professional course');
    level.textContent = String(course?.difficulty || 'Intermediate');
    duration.textContent = String(course?.estimatedDuration || '4-6 weeks');
    demand.textContent = String(course?.marketDemand || 'High demand in current job market.');
    overview.textContent = String(course?.overview || 'Overview not available.');

    renderList(outcomes, course?.learningOutcomes);
    renderList(resumeSignals, course?.resumeSignals);
    
    progressState.assessmentItems = asArray(course?.finalAssessment);
    progressState.interviewPrepItems = asArray(course?.interviewPrep);
    
    renderModules(course?.modules);

    const project = course?.capstoneProject || {};
    const deliverables = asArray(project?.deliverables)
      .map((item) => `<li style="margin-bottom:6px;">${String(item)}</li>`)
      .join('');
    capstone.innerHTML = `
      <p><strong style="color:#93c5fd;">Project:</strong> ${String(project?.title || `${courseTitle} Capstone`)}</p>
      <p><strong style="color:#93c5fd;">Scenario:</strong> ${String(project?.scenario || 'Build and deliver an end-to-end practical project.')}</p>
      <p style="margin-bottom:6px;"><strong style="color:#93c5fd;">Deliverables:</strong></p>
      <ul style="margin:0;padding-left:18px;">${deliverables || '<li>Project plan</li><li>Execution artifact</li><li>Results summary</li>'}</ul>
    `;

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
    if (!total || completed !== total) return;

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
    doc.text('Certificate of Completion', width / 2, 120, { align: 'center' });

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
    doc.text(`Date: ${new Date().toLocaleDateString()}`, width / 2, 360, { align: 'center' });
    doc.text('Issued by RoleRocket AI Learning', width / 2, 402, { align: 'center' });

    const filename = `${String(topic || 'course').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-certificate.pdf`;
    doc.save(filename);
  }

  function renderAccessMessage(message, subtitle) {
    titleMain.textContent = topic || 'Course';
    titleSide.textContent = topic || 'Course';
    subtitleSide.textContent = subtitle || 'Course access required';
    overview.textContent = message;
    if (modules) {
      modules.innerHTML = '<div class="module-item"><p>Sign in with an Elite account to load modules, audio playback, and progress checks.</p></div>';
    }
    if (capstone) capstone.innerHTML = '<p>Capstone details will appear after course access is confirmed.</p>';
    if (assessment) assessment.innerHTML = '<div class="module-item"><p>Assessment questions will appear after course access is confirmed.</p></div>';
    if (interviewPrep) interviewPrep.innerHTML = '<li>Interview prep unlocks after course access is confirmed.</li>';
    if (capstoneSection) capstoneSection.hidden = true;
    if (assessmentSection) assessmentSection.hidden = true;
    if (interviewPrepSection) interviewPrepSection.hidden = true;
  }

  async function loadCourse(forceRefresh = false) {
    if (!topic) {
      titleMain.textContent = 'No course selected';
      titleSide.textContent = 'No course selected';
      overview.textContent = 'Return to the course catalog and choose a course card.';
      return;
    }

    setCourseLoadingState(true, forceRefresh ? 'Refreshing...' : 'Loading...');
    stopModuleAudio();
    progressState.sessionToken = '';
    progressState.moduleNarration = [];
    progressState.pendingAdvance = null;
    titleMain.textContent = `Loading ${topic}...`;
    titleSide.textContent = `Loading ${topic}...`;
    subtitleSide.textContent = forceRefresh ? 'Refreshing course version...' : 'Generating complete curriculum...';
    overview.textContent = forceRefresh ? 'Please wait while we create a fresh version of this course.' : 'Please wait while we build your full course.';
    if (modules) modules.innerHTML = '';
    if (assessment) assessment.innerHTML = '';
    if (capstone) capstone.innerHTML = '';
    if (interviewPrep) interviewPrep.innerHTML = '';
    if (capstoneSection) capstoneSection.hidden = true;
    if (assessmentSection) assessmentSection.hidden = true;
    if (interviewPrepSection) interviewPrepSection.hidden = true;
    if (outcomes) outcomes.innerHTML = '';
    if (resumeSignals) resumeSignals.innerHTML = '';

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
      if (/token|unauthorized|403|401/i.test(message)) {
        renderAccessMessage('Sign in and upgrade to Elite to open the full course experience for this topic.', 'Sign in required');
      } else {
        titleMain.textContent = topic;
        titleSide.textContent = topic;
        subtitleSide.textContent = 'Course generation failed';
        overview.textContent = message;
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
  loadLearnerIdentity();
  loadCourse();
});
