import { describe, it, expect } from 'vitest'
import { 
  sanitizeInput, 
  validateTokenName, 
  validateTokenSymbol, 
  validateSupply,
  validateDescription,
  isValidAddress,
  isValidTransactionHash
} from '../validation'

describe('Security Utils', () => {
  describe('sanitizeInput', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeInput('<script>alert("xss")</script>Hello')).toBe('Hello')
      expect(sanitizeInput('Hello <b>world</b>')).toBe('Hello world')
    })

    it('should remove SQL injection attempts', () => {
      expect(sanitizeInput("'; DROP TABLE users; --")).toBe(' DROP TABLE users ')
      expect(sanitizeInput('1 OR 1=1')).toBe('1 OR 11')
    })

    it('should handle normal input', () => {
      expect(sanitizeInput('Hello World 123')).toBe('Hello World 123')
      expect(sanitizeInput('Test_Token-2024')).toBe('Test_Token-2024')
    })

    it('should trim whitespace', () => {
      expect(sanitizeInput('  Hello  ')).toBe('Hello')
      expect(sanitizeInput('\n\tTest\n\t')).toBe('Test')
    })
  })

  describe('validateTokenName', () => {
    it('should accept valid token names', () => {
      expect(validateTokenName('Bitcoin')).toBe(true)
      expect(validateTokenName('Ethereum Classic')).toBe(true)
      expect(validateTokenName('DOGE-2024')).toBe(true)
    })

    it('should reject invalid token names', () => {
      expect(validateTokenName('')).toBe(false)
      expect(validateTokenName('A')).toBe(false) // Too short
      expect(validateTokenName('A'.repeat(51))).toBe(false) // Too long
      expect(validateTokenName('<script>alert</script>')).toBe(false)
      expect(validateTokenName('Token!@#$')).toBe(false)
    })
  })

  describe('validateTokenSymbol', () => {
    it('should accept valid symbols', () => {
      expect(validateTokenSymbol('BTC')).toBe(true)
      expect(validateTokenSymbol('ETH')).toBe(true)
      expect(validateTokenSymbol('DOGE')).toBe(true)
      expect(validateTokenSymbol('USDT')).toBe(true)
    })

    it('should reject invalid symbols', () => {
      expect(validateTokenSymbol('')).toBe(false)
      expect(validateTokenSymbol('BT')).toBe(false) // Too short
      expect(validateTokenSymbol('TOOLONG')).toBe(false) // Too long
      expect(validateTokenSymbol('btc')).toBe(false) // Lowercase
      expect(validateTokenSymbol('BTC!')).toBe(false) // Special chars
      expect(validateTokenSymbol('123')).toBe(false) // Numbers only
    })
  })

  describe('validateSupply', () => {
    it('should accept valid supplies', () => {
      expect(validateSupply(1000000)).toBe(true)
      expect(validateSupply(1e9)).toBe(true)
      expect(validateSupply(1)).toBe(true)
      expect(validateSupply(1e18)).toBe(true)
    })

    it('should reject invalid supplies', () => {
      expect(validateSupply(0)).toBe(false)
      expect(validateSupply(-1000)).toBe(false)
      expect(validateSupply(1e19)).toBe(false) // Too large
      expect(validateSupply(0.5)).toBe(false) // Decimals
      expect(validateSupply(NaN)).toBe(false)
      expect(validateSupply(Infinity)).toBe(false)
    })
  })

  describe('validateDescription', () => {
    it('should accept valid descriptions', () => {
      expect(validateDescription('A great meme coin')).toBe(true)
      expect(validateDescription('')).toBe(true) // Optional
      expect(validateDescription('To the moon! 🚀')).toBe(true)
    })

    it('should reject invalid descriptions', () => {
      expect(validateDescription('A'.repeat(501))).toBe(false) // Too long
      expect(validateDescription('<script>hack</script>')).toBe(false)
      expect(validateDescription("'; DROP TABLE; --")).toBe(false)
    })
  })

  describe('isValidAddress', () => {
    it('should validate Ethereum addresses', () => {
      expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f6A8e7', 'ethereum')).toBe(true)
      expect(isValidAddress('0x0000000000000000000000000000000000000000', 'ethereum')).toBe(true)
    })

    it('should validate BSC addresses (same as Ethereum)', () => {
      expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f6A8e7', 'bsc')).toBe(true)
    })

    it('should validate Solana addresses', () => {
      expect(isValidAddress('11111111111111111111111111111111', 'solana')).toBe(true)
      expect(isValidAddress('So11111111111111111111111111111111111111112', 'solana')).toBe(true)
    })

    it('should reject invalid addresses', () => {
      expect(isValidAddress('', 'ethereum')).toBe(false)
      expect(isValidAddress('0x123', 'ethereum')).toBe(false) // Too short
      expect(isValidAddress('not-an-address', 'ethereum')).toBe(false)
      expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f6A8e7', 'invalid' as any)).toBe(false)
    })
  })

  describe('isValidTransactionHash', () => {
    it('should validate transaction hashes', () => {
      expect(isValidTransactionHash('0x' + 'a'.repeat(64), 'ethereum')).toBe(true)
      expect(isValidTransactionHash('0x' + '1234567890abcdef'.repeat(4), 'bsc')).toBe(true)
      expect(isValidTransactionHash('1234567890ABCDEFabcdef'.repeat(4), 'solana')).toBe(true)
    })

    it('should reject invalid transaction hashes', () => {
      expect(isValidTransactionHash('', 'ethereum')).toBe(false)
      expect(isValidTransactionHash('0x123', 'ethereum')).toBe(false) // Too short
      expect(isValidTransactionHash('not-a-hash', 'ethereum')).toBe(false)
      expect(isValidTransactionHash('0x' + 'g'.repeat(64), 'ethereum')).toBe(false) // Invalid hex
    })
  })
})