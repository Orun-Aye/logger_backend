"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseIntegration = void 0;
class BaseIntegration {
    /**
     * Helper: make an HTTP request with timeout.
     */
    async fetchWithTimeout(url, options = {}) {
        const { timeout = 15000, ...fetchOptions } = options;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, {
                ...fetchOptions,
                signal: controller.signal,
            });
            return response;
        }
        finally {
            clearTimeout(id);
        }
    }
}
exports.BaseIntegration = BaseIntegration;
