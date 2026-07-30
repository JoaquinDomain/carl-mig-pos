const crypto = require('node:crypto');

const ROLES = new Set(['admin', 'guest']);

function createSessionToken(role, secret) {
  if (!ROLES.has(role)) throw new Error('Invalid role.');
  if (!secret) throw new Error('Session secret is required.');
  const payload = Buffer.from(JSON.stringify({ role })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifySessionToken(token, secret) {
  if (!token || !secret) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const { role } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return ROLES.has(role) ? role : null;
  } catch {
    return null;
  }
}

module.exports = { createSessionToken, verifySessionToken };
