/**
 * Client-side rate limiter for preventing API spam
 * MVP implementation: Simple in-memory tracking
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RequestEntry {
  timestamp: number;
  resolve: () => void;
}

/**
 * Client-side rate limiter class
 * Uses a sliding window approach to limit requests
 */
export class ClientRateLimiter {
  private requests: RequestEntry[] = [];
  private config: RateLimitConfig;
  private pendingQueue: Array<() => void> = [];

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Acquire permission to make a request
   * Returns a promise that resolves when the request can proceed
   */
  async acquire(): Promise<void> {
    const now = Date.now();

    // Remove old requests outside the window
    this.requests = this.requests.filter(
      (r) => now - r.timestamp < this.config.windowMs
    );

    // If at limit, queue the request
    if (this.requests.length >= this.config.maxRequests) {
      return new Promise<void>((resolve) => {
        this.pendingQueue.push(resolve);
      });
    }

    // Add current request
    const requestEntry: RequestEntry = {
      timestamp: now,
      resolve: () => {
        // This will be called when request completes
      },
    };

    this.requests.push(requestEntry);
  }

  /**
   * Release a request (call after request completes)
   */
  release(): void {
    // Remove the oldest request
    if (this.requests.length > 0) {
      this.requests.shift();
    }

    // Process next pending request if any
    if (this.pendingQueue.length > 0) {
      const nextResolve = this.pendingQueue.shift();
      if (nextResolve) {
        const now = Date.now();
        this.requests.push({
          timestamp: now,
          resolve: () => {},
        });
        nextResolve();
      }
    }
  }

  /**
   * Get current usage stats
   */
  getStats(): { current: number; max: number; queued: number } {
    return {
      current: this.requests.length,
      max: this.config.maxRequests,
      queued: this.pendingQueue.length,
    };
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requests = [];
    this.pendingQueue = [];
  }
}

// Default rate limiter: 10 requests per minute
export const chatRateLimiter = new ClientRateLimiter({
  maxRequests: 10,
  windowMs: 60000, // 1 minute
});
