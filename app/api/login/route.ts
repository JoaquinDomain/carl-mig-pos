import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '../../../utils/auth.js';

export async function POST(request: NextRequest) {
  const { role, password } = await request.json();
  if (role !== 'admin' && role !== 'guest') {
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
  }
  if (role === 'admin' && (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD)) {
    return NextResponse.json({ error: 'Incorrect admin password.' }, { status: 401 });
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) return NextResponse.json({ error: 'Authentication is not configured.' }, { status: 500 });
  const response = NextResponse.json({ role });
  response.cookies.set('carls_session', createSessionToken(role, secret), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 12,
    path: '/'
  });
  return response;
}
