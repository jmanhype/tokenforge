/**
 * Centralized error handling utilities for TokenForge
 * Provides type-safe error handling and consistent error messages
 */

export class TokenForgeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TokenForgeError';
  }
}

export class WalletConnectionError extends TokenForgeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'WALLET_CONNECTION_ERROR', details);
    this.name = 'WalletConnectionError';
  }
}

export class TransactionError extends TokenForgeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TRANSACTION_ERROR', details);
    this.name = 'TransactionError';
  }
}

export class ValidationError extends TokenForgeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class DeploymentError extends TokenForgeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'DEPLOYMENT_ERROR', details);
    this.name = 'DeploymentError';
  }
}

/**
 * Type guard to check if error is a TokenForgeError
 */
export function isTokenForgeError(error: unknown): error is TokenForgeError {
  return error instanceof TokenForgeError;
}

/**
 * Safely extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

/**
 * Extract error code from various error types
 */
export function getErrorCode(error: unknown): string | undefined {
  if (isTokenForgeError(error)) {
    return error.code;
  }
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string' || typeof code === 'number') {
      return String(code);
    }
  }
  return undefined;
}

/**
 * Format error for logging with structured data
 */
export function formatErrorForLogging(error: unknown): Record<string, unknown> {
  const baseLog: Record<string, unknown> = {
    message: getErrorMessage(error),
    timestamp: new Date().toISOString(),
  };

  if (error instanceof Error) {
    baseLog.name = error.name;
    baseLog.stack = error.stack;
  }

  if (isTokenForgeError(error)) {
    baseLog.code = error.code;
    baseLog.details = error.details;
  }

  return baseLog;
}

/**
 * Handle async errors with proper typing
 */
export async function handleAsyncError<T>(
  fn: () => Promise<T>,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    console.error('Async operation failed:', formatErrorForLogging(error));
    return fallback;
  }
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
