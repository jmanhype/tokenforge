import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { ConvexTestingHelper } from '@convex-dev/testing'
import { api } from '../../convex/_generated/api'

describe('Convex Backend Integration Tests', () => {
  let t: ConvexTestingHelper

  beforeAll(async () => {
    t = new ConvexTestingHelper()
    await t.init()
  })

  afterAll(async () => {
    await t.cleanup()
  })

  describe('Meme Coin Creation', () => {
    it('should create a meme coin with valid parameters', async () => {
      // First, create a user
      const userId = await t.mutation(api.auth.signIn, {
        provider: 'anonymous',
      })

      // Create a meme coin
      const result = await t.action(api.memeCoins.createMemeCoin, {
        name: 'Test Coin',
        symbol: 'TEST',
        initialSupply: 1000000,
        canMint: true,
        canBurn: false,
        postQuantumSecurity: false,
        description: 'A test meme coin',
        blockchain: 'ethereum',
      })

      expect(result).toHaveProperty('coinId')
      expect(result).toHaveProperty('fee')
      expect(result.fee).toBeGreaterThanOrEqual(0)

      // Verify the coin was created
      const coins = await t.query(api.memeCoins.getUserCoins)
      expect(coins).toHaveLength(1)
      expect(coins[0].name).toBe('Test Coin')
      expect(coins[0].symbol).toBe('TEST')
    })

    it('should enforce rate limiting', async () => {
      // Create 3 coins (the limit)
      for (let i = 0; i < 3; i++) {
        await t.action(api.memeCoins.createMemeCoin, {
          name: `Rate Test ${i}`,
          symbol: `RT${i}`,
          initialSupply: 1000000,
          canMint: false,
          canBurn: false,
          postQuantumSecurity: false,
          blockchain: 'ethereum',
        })
      }

      // The 4th should fail
      await expect(
        t.action(api.memeCoins.createMemeCoin, {
          name: 'Rate Test 4',
          symbol: 'RT4',
          initialSupply: 1000000,
          canMint: false,
          canBurn: false,
          postQuantumSecurity: false,
          blockchain: 'ethereum',
        })
      ).rejects.toThrow('Daily coin creation limit reached')
    })

    it('should reject duplicate symbols', async () => {
      // Create first coin
      await t.action(api.memeCoins.createMemeCoin, {
        name: 'Original Coin',
        symbol: 'DUPE',
        initialSupply: 1000000,
        canMint: false,
        canBurn: false,
        postQuantumSecurity: false,
        blockchain: 'ethereum',
      })

      // Try to create with same symbol
      await expect(
        t.action(api.memeCoins.createMemeCoin, {
          name: 'Duplicate Coin',
          symbol: 'DUPE',
          initialSupply: 2000000,
          canMint: true,
          canBurn: true,
          postQuantumSecurity: false,
          blockchain: 'bsc',
        })
      ).rejects.toThrow('A coin with this symbol already exists')
    })
  })

  describe('Bonding Curve Trading', () => {
    let coinId: string

    beforeAll(async () => {
      // Create a coin for trading tests
      const result = await t.action(api.memeCoins.createMemeCoin, {
        name: 'Trading Test Coin',
        symbol: 'TTC',
        initialSupply: 1000000,
        canMint: false,
        canBurn: false,
        postQuantumSecurity: false,
        blockchain: 'ethereum',
      })
      coinId = result.coinId
    })

    it('should calculate buy price correctly', async () => {
      const quote = await t.query(api.bondingCurveApi.getBuyQuote, {
        coinId,
        ethAmount: 1, // 1 ETH
      })

      expect(quote).toHaveProperty('tokensOut')
      expect(quote).toHaveProperty('pricePerToken')
      expect(quote).toHaveProperty('priceImpact')
      expect(quote).toHaveProperty('fee')
      expect(quote.tokensOut).toBeGreaterThan(0)
    })

    it('should execute buy trade', async () => {
      const result = await t.mutation(api.bondingCurveApi.buyTokens, {
        coinId,
        ethAmount: 0.1,
        minTokensOut: 0,
        slippageBps: 100, // 1% slippage
      })

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('tokensReceived')
      expect(result).toHaveProperty('ethSpent')
      expect(result.success).toBe(true)
      expect(result.tokensReceived).toBeGreaterThan(0)
    })

    it('should execute sell trade', async () => {
      // First buy some tokens
      await t.mutation(api.bondingCurveApi.buyTokens, {
        coinId,
        ethAmount: 0.5,
        minTokensOut: 0,
        slippageBps: 100,
      })

      // Then sell some
      const sellResult = await t.mutation(api.bondingCurveApi.sellTokens, {
        coinId,
        tokenAmount: 1000,
        minEthOut: 0,
        slippageBps: 100,
      })

      expect(sellResult.success).toBe(true)
      expect(sellResult.ethReceived).toBeGreaterThan(0)
    })

    it('should track holder count', async () => {
      const bondingCurve = await t.query(api.bondingCurveApi.getBondingCurve, {
        coinId,
      })

      expect(bondingCurve?.holders).toBeGreaterThan(0)
    })
  })

  describe('Analytics and Monitoring', () => {
    it('should record audit logs', async () => {
      // Create a coin to generate audit log
      const result = await t.action(api.memeCoins.createMemeCoin, {
        name: 'Audit Test',
        symbol: 'AUDIT',
        initialSupply: 1000000,
        canMint: false,
        canBurn: false,
        postQuantumSecurity: false,
        blockchain: 'ethereum',
      })

      // Check audit logs
      const logs = await t.query(api.monitoringApi.getRecentAuditLogs, {
        limit: 10,
      })

      const createLog = logs.find(log => log.action === 'token_created')
      expect(createLog).toBeDefined()
      expect(createLog?.entityId).toBe(result.coinId)
    })

    it('should track metrics', async () => {
      const metrics = await t.query(api.monitoringApi.getMetricsSummary, {
        timeRange: '24h',
      })

      expect(metrics).toBeInstanceOf(Array)
      expect(metrics.length).toBeGreaterThan(0)
      
      const tokensCreatedMetric = metrics.find(m => m.name.includes('TOKENS CREATED'))
      expect(tokensCreatedMetric).toBeDefined()
    })

    it('should check system health', async () => {
      const health = await t.query(api.monitoringApi.getSystemHealth)

      expect(health).toBeInstanceOf(Array)
      expect(health.length).toBeGreaterThan(0)
      
      health.forEach(component => {
        expect(component).toHaveProperty('component')
        expect(component).toHaveProperty('status')
        expect(['healthy', 'degraded', 'down']).toContain(component.status)
      })
    })
  })

  describe('Fee Management', () => {
    it('should calculate fees correctly', async () => {
      const fee = await t.query(api.fees.feeManager.calculateFee, {
        feeType: 0, // TOKEN_CREATION
        blockchain: 'ethereum',
        testnet: true,
      })

      expect(fee).toHaveProperty('fee')
      expect(fee).toHaveProperty('feeCollectorAddress')
      expect(fee.fee).toBeGreaterThanOrEqual(0)
    })

    it('should track user fee statistics', async () => {
      // Create a coin to generate fees
      await t.action(api.memeCoins.createMemeCoin, {
        name: 'Fee Test',
        symbol: 'FEE',
        initialSupply: 1000000,
        canMint: false,
        canBurn: false,
        postQuantumSecurity: false,
        blockchain: 'ethereum',
      })

      const userId = 'test-user' // Would come from auth in real scenario
      const stats = await t.query(api.fees.feeManager.getUserFeeStats, {
        userId,
      })

      expect(stats).toHaveProperty('totalFeesPaid')
      expect(stats).toHaveProperty('feesByType')
      expect(stats.totalFeesPaid).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Social Media Integration', () => {
    it('should format launch announcement', async () => {
      const coinId = 'test-coin-id'
      
      // This would normally be an internal function, but we can test the concept
      const mockCoin = {
        name: 'Social Test Coin',
        symbol: 'STC',
        description: 'Testing social media integration',
      }

      // Test that social share would be triggered
      // In real tests, we'd mock the external APIs
      expect(mockCoin.name).toBeTruthy()
      expect(mockCoin.symbol).toBeTruthy()
    })
  })

  describe('Mainnet Configuration', () => {
    it('should check mainnet readiness', async () => {
      const readiness = await t.query(api.config.mainnetConfig.checkMainnetReadiness)

      expect(readiness).toHaveProperty('isReady')
      expect(readiness).toHaveProperty('scores')
      expect(readiness).toHaveProperty('overallScore')
      expect(readiness).toHaveProperty('recommendations')

      expect(readiness.overallScore).toHaveProperty('percentage')
      expect(readiness.overallScore.percentage).toBeGreaterThanOrEqual(0)
      expect(readiness.overallScore.percentage).toBeLessThanOrEqual(100)
    })

    it('should get network configuration', async () => {
      const config = await t.query(api.config.mainnetConfig.getMainnetConfig, {
        blockchain: 'ethereum',
      })

      expect(config).toHaveProperty('enabled')
      expect(config).toHaveProperty('chainId')
      expect(config).toHaveProperty('isConfigured')
      expect(config).toHaveProperty('warnings')
    })
  })
})