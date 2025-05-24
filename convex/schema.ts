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
    status: v.union(v.literal("pending"), v.literal("deployed"), v.literal("failed")),
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
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
