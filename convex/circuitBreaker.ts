import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// Circuit breaker states
export type CircuitState = "closed" | "open" | "half_open";

// Circuit breaker configuration
export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes to close from half-open
  timeout: number; // Milliseconds to wait before half-open
  volumeThreshold: number; // Minimum requests before evaluating
}

// Default configurations for different services
export const DEFAULT_CONFIGS: Record<string, CircuitBreakerConfig> = {
  "ethereum_rpc": {
    name: "ethereum_rpc",
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 60000, // 1 minute
    volumeThreshold: 10,
  },
  "bsc_rpc": {
    name: "bsc_rpc",
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 60000,
    volumeThreshold: 10,
  },
  "solana_rpc": {
    name: "solana_rpc",
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 60000,
    volumeThreshold: 10,
  },
  "coingecko_api": {
    name: "coingecko_api",
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 30000, // 30 seconds
    volumeThreshold: 5,
  },
  "social_twitter": {
    name: "social_twitter",
    failureThreshold: 3,
    successThreshold: 1,
    timeout: 120000, // 2 minutes
    volumeThreshold: 3,
  },
};

// Get or create circuit breaker state
export const getState = internalQuery({
  args: {
    service: v.string(),
  },
  handler: async (ctx, args) => {
    const breaker = await ctx.db
      .query("circuitBreakers")
      .withIndex("by_service", (q) => q.eq("service", args.service))
      .first();

    if (!breaker) {
      // Create default state
      const config = DEFAULT_CONFIGS[args.service] || {
        name: args.service,
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 60000,
        volumeThreshold: 10,
      };

      return {
        service: args.service,
        state: "closed" as CircuitState,
        failures: 0,
        successes: 0,
        lastFailureTime: undefined as number | undefined,
        lastSuccessTime: undefined as number | undefined,
        nextAttemptTime: undefined as number | undefined,
        totalRequests: 0,
        config,
      };
    }

    return breaker;
  },
});

// Record success
export const recordSuccess = internalMutation({
  args: {
    service: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("circuitBreakers")
      .withIndex("by_service", (q) => q.eq("service", args.service))
      .first();

    const now = Date.now();

    if (!existing) {
      // Create new breaker in closed state
      await ctx.db.insert("circuitBreakers", {
        service: args.service,
        state: "closed",
        failures: 0,
        successes: 1,
        lastFailureTime: undefined as number | undefined,
        lastSuccessTime: now,
        nextAttemptTime: undefined as number | undefined,
        totalRequests: 1,
      });
      return;
    }

    // Update existing breaker
    const updates: any = {
      successes: existing.successes + 1,
      lastSuccessTime: now,
      totalRequests: existing.totalRequests + 1,
    };

    // Handle state transitions
    if (existing.state === "half_open") {
      const config = DEFAULT_CONFIGS[args.service];
      if (config && existing.successes + 1 >= config.successThreshold) {
        // Close the circuit
        updates.state = "closed";
        updates.failures = 0;
        updates.successes = 0;
        updates.nextAttemptTime = undefined as number | undefined;
      }
    }

    await ctx.db.patch(existing._id, updates);
  },
});

// Record failure
export const recordFailure = internalMutation({
  args: {
    service: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("circuitBreakers")
      .withIndex("by_service", (q) => q.eq("service", args.service))
      .first();

    const now = Date.now();
    const config = DEFAULT_CONFIGS[args.service];

    if (!existing) {
      // Create new breaker
      await ctx.db.insert("circuitBreakers", {
        service: args.service,
        state: "closed",
        failures: 1,
        successes: 0,
        lastFailureTime: now,
        lastSuccessTime: undefined as number | undefined,
        nextAttemptTime: undefined as number | undefined,
        totalRequests: 1,
      });
      return;
    }

    // Update existing breaker
    const updates: any = {
      failures: existing.failures + 1,
      lastFailureTime: now,
      totalRequests: existing.totalRequests + 1,
    };

    // Check if we should open the circuit
    if (existing.state === "closed" && config) {
      if (existing.totalRequests >= config.volumeThreshold &&
          existing.failures + 1 >= config.failureThreshold) {
        // Open the circuit
        updates.state = "open";
        updates.nextAttemptTime = now + config.timeout;
        updates.failures = 0;
        updates.successes = 0;

        // Log circuit opened
        console.error(`[CircuitBreaker] Circuit OPENED for ${args.service}: ${args.error}`);
      }
    } else if (existing.state === "half_open") {
      // Failed in half-open state, reopen
      updates.state = "open";
      updates.nextAttemptTime = now + (config?.timeout || 60000);
      updates.failures = 0;
      updates.successes = 0;

      console.error(`[CircuitBreaker] Circuit REOPENED for ${args.service}: ${args.error}`);
    }

    await ctx.db.patch(existing._id, updates);
  },
});

