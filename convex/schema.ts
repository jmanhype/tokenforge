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
    multiSigWallet: v.optional(v.string()),
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
    .index("by_blockchain", ["blockchain"])
    .index("by_contractAddress", ["contractAddress"]),

  // Real-time analytics data
  analytics: defineTable({
    coinId: v.id("memeCoins"),
    price: v.number(),
    currentPrice: v.optional(v.number()), // Added for compatibility
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
    tokenId: v.optional(v.id("memeCoins")), // Made optional for backward compatibility
    currentSupply: v.number(),
    currentPrice: v.number(),
    reserveBalance: v.number(),
    totalVolume: v.number(),
    totalTransactions: v.number(),
    uniqueHolders: v.optional(v.number()), // Added for graduation check
    holders: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
    graduatedAt: v.optional(v.number()),
    dexPoolAddress: v.optional(v.string()),
    contractAddress: v.optional(v.string()), // Bonding curve contract address
    blockchain: v.optional(v.union(v.literal("ethereum"), v.literal("bsc"), v.literal("solana"))),
    volume24h: v.optional(v.number()),
    lastVolumeReset: v.optional(v.number()),
    ethReserve: v.optional(v.number()), // ETH locked in bonding curve
    tokenSupply: v.optional(v.number()), // Tokens in bonding curve
    transactions: v.optional(v.number()), // Total transaction count
  })
    .index("by_coin", ["coinId"])
    .index("by_active", ["isActive"]),
    // Removed byTokenId index since tokenId is optional
  
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

  // Bonding curve holdings with more details
  bondingCurveHoldings: defineTable({
    userId: v.id("users"),
    bondingCurveId: v.id("bondingCurves"),
    coinId: v.id("memeCoins"),
    balance: v.number(),
    totalBought: v.number(),
    totalSold: v.number(),
    averageBuyPrice: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_curve", ["bondingCurveId"])
    .index("by_user_and_curve", ["userId", "bondingCurveId"]),

  // Bonding curve analytics snapshots
  bondingCurveAnalytics: defineTable({
    bondingCurveId: v.id("bondingCurves"),
    timestamp: v.number(),
    price: v.number(),
    marketCap: v.number(),
    volume: v.number(),
    holders: v.number(),
    transactions: v.number(),
    tvl: v.number(), // Total Value Locked
  })
    .index("by_curve", ["bondingCurveId"])
    .index("by_timestamp", ["timestamp"]),

  // Bonding curve events
  bondingCurveEvents: defineTable({
    bondingCurveId: v.id("bondingCurves"),
    type: v.union(v.literal("initialized"), v.literal("graduated"), v.literal("paused"), v.literal("resumed")),
    data: v.any(),
    timestamp: v.number(),
  })
    .index("by_curve", ["bondingCurveId"])
    .index("by_type", ["type"])
    .index("by_timestamp", ["timestamp"]),

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

  // Fee collectors deployed on each network
  feeCollectors: defineTable({
    network: v.string(),
    address: v.string(),
    treasury: v.string(),
    emergencyAddress: v.string(),
    deployedAt: v.number(),
    isActive: v.boolean(),
  })
    .index("by_network", ["network"])
    .index("by_active", ["isActive"]),

  // Fee configurations
  feeConfigurations: defineTable({
    feeType: v.number(),
    amount: v.number(),
    minAmount: v.number(),
    maxAmount: v.number(),
    isEnabled: v.boolean(),
    isPercentage: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_type", ["feeType"]),

  // Fee collections
  feeCollections: defineTable({
    userId: v.string(),
    tokenId: v.id("memeCoins"),
    feeType: v.number(),
    amount: v.number(),
    blockchain: v.string(),
    status: v.union(v.literal("pending"), v.literal("collected"), v.literal("distributed")),
    metadata: v.optional(v.any()),
    transactionHash: v.optional(v.string()),
    collectedAt: v.number(),
    distributedAt: v.optional(v.number()),
    distributionTxHash: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_token", ["tokenId"])
    .index("by_status", ["status"])
    .index("by_collected", ["collectedAt"]),

  // User fee statistics
  userFeeStats: defineTable({
    userId: v.string(),
    totalFeesPaid: v.number(),
    lastFeeAt: v.number(),
    fees_0: v.optional(v.number()), // TOKEN_CREATION
    fees_1: v.optional(v.number()), // BONDING_CURVE_TRADE
    fees_2: v.optional(v.number()), // DEX_GRADUATION
    fees_3: v.optional(v.number()), // LIQUIDITY_PROVISION
    fees_4: v.optional(v.number()), // MULTI_SIG_DEPLOYMENT
  })
    .index("by_user", ["userId"]),

  // Fee distributions
  feeDistributions: defineTable({
    blockchain: v.string(),
    transactionHash: v.string(),
    feesDistributed: v.number(),
    totalAmount: v.number(),
    distributedAt: v.number(),
  })
    .index("by_blockchain", ["blockchain"])
    .index("by_distributed", ["distributedAt"]),

  // Multi-signature wallets
  multiSigWallets: defineTable({
    tokenId: v.id("memeCoins"),
    address: v.string(),
    owners: v.array(v.string()),
    requiredConfirmations: v.number(),
    blockchain: v.string(),
    transactionHash: v.string(),
    deploymentCost: v.number(),
    createdAt: v.number(),
    isActive: v.boolean(),
  })
    .index("by_token", ["tokenId"])
    .index("by_address", ["address"]),

  // Multi-sig transactions
  multiSigTransactions: defineTable({
    multiSigAddress: v.string(),
    txIndex: v.number(),
    to: v.string(),
    value: v.string(),
    data: v.string(),
    description: v.string(),
    submitter: v.string(),
    submitTxHash: v.string(),
    confirmations: v.array(v.object({
      confirmer: v.string(),
      confirmTxHash: v.string(),
      timestamp: v.number(),
    })),
    executed: v.boolean(),
    executeTxHash: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_multisig", ["multiSigAddress"])
    .index("by_multisig_index", ["multiSigAddress", "txIndex"])
    .index("by_executed", ["executed"]),

  // Price history from oracles
  priceHistory: defineTable({
    tokenAddress: v.string(),
    price: v.number(),
    sources: v.array(v.object({
      source: v.string(),
      price: v.number(),
    })),
    timestamp: v.number(),
  })
    .index("by_token_time", ["tokenAddress", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  // Liquidity provisions tracking
  liquidityProvisions: defineTable({
    tokenId: v.id("memeCoins"),
    poolAddress: v.string(),
    positionId: v.union(v.number(), v.null()),
    tokenAmount: v.number(),
    ethAmount: v.number(),
    threshold: v.string(),
    timestamp: v.number(),
    provider: v.union(v.literal("auto"), v.literal("manual"), v.literal("user")),
    transactionHash: v.optional(v.string()),
    fees: v.optional(v.object({
      tokenFees: v.number(),
      ethFees: v.number(),
      lastCollected: v.number(),
    })),
  })
    .index("by_token", ["tokenId"])
    .index("by_pool", ["poolAddress"])
    .index("by_timestamp", ["timestamp"]),

  // DEX graduation records
  dexGraduations: defineTable({
    tokenId: v.id("memeCoins"),
    targetDex: v.union(v.literal("uniswap"), v.literal("pancakeswap")),
    status: v.union(v.literal("pending"), v.literal("processing"), v.literal("completed"), v.literal("failed")),
    liquidityPercentage: v.number(),
    ethLiquidity: v.number(),
    tokenLiquidity: v.number(),
    poolAddress: v.optional(v.string()),
    transactionHash: v.optional(v.string()),
    error: v.optional(v.string()),
    initiatedAt: v.number(),
    initiatedBy: v.string(),
    updatedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_token", ["tokenId"])
    .index("by_status", ["status"])
    .index("by_initiated", ["initiatedAt"]),

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

  // Audit logs for compliance and security
  auditLogs: defineTable({
    userId: v.string(),
    action: v.string(),
    entityId: v.optional(v.string()),
    entityType: v.optional(v.string()),
    metadata: v.optional(v.any()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    severity: v.union(v.literal("info"), v.literal("warning"), v.literal("error"), v.literal("critical")),
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_action", ["action"])
    .index("by_severity", ["severity"])
    .index("by_timestamp", ["timestamp"])
    .index("by_entity", ["entityType", "entityId"]),

  // Metrics for performance and business monitoring
  metrics: defineTable({
    name: v.string(),
    value: v.number(),
    labels: v.optional(v.any()),
    type: v.union(v.literal("counter"), v.literal("gauge"), v.literal("histogram")),
    timestamp: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_timestamp", ["timestamp"])
    .index("by_name_time", ["name", "timestamp"]),

  // Alert configurations
  alertConfigs: defineTable({
    name: v.string(),
    description: v.string(),
    enabled: v.boolean(),
    condition: v.object({
      metric: v.string(),
      operator: v.union(v.literal(">"), v.literal("<"), v.literal(">="), v.literal("<="), v.literal("==")),
      threshold: v.number(),
      duration: v.optional(v.number()), // seconds
    }),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    channels: v.array(v.id("alertChannels")),
    cooldown: v.number(), // seconds
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_enabled", ["enabled"])
    .index("by_severity", ["severity"]),

  // Alert channels (Discord, Telegram, Webhooks)
  alertChannels: defineTable({
    name: v.string(),
    type: v.union(v.literal("discord"), v.literal("telegram"), v.literal("webhook")),
    enabled: v.boolean(),
    config: v.any(), // Channel-specific configuration
    testMode: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_enabled", ["enabled"]),

  // Triggered alerts
  alerts: defineTable({
    configId: v.id("alertConfigs"),
    title: v.string(),
    message: v.string(),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    status: v.union(v.literal("triggered"), v.literal("acknowledged"), v.literal("resolved")),
    triggeredAt: v.number(),
    acknowledgedAt: v.optional(v.number()),
    acknowledgedBy: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.string()),
    metadata: v.optional(v.any()),
    notificationsSent: v.array(v.object({
      channelId: v.id("alertChannels"),
      sentAt: v.number(),
      success: v.boolean(),
      error: v.optional(v.string()),
    })),
  })
    .index("by_config", ["configId"])
    .index("by_status", ["status"])
    .index("by_severity", ["severity"])
    .index("by_triggered", ["triggeredAt"]),

  // System health status
  systemHealth: defineTable({
    component: v.string(),
    status: v.union(v.literal("healthy"), v.literal("degraded"), v.literal("down")),
    lastCheck: v.number(),
    responseTime: v.optional(v.number()),
    errorRate: v.optional(v.number()),
    metadata: v.optional(v.any()),
  })
    .index("by_component", ["component"])
    .index("by_status", ["status"]),

  // Comments on tokens
  comments: defineTable({
    tokenId: v.id("memeCoins"),
    userId: v.id("users"),
    content: v.string(),
    timestamp: v.number(),
    likes: v.number(),
    parentId: v.optional(v.id("comments")), // For nested replies
    isDeleted: v.optional(v.boolean()),
    editedAt: v.optional(v.number()),
  })
    .index("by_token", ["tokenId"])
    .index("by_user", ["userId"])
    .index("by_parent", ["parentId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_token_timestamp", ["tokenId", "timestamp"]),

  // Reactions to tokens
  reactions: defineTable({
    tokenId: v.id("memeCoins"),
    userId: v.id("users"),
    type: v.union(
      v.literal("rocket"),    // 🚀
      v.literal("fire"),      // 🔥
      v.literal("diamond"),   // 💎
      v.literal("trash"),     // 🗑️
      v.literal("moon"),      // 🌙
      v.literal("bear")       // 🐻
    ),
    timestamp: v.number(),
  })
    .index("by_token", ["tokenId"])
    .index("by_user", ["userId"])
    .index("by_token_user", ["tokenId", "userId"])
    .index("by_token_type", ["tokenId", "type"]),

  // Comment likes
  commentLikes: defineTable({
    commentId: v.id("comments"),
    userId: v.id("users"),
    timestamp: v.number(),
  })
    .index("by_comment", ["commentId"])
    .index("by_user", ["userId"])
    .index("by_comment_user", ["commentId", "userId"]),

  // User activity feed
  activityFeed: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("token_created"),
      v.literal("token_traded"),
      v.literal("comment_posted"),
      v.literal("reaction_added"),
      v.literal("token_graduated")
    ),
    tokenId: v.id("memeCoins"),
    data: v.optional(v.any()),
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_token", ["tokenId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_user_timestamp", ["userId", "timestamp"]),

  // Trending tokens based on engagement
  trending: defineTable({
    tokenId: v.id("memeCoins"),
    score: v.number(), // Calculated from volume, comments, reactions
    volumeScore: v.number(),
    socialScore: v.number(),
    priceScore: v.number(),
    lastUpdated: v.number(),
    rank: v.number(),
  })
    .index("by_token", ["tokenId"])
    .index("by_score", ["score"])
    .index("by_rank", ["rank"]),

  // Creator revenue tracking
  creatorRevenue: defineTable({
    creatorId: v.id("users"),
    tokenId: v.id("memeCoins"),
    totalEarned: v.number(),
    totalWithdrawn: v.number(),
    pendingAmount: v.number(),
    lastUpdated: v.number(),
  })
    .index("by_creator", ["creatorId"])
    .index("by_token", ["tokenId"])
    .index("by_creator_token", ["creatorId", "tokenId"]),

  // Revenue transactions
  revenueTransactions: defineTable({
    creatorId: v.id("users"),
    tokenId: v.id("memeCoins"),
    type: v.union(
      v.literal("trading_fee"),
      v.literal("bonding_curve_fee"),
      v.literal("dex_fee"),
      v.literal("withdrawal")
    ),
    amount: v.number(),
    txHash: v.optional(v.string()),
    blockchain: v.string(),
    timestamp: v.number(),
    status: v.optional(v.union(v.literal("pending"), v.literal("completed"), v.literal("failed"))),
    feePercentage: v.optional(v.number()),
    metadata: v.optional(v.any()),
  })
    .index("by_creator", ["creatorId"])
    .index("by_token", ["tokenId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_creator_timestamp", ["creatorId", "timestamp"]),

  // Platform revenue tracking
  platformRevenue: defineTable({
    period: v.string(), // YYYY-MM-DD
    blockchain: v.string(),
    tradingFees: v.number(),
    creationFees: v.number(),
    bondingCurveFees: v.number(),
    dexFees: v.number(),
    totalRevenue: v.number(),
    tokenCount: v.number(),
    tradeCount: v.number(),
    timestamp: v.number(),
  })
    .index("by_period", ["period"])
    .index("by_blockchain", ["blockchain"])
    .index("by_period_blockchain", ["period", "blockchain"]),

  // Withdrawal requests
  withdrawalRequests: defineTable({
    creatorId: v.id("users"),
    amount: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    blockchain: v.string(),
    destinationAddress: v.string(),
    txHash: v.optional(v.string()),
    requestedAt: v.number(),
    processedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_creator", ["creatorId"])
    .index("by_status", ["status"])
    .index("by_requested", ["requestedAt"]),

  // Revenue sharing configuration
  revenueSharingConfig: defineTable({
    tokenId: v.id("memeCoins"),
    creatorFeePercent: v.number(), // Basis points (100 = 1%)
    platformFeePercent: v.number(),
    liquidityFeePercent: v.number(), // For auto-liquidity
    burnFeePercent: v.number(), // For auto-burn
    isEnabled: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_token", ["tokenId"])
    .index("by_enabled", ["isEnabled"]),
    
  // Fair launch configuration
  fairLaunches: defineTable({
    tokenId: v.id("memeCoins"),
    config: v.object({
      maxBuyPerWallet: v.number(),
      maxBuyPerTx: v.number(),
      cooldownPeriod: v.number(),
      antiSnipeBlocks: v.number(),
      vestingSchedule: v.optional(v.array(v.object({
        percentage: v.number(),
        unlockTime: v.number(),
      }))),
      enabled: v.boolean(),
    }),
    launchTime: v.number(),
    launchBlock: v.optional(v.number()),
    tradingEnabled: v.boolean(),
    totalParticipants: v.number(),
    totalRaised: v.number(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_token", ["tokenId"])
    .index("by_enabled", ["tradingEnabled"]),
    
  // Fair launch participants
  fairLaunchParticipants: defineTable({
    fairLaunchId: v.id("fairLaunches"),
    buyer: v.string(),
    totalBought: v.number(),
    totalSpent: v.number(),
    lastBuyTime: v.number(),
    buyCount: v.number(),
    isBlacklisted: v.boolean(),
  })
    .index("by_launch", ["fairLaunchId"])
    .index("by_buyer", ["buyer"])
    .index("by_launch_buyer", ["fairLaunchId", "buyer"]),
    
  // Fair launch transactions
  fairLaunchTransactions: defineTable({
    fairLaunchId: v.id("fairLaunches"),
    buyer: v.string(),
    tokenAmount: v.number(),
    ethAmount: v.number(),
    txHash: v.string(),
    timestamp: v.number(),
    type: v.union(v.literal("buy"), v.literal("sell")),
  })
    .index("by_launch", ["fairLaunchId"])
    .index("by_buyer", ["buyer"])
    .index("by_timestamp", ["timestamp"])
    .index("by_launch_timestamp", ["fairLaunchId", "timestamp"]),
    
  // Burn configuration
  burnConfigs: defineTable({
    tokenId: v.id("memeCoins"),
    autoBurnEnabled: v.boolean(),
    burnFeePercent: v.number(), // Basis points
    manualBurnEnabled: v.boolean(),
    burnOnGraduation: v.boolean(),
    graduationBurnPercent: v.number(), // Basis points
    totalBurned: v.number(),
    lastBurnTime: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token", ["tokenId"])
    .index("by_enabled", ["autoBurnEnabled"]),
    
  // Burn transactions
  burnTransactions: defineTable({
    tokenId: v.id("memeCoins"),
    burner: v.union(v.id("users"), v.literal("system")),
    amount: v.number(),
    burnType: v.union(
      v.literal("manual"),
      v.literal("trading_fee"),
      v.literal("graduation")
    ),
    txHash: v.string(),
    timestamp: v.number(),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed"), v.literal("scheduled")),
    metadata: v.optional(v.any()),
  })
    .index("by_token", ["tokenId"])
    .index("by_burner", ["burner"])
    .index("by_timestamp", ["timestamp"])
    .index("by_token_timestamp", ["tokenId", "timestamp"])
    .index("by_status", ["status"]),
    
  // Auto-liquidity configuration
  autoLiquidityConfigs: defineTable({
    tokenId: v.id("memeCoins"),
    enabled: v.boolean(),
    liquidityFeePercent: v.number(), // Basis points
    minTokensBeforeSwap: v.number(),
    targetLiquidityPercent: v.number(), // Target % of supply in liquidity
    collectedTokens: v.number(),
    collectedETH: v.number(),
    totalLiquidityAdded: v.number(),
    lastSwapTime: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token", ["tokenId"])
    .index("by_enabled", ["enabled"]),
    
  // Liquidity events
  liquidityEvents: defineTable({
    tokenId: v.id("memeCoins"),
    type: v.union(
      v.literal("collection"),
      v.literal("addition"),
      v.literal("removal"),
      v.literal("manual_addition")
    ),
    tokenAmount: v.number(),
    ethAmount: v.number(),
    fromTrade: v.optional(v.boolean()),
    metadata: v.optional(v.any()),
    timestamp: v.number(),
  })
    .index("by_token", ["tokenId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_token_timestamp", ["tokenId", "timestamp"])
    .index("by_type", ["type"]),
    
  // Reflection/rewards configuration
  reflectionConfigs: defineTable({
    tokenId: v.id("memeCoins"),
    enabled: v.boolean(),
    reflectionFeePercent: v.number(), // Basis points
    minHoldingForRewards: v.number(),
    excludedAddresses: v.array(v.string()),
    totalReflected: v.number(),
    totalDistributed: v.number(),
    lastDistributionTime: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token", ["tokenId"])
    .index("by_enabled", ["enabled"]),
    
  // Reflection balances for holders
  reflectionBalances: defineTable({
    tokenId: v.id("memeCoins"),
    holderId: v.id("bondingCurveHolders"),
    userId: v.string(),
    totalReceived: v.number(),
    pendingRewards: v.number(),
    claimedRewards: v.number(),
    lastUpdateTime: v.number(),
    lastClaimTime: v.optional(v.number()),
  })
    .index("by_token", ["tokenId"])
    .index("by_holder", ["holderId"])
    .index("by_user", ["userId"]),
    
  // Reflection distribution events
  reflectionDistributions: defineTable({
    tokenId: v.id("memeCoins"),
    totalAmount: v.number(),
    recipientCount: v.number(),
    averageAmount: v.number(),
    txHash: v.string(),
    timestamp: v.number(),
    distributions: v.array(v.object({
      holderId: v.id("bondingCurveHolders"),
      userId: v.string(),
      amount: v.number(),
      percentage: v.number(),
    })),
  })
    .index("by_token", ["tokenId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_token_timestamp", ["tokenId", "timestamp"]),
    
  // Reflection claims
  reflectionClaims: defineTable({
    tokenId: v.id("memeCoins"),
    userId: v.string(),
    amount: v.number(),
    timestamp: v.number(),
    txHash: v.string(),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
  })
    .index("by_token", ["tokenId"])
    .index("by_user", ["userId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_status", ["status"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
