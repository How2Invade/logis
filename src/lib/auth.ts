/**
 * Demo authentication helpers (client-side only).
 * LOGIS uses a lightweight demo session: a `logis_role` cookie (read by src/proxy.ts)
 * mirrored into localStorage as `logis-auth`.
 */

export const AUTH_COOKIE = 'logis_role';
export const AUTH_STORAGE_KEY = 'logis-auth';

export type DemoRole = 'operations_manager' | 'quality_inspector';

export function signIn(role: DemoRole) {
  document.cookie = `${AUTH_COOKIE}=${role}; path=/; max-age=86400; samesite=lax`;
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ role, signedInAt: new Date().toISOString() }));
  } catch {}
}

export function isAuthenticated(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some(c => c.trim().startsWith(`${AUTH_COOKIE}=`) && c.trim().length > AUTH_COOKIE.length + 1);
}

export function signOut() {
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; samesite=lax`;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.clear();
  } catch {}
  // replace() so the protected page is not left in history; land on the LOGIS landing page.
  window.location.replace('/');
}
