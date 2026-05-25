'use strict';

const BRAND = {
  name: 'RoleRocket AI',
  from: 'info@rolerocketai.com',
  dashUrl: process.env.CLIENT_URL ? process.env.CLIENT_URL.replace(/\/$/, '') : 'https://www.rolerocketai.com'
};

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'there';
}

function baseWrapper(content) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#E0F2FE;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0"
  style="background:radial-gradient(circle at top,#FFFFFF 0%,#E0F2FE 42%,#DBEAFE 100%);padding:32px 14px;">
  <tr><td align="center">
    <table width="640" cellpadding="0" cellspacing="0" border="0"
      style="max-width:640px;width:100%;border-radius:28px;overflow:hidden;box-shadow:0 22px 60px rgba(15,23,42,0.18);background:#FFFFFF;border:3px solid #1D4ED8;">

      <!-- HEADER -->
      <tr>
        <td style="background:linear-gradient(135deg,#082F49 0%,#0F172A 38%,#0C4A6E 72%,#0284C7 100%);padding:24px 30px 28px;">
          <table cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border:1px solid #BFDBFE;border-radius:999px;">
            <tr>
              <td style="padding:10px 14px;color:#DC2626;font-size:24px;line-height:1;">&#x1F680;</td>
              <td style="padding:10px 18px 10px 0;white-space:nowrap;">
                <div style="color:#0F172A;font-size:22px;font-weight:800;letter-spacing:-0.4px;">${BRAND.name}</div>
                <div>
                  <span style="display:inline-block;width:7px;height:7px;background:#DC2626;border-radius:999px;margin-right:6px;vertical-align:middle;"></span>
                  <span style="color:#0C4A6E;font-size:12px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;vertical-align:middle;">AI Job Search &amp; Career Co-Pilot</span>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- GRADIENT BAR -->
      <tr><td style="background:linear-gradient(90deg,#0EA5E9 0%,#F97316 48%,#38BDF8 100%);height:4px;"></td></tr>

      <!-- BODY -->
      ${content}

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function featureCard(icon, title, body) {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:18px;margin-bottom:12px;">
    <tr>
      <td width="58" style="padding:18px 0 18px 18px;vertical-align:top;">
        <div style="width:40px;height:40px;border-radius:12px;background:#E0F2FE;text-align:center;line-height:40px;font-size:20px;">${icon}</div>
      </td>
      <td style="padding:18px 18px 18px 12px;">
        <div style="color:#0F172A;font-size:15px;font-weight:800;">${title}</div>
        <div style="margin-top:5px;color:#64748B;font-size:13px;line-height:1.65;">${body}</div>
      </td>
    </tr>
  </table>`;
}

function ctaButton(label, href) {
  return `
  <table cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
    <tr>
      <td>
        <a href="${href}"
          style="display:inline-block;background:#0C4A6E;color:#FFFFFF;text-decoration:none;padding:16px 38px;border-radius:16px;font-weight:800;font-size:18px;letter-spacing:0.2px;box-shadow:0 14px 28px rgba(12,74,110,0.28);border:2px solid #082F49;">
          ${label} &rarr;
        </a>
      </td>
    </tr>
  </table>`;
}

function footer(unsubscribeUrl) {
  return `
  <tr>
    <td style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:20px 30px;text-align:center;">
      <p style="margin:0;color:#94A3B8;font-size:12px;line-height:1.7;">
        RoleRocket AI &bull; <a href="https://www.rolerocketai.com" style="color:#0284C7;text-decoration:none;">rolerocketai.com</a>
      </p>
      <p style="margin:6px 0 0;color:#CBD5E1;font-size:11px;">
        <a href="${unsubscribeUrl}" style="color:#94A3B8;text-decoration:underline;">Unsubscribe from engagement emails</a>
      </p>
    </td>
  </tr>`;
}

// ─── EMAIL TYPE 1: day3_nudge ─────────────────────────────────────────────────
function getDay3NudgeHtml(name, unsubscribeUrl) {
  const first = firstName(name);
  const dash = BRAND.dashUrl;

  const body = `
  <tr>
    <td style="background:#FFFFFF;padding:32px 32px 16px;">
      <div style="display:inline-block;background:#FED7AA;color:#9A3412;border-radius:999px;padding:6px 12px;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">Quick start guide</div>
      <h1 style="margin:14px 0 8px;color:#0F172A;font-size:28px;font-weight:800;line-height:1.2;letter-spacing:-0.6px;">Still figuring out where to start, ${first}?</h1>
      <p style="margin:0 0 22px;color:#475569;font-size:15px;line-height:1.75;">No worries. Here are three things you can do in the next 10 minutes that will make your job search noticeably easier.</p>

      ${featureCard('&#x1F4C4;', 'Tailor your resume to a real job', 'Paste a job description and your resume — RoleRocket rewrites the bullets to match what the employer is actually scanning for.')}
      ${featureCard('&#x1F3A4;', 'Run a mock interview', 'Pick a role and go. Interview Assist gives you targeted talking points so you walk in with something to say.')}
      ${featureCard('&#x1F50D;', 'Save a job and track your pipeline', 'Search live job boards directly from your dashboard and log every application you send so nothing slips.')}

      ${ctaButton('Open My Dashboard', `${dash}/dashboard.html`)}
    </td>
  </tr>
  <tr><td style="background:linear-gradient(90deg,#0EA5E9 0%,#F97316 48%,#38BDF8 100%);height:4px;"></td></tr>
  ${footer(unsubscribeUrl)}`;

  return baseWrapper(body);
}

// ─── EMAIL TYPE 2: day7_reengagement ─────────────────────────────────────────
function getDay7ReengagementHtml(name, unsubscribeUrl) {
  const first = firstName(name);
  const dash = BRAND.dashUrl;

  const body = `
  <tr>
    <td style="background:#FFFFFF;padding:32px 32px 16px;">
      <div style="display:inline-block;background:#DBEAFE;color:#1D4ED8;border-radius:999px;padding:6px 12px;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">Come back</div>
      <h1 style="margin:14px 0 8px;color:#0F172A;font-size:28px;font-weight:800;line-height:1.2;letter-spacing:-0.6px;">A few things worth trying, ${first}</h1>
      <p style="margin:0 0 22px;color:#475569;font-size:15px;line-height:1.75;">Your dashboard is ready. Here's what's waiting for you that most users find most useful once they give it a real try.</p>

      ${featureCard('&#x1F4CA;', 'ATS Score your current resume', 'See exactly how your resume reads to applicant tracking systems — and what to fix to improve your match rate.')}
      ${featureCard('&#x2709;&#xFE0F;', 'Generate a targeted cover letter', 'Takes under 2 minutes. Paste the job posting and your background — get a letter that sounds like you wrote it yourself.')}
      ${featureCard('&#x1F4BC;', 'Career Coach AI', 'Ask anything about your next move, salary negotiation, how to explain a gap, or how to position a career pivot.')}

      ${ctaButton('Back to My Dashboard', `${dash}/dashboard.html`)}
    </td>
  </tr>
  <tr><td style="background:linear-gradient(90deg,#0EA5E9 0%,#F97316 48%,#38BDF8 100%);height:4px;"></td></tr>
  ${footer(unsubscribeUrl)}`;

  return baseWrapper(body);
}

// ─── EMAIL TYPE 3: day30_winback ──────────────────────────────────────────────
function getDay30WinbackHtml(name, unsubscribeUrl) {
  const first = firstName(name);
  const dash = BRAND.dashUrl;

  const body = `
  <tr>
    <td style="background:#FFFFFF;padding:32px 32px 16px;">
      <div style="display:inline-block;background:#ECFDF5;color:#065F46;border-radius:999px;padding:6px 12px;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">We kept your spot</div>
      <h1 style="margin:14px 0 8px;color:#0F172A;font-size:28px;font-weight:800;line-height:1.2;letter-spacing:-0.6px;">Your dashboard is still here, ${first}</h1>
      <p style="margin:0 0 22px;color:#475569;font-size:15px;line-height:1.75;">Whenever you're ready to get back in the game, everything is exactly where you left it. The job market moves fast — RoleRocket makes sure you don't fall behind.</p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:20px;margin-bottom:22px;">
        <tr>
          <td style="padding:22px 24px;">
            <div style="color:#0F172A;font-size:17px;font-weight:800;letter-spacing:-0.3px;">What's waiting for you</div>
            <ul style="margin:12px 0 0;padding-left:20px;color:#334155;font-size:14px;line-height:2;">
              <li>Saved jobs and your application tracker</li>
              <li>Resume tailoring against any job description</li>
              <li>Interview prep for whatever role you're targeting</li>
              <li>Career Coach AI to talk through your next move</li>
            </ul>
          </td>
        </tr>
      </table>

      ${ctaButton('Pick Up Where I Left Off', `${dash}/dashboard.html`)}
    </td>
  </tr>
  <tr><td style="background:linear-gradient(90deg,#0EA5E9 0%,#F97316 48%,#38BDF8 100%);height:4px;"></td></tr>
  ${footer(unsubscribeUrl)}`;

  return baseWrapper(body);
}

module.exports = { getDay3NudgeHtml, getDay7ReengagementHtml, getDay30WinbackHtml };
