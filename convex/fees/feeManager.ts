import { v } from "convex/values";
import { internalAction, internalMutation, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";

// Fee types enum matching contract
export const FeeTypes = {
  TOKEN_CREATION: 0,
  BONDING_CURVE_TRADE: 1,
  DEX_GRADUATION: 2,
  LIQUIDITY_PROVISION: 3,
  MULTI_SIG_DEPLOYMENT: 4,
} as const;

// Fee collector addresses by network
const FEE_COLLECTOR_ADDRESSES = {
  "ethereum-testnet": process.env.FEE_COLLECTOR_SEPOLIA || "",
  "ethereum-mainnet": process.env.FEE_COLLECTOR_ETHEREUM || "",
  "bsc-testnet": process.env.FEE_COLLECTOR_BSC_TESTNET || "",
  "bsc-mainnet": process.env.FEE_COLLECTOR_BSC || "",
};

// Calculate fee for a given operation
export const calculateFee = query({
  args: {
    feeType: v.number(),
    blockchain: v.string(),
    testnet: v.boolean(),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("feeConfigurations")
      .withIndex("by_type", (q) => q.eq("feeType", args.feeType))
      .first();
    
    if (!config || !config.isEnabled) {
      return { fee: 0, feeCollectorAddress: "" };
    }
    
    const network = `${args.blockchain}-${args.testnet ? "testnet" : "mainnet"}`;
    const feeCollectorAddress = FEE_COLLECTOR_ADDRESSES[network as keyof typeof FEE_COLLECTOR_ADDRESSES] || "";
    
    return {
      fee: config.amount,
      minAmount: config.minAmount,
      maxAmount: config.maxAmount,
      isPercentage: config.isPercentage,
      feeCollectorAddress,
    };
  },
});

// Get fee statistics
export const getFeeStatistics = query({
  args: {
    userId: v.optional(v.string()),
    feeType: v.optional(v.number()),
    timeRange: v.optional(v.union(v.literal("day"), v.literal("week"), v.literal("month"), v.literal("all"))),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("feeCollections");
    
    if (args.userId) {
      query = query.withIndex("by_user", (q) => q.eq("userId", args.userId));
    }
    
    let collections = await query.collect();
    
    if (args.feeType !== undefined) {
      collections = collections.filter(c => c.feeType === args.feeType);
    }
    
    if (args.timeRange && args.timeRange !== "all") {
      const now = Date.now();
      const ranges = {
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
      };
      const since = now - ranges[args.timeRange];
      collections = collections.filter(c => c.collectedAt >= since);
    }
    
    const totalFees = collections.reduce((sum, c) => sum + c.amount, 0);
    const feesByType: Record<number, number> = {};
    
    collections.forEach(c => {
      feesByType[c.feeType] = (feesByType[c.feeType] || 0) + c.amount;
    });
    
    return {
      totalFees,
      feesByType,
      transactionCount: collections.length,
      collections: collections.slice(0, 10), // Recent 10
    };
  },
});

// Record fee collection
export const recordFeeCollection = internalMutation({
  args: {
    userId: v.string(),
    tokenId: v.id("memeCoins"),
    feeType: v.number(),
    amount: v.number(),
    blockchain: v.string(),
    status: v.union(v.literal("pending"), v.literal("collected"), v.literal("distributed")),
    metadata: v.optional(v.any()),
    transactionHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const feeId = await ctx.db.insert("feeCollections", {
      ...args,
      collectedAt: Date.now(),
      distributedAt: undefined,
      distributionTxHash: undefined,
    });
    
    // Update user fee stats
    const userStats = await ctx.db
      .query("userFeeStats")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    
    if (userStats) {
      await ctx.db.patch(userStats._id, {
        totalFeesPaid: userStats.totalFeesPaid + args.amount,
        lastFeeAt: Date.now(),
        [`fees_${args.feeType}`]: (userStats[`fees_${args.feeType}`] || 0) + args.amount,
      });
    } else {
      await ctx.db.insert("userFeeStats", {
        userId: args.userId,
        totalFeesPaid: args.amount,
        lastFeeAt: Date.now(),
        [`fees_${args.feeType}`]: args.amount,
      });
    }
    
    return feeId;
  },
});

// Update fee configuration
export const updateFeeConfiguration = mutation({
  args: {
    feeType: v.number(),
    amount: v.number(),
    minAmount: v.number(),
    maxAmount: v.number(),
    isEnabled: v.boolean(),
    isPercentage: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Check admin permissions
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.tokenIdentifier?.includes("admin")) {
      throw new Error("Not authorized");
    }
    
    const existing = await ctx.db
      .query("feeConfigurations")
      .withIndex("by_type", (q) => q.eq("feeType", args.feeType))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("feeConfigurations", {
        ...args,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    
    return { success: true };
  },
});

// Get user fee stats
export const getUserFeeStats = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query("userFeeStats")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    
    if (!stats) {
      return {
        totalFeesPaid: 0,
        lastFeeAt: null,
        feesByType: {},
      };
    }
    
    const feesByType: Record<string, number> = {};
    for (let i = 0; i <= 4; i++) {
      const key = `fees_${i}`;
      if (stats[key as keyof typeof stats]) {
        const feeTypeName = Object.entries(FeeTypes).find(([_, value]) => value === i)?.[0] || `Type ${i}`;
        feesByType[feeTypeName] = stats[key as keyof typeof stats] as number;
      }
    }
    
    return {
      totalFeesPaid: stats.totalFeesPaid,
      lastFeeAt: stats.lastFeeAt,
      feesByType,
    };
  },
});