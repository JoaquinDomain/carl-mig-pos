const test = require('node:test');
const assert = require('node:assert/strict');
const { createSessionToken, verifySessionToken } = require('../utils/auth.js');

test('creates and verifies signed admin and guest sessions', () => {
  const secret = 'test-secret-at-least-32-characters-long';
  const adminToken = createSessionToken('admin', secret);
  const guestToken = createSessionToken('guest', secret);

  assert.equal(verifySessionToken(adminToken, secret), 'admin');
  assert.equal(verifySessionToken(guestToken, secret), 'guest');
});

test('rejects tampered sessions and invalid roles', () => {
  const secret = 'test-secret-at-least-32-characters-long';
  const token = createSessionToken('admin', secret);

  assert.equal(verifySessionToken(`${token}tampered`, secret), null);
  assert.throws(() => createSessionToken('owner', secret), /Invalid role/);
});
