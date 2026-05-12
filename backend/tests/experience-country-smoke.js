/* eslint-disable no-console */
const BASE_URL = (process.env.BASE_URL || 'http://localhost:5001').replace(/\/$/, '');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Expected JSON but received: ${text.slice(0, 180)}`);
  }
}

async function testContextEndpoint() {
  const response = await fetch(`${BASE_URL}/api/experience/context`);
  assert(response.ok, `GET /api/experience/context failed (${response.status})`);

  const data = await readJson(response);
  assert(typeof data.detectedCountry === 'string', 'context.detectedCountry missing');
  assert(typeof data.effectiveCountry === 'string', 'context.effectiveCountry missing');
  assert(Array.isArray(data.supportedCountries), 'context.supportedCountries missing');

  console.log('PASS: context endpoint');
}

async function testPreferenceEndpoint() {
  const cases = [
    { code: 'GLOBAL', showJamaicaHub: false },
    { code: 'JM', showJamaicaHub: true },
    { code: 'US', showJamaicaHub: false },
    { code: 'DE', showJamaicaHub: false },
    { code: 'NG', showJamaicaHub: false },
    { code: 'AW', showJamaicaHub: false }
  ];

  for (const testCase of cases) {
    const response = await fetch(`${BASE_URL}/api/experience/preference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode: testCase.code })
    });

    assert(response.ok, `POST /api/experience/preference ${testCase.code} failed (${response.status})`);
    const data = await readJson(response);

    assert(data.ok === true, `preference ${testCase.code} did not return ok=true`);
    assert(data.selectedCountry === testCase.code, `selectedCountry mismatch for ${testCase.code}`);
    assert(data.effectiveCountry === testCase.code, `effectiveCountry mismatch for ${testCase.code}`);
    assert(data.showJamaicaHub === testCase.showJamaicaHub, `showJamaicaHub mismatch for ${testCase.code}`);
  }

  console.log('PASS: preference endpoint');
}

async function testJamaicaHubGate() {
  const blocked = await fetch(`${BASE_URL}/jamaica-workforce-accelerator.html`, {
    redirect: 'manual'
  });

  assert(blocked.status === 302, `Expected 302 without cookie, got ${blocked.status}`);
  const blockedLocation = blocked.headers.get('location') || '';
  assert(blockedLocation.includes('/dashboard.html?experience=global'), `Unexpected redirect location: ${blockedLocation}`);

  const allowed = await fetch(`${BASE_URL}/jamaica-workforce-accelerator.html`, {
    redirect: 'manual',
    headers: { Cookie: 'rr_exp_country=JM' }
  });

  assert(allowed.status === 200, `Expected 200 with JM cookie, got ${allowed.status}`);

  console.log('PASS: Jamaica hub gate');
}

(async function run() {
  try {
    console.log(`Running experience-country smoke tests against ${BASE_URL}`);
    await testContextEndpoint();
    await testPreferenceEndpoint();
    await testJamaicaHubGate();
    console.log('PASS: all experience-country smoke tests');
  } catch (error) {
    console.error('FAIL:', error.message);
    process.exit(1);
  }
})();
