import { v } from "convex/values";

// Rate limiting configuration
export const RATE_LIMIT_CONFIG = {
  COINGECKO: {
    requestsPerMinute: 30, // CoinGecko Pro tier
    minDelay: 2000, // 2 seconds minimum between requests
    maxRetries: 3,
    backoffMultiplier: 2
  },
  GECKOTERMINAL: {
    requestsPerMinute: 120, // GeckoTerminal is more lenient
    minDelay: 500, // 500ms minimum between requests
    maxRetries: 3,
    backoffMultiplier: 1.5
  },
  ETHERSCAN: {
    requestsPerSecond: 5,
    minDelay: 200, // 200ms minimum between requests
    maxRetries: 3,
    backoffMultiplier: 2
  },
  BSCSCAN: {
    requestsPerSecond: 5,
    minDelay: 200,
    maxRetries: 3,
    backoffMultiplier: 2
  },
  SOLSCAN: {
    requestsPerSecond: 10,
    minDelay: 100,
    maxRetries: 3,
    backoffMultiplier: 1.5
  }
};

// Rate limiter state
interface RateLimiterState {
  lastRequestTime: number;
  requestCount: number;
  windowStart: number;
  isBlocked: boolean;
  blockUntil: number;
}

// Generic rate limiter class
export class RateLimiter {
  private state: Map<string, RateLimiterState>;
  private config: typeof RATE_LIMIT_CONFIG[keyof typeof RATE_LIMIT_CONFIG];
  private name: string;

  constructor(name: string, config: typeof RATE_LIMIT_CONFIG[keyof typeof RATE_LIMIT_CONFIG]) {
    this.state = new Map();
    this.config = config;
    this.name = name;
  }

  // Check if request can be made
  async canMakeRequest(key: string = "default"): Promise<boolean> {
    const now = Date.now();
    const state = this.getState(key);

    // Check if blocked
    if (state.isBlocked && now < state.blockUntil) {
      return false;
    }

    // Reset block if time has passed
    if (state.isBlocked && now >= state.blockUntil) {
      state.isBlocked = false;
      state.blockUntil = 0;
    }

    // Check rate limits
    const windowDuration = 'requestsPerMinute' in this.config ? 60000 : 1000;
    const maxRequests = 'requestsPerMinute' in this.config 
      ? this.config.requestsPerMinute 
      : this.config.requestsPerSecond;

    // Reset window if needed
    if (now - state.windowStart > windowDuration) {
      state.windowStart = now;
      state.requestCount = 0;
    }

    // Check if within rate limit
    if (state.requestCount >= maxRequests) {
      return false;
    }

    // Check minimum delay
    if (now - state.lastRequestTime < this.config.minDelay) {
      return false;
    }

    return true;
  }

  // Wait until request can be made
  async waitForSlot(key: string = "default"): Promise<void> {
    while (!(await this.canMakeRequest(key))) {
      const state = this.getState(key);
      const now = Date.now();

      let waitTime = this.config.minDelay;

      // If blocked, wait until unblocked
      if (state.isBlocked && now < state.blockUntil) {
        waitTime = state.blockUntil - now;
      } else {
        // Otherwise, wait for minimum delay
        waitTime = Math.max(
          this.config.minDelay,
          state.lastRequestTime + this.config.minDelay - now
        );
      }

      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  // Record a request
  recordRequest(key: string = "default"): void {
    const state = this.getState(key);
    const now = Date.now();

    state.lastRequestTime = now;
    state.requestCount++;
    
    this.state.set(key, state);
  }

  // Record a rate limit error (429 response)
  recordRateLimitError(key: string = "default", retryAfter?: number): void {
    const state = this.getState(key);
    const now = Date.now();

    state.isBlocked = true;
    state.blockUntil = now + (retryAfter ? retryAfter * 1000 : 60000);
    
    this.state.set(key, state);
  }

  // Get or create state for a key
  private getState(key: string): RateLimiterState {
    if (!this.state.has(key)) {
      this.state.set(key, {
        lastRequestTime: 0,
        requestCount: 0,
        windowStart: Date.now(),
        isBlocked: false,
        blockUntil: 0
      });
    }
    return this.state.get(key)!;
  }

  // Get statistics
  getStats(key: string = "default"): {
    requestsInWindow: number;
    isBlocked: boolean;
    timeUntilNextRequest: number;
  } {
    const state = this.getState(key);
    const now = Date.now();

    return {
      requestsInWindow: state.requestCount,
      isBlocked: state.isBlocked && now < state.blockUntil,
      timeUntilNextRequest: Math.max(
        0,
        state.lastRequestTime + this.config.minDelay - now
      )
    };
  }

  // Reset rate limiter for a key
  reset(key: string = "default"): void {
    this.state.delete(key);
  }

  // Reset all rate limiters
  resetAll(): void {
    this.state.clear();
  }
}

// Create rate limiters for each service
export const rateLimiters = {
  coingecko: new RateLimiter("CoinGecko", RATE_LIMIT_CONFIG.COINGECKO),
  geckoterminal: new RateLimiter("GeckoTerminal", RATE_LIMIT_CONFIG.GECKOTERMINAL),
  etherscan: new RateLimiter("Etherscan", RATE_LIMIT_CONFIG.ETHERSCAN),
  bscscan: new RateLimiter("BSCScan", RATE_LIMIT_CONFIG.BSCSCAN),
  solscan: new RateLimiter("Solscan", RATE_LIMIT_CONFIG.SOLSCAN)
};

// Utility function for retrying with exponential backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    backoffMultiplier?: number;
    maxDelay?: number;
    onRetry?: (error: any, attempt: number) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    backoffMultiplier = 2,
    maxDelay = 30000,
    onRetry
  } = options;

  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }

      if (onRetry) {
        onRetry(error, attempt + 1);
      }

      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Rate-limited fetch wrapper
export async function rateLimitedFetch(
  service: keyof typeof rateLimiters,
  url: string,
  options?: RequestInit
): Promise<Response> {
  const rateLimiter = rateLimiters[service];
  
  // Wait for available slot
  await rateLimiter.waitForSlot();
  
  try {
    // Record the request
    rateLimiter.recordRequest();
    
    // Make the request with retry logic
    const response = await retryWithBackoff(
      async () => {
        const res = await fetch(url, options);
        
        // Handle rate limiting
        if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After');
          rateLimiter.recordRateLimitError(
            "default",
            retryAfter ? parseInt(retryAfter) : undefined
          );
          throw new Error(`Rate limited: ${res.statusText}`);
        }
        
        return res;
      },
      {
        maxRetries: RATE_LIMIT_CONFIG[service.toUpperCase() as keyof typeof RATE_LIMIT_CONFIG].maxRetries,
        backoffMultiplier: RATE_LIMIT_CONFIG[service.toUpperCase() as keyof typeof RATE_LIMIT_CONFIG].backoffMultiplier,
        onRetry: (error, attempt) => {
          console.log(`Retry attempt ${attempt} for ${service}: ${error.message}`);
        }
      }
    );
    
    return response;
  } catch (error) {
    console.error(`${service} fetch error:`, error);
    throw error;
  }
}

// Export utilities
export const rateLimitUtils = {
  rateLimiters,
  retryWithBackoff,
  rateLimitedFetch,
  RATE_LIMIT_CONFIG
};