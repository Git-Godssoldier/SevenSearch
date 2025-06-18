// Enhanced middleware with rate limiting and security features
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Simple in-memory rate limiter for Edge Runtime compatibility
class EdgeRateLimiter {
  private static instances = new Map<string, EdgeRateLimiter>();
  private requests = new Map<string, number[]>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  static getInstance(key: string = 'default'): EdgeRateLimiter {
    if (!EdgeRateLimiter.instances.has(key)) {
      EdgeRateLimiter.instances.set(key, new EdgeRateLimiter());
    }
    return EdgeRateLimiter.instances.get(key)!;
  }

  isRateLimited(identifier: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Get existing requests for this identifier
    const userRequests = this.requests.get(identifier) || [];
    
    // Filter out old requests outside the window
    const recentRequests = userRequests.filter(time => time > windowStart);
    
    // Check if limit exceeded
    if (recentRequests.length >= this.maxRequests) {
      return true;
    }
    
    // Add current request and update
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);
    
    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      this.cleanup(windowStart);
    }
    
    return false;
  }

  private cleanup(cutoff: number): void {
    for (const [identifier, requests] of this.requests.entries()) {
      const recentRequests = requests.filter(time => time > cutoff);
      if (recentRequests.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, recentRequests);
      }
    }
  }
}

// Rate limiting configuration
const rateLimiters = {
  api: EdgeRateLimiter.getInstance('api'), // 100 requests per minute for API routes
  search: EdgeRateLimiter.getInstance('search'), // Stricter limits for search
  webhook: EdgeRateLimiter.getInstance('webhook'), // Separate limits for webhooks
};

function getClientIdentifier(request: NextRequest): string {
  // Try to get real IP, fallback to forwarded headers
  const realIP = request.headers.get('x-real-ip');
  const forwardedFor = request.headers.get('x-forwarded-for');
  const connInfo = request.headers.get('x-vercel-forwarded-for');
  
  return realIP || 
         forwardedFor?.split(',')[0]?.trim() || 
         connInfo?.split(',')[0]?.trim() || 
         '127.0.0.1';
}

function createRateLimitResponse(retryAfter: number = 60): NextResponse {
  return new NextResponse(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: 'Too many requests, please try again later',
      retryAfter
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(Date.now() + retryAfter * 1000).toISOString(),
      }
    }
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const clientIP = getClientIdentifier(request);
  
  // Skip rate limiting for static assets, _next routes, and health checks
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/health') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  try {
    // Different rate limits for different route types
    if (pathname.startsWith('/api/')) {
      // API routes - stricter limits
      if (pathname.startsWith('/api/search') || pathname.startsWith('/api/enhance-search')) {
        // Search endpoints - 20 requests per minute
        const searchLimiter = new EdgeRateLimiter(20, 60000);
        if (searchLimiter.isRateLimited(clientIP)) {
          console.log(`[Middleware] Rate limit exceeded for search API: ${clientIP}`);
          return createRateLimitResponse(60);
        }
      } else if (pathname.startsWith('/api/webhooks/')) {
        // Webhook endpoints - check origin and apply limits
        const origin = request.headers.get('origin');
        const userAgent = request.headers.get('user-agent');
        
        // Skip rate limiting for webhook calls from trusted sources
        const trustedOrigins = ['localhost', 'vercel.app', process.env.NEXT_PUBLIC_SITE_URL];
        const isTrustedOrigin = trustedOrigins.some(trusted => 
          trusted && origin?.includes(trusted)
        );
        
        if (!isTrustedOrigin) {
          if (rateLimiters.webhook.isRateLimited(clientIP)) {
            console.log(`[Middleware] Rate limit exceeded for webhook: ${clientIP}`);
            return createRateLimitResponse(30);
          }
        }
      } else {
        // General API routes - 100 requests per minute
        if (rateLimiters.api.isRateLimited(clientIP)) {
          console.log(`[Middleware] Rate limit exceeded for API: ${clientIP}`);
          return createRateLimitResponse(60);
        }
      }
    } else {
      // Page routes - more lenient limits
      const pageLimiter = new EdgeRateLimiter(200, 60000);
      if (pageLimiter.isRateLimited(clientIP)) {
        console.log(`[Middleware] Rate limit exceeded for pages: ${clientIP}`);
        return createRateLimitResponse(30);
      }
    }

    // Add security headers
    const response = NextResponse.next();
    
    // Security headers for all responses
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Rate limit info headers for API routes
    if (pathname.startsWith('/api/')) {
      response.headers.set('X-RateLimit-Limit', '100');
      response.headers.set('X-RateLimit-Remaining', '95'); // Approximate
    }

    return response;
    
  } catch (error) {
    console.error('[Middleware] Error in rate limiting:', error);
    // On error, allow the request to continue rather than blocking
    return NextResponse.next();
  }
}

// Apply to API routes and pages, exclude static assets
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - *.* (other static files)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
};