// Check if request should be allowed
export const shouldAllowRequest = internalQuery({
  args: {
    service: v.string(),
  },
  handler: async (ctx, args) => {
    const breaker = await ctx.db
      .query("circuitBreakers")
      .withIndex("by_service", (q) => q.eq("service", args.service))
      .first();

    if (!breaker) {
      // No breaker exists, allow request
      return { allowed: true, state: "closed" as CircuitState };
    }

    const now = Date.now();

    // Check state
    if (breaker.state === "closed") {
      return { allowed: true, state: "closed" as CircuitState };
    }

    if (breaker.state === "open") {
      // Check if we should transition to half-open
      if (breaker.nextAttemptTime && now >= breaker.nextAttemptTime) {
        // Transition to half-open
        await ctx.scheduler.runAfter(0, internal.circuitBreaker.transitionToHalfOpen as any, {
          service: args.service,
        });
        return { allowed: true, state: "half_open" as CircuitState };
      }
      
      // Still open, reject request
      return { 
        allowed: false, 
        state: "open" as CircuitState,
        retryAfter: breaker.nextAttemptTime ? breaker.nextAttemptTime - now : undefined,
      };
    }

    // Half-open state, allow limited requests
    return { allowed: true, state: "half_open" as CircuitState };
  },
});

// Transition to half-open state
export const transitionToHalfOpen = internalMutation({
  args: {
    service: v.string(),
  },
  handler: async (ctx, args) => {
    const breaker = await ctx.db
      .query("circuitBreakers")
      .withIndex("by_service", (q) => q.eq("service", args.service))
      .first();

    if (breaker && breaker.state === "open") {
      await ctx.db.patch(breaker._id, {
        state: "half_open",
        failures: 0,
        successes: 0,
      });

      console.log(`[CircuitBreaker] Circuit HALF-OPEN for ${args.service}`);
    }
  },
});

// Get circuit breaker metrics
export const getMetrics = internalQuery({
  handler: async (ctx) => {
    const breakers = await ctx.db.query("circuitBreakers").collect();
    
    const metrics = {
      total: breakers.length,
      byState: {
        closed: 0,
        open: 0,
        half_open: 0,
      },
      byService: {} as Record<string, any>,
    };

    for (const breaker of breakers) {
      metrics.byState[breaker.state]++;
      
      metrics.byService[breaker.service] = {
        state: breaker.state,
        failures: breaker.failures,
        successes: breaker.successes,
        totalRequests: breaker.totalRequests,
        lastFailure: breaker.lastFailureTime,
        lastSuccess: breaker.lastSuccessTime,
        successRate: breaker.totalRequests > 0 
          ? ((breaker.totalRequests - breaker.failures) / breaker.totalRequests * 100).toFixed(2)
          : 0,
      };
    }

    return metrics;
  },
});

// Reset circuit breaker (for manual intervention)
export const reset = internalMutation({
  args: {
    service: v.string(),
  },
  handler: async (ctx, args) => {
    const breaker = await ctx.db
      .query("circuitBreakers")
      .withIndex("by_service", (q) => q.eq("service", args.service))
      .first();

    if (breaker) {
      await ctx.db.patch(breaker._id, {
        state: "closed",
        failures: 0,
        successes: 0,
        nextAttemptTime: undefined as number | undefined,
      });

      console.log(`[CircuitBreaker] Circuit RESET for ${args.service}`);
    }
  },
});