/**
 * Validation utilities for input validation and sanitization
 */

// Remove HTML tags and potential XSS vectors
export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove potential SQL injection characters
    .replace(/['";]/g, '')
    // Remove script tags specifically
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    // Trim whitespace
    .trim();
}

// Validate token name
export function validateTokenName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 50) return false;
  
  // Allow letters, numbers, spaces, hyphens
  const validPattern = /^[a-zA-Z0-9\s\-]+$/;
  
  // Check for XSS/injection attempts
  if (name !== sanitizeInput(name)) return false;
  
  return validPattern.test(name);
}

// Validate token symbol
export function validateTokenSymbol(symbol: string): boolean {
  if (!symbol || symbol.length < 3 || symbol.length > 6) return false;
  
  // Must be uppercase letters only
  const validPattern = /^[A-Z]+$/;
  
  return validPattern.test(symbol);
}

// Validate token supply
export function validateSupply(supply: number): boolean {
  if (!supply || supply <= 0) return false;
  if (supply > 1e18) return false; // Max 1 quintillion
  if (!Number.isInteger(supply)) return false;
  if (!Number.isFinite(supply)) return false;
  
  return true;
}

// Validate description
export function validateDescription(description: string): boolean {
  if (!description) return true; // Optional field
  if (description.length > 500) return false;
  
  // Check for XSS/injection attempts
  if (description !== sanitizeInput(description)) return false;
  
  return true;
}

// Validate blockchain address
export function isValidAddress(address: string, blockchain: string): boolean {
  if (!address) return false;
  
  switch (blockchain) {
    case 'ethereum':
    case 'bsc':
      // Ethereum/BSC address validation
      return /^0x[a-fA-F0-9]{40}$/.test(address);
      
    case 'solana':
      // Solana address validation (base58)
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      
    default:
      return false;
  }
}

// Validate transaction hash
export function isValidTransactionHash(hash: string, blockchain: string): boolean {
  if (!hash) return false;
  
  switch (blockchain) {
    case 'ethereum':
    case 'bsc':
      // Ethereum/BSC tx hash (66 chars including 0x)
      return /^0x[a-fA-F0-9]{64}$/.test(hash);
      
    case 'solana':
      // Solana signature (88 chars base58)
      return /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(hash);
      
    default:
      return false;
  }
}