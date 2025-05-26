// Input validation and sanitization
export const sanitizeInput = (input: string): string => {
  // Remove HTML tags and potential XSS vectors
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags and content
    .replace(/<[^>]*>/g, '') // Remove all other HTML tags
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/--/g, ' ') // Remove SQL comment syntax
    .replace(/'/g, '') // Remove single quotes
    .replace(/=/g, '') // Remove equals signs
    .trim();
};

// Token validation
export const validateTokenName = (name: string): boolean => {
  if (name.length < 2 || name.length > 50) return false;
  // Allow letters, numbers, spaces, and common symbols
  return /^[a-zA-Z0-9\s\-_.]+$/.test(name);
};

export const validateTokenSymbol = (symbol: string): boolean => {
  if (symbol.length < 2 || symbol.length > 10) return false;
  // Only allow uppercase letters and numbers
  return /^[A-Z0-9]+$/.test(symbol.toUpperCase());
};

export const validateSupply = (supply: number): boolean => {
  return supply > 0 && supply <= 1e15 && Number.isInteger(supply);
};

export const validateDescription = (description: string): boolean => {
  return description.length <= 500;
};

// Address validation
export const isValidAddress = (address: string, blockchain: 'ethereum' | 'solana' | 'bsc'): boolean => {
  if (blockchain === 'ethereum' || blockchain === 'bsc') {
    // Ethereum/BSC address format: 0x followed by 40 hex characters
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  } else if (blockchain === 'solana') {
    // Solana address format: base58 encoded, 32-44 characters
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }
  return false;
};

// Transaction hash validation
export const isValidTransactionHash = (hash: string, blockchain: 'ethereum' | 'solana' | 'bsc'): boolean => {
  if (blockchain === 'ethereum' || blockchain === 'bsc') {
    // Ethereum/BSC tx hash: 0x followed by 64 hex characters or just 64 hex characters
    return /^(0x)?[a-fA-F0-9]{64}$/.test(hash);
  } else if (blockchain === 'solana') {
    // Solana tx signature: base58 encoded, typically 87-88 characters
    return /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(hash);
  }
  return false;
};

// Security headers for API responses
export const getSecurityHeaders = () => ({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
});

// Rate limiting helper (client-side)
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  
  constructor(
    private maxAttempts: number,
    private windowMs: number
  ) {}
  
  isAllowed(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Remove old attempts outside the window
    const validAttempts = attempts.filter(time => now - time < this.windowMs);
    
    if (validAttempts.length >= this.maxAttempts) {
      return false;
    }
    
    validAttempts.push(now);
    this.attempts.set(key, validAttempts);
    return true;
  }
  
  reset(key: string): void {
    this.attempts.delete(key);
  }
}