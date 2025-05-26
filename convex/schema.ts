import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // Meme coins created by users
  memeCoins: defineTable({
    name: v.string(),
    symbol: v.string(),
    initialSupply: v.number(),
    canMint: v.boolean(),
    canBurn: v.boolean(),
    postQuantumSecurity: v.boolean(),
    creatorId: v.id("users"),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("deployed"), v.literal("failed"), v.literal("graduated")),
  })
    .index("by_creator", ["creatorId"])
    .index("by_status", ["status"]),

  // Smart contract deployments
  deployments: defineTable({
    coinId: v.id("memeCoins"),
    blockchain: v.union(v.literal("ethereum"), v.literal("solana"), v.literal("bsc")),
    contractAddress: v.string(),
    transactionHash: v.string(),
    deployedAt: v.number(),
    gasUsed: v.optional(v.number()),
    deploymentCost: v.optional(v.number()),
  })
    .index("by_coin", ["coinId"])
    .index("by_blockchain", ["blockchain"]),

  // Real-time analytics data
  analytics: defineTable({
    coinId: v.id("memeCoins"),
    price: v.number(),
    marketCap: v.number(),
    volume24h: v.number(),
    holders: v.number(),
    transactions24h: v.number(),
    priceChange24h: v.number(),
    timestamp: v.number(),
  })
    .index("by_coin", ["coinId"])
    .index("by_timestamp", ["timestamp"]),

  // Social media sharing logs
  socialShares: defineTable({
    coinId: v.id("memeCoins"),
    platform: v.union(v.literal("twitter"), v.literal("discord"), v.literal("telegram")),
    shareType: v.union(v.literal("launch"), v.literal("milestone"), v.literal("update")),
    message: v.string(),
    success: v.boolean(),
    response: v.optional(v.string()),
    sharedAt: v.number(),
  })
    .index("by_coin", ["coinId"])
    .index("by_platform", ["platform"]),

  // Rate limiting for coin creation
  rateLimits: defineTable({
    userId: v.id("users"),
    action: v.string(),
    count: v.number(),
    resetAt: v.number(),
  })
    .index("by_user_action", ["userId", "action"]),

  // Bonding curve state for each token
  bondingCurves: defineTable({
    coinId: v.id("memeCoins"),
    currentSupply: v.number(),
    currentPrice: v.number(),
    reserveBalance: v.number(),
    totalVolume: v.number(),
    totalTransactions: v.number(),
    holders: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
    graduatedAt: v.optional(v.number()),
    dexPoolAddress: v.optional(v.string()),
  })
    .index("by_coin", ["coinId"])
    .index("by_active", ["isActive"]),
  
  // Bonding curve transactions
  bondingCurveTransactions: defineTable({
    bondingCurveId: v.id("bondingCurves"),
    type: v.union(v.literal("buy"), v.literal("sell"), v.literal("launch"), v.literal("graduation")),
    user: v.string(),
    amountIn: v.optional(v.number()),
    tokensOut: v.optional(v.number()),
    tokensIn: v.optional(v.number()),
    amountOut: v.optional(v.number()),
    price: v.optional(v.number()),
    timestamp: v.number(),
    txHash: v.optional(v.string()),
  })
    .index("by_curve", ["bondingCurveId"])
    .index("by_user", ["user"])
    .index("by_timestamp", ["timestamp"]),
  
  // Bonding curve token holders
  bondingCurveHolders: defineTable({
    bondingCurveId: v.id("bondingCurves"),
    user: v.string(),
    balance: v.number(),
  })
    .index("by_curve", ["bondingCurveId"])
    .index("by_user", ["user"])
    .index("by_curve_user", ["bondingCurveId", "user"]),

  // Token trades history
  tokenTrades: defineTable({
    tokenId: v.id("memeCoins"),
    trader: v.id("users"),
    type: v.union(v.literal("buy"), v.literal("sell")),
    tokenAmount: v.number(),
    ethAmount: v.number(),
    price: v.number(),
    timestamp: v.number(),
    txHash: v.optional(v.string()),
  })
    .index("by_token", ["tokenId"])
    .index("by_trader", ["trader"])
    .index("by_timestamp", ["timestamp"]),

  // Job queue for async processing
  jobs: defineTable({
    type: v.union(
      v.literal("deploy_token"),
      v.literal("verify_contract"),
      v.literal("social_share"),
      v.literal("analytics_update"),
      v.literal("deploy_to_dex")
    ),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("retrying")
    ),
    payload: v.any(),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    attempts: v.number(),
    maxAttempts: v.number(),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    nextRetryAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_type", ["type"])
    .index("by_created", ["createdAt"]),

  // Cache for expensive operations
  cache: defineTable({
    key: v.string(),
    value: v.any(),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_expires", ["expiresAt"]),

  // Circuit breakers for external services
  circuitBreakers: defineTable({
    service: v.string(),
    state: v.union(v.literal("closed"), v.literal("open"), v.literal("half_open")),
    failures: v.number(),
    successes: v.number(),
    lastFailureTime: v.optional(v.number()),
    lastSuccessTime: v.optional(v.number()),
    nextAttemptTime: v.optional(v.number()),
    totalRequests: v.number(),
  })
    .index("by_service", ["service"]),

  // Secure key metadata (actual keys in external KMS)
  keyMetadata: defineTable({
    keyType: v.union(v.literal("deployer_private_key"), v.literal("api_key"), v.literal("signing_key")),
    keyId: v.string(), // External KMS key ID
    version: v.number(),
    checksum: v.string(),
    state: v.union(v.literal("active"), v.literal("rotating"), v.literal("retired"), v.literal("compromised")),
    createdAt: v.number(),
    expiresAt: v.number(),
    lastUsed: v.optional(v.number()),
    useCount: v.number(),
    retiredAt: v.optional(v.number()),
    rotatedFrom: v.optional(v.string()),
  })
    .index("by_keyId", ["keyId"])
    .index("by_type_state", ["keyType", "state"])
    .index("by_state", ["state"])
    .index("by_expires", ["expiresAt"]),

  // Security audit log
  securityAuditLog: defineTable({
    action: v.string(),
    timestamp: v.number(),
    actor: v.string(),
    keyType: v.optional(v.string()),
    keyId: v.optional(v.string()),
    purpose: v.optional(v.string()),
    severity: v.optional(v.union(v.literal("info"), v.literal("warning"), v.literal("critical"))),
    details: v.optional(v.any()),
  })
    .index("by_action", ["action"])
    .index("by_timestamp", ["timestamp"])
    .index("by_severity", ["severity"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
