import test from 'node:test';
import assert from 'node:assert/strict';

test('register route rejects requests without a turnstile token', async () => {
  const { POST } = await import('./route');

  const request = new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: 'alice',
      password: 'secret123',
    }),
  });

  const response = await POST(request as never);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: '请完成人机验证',
  });
});
