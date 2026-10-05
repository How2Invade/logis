import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Demo route protection.
 * The landing page (/) sets the `logis_role` cookie when the user enters the demo.
 * Any request to /dashboard/* without that cookie is redirected to the landing page.
 */
export function proxy(request: NextRequest) {
  const role = request.cookies.get('logis_role')?.value;
  if (!role) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  const res = NextResponse.next();
  // Prevent protected pages from being restored from the browser cache after logout.
  res.headers.set('Cache-Control', 'no-store, must-revalidate');
  return res;
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*'],
};
