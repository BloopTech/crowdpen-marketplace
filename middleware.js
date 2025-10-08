import { NextResponse } from 'next/server';
import { isAuthenticatedInMiddleware } from './app/utils/middlewareSessionUtils';

// Protected routes that require authentication
const protectedRoutes = [
  '/cart',
  '/wishlist', 
  '/account',
  '/checkout',
  '/product/create'
];

// Dynamic route patterns that require authentication
const protectedPatterns = [
  /^\/product\/edit\/[^/]+$/  // /product/edit/:id
];

// Routes that should redirect authenticated users (like login pages)
const authRoutes = [];

/**
 * Check if a pathname matches any protected route or pattern
 */
function isProtectedRoute(pathname) {
  // Check exact matches
  if (protectedRoutes.includes(pathname)) {
    return true;
  }
  
  // Check pattern matches
  return protectedPatterns.some(pattern => pattern.test(pathname));
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  // Generate a per-request CSP nonce
  const nonce = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

  const isDev = process.env.NODE_ENV === 'development';
  const buildCSP = (n) => [
    "default-src 'self'",
    "base-uri 'self'",
    "font-src 'self' https: data:",
    "img-src 'self' data: blob: https:",
    "object-src 'none'",
    // In dev, allow inline/eval to support HMR; in prod, only nonce and trusted hosts
    `script-src 'self' 'nonce-${n}' https://www.googletagmanager.com https://www.google-analytics.com ${isDev ? "'unsafe-inline' 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https: wss: ws:",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join('; ');

  // Forward nonce to the app via request headers so server components can access it
  const reqHeaders = new Headers(request.headers);
  reqHeaders.set('x-csp-nonce', nonce);
  reqHeaders.set('x-nonce', nonce);
  
  const isDashboardRoute = isProtectedRoute(pathname);
  const isAdminRoute = pathname.startsWith('/admin');
  const isAuthRoute = authRoutes.includes(pathname);
  
  try {
    // Check authentication using session cookies
    const { isAuthenticated, user } = await isAuthenticatedInMiddleware(request);
    
    // Redirect unauthenticated users from protected routes
    if (!isAuthenticated && (isDashboardRoute || isAdminRoute)) {
      const loginUrl = new URL('/', request.url);
      // Add redirect parameter to return user to original page after login
      loginUrl.searchParams.set('redirect', pathname);
      const redirectRes = NextResponse.redirect(loginUrl);
      redirectRes.headers.set('Content-Security-Policy', buildCSP(nonce));
      return redirectRes;
    }

    // Restrict admin routes to authorized roles
    if (
      isAdminRoute &&
      !(
        user?.crowdpen_staff === true ||
        user?.role === 'admin' ||
        user?.role === 'senior_admin'
      )
    ) {
      const unauthorizedRes = NextResponse.redirect(new URL('/', request.url));
      unauthorizedRes.headers.set('Content-Security-Policy', buildCSP(nonce));
      return unauthorizedRes;
    }
    
    // Redirect authenticated users from auth-only routes (like login pages)
    if (isAuthenticated && isAuthRoute) {
      const referer = request.headers.get('referer');
      let redirectUrl = '/';
      
      if (referer) {
        try {
          const refererUrl = new URL(referer);
          const refererPath = refererUrl.pathname;
          
          if (refererPath.startsWith('/') && !authRoutes.includes(refererPath)) {
            redirectUrl = refererPath;
          }
        } catch (error) {
          console.error('Error parsing referer URL:', error);
        }
      }
      
      const authRedirectRes = NextResponse.redirect(new URL(redirectUrl, request.url));
      authRedirectRes.headers.set('Content-Security-Policy', buildCSP(nonce));
      return authRedirectRes;
    }
    
    const res = NextResponse.next({ request: { headers: reqHeaders } });
    res.headers.set('Content-Security-Policy', buildCSP(nonce));
    return res;
  } catch (error) {
    console.error('Middleware error:', error);
    // On error, allow the request to proceed to avoid breaking the app
    const res = NextResponse.next({ request: { headers: reqHeaders } });
    res.headers.set('Content-Security-Policy', buildCSP(nonce));
    return res;
  }
}

export const config = {
  matcher: [
    // Static protected routes
    '/cart',
    '/wishlist',
    '/account', 
    '/checkout',
    '/product/create',
    // Dynamic protected routes
    '/product/edit/:path*',
    // Catch other potential protected routes
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
