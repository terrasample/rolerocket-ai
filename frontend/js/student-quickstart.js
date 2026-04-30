/**
 * Student Quick-Start Onboarding Wizard
 * Shows once on first dashboard visit after signup.
 * Collects 5 key details → pre-fills Resume Builder → launches career journey.
 */
(function () {
  const STORAGE_KEY = 'rr_onboarding_done';
  const DRAFT_KEY = 'rr_student_draft';

  if (localStorage.getItem(STORAGE_KEY)) return;

  const steps = [
    {
      id: 'qualification',
      emoji: '🎓',
      title: 'What is your highest qualification?',
      subtitle: 'This helps us tailor your resume baseline.',
      type: 'select',
      options: [
        'Currently in school / university',
        'CSEC / Secondary school graduate',
        'CAPE / A-Level graduate',
        'Associate Degree',
        "Bachelor's Degree",
        "Master's Degree",
        'PhD / Doctoral Degree',
        'Professional Certification',
        'Trade / Vocational Certificate',
        'Other'
      ]
    },
    {
      id: 'field',
      emoji: '🎯',
      title: 'What role or field are you targeting?',
      subtitle: 'Be specific — e.g. Registered Nurse, Software Developer, Accountant.',
      type: 'text',
      placeholder: 'e.g. Registered Nurse'
    },
    {
      id: 'experience',
      emoji: '💼',
      title: 'Any work, internship, or volunteer experience?',
      subtitle: 'Brief notes are fine — we will structure it for you.',
      type: 'textarea',
      placeholder: 'e.g. 6-month internship at Kingston Public Hospital, nursing assistant duties...'
    },
    {
      id: 'skills',
      emoji: '⚡',
      title: 'Any skills, certifications, or tools?',
      subtitle: 'Include software, licences, languages, or anything relevant.',
      type: 'textarea',
      placeholder: 'e.g. BLS certified, Microsoft Office, patient care, NCLEX prep...'
    },
    {
      id: 'market',
      emoji: '🌍',
      title: 'Where are you looking to work?',
      subtitle: 'This shapes which opportunities we surface for you.',
      type: 'select',
      options: [
        'Jamaica only',
        'Jamaica first, open to overseas',
        'United Kingdom',
        'United States',
        'Canada',
        'Caribbean region',
        'Open to anywhere'
      ]
    }
  ];

  let current = 0;
  const answers = {};

  function buildModal() {
    const overlay = document.createElement('div');
    overlay.id = 'rrOnboardingOverlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.72);
      z-index: 99999; display: flex; align-items: center; justify-content: center;
      padding: 16px; box-sizing: border-box;
    `;

    const card = document.createElement('div');
    card.id = 'rrOnboardingCard';
    card.style.cssText = `
      background: #0f172a; border: 1px solid #1e3a5f; border-radius: 18px;
      max-width: 520px; width: 100%; padding: 36px 32px 28px;
      box-shadow: 0 24px 72px rgba(0,0,0,0.6); color: #f8fafc;
      font-family: inherit;
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    renderStep(card);
  }

  function renderStep(card) {
    const step = steps[current];
    const progress = Math.round(((current) / steps.length) * 100);

    card.innerHTML = `
      <div style="margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:0.78rem;font-weight:700;color:#60a5fa;text-transform:uppercase;letter-spacing:0.06em;">
            Step ${current + 1} of ${steps.length}
          </span>
          <span style="font-size:0.78rem;color:#64748b;">Career Launch Setup</span>
        </div>
        <div style="background:#1e293b;border-radius:999px;height:5px;overflow:hidden;">
          <div style="background:linear-gradient(90deg,#2563eb,#6d28d9);height:100%;width:${progress}%;border-radius:999px;transition:width 0.35s ease;"></div>
        </div>
      </div>

      <div style="font-size:2.2rem;margin-bottom:10px;">${step.emoji}</div>
      <h2 style="font-size:1.35rem;font-weight:800;margin:0 0 6px;color:#f1f5f9;">${step.title}</h2>
      <p style="font-size:0.93rem;color:#94a3b8;margin:0 0 20px;">${step.subtitle}</p>

      <div id="rrStepInput" style="margin-bottom:22px;">${renderInput(step)}</div>

      <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
        ${current > 0 ? `<button id="rrBackBtn" style="background:transparent;border:1px solid #334155;color:#94a3b8;padding:10px 20px;border-radius:10px;cursor:pointer;font-weight:600;font-size:0.93rem;">Back</button>` : ''}
        <button id="rrNextBtn" style="background:linear-gradient(135deg,#2563eb,#6d28d9);color:#fff;border:none;padding:11px 28px;border-radius:10px;cursor:pointer;font-weight:700;font-size:0.95rem;flex:1;min-width:120px;">
          ${current === steps.length - 1 ? '🚀 Build My Resume' : 'Continue →'}
        </button>
      </div>
      <p style="text-align:center;margin:14px 0 0;font-size:0.8rem;color:#475569;">
        <a href="#" id="rrSkipLink" style="color:#475569;text-decoration:underline;">Skip for now</a>
      </p>
    `;

    // Restore previous answer
    const inputEl = card.querySelector('#rrStepInput select, #rrStepInput input, #rrStepInput textarea');
    if (inputEl && answers[step.id] !== undefined) {
      inputEl.value = answers[step.id];
    }

    card.querySelector('#rrNextBtn').addEventListener('click', () => handleNext(card));
    card.querySelector('#rrBackBtn')?.addEventListener('click', () => { current--; renderStep(card); });
    card.querySelector('#rrSkipLink').addEventListener('click', (e) => { e.preventDefault(); finish(true); });
  }

  function renderInput(step) {
    if (step.type === 'select') {
      const opts = step.options.map(o => `<option value="${o}">${o}</option>`).join('');
      return `<select style="width:100%;padding:12px 14px;background:#1e293b;border:1px solid #334155;border-radius:10px;color:#f8fafc;font-size:0.97rem;outline:none;">${opts}</select>`;
    }
    if (step.type === 'textarea') {
      return `<textarea rows="4" placeholder="${step.placeholder}" style="width:100%;padding:12px 14px;background:#1e293b;border:1px solid #334155;border-radius:10px;color:#f8fafc;font-size:0.95rem;resize:vertical;outline:none;box-sizing:border-box;">${answers[step.id] || ''}</textarea>`;
    }
    return `<input type="text" placeholder="${step.placeholder}" value="${answers[step.id] || ''}" style="width:100%;padding:12px 14px;background:#1e293b;border:1px solid #334155;border-radius:10px;color:#f8fafc;font-size:0.97rem;outline:none;box-sizing:border-box;" />`;
  }

  function handleNext(card) {
    const step = steps[current];
    const inputEl = card.querySelector('#rrStepInput select, #rrStepInput input, #rrStepInput textarea');
    const value = inputEl ? inputEl.value.trim() : '';

    if (!value && step.type !== 'textarea') {
      inputEl.style.borderColor = '#ef4444';
      inputEl.focus();
      return;
    }

    answers[step.id] = value;

    if (current < steps.length - 1) {
      current++;
      renderStep(card);
    } else {
      finish(false);
    }
  }

  function finish(skipped) {
    localStorage.setItem(STORAGE_KEY, '1');

    if (!skipped && answers.field) {
      // Pre-fill resume builder with collected data
      const draft = {
        jobTitle: answers.field || '',
        qualification: answers.qualification || '',
        experience: answers.experience || '',
        skills: answers.skills || '',
        market: answers.market || '',
        fromOnboarding: true
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));

      // Build a simple resume baseline text for the resume builder
      const baselineText = buildBaselineText(draft);
      localStorage.setItem('rr_resume_baseline', baselineText);
    }

    // Remove overlay
    document.getElementById('rrOnboardingOverlay')?.remove();

    // Redirect to resume builder if not skipped
    if (!skipped && answers.field) {
      window.location.href = `resume-generator.html?from=onboarding&role=${encodeURIComponent(answers.field)}`;
    }
  }

  function buildBaselineText(draft) {
    const lines = [];
    if (draft.qualification) lines.push(`Education: ${draft.qualification}`);
    if (draft.experience) lines.push(`\nExperience:\n${draft.experience}`);
    if (draft.skills) lines.push(`\nSkills & Certifications:\n${draft.skills}`);
    if (draft.market) lines.push(`\nTarget Market: ${draft.market}`);
    return lines.join('\n');
  }

  // Launch on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildModal);
  } else {
    buildModal();
  }
})();
