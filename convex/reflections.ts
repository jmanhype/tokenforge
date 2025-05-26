import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Configure reflection/rewards for a token
export const configureReflections = mutation({
  args: {
    tokenId: v.id("memeCoins"),
    enabled: v.boolean(),
    reflectionFeePercent: v.number(), // Basis points (100 = 1%)
    minHoldingForRewards: v.number(), // Minimum tokens to receive reflections
    excludeFromRewards: v.optional(v.array(v.string())), // Addresses to exclude
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const token = await ctx.db.get(args.tokenId);
    if (!token || token.creatorId !== userId) {
      throw new Error("Not authorized");
    }

    if (args.reflectionFeePercent > 500) { // Max 5%
      throw new Error("Reflection fee cannot exceed 5%");
    }

    // Check if config exists
    let config = await ctx.db
      .query("reflectionConfigs")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (config) {
      await ctx.db.patch(config._id, {
        enabled: args.enabled,
        reflectionFeePercent: args.reflectionFeePercent,
        minHoldingForRewards: args.minHoldingForRewards,
        excludedAddresses: args.excludeFromRewards || config.excludedAddresses,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("reflectionConfigs", {
        tokenId: args.tokenId,
        enabled: args.enabled,
        reflectionFeePercent: args.reflectionFeePercent,
        minHoldingForRewards: args.minHoldingForRewards,
        excludedAddresses: args.excludeFromRewards || [],
        totalReflected: 0,
        totalDistributed: 0,
        lastDistributionTime: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Initialize reflections for a new token
export const initializeReflections = internalMutation({
  args: {
    tokenId: v.id("memeCoins"),
    initialSupply: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("reflectionConfigs")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("reflectionConfigs", {
      tokenId: args.tokenId,
      enabled: false, // Off by default
      reflectionFeePercent: 200, // 2% default
      minHoldingForRewards: args.initialSupply * 0.0001, // 0.01% of supply
      excludedAddresses: [],
      totalReflected: 0,
      totalDistributed: 0,
      lastDistributionTime: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Distribute reflections from a transaction
export const distributeReflections = internalMutation({
  args: {
    tokenId: v.id("memeCoins"),
    reflectionAmount: v.number(),
    fromAddress: v.string(),
    txHash: v.string(),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("reflectionConfigs")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (!config || !config.enabled) return;

    // Get all eligible holders
    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .first();

    if (!bondingCurve) return;

    const holders = await ctx.db
      .query("bondingCurveHolders")
      .withIndex("by_curve", (q) => q.eq("bondingCurveId", bondingCurve._id))
      .collect();

    // Filter eligible holders
    const eligibleHolders = holders.filter(holder => 
      holder.balance >= config.minHoldingForRewards &&
      !config.excludedAddresses.includes(holder.user) &&
      holder.user !== fromAddress
    );

    if (eligibleHolders.length === 0) return;

    // Calculate total eligible balance
    const totalEligibleBalance = eligibleHolders.reduce((sum, h) => sum + h.balance, 0);

    // Distribute reflections proportionally
    const distributions = eligibleHolders.map(holder => ({
      holderId: holder._id,
      userId: holder.user,
      amount: (holder.balance / totalEligibleBalance) * args.reflectionAmount,
      percentage: (holder.balance / totalEligibleBalance) * 100,
    }));

    // Record distributions
    for (const dist of distributions) {
      // Update holder rewards
      let holderRewards = await ctx.db
        .query("reflectionBalances")
        .withIndex("by_holder", (q) => q.eq("holderId", dist.holderId))
        .first();

      if (holderRewards) {
        await ctx.db.patch(holderRewards._id, {
          totalReceived: holderRewards.totalReceived + dist.amount,
          pendingRewards: holderRewards.pendingRewards + dist.amount,
          lastUpdateTime: Date.now(),
        });
      } else {
        await ctx.db.insert("reflectionBalances", {
          tokenId: args.tokenId,
          holderId: dist.holderId,
          userId: dist.userId,
          totalReceived: dist.amount,
          pendingRewards: dist.amount,
          claimedRewards: 0,
          lastUpdateTime: Date.now(),
        });
      }
    }

    // Record distribution event
    await ctx.db.insert("reflectionDistributions", {
      tokenId: args.tokenId,
      totalAmount: args.reflectionAmount,
      recipientCount: eligibleHolders.length,
      averageAmount: args.reflectionAmount / eligibleHolders.length,
      txHash: args.txHash,
      timestamp: Date.now(),
      distributions: distributions.slice(0, 10), // Store top 10 for reference
    });

    // Update config stats
    await ctx.db.patch(config._id, {
      totalReflected: config.totalReflected + args.reflectionAmount,
      totalDistributed: config.totalDistributed + args.reflectionAmount,
      lastDistributionTime: Date.now(),
    });
  },
});

// Get reflection stats for a token
export const getReflectionStats = query({
  args: {
    tokenId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("reflectionConfigs")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (!config) {
      return {
        configured: false,
        enabled: false,
        stats: null,
      };
    }

    // Get recent distributions
    const recentDistributions = await ctx.db
      .query("reflectionDistributions")
      .withIndex("by_token_timestamp", (q) => q.eq("tokenId", args.tokenId))
      .order("desc")
      .take(20);

    // Get total holders eligible for rewards
    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .first();

    let eligibleHolders = 0;
    let totalHolders = 0;

    if (bondingCurve) {
      const holders = await ctx.db
        .query("bondingCurveHolders")
        .withIndex("by_curve", (q) => q.eq("bondingCurveId", bondingCurve._id))
        .collect();

      totalHolders = holders.length;
      eligibleHolders = holders.filter(h => 
        h.balance >= config.minHoldingForRewards &&
        !config.excludedAddresses.includes(h.user)
      ).length;
    }

    return {
      configured: true,
      enabled: config.enabled,
      stats: {
        ...config,
        eligibleHolders,
        totalHolders,
        recentDistributions,
        averageDistribution: config.totalDistributed > 0 
          ? config.totalDistributed / Math.max(1, recentDistributions.length)
          : 0,
      },
    };
  },
});

// Get user's reflection balance
export const getUserReflections = query({
  args: {
    tokenId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Find user's holder record
    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .first();

    if (!bondingCurve) return null;

    const holder = await ctx.db
      .query("bondingCurveHolders")
      .withIndex("by_curve_user", (q) => 
        q.eq("bondingCurveId", bondingCurve._id).eq("user", userId)
      )
      .first();

    if (!holder) return null;

    // Get reflection balance
    const reflectionBalance = await ctx.db
      .query("reflectionBalances")
      .withIndex("by_holder", (q) => q.eq("holderId", holder._id))
      .first();

    if (!reflectionBalance) {
      return {
        totalReceived: 0,
        pendingRewards: 0,
        claimedRewards: 0,
        tokenBalance: holder.balance,
        isEligible: holder.balance >= (await ctx.db
          .query("reflectionConfigs")
          .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
          .first())?.minHoldingForRewards || 0,
      };
    }

    return {
      ...reflectionBalance,
      tokenBalance: holder.balance,
      isEligible: true,
    };
  },
});

// Claim reflection rewards
export const claimReflections = mutation({
  args: {
    tokenId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Find user's reflection balance
    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .first();

    if (!bondingCurve) throw new Error("Bonding curve not found");

    const holder = await ctx.db
      .query("bondingCurveHolders")
      .withIndex("by_curve_user", (q) => 
        q.eq("bondingCurveId", bondingCurve._id).eq("user", userId)
      )
      .first();

    if (!holder) throw new Error("Not a token holder");

    const reflectionBalance = await ctx.db
      .query("reflectionBalances")
      .withIndex("by_holder", (q) => q.eq("holderId", holder._id))
      .first();

    if (!reflectionBalance || reflectionBalance.pendingRewards === 0) {
      throw new Error("No rewards to claim");
    }

    // Update balance
    await ctx.db.patch(reflectionBalance._id, {
      pendingRewards: 0,
      claimedRewards: reflectionBalance.claimedRewards + reflectionBalance.pendingRewards,
      lastClaimTime: Date.now(),
    });

    // Record claim
    await ctx.db.insert("reflectionClaims", {
      tokenId: args.tokenId,
      userId,
      amount: reflectionBalance.pendingRewards,
      timestamp: Date.now(),
      txHash: "", // Would be from blockchain transaction
      status: "completed",
    });

    return {
      success: true,
      claimedAmount: reflectionBalance.pendingRewards,
    };
  },
});

// Get top reflection earners
export const getTopEarners = query({
  args: {
    tokenId: v.id("memeCoins"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .first();

    if (!bondingCurve) return [];

    // Get all reflection balances for this token
    const reflectionBalances = await ctx.db
      .query("reflectionBalances")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .collect();

    // Sort by total received
    const sorted = reflectionBalances
      .sort((a, b) => b.totalReceived - a.totalReceived)
      .slice(0, limit);

    // Get holder details
    const topEarners = await Promise.all(
      sorted.map(async (rb) => {
        const holder = await ctx.db
          .query("bondingCurveHolders")
          .filter((q) => q.eq(q.field("_id"), rb.holderId))
          .first();

        return {
          address: rb.userId.slice(0, 6) + "..." + rb.userId.slice(-4),
          totalReceived: rb.totalReceived,
          pendingRewards: rb.pendingRewards,
          tokenBalance: holder?.balance || 0,
          rank: sorted.indexOf(rb) + 1,
        };
      })
    );

    return topEarners;
  },
});