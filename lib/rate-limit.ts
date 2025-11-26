import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Rate Limiter using in-memory store
 * Production: Nên dùng Redis hoặc database
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

export interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  max: number;       // Max requests per window
  message?: string;
  keyGenerator?: (req: NextApiRequest) => string;
}

/**
 * Clean up expired entries (chạy mỗi 5 phút)
 */
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 5 * 60 * 1000);

/**
 * Rate limit middleware
 */
export const rateLimit = (config: RateLimitConfig) => {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later',
    keyGenerator = (req) => {
      // Default: Use IP address hoặc user ID
      return req.headers['x-forwarded-for'] as string || 
             req.headers['x-real-ip'] as string ||
             req.socket.remoteAddress ||
             'unknown';
    }
  } = config;

  return async (
    req: NextApiRequest,
    res: NextApiResponse,
    next: () => void | Promise<void>
  ) => {
    const key = keyGenerator(req);
    const now = Date.now();

    // Initialize hoặc reset nếu window hết hạn
    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 0,
        resetTime: now + windowMs
      };
    }

    // Increment counter
    store[key].count++;

    // Check if exceeded
    if (store[key].count > max) {
      const retryAfter = Math.ceil((store[key].resetTime - now) / 1000);
      
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', store[key].resetTime.toString());
      res.setHeader('Retry-After', retryAfter.toString());
      
      return res.status(429).json({ 
        error: message,
        retryAfter 
      });
    }

    // Set rate limit headers
    const remaining = max - store[key].count;
    res.setHeader('X-RateLimit-Limit', max.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', store[key].resetTime.toString());

    // Continue to next middleware/handler
    return next();
  };
};

/**
 * Helper: Wrap handler với rate limiting
 */
export const withRateLimit = (
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  config: RateLimitConfig
) => {
  const limiter = rateLimit(config);

  return async (req: NextApiRequest, res: NextApiResponse) => {
    return limiter(req, res, () => handler(req, res));
  };
};

/**
 * Preset configs cho các use cases khác nhau
 */
export const rateLimitPresets = {
  // Upload files: 10 uploads per minute
  upload: {
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many uploads, please try again later'
  },

  // API calls: 100 requests per minute
  api: {
    windowMs: 60 * 1000,
    max: 100,
    message: 'API rate limit exceeded'
  },

  // Authentication: 5 attempts per 15 minutes
  auth: {
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many authentication attempts'
  },

  // Heavy operations: 3 per 5 minutes
  heavy: {
    windowMs: 5 * 60 * 1000,
    max: 3,
    message: 'Rate limit exceeded for heavy operations'
  },

  // Messages: 60 per minute
  message: {
    windowMs: 60 * 1000,
    max: 60,
    message: 'Too many messages sent'
  }
};
