const jwt = require('jsonwebtoken');
const assert = require('assert');

process.env.NODE_ENV = 'test';
process.env.E2E_MOCK = '1';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

const app = require('../server');

function makeToken() {
  return jwt.sign({ userId: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET, {
    expiresIn: '1h'
  });
}

async function run() {
  const token = makeToken();
  const server = app.listen(0);

  try {
    const base = `http://127.0.0.1:${server.address().port}`;

    const searchRes = await fetch(`${base}/api/jobs/find`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ title: 'Project Manager', location: 'Remote', resume: 'Agile stakeholder delivery' })
    });

    assert.equal(searchRes.status, 200, 'jobs/find should return 200');
    const searchJson = await searchRes.json();
    assert.ok(Array.isArray(searchJson.jobs), 'jobs/find should return jobs array');
    assert.ok(searchJson.jobs.length > 0, 'jobs/find should return at least one job');

    const checkoutRes = await fetch(`${base}/api/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ plan: 'pro' })
    });

    assert.equal(checkoutRes.status, 200, 'checkout should return 200');
    const checkoutJson = await checkoutRes.json();
    assert.ok(String(checkoutJson.url || '').includes('checkout.test'), 'checkout should return mocked checkout URL');

    const interviewRes = await fetch(`${base}/api/interview-assist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ question: 'Tell me about a time you handled conflict.' })
    });

    assert.equal(interviewRes.status, 200, 'interview-assist should return 200');
    const interviewJson = await interviewRes.json();
    assert.ok(interviewJson.answer, 'interview-assist should return answer');
    assert.ok(Array.isArray(interviewJson.bullets), 'interview-assist should return bullet array');

    console.log('E2E core-flow tests passed.');
  } finally {
    server.close();
  }
}

run().catch((err) => {
  console.error('E2E test failure:', err.message);
  process.exit(1);
});
