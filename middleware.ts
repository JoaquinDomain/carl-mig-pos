import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from './utils/auth-edge';

export async function middleware(request: NextRequest) {
  const role = await verifySessionToken(
    request.cookies.get('carls_session')?.value,
    process.env.AUTH_SECRET
  );
  const path = request.nextUrl.pathname;

  if (path === '/login') {
    return role ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next();
  }
  if (!role) return NextResponse.redirect(new URL('/login', request.url));
  if ((path.startsWith('/inventory') || path.startsWith('/reports')) && role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const response = NextResponse.next();
  response.headers.set('x-user-role', role);
  return response;
}

export const config = {
  matcher: ['/((?!api/login|api/logout|_next/static|_next/image|favicon.ico).*)']
};
