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
  
  const isDashboardRoute = isProtectedRoute(pathname);
  const isAuthRoute = authRoutes.includes(pathname);
  
  try {
    // Check authentication using session cookies
    const isAuthenticated = await isAuthenticatedInMiddleware(request);
    
    // Redirect unauthenticated users from protected routes
    if (!isAuthenticated && isDashboardRoute) {
      const loginUrl = new URL('/', request.url);
      // Add redirect parameter to return user to original page after login
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
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
      
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
    
    return NextResponse.next();
  } catch (error) {
    console.error('Middleware error:', error);
    // On error, allow the request to proceed to avoid breaking the app
    return NextResponse.next();
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
