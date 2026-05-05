const fs = require('fs');
const path = require('path');
const PDFDocument = require('../backend/node_modules/pdfkit');

const outDir = path.join(process.env.HOME, 'Desktop', 'RoleRocket_UWI_Sales_Kit');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'Cohort_Manager_Guide.pdf');

const doc = new PDFDocument({ size: 'LETTER', margin: 48 });
doc.pipe(fs.createWriteStream(outPath));

function title(text) {
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#0f172a').text(text);
  doc.moveDown(0.4);
}

function subtitle(text) {
  doc.font('Helvetica').fontSize(11).fillColor('#334155').text(text);
  doc.moveDown(0.6);
}

function section(text) {
  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#1e3a8a').text(text);
  doc.moveDown(0.2);
}

function sub(text) {
  doc.font('Helvetica-Bold').fontSize(11.5).fillColor('#0f172a').text(text);
  doc.moveDown(0.15);
}

function para(text) {
  doc.font('Helvetica').fontSize(10.8).fillColor('#1f2937').text(text, { lineGap: 2 });
  doc.moveDown(0.25);
}

function bullets(items) {
  items.forEach((item) => {
    doc.font('Helvetica').fontSize(10.8).fillColor('#1f2937').text('- ' + item, { indent: 10, lineGap: 2 });
  });
  doc.moveDown(0.35);
}

function numbered(items) {
  items.forEach((item, i) => {
    doc.font('Helvetica').fontSize(10.8).fillColor('#1f2937').text(`${i + 1}. ${item}`, { indent: 10, lineGap: 2 });
  });
  doc.moveDown(0.35);
}

title('RoleRocket AI - Cohort Manager Guide');
subtitle('Detailed process guide for institutions: setup, onboarding, intervention, reporting, and scale.');
para('Audience: Institution admins, career services, advisors, and student success teams.');
para('Purpose: This guide tells each role exactly what to do at each stage, from institution signup to weekly intervention execution.');
para('Version: UWI Sales Kit Edition | Date: April 30, 2026');

section('A) Program Setup: What Happens First');
sub('Step 1: Institution Admin Account Creation');
numbered([
  'Institution lead signs up with Institution account type.',
  'Institution name is standardized (for example: UWI Mona).',
  'Admin confirms access to Cohort Manager dashboard.',
  'Admin copies institution invite link from Overview.'
]);

sub('Step 2: Internal Readiness Checklist');
bullets([
  'Assign one cohort owner and one backup owner.',
  'Define student cohort scope (program, intake, semester).',
  'Set weekly operations slot (recommended: 45 to 60 minutes).',
  'Agree KPIs before launch (activation, resumes, applications, active 7-day).'
]);

section('B) Student Onboarding Process (Exact Flow)');
sub('What students should do');
numbered([
  'Open institution invite link (not a generic signup link).',
  'Complete signup and verify email.',
  'Log in and complete first action within 48 hours.',
  'First action can be: Resume, Job Search, Interview Assist, or Job Alerts.',
  'Submit one application in first week where possible.'
]);

sub('What staff should verify');
bullets([
  'Student appears in Students tab under institution cohort.',
  'Student has at least one activity signal (usage/applications).',
  'Student is no longer in no-usage at-risk category after first action.'
]);

section('C) Daily Operating Process (10 to 15 Minutes)');
numbered([
  'Open Overview and check Active 7-day trend.',
  'Check At-Risk cards for any spikes.',
  'Trigger same-day nudges for highest-risk students.',
  'Flag unresolved access issues for technical follow-up.'
]);

section('D) Weekly Intervention Process (45 to 60 Minutes)');
sub('Part 1: Pull and segment lists');
numbered([
  'Open Interventions tab.',
  'Copy emails for No Resume / No Tool Use.',
  'Copy emails for Inactive 14+ Days.',
  'Copy emails for No Applications.'
]);

sub('Part 2: Send targeted campaigns by segment');
para('Use one message per category with a single call-to-action. Do not use one generic broadcast for all students.');

sub('Message template: No Resume / No Tool Use');
para('Subject: Start your first employability action this week\nMessage: Complete your first resume draft today using the Resume Generator. Reply DONE once complete so we can help with your next step.');

sub('Message template: Inactive 14+ Days');
para('Subject: Quick re-start this week\nMessage: We noticed your activity paused. Please complete one action today: Interview Assist or Job Search. We will support your next step after that.');

sub('Message template: No Applications');
para('Subject: Submit your first application this week\nMessage: Your goal this week is one quality application. Use Job Search + Job Alerts and share your target role with your advisor.');

sub('Part 3: Track conversion from outreach');
bullets([
  'Count students contacted by category.',
  'Count students re-activated in 7 days.',
  'Count first applications submitted after intervention.',
  'Document highest-performing message variants.'
]);

section('E) KPI and Reporting Framework');
sub('Core metrics to track weekly');
bullets([
  'Activation rate: students with first action divided by invited students.',
  'Resume completion rate.',
  'Applications submitted per active student.',
  'Active 7-day percentage.',
  'At-risk category reduction week-over-week.'
]);

sub('Monthly review questions');
numbered([
  'Which category remains the largest risk?',
  'Which intervention message produced the best conversion?',
  'Which program/faculty has lowest activation?',
  'What process change should be tested next month?'
]);

section('F) Troubleshooting Guide');
sub('Student not showing in cohort');
bullets([
  'Confirm student used institution invite link.',
  'Confirm student finished signup and email verification.',
  'Confirm student completed first activity.',
  'Refresh dashboard and recheck after sync window.'
]);

sub('Institution cannot access Cohort Manager');
bullets([
  'Verify login is institution account type.',
  'Re-authenticate and retry.',
  'Confirm account has institution profile fields.',
  'Escalate with screenshot, email, and timestamp if unresolved.'
]);

section('G) 30-Day Launch Timeline');
sub('Week 1: Setup + Invite');
bullets(['Admin setup complete', 'Invite link distributed', 'First activation checkpoint']);
sub('Week 2: First intervention cycle');
bullets(['Run all three risk campaigns', 'Review conversion after 7 days']);
sub('Week 3: Optimization');
bullets(['Refine messages', 'Increase advisor follow-up quality']);
sub('Week 4: Impact review and scale decision');
bullets(['Baseline vs week-4 KPI comparison', 'Recommend wider rollout scope']);

section('H) Ownership Matrix');
bullets([
  'Institution Admin: governance, KPI review, escalation owner.',
  'Career Services: intervention execution owner.',
  'Advisors: student accountability and follow-up owner.',
  'Program Leads: adoption reinforcement owner.'
]);

section('I) Operational Checklist');
numbered([
  'Institution owner assigned',
  'Invite link deployed',
  'Weekly intervention meeting scheduled',
  'KPI sheet updated weekly',
  'Monthly impact review calendarized'
]);

para('End of guide.');

doc.end();
console.log('Detailed guide created:', outPath);
