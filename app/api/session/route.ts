import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '../../../utils/auth-edge';

export async function GET() {
  const cookieStore = await cookies();
  const role = await verifySessionToken(cookieStore.get('carls_session')?.value, process.env.AUTH_SECRET);
  return NextResponse.json({ role });
}
