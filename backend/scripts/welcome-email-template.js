'use strict';

function getWelcomeEmailHtml(name, dashUrl) {
  const firstName = String(name || '').trim().split(/\s+/)[0] || 'there';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#E0F2FE;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:radial-gradient(circle at top,#FFFFFF 0%,#E0F2FE 42%,#DBEAFE 100%);padding:32px 14px;">
  <tr><td align="center">
    <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;border-radius:28px;overflow:hidden;box-shadow:0 22px 60px rgba(15,23,42,0.18);background:#FFFFFF;border:3px solid #1D4ED8;">
      <tr>
        <td style="background:linear-gradient(135deg,#082F49 0%,#0F172A 38%,#0C4A6E 72%,#0284C7 100%);padding:28px 30px 34px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <table cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border:1px solid #BFDBFE;border-radius:999px;">
                  <tr>
                    <td style="padding:10px 14px;color:#DC2626;font-size:24px;line-height:1;">&#x1F680;</td>
                    <td style="padding:10px 18px 10px 0;white-space:nowrap;">
                      <div style="color:#0F172A;font-size:24px;font-weight:800;letter-spacing:-0.4px;">RoleRocket AI</div>
                      <div>
                        <span style="display:inline-block;width:8px;height:8px;background:#DC2626;border-radius:999px;margin-right:7px;vertical-align:middle;"></span>
                        <span style="color:#0C4A6E;font-size:14px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;vertical-align:middle;">AI Job Search and Career Co-Pilot</span>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;background:#F8FCFF;border:1px solid #BFDBFE;border-radius:24px;">
            <tr>
              <td style="padding:30px 28px 26px;">
                <div style="display:inline-block;background:#FED7AA;color:#9A3412;border-radius:999px;padding:7px 12px;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">Built to make interviews and applications easier</div>
                <h1 style="margin:16px 0 10px;color:#0F172A;font-size:34px;font-weight:800;line-height:1.15;letter-spacing:-0.8px;">Welcome aboard, ${firstName}.</h1>
                <p style="margin:0;color:#334155;font-size:17px;line-height:1.75;max-width:500px;">You now have a faster way to find roles, tailor every application, and stay sharp in interviews without juggling five different tools.</p>

                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
                  <tr>
                    <td style="padding-right:8px;padding-bottom:8px;">
                        <div style="background:#FFFFFF;border:1px solid #DBEAFE;border-radius:16px;padding:14px 14px 12px;">
                          <div style="color:#0369A1;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">Career Coach AI</div>
                          <div style="margin-top:6px;color:#0F172A;font-size:14px;line-height:1.55;">Get practical guidance for your next move, from positioning yourself better to navigating interviews and offers.</div>
                      </div>
                    </td>
                    <td style="padding-left:8px;padding-bottom:8px;">
                      <div style="background:#FFFFFF;border:1px solid #DBEAFE;border-radius:16px;padding:14px 14px 12px;">
                        <div style="color:#0369A1;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">Tailored Documents</div>
                        <div style="margin-top:6px;color:#0F172A;font-size:14px;line-height:1.55;">Create ATS-ready resumes and role-targeted cover letters in minutes.</div>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr><td style="background:linear-gradient(90deg,#0EA5E9 0%,#F97316 48%,#38BDF8 100%);height:4px;"></td></tr>

      <tr>
        <td style="background:#FFFFFF;padding:34px 32px 16px;">
          <div style="color:#0F172A;font-size:22px;font-weight:800;letter-spacing:-0.4px;">Why people choose RoleRocket AI</div>
          <p style="margin:10px 0 0;color:#475569;font-size:15px;line-height:1.8;">Most tools stop at resume writing. RoleRocket AI helps across the full job search: finding better-fit roles, improving application quality, and helping you perform when interviews happen.</p>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
            <tr>
              <td style="padding-bottom:16px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:18px;">
                  <tr>
                    <td width="58" style="padding:18px 0 18px 18px;vertical-align:top;"><div style="width:40px;height:40px;border-radius:12px;background:#E0F2FE;text-align:center;line-height:40px;font-size:20px;">&#x1F3A4;</div></td>
                    <td style="padding:18px 18px 18px 12px;">
                      <div style="color:#0F172A;font-size:16px;font-weight:800;">Interview Assist that actually helps in the moment</div>
                      <div style="margin-top:6px;color:#64748B;font-size:14px;line-height:1.65;">Stay composed with fast, concise talking points when you need to answer clearly and confidently.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:16px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:18px;">
                  <tr>
                    <td width="58" style="padding:18px 0 18px 18px;vertical-align:top;"><div style="width:40px;height:40px;border-radius:12px;background:#DBEAFE;text-align:center;line-height:40px;font-size:20px;">&#x1F4C4;</div></td>
                    <td style="padding:18px 18px 18px 12px;">
                      <div style="color:#0F172A;font-size:16px;font-weight:800;">Role-targeted resumes and cover letters</div>
                      <div style="margin-top:6px;color:#64748B;font-size:14px;line-height:1.65;">Tailor each application without rewriting everything from scratch, while keeping it ATS-friendly.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td>
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:18px;">
                  <tr>
                    <td width="58" style="padding:18px 0 18px 18px;vertical-align:top;"><div style="width:40px;height:40px;border-radius:12px;background:#FFEDD5;text-align:center;line-height:40px;font-size:20px;">&#x1F4CA;</div></td>
                    <td style="padding:18px 18px 18px 12px;">
                      <div style="color:#0F172A;font-size:16px;font-weight:800;">A cleaner way to manage your pipeline</div>
                      <div style="margin-top:6px;color:#64748B;font-size:14px;line-height:1.65;">Track applications, interviews, and momentum in one place so opportunities do not slip through.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:20px;">
            <tr>
              <td style="padding:22px 22px 18px;">
                <div style="color:#0F172A;font-size:18px;font-weight:800;letter-spacing:-0.3px;">Start here</div>
                <div style="margin-top:8px;color:#475569;font-size:14px;line-height:1.75;">Open your dashboard, save a role, tailor your resume to it, and test Interview Assist before your next call. You will feel the difference quickly.</div>
                <table cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;">
                  <tr>
                    <td>
                      <a href="${dashUrl}/dashboard.html" style="display:inline-block;background:#0C4A6E;color:#FFFFFF;text-decoration:none;padding:18px 40px;border-radius:16px;font-weight:800;font-size:19px;letter-spacing:0.2px;box-shadow:0 14px 28px rgba(12,74,110,0.28);border:2px solid #082F49;">Launch Your Dashboard &rarr;</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="background:#F8FAFC;padding:24px 32px;border-top:1px solid #E2E8F0;">
          <p style="margin:0 0 6px;color:#64748B;font-size:13px;text-align:center;">Questions? Reply to this email and we will help.</p>
          <p style="margin:0;color:#94A3B8;font-size:11px;text-align:center;">&copy; 2026 RoleRocket AI &nbsp;&middot;&nbsp; You are receiving this because you created an account.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

module.exports = { getWelcomeEmailHtml };
