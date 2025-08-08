// src/middleware/cache.middleware.ts
import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';

// Initialize cache with 10 minute default TTL
const cache = new NodeCache({ stdTTL: 600, checkperiod: 60 });

interface CacheOptions {
  duration: number; // Cache duration in seconds
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
}

export const cacheMiddleware = (options: CacheOptions) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip cache if condition is provided and returns false
    if (options.condition && !options.condition(req)) {
      return next();
    }

    // Generate cache key
    const key = options.keyGenerator ? 
      options.keyGenerator(req) : 
      `${req.originalUrl}_${JSON.stringify(req.query)}_${JSON.stringify(req.userId)}`;

    // Try to get from cache
    const cachedResponse = cache.get(key);
    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache response
    res.json = function(body: any) {
      // Only cache successful responses
      if (res.statusCode === 200 && body.success !== false) {
        cache.set(key, body, options.duration);
      }
      return originalJson(body);
    };

    next();
  };
};

// Clear cache utility function
export const clearDashboardCache = (pattern?: string) => {
  if (pattern) {
    const keys = cache.keys().filter(key => key.includes(pattern));
    cache.del(keys);
  } else {
    cache.flushAll();
  }
};