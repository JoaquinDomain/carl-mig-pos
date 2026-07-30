const encoder = new TextEncoder();
const roles = new Set(['admin', 'guest']);

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signature(payload: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))));
}

export async function createSessionToken(role: string, secret: string) {
  if (!roles.has(role)) throw new Error('Invalid role.');
  const payload = base64url(encoder.encode(JSON.stringify({ role })));
  return `${payload}.${await signature(payload, secret)}`;
}

export async function verifySessionToken(token: string | undefined, secret: string | undefined) {
  if (!token || !secret) return null;
  const [payload, supplied, extra] = token.split('.');
  if (!payload || !supplied || extra || supplied !== await signature(payload, secret)) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const role = JSON.parse(atob(normalized)).role;
    return roles.has(role) ? role as 'admin' | 'guest' : null;
  } catch {
    return null;
  }
}
