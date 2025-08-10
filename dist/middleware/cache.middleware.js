"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearDashboardCache = exports.cacheMiddleware = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
// Initialize cache with 10 minute default TTL
const cache = new node_cache_1.default({ stdTTL: 600, checkperiod: 60 });
const cacheMiddleware = (options) => {
    return (req, res, next) => {
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
        res.json = function (body) {
            // Only cache successful responses
            if (res.statusCode === 200 && body.success !== false) {
                cache.set(key, body, options.duration);
            }
            return originalJson(body);
        };
        next();
    };
};
exports.cacheMiddleware = cacheMiddleware;
// Clear cache utility function
const clearDashboardCache = (pattern) => {
    if (pattern) {
        const keys = cache.keys().filter(key => key.includes(pattern));
        cache.del(keys);
    }
    else {
        cache.flushAll();
    }
};
exports.clearDashboardCache = clearDashboardCache;
