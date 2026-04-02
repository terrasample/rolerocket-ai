const fs = require('fs');
const path = require('path');

const frontendDir = path.resolve(__dirname, '../../frontend');
const files = fs
  .readdirSync(frontendDir)
  .filter((f) => f.endsWith('.html'))
  .sort();

const failures = [];

for (const file of files) {
  const filePath = path.join(frontendDir, file);
  const html = fs.readFileSync(filePath, 'utf8');
  const messageTags = html.match(/<[^>]*id="[^"]*Message"[^>]*>/g) || [];

  const checks = [
    {
      name: 'has skip link',
      pass: /class="skip-link"/.test(html)
    },
    {
      name: 'has viewport meta',
      pass: /name="viewport"/.test(html)
    },
    {
      name: 'form controls have labels or aria-label',
      pass: !/(<input|<textarea|<select)(?![^>]*(aria-label|id=))/g.test(html)
    },
    {
      name: 'status messages use aria-live when present',
      pass: messageTags.every((tag) => /aria-live=/.test(tag))
    }
  ];

  checks.forEach((check) => {
    if (!check.pass) {
      failures.push(`${file}: ${check.name}`);
    }
  });
}

if (failures.length) {
  console.error('Accessibility audit failed:');
  failures.forEach((f) => console.error(`- ${f}`));
  process.exit(1);
}

console.log(`Accessibility audit passed for ${files.length} HTML pages.`);
