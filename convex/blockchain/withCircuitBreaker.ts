import { internal } from "../_generated/api";

// Wrapper for external service calls with circuit breaker protection
export async function withCircuitBreaker<T>(
  ctx: any,
  service: string,
  operation: () => Promise<T>,
  fallback?: () => T | Promise<T>
): Promise<T> {
  // Check circuit breaker state
  const breaker = await ctx.runQuery(internal.circuitBreaker.shouldAllowRequest, {
    service,
  });

  if (!breaker.allowed) {
    console.warn(`[CircuitBreaker] Request blocked for ${service}, circuit is ${breaker.state}`);
    
    if (fallback) {
      console.log(`[CircuitBreaker] Using fallback for ${service}`);
      return await fallback();
    }
    
    throw new Error(
      `Service ${service} is temporarily unavailable. Circuit breaker is ${breaker.state}. ` +
      `Retry after ${breaker.retryAfter ? Math.ceil(breaker.retryAfter / 1000) + ' seconds' : 'some time'}.`
    );
  }

  try {
    // Execute the operation
    const result = await operation();
    
    // Record success
    await ctx.runMutation(internal.circuitBreaker.recordSuccess, { service });
    
    return result;
  } catch (error) {
    // Record failure
    await ctx.runMutation(internal.circuitBreaker.recordFailure, {
      service,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    
    // Re-throw the error
    throw error;
  }
}

// Example usage in ethereum deployment
export async function deployWithCircuitBreaker(ctx: any, deployFn: () => Promise<any>) {
  return withCircuitBreaker(
    ctx,
    "ethereum_rpc",
    deployFn,
    // Fallback function (optional)
    async () => {
      // Could return cached data, use alternative RPC, etc.
      throw new Error("No fallback available for Ethereum RPC");
    }
  );
}

// Batch operation with circuit breaker
export async function batchWithCircuitBreaker<T>(
  ctx: any,
  service: string,
  operations: Array<() => Promise<T>>,
  options?: {
    maxConcurrent?: number;
    stopOnFirstError?: boolean;
    fallback?: (index: number) => T | Promise<T>;
  }
): Promise<Array<{ success: boolean; result?: T; error?: string }>> {
  const maxConcurrent = options?.maxConcurrent || 3;
  const results: Array<{ success: boolean; result?: T; error?: string }> = [];
  
  // Process in batches
  for (let i = 0; i < operations.length; i += maxConcurrent) {
    const batch = operations.slice(i, i + maxConcurrent);
    
    const batchResults = await Promise.all(
      batch.map(async (operation, batchIndex) => {
        const actualIndex = i + batchIndex;
        
        try {
          const result = await withCircuitBreaker(
            ctx,
            service,
            operation,
            options?.fallback ? () => options.fallback!(actualIndex) : undefined
          );
          
          return { success: true, result };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          
          if (options?.stopOnFirstError) {
            throw error;
          }
          
          return { success: false, error: errorMessage };
        }
      })
    );
    
    results.push(...batchResults);
  }
  
  return results;
}

// Health check wrapper
export async function healthCheckWithBreaker(
  ctx: any,
  service: string,
  healthCheckFn: () => Promise<boolean>
): Promise<{ healthy: boolean; circuitState: string }> {
  const breaker = await ctx.runQuery(internal.circuitBreaker.getState, { service });
  
  if (breaker.state === "open") {
    return { healthy: false, circuitState: "open" };
  }
  
  try {
    const healthy = await withCircuitBreaker(ctx, service, healthCheckFn);
    return { healthy, circuitState: breaker.state };
  } catch {
    return { healthy: false, circuitState: breaker.state };
  }
}