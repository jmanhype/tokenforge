import { v } from "convex/values";
import { mutation, query, internalMutation } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "../_generated/dataModel";

// Initialize revenue tracking for a token
export const initializeRevenue = internalMutation({
  args: {
    creatorId: v.string(),
    tokenId: v.id("memeCoins"),
    blockchain: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if already exists
    const existing = await ctx.db
      .query("creatorRevenue")
      .withIndex("by_creator_token", (q) =>
        q.eq("creatorId", args.creatorId).eq("tokenId", args.tokenId)
      )
      .first();

    if (!existing) {
      await ctx.db.insert("creatorRevenue", {
        creatorId: args.creatorId,
        tokenId: args.tokenId,
        totalEarned: 0,
        totalWithdrawn: 0,
        pendingAmount: 0,
        lastUpdated: Date.now(),
      });
    }

    // Initialize revenue sharing config with default values
    const config = await ctx.db
      .query("revenueSharingConfig")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (!config) {
      await ctx.db.insert("revenueSharingConfig", {
        tokenId: args.tokenId,
        creatorFeePercent: 100, // 1% default
        platformFeePercent: 100, // 1% default
        liquidityFeePercent: 0,
        burnFeePercent: 0,
        isEnabled: true,
        updatedAt: Date.now(),
      });
    }
  },
});

// Record revenue from trading fees
export const recordTradingFee = internalMutation({
  args: {
    tokenId: v.id("memeCoins"),
    tradeAmount: v.number(),
    feeAmount: v.number(),
    txHash: v.optional(v.string()),
    blockchain: v.string(),
  },
  handler: async (ctx, args) => {
    // Get token to find creator
    const token = await ctx.db.get(args.tokenId);
    if (!token) throw new Error("Token not found");

    // Get revenue config
    const config = await ctx.db
      .query("revenueSharingConfig")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (!config || !config.isEnabled) return;

    // Calculate creator's share
    const creatorShare = (args.feeAmount * config.creatorFeePercent) / 10000;
    const platformShare = (args.feeAmount * config.platformFeePercent) / 10000;

    // Update creator revenue
    const revenue = await ctx.db
      .query("creatorRevenue")
      .withIndex("by_creator_token", (q) =>
        q.eq("creatorId", token.creatorId).eq("tokenId", args.tokenId)
      )
      .first();

    if (revenue) {
      await ctx.db.patch(revenue._id, {
        totalEarned: revenue.totalEarned + creatorShare,
        pendingAmount: revenue.pendingAmount + creatorShare,
        lastUpdated: Date.now(),
      });
    }

    // Record transaction
    await ctx.db.insert("revenueTransactions", {
      creatorId: token.creatorId,
      tokenId: args.tokenId,
      type: "trading_fee",
      amount: creatorShare,
      txHash: args.txHash,
      blockchain: args.blockchain,
      timestamp: Date.now(),
      metadata: {
        tradeAmount: args.tradeAmount,
        totalFee: args.feeAmount,
        platformShare,
      },
    });

    // Update platform revenue
    await updatePlatformRevenue(ctx, {
      blockchain: args.blockchain,
      tradingFees: platformShare,
    });
  },
});

// Record bonding curve fees
export const recordBondingCurveFee = internalMutation({
  args: {
    tokenId: v.id("memeCoins"),
    feeAmount: v.number(),
    txHash: v.optional(v.string()),
    blockchain: v.string(),
  },
  handler: async (ctx, args) => {
    const token = await ctx.db.get(args.tokenId);
    if (!token) throw new Error("Token not found");

    const config = await ctx.db
      .query("revenueSharingConfig")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (!config || !config.isEnabled) return;

    const creatorShare = (args.feeAmount * config.creatorFeePercent) / 10000;
    const platformShare = (args.feeAmount * config.platformFeePercent) / 10000;

    // Update creator revenue
    const revenue = await ctx.db
      .query("creatorRevenue")
      .withIndex("by_creator_token", (q) =>
        q.eq("creatorId", token.creatorId).eq("tokenId", args.tokenId)
      )
      .first();

    if (revenue) {
      await ctx.db.patch(revenue._id, {
        totalEarned: revenue.totalEarned + creatorShare,
        pendingAmount: revenue.pendingAmount + creatorShare,
        lastUpdated: Date.now(),
      });
    }

    // Record transaction
    await ctx.db.insert("revenueTransactions", {
      creatorId: token.creatorId,
      tokenId: args.tokenId,
      type: "bonding_curve_fee",
      amount: creatorShare,
      txHash: args.txHash,
      blockchain: args.blockchain,
      timestamp: Date.now(),
      metadata: {
        totalFee: args.feeAmount,
        platformShare,
      },
    });

    await updatePlatformRevenue(ctx, {
      blockchain: args.blockchain,
      bondingCurveFees: platformShare,
    });
  },
});

// Get creator's total revenue across all tokens
export const getCreatorTotalRevenue = query({
  args: {
    creatorId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const creatorId = args.creatorId || (await getAuthUserId(ctx));
    if (!creatorId) throw new Error("Not authenticated");

    const revenues = await ctx.db
      .query("creatorRevenue")
      .withIndex("by_creator", (q) => q.eq("creatorId", creatorId))
      .collect();

    const totalStats = revenues.reduce(
      (acc, rev) => ({
        totalEarned: acc.totalEarned + rev.totalEarned,
        totalWithdrawn: acc.totalWithdrawn + rev.totalWithdrawn,
        pendingAmount: acc.pendingAmount + rev.pendingAmount,
      }),
      { totalEarned: 0, totalWithdrawn: 0, pendingAmount: 0 }
    );

    // Get token details for each revenue entry
    const revenueByToken = await Promise.all(
      revenues.map(async (rev) => {
        const token = await ctx.db.get(rev.tokenId);
        return {
          ...rev,
          tokenName: token?.name || "Unknown",
          tokenSymbol: token?.symbol || "???",
        };
      })
    );

    return {
      ...totalStats,
      tokenCount: revenues.length,
      revenueByToken,
    };
  },
});

// Get revenue details for a specific token
export const getTokenRevenue = query({
  args: {
    tokenId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const token = await ctx.db.get(args.tokenId);
    if (!token || token.creatorId !== userId) {
      throw new Error("Not authorized");
    }

    const revenue = await ctx.db
      .query("creatorRevenue")
      .withIndex("by_creator_token", (q) =>
        q.eq("creatorId", userId).eq("tokenId", args.tokenId)
      )
      .first();

    const config = await ctx.db
      .query("revenueSharingConfig")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    // Get recent transactions
    const recentTransactions = await ctx.db
      .query("revenueTransactions")
      .withIndex("by_creator_timestamp", (q) => q.eq("creatorId", userId))
      .order("desc")
      .filter((q) => q.eq(q.field("tokenId"), args.tokenId))
      .take(20);

    return {
      revenue: revenue || {
        totalEarned: 0,
        totalWithdrawn: 0,
        pendingAmount: 0,
        lastUpdated: Date.now(),
      },
      config,
      recentTransactions,
    };
  },
});

// Get revenue history with pagination
export const getRevenueHistory = query({
  args: {
    creatorId: v.optional(v.id("users")),
    tokenId: v.optional(v.id("memeCoins")),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const creatorId = args.creatorId || (await getAuthUserId(ctx));
    if (!creatorId) throw new Error("Not authenticated");

    const limit = args.limit || 50;
    const cursor = args.cursor || Date.now();

    let transactionsQuery = ctx.db
      .query("revenueTransactions")
      .withIndex("by_creator_timestamp", (q) =>
        q.eq("creatorId", creatorId).lt("timestamp", cursor)
      )
      .order("desc");

    if (args.tokenId) {
      transactionsQuery = transactionsQuery.filter((q) =>
        q.eq(q.field("tokenId"), args.tokenId)
      );
    }

    const transactions = await transactionsQuery.take(limit);

    // Get token details
    const transactionsWithTokens = await Promise.all(
      transactions.map(async (tx) => {
        const token = await ctx.db.get(tx.tokenId);
        return {
          ...tx,
          tokenName: token?.name || "Unknown",
          tokenSymbol: token?.symbol || "???",
        };
      })
    );

    return {
      transactions: transactionsWithTokens,
      hasMore: transactions.length === limit,
      nextCursor: transactions.length > 0 
        ? transactions[transactions.length - 1].timestamp 
        : undefined,
    };
  },
});

// Request withdrawal
export const requestWithdrawal = mutation({
  args: {
    amount: v.number(),
    blockchain: v.string(),
    destinationAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Validate amount
    if (args.amount <= 0) {
      throw new Error("Invalid withdrawal amount");
    }

    // Get total pending amount
    const revenues = await ctx.db
      .query("creatorRevenue")
      .withIndex("by_creator", (q) => q.eq("creatorId", userId))
      .collect();

    const totalPending = revenues.reduce((sum, rev) => sum + rev.pendingAmount, 0);

    if (args.amount > totalPending) {
      throw new Error("Insufficient balance");
    }

    // Create withdrawal request
    const requestId = await ctx.db.insert("withdrawalRequests", {
      creatorId: userId,
      amount: args.amount,
      status: "pending",
      blockchain: args.blockchain,
      destinationAddress: args.destinationAddress,
      requestedAt: Date.now(),
    });

    // Deduct from pending amounts proportionally
    for (const revenue of revenues) {
      if (revenue.pendingAmount > 0) {
        const proportion = revenue.pendingAmount / totalPending;
        const deduction = args.amount * proportion;

        await ctx.db.patch(revenue._id, {
          pendingAmount: revenue.pendingAmount - deduction,
          lastUpdated: Date.now(),
        });
      }
    }

    return requestId;
  },
});

// Get withdrawal history
export const getWithdrawalHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const limit = args.limit || 10;

    const withdrawals = await ctx.db
      .query("withdrawalRequests")
      .withIndex("by_creator", (q) => q.eq("creatorId", userId))
      .order("desc")
      .take(limit);

    return withdrawals;
  },
});

// Update revenue sharing configuration (creator only)
export const updateRevenueConfig = mutation({
  args: {
    tokenId: v.id("memeCoins"),
    creatorFeePercent: v.optional(v.number()),
    isEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const token = await ctx.db.get(args.tokenId);
    if (!token || token.creatorId !== userId) {
      throw new Error("Not authorized");
    }

    const config = await ctx.db
      .query("revenueSharingConfig")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (!config) {
      throw new Error("Revenue config not found");
    }

    const updates: any = { updatedAt: Date.now() };

    if (args.creatorFeePercent !== undefined) {
      // Validate fee percentage (max 5%)
      if (args.creatorFeePercent > 500) {
        throw new Error("Creator fee cannot exceed 5%");
      }
      updates.creatorFeePercent = args.creatorFeePercent;
    }

    if (args.isEnabled !== undefined) {
      updates.isEnabled = args.isEnabled;
    }

    await ctx.db.patch(config._id, updates);
  },
});

// Helper function to update platform revenue
async function updatePlatformRevenue(
  ctx: any,
  data: {
    blockchain: string;
    tradingFees?: number;
    creationFees?: number;
    bondingCurveFees?: number;
    dexFees?: number;
  }
) {
  const period = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const existing = await ctx.db
    .query("platformRevenue")
    .withIndex("by_period_blockchain", (q) =>
      q.eq("period", period).eq("blockchain", data.blockchain)
    )
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      tradingFees: existing.tradingFees + (data.tradingFees || 0),
      creationFees: existing.creationFees + (data.creationFees || 0),
      bondingCurveFees: existing.bondingCurveFees + (data.bondingCurveFees || 0),
      dexFees: existing.dexFees + (data.dexFees || 0),
      totalRevenue:
        existing.totalRevenue +
        (data.tradingFees || 0) +
        (data.creationFees || 0) +
        (data.bondingCurveFees || 0) +
        (data.dexFees || 0),
      tradeCount: existing.tradeCount + (data.tradingFees ? 1 : 0),
      timestamp: Date.now(),
    });
  } else {
    await ctx.db.insert("platformRevenue", {
      period,
      blockchain: data.blockchain,
      tradingFees: data.tradingFees || 0,
      creationFees: data.creationFees || 0,
      bondingCurveFees: data.bondingCurveFees || 0,
      dexFees: data.dexFees || 0,
      totalRevenue:
        (data.tradingFees || 0) +
        (data.creationFees || 0) +
        (data.bondingCurveFees || 0) +
        (data.dexFees || 0),
      tokenCount: 0,
      tradeCount: data.tradingFees ? 1 : 0,
      timestamp: Date.now(),
    });
  }
}

// Get creator statistics
export const getCreatorStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const revenues = await ctx.db
      .query("creatorRevenue")
      .withIndex("by_creator", (q) => q.eq("creatorId", userId))
      .collect();

    const totalEarnings = revenues.reduce((sum, rev) => sum + rev.totalEarned, 0);
    const availableBalance = revenues.reduce((sum, rev) => sum + rev.pendingAmount, 0);
    const totalWithdrawn = revenues.reduce((sum, rev) => sum + rev.totalWithdrawn, 0);

    // Get all user's tokens to calculate total volume
    const userTokens = await ctx.db
      .query("memeCoins")
      .withIndex("by_creator", (q) => q.eq("creatorId", userId))
      .collect();

    let totalVolume = 0;
    let activeTokens = 0;

    for (const token of userTokens) {
      const bondingCurve = await ctx.db
        .query("bondingCurves")
        .withIndex("by_coin", (q) => q.eq("coinId", token._id))
        .first();

      if (bondingCurve) {
        totalVolume += bondingCurve.totalVolume;
        if (bondingCurve.isActive) activeTokens++;
      }
    }

    return {
      totalEarnings,
      availableBalance,
      totalWithdrawn,
      totalVolume,
      activeTokens,
      lifetimeEarnings: totalEarnings + totalWithdrawn,
    };
  },
});

// Get revenue breakdown by token
export const getTokenRevenues = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const revenues = await ctx.db
      .query("creatorRevenue")
      .withIndex("by_creator", (q) => q.eq("creatorId", userId))
      .collect();

    const tokenRevenues = await Promise.all(
      revenues.map(async (revenue) => {
        const token = await ctx.db.get(revenue.tokenId);
        if (!token) return null;

        // Get transaction breakdown
        const transactions = await ctx.db
          .query("revenueTransactions")
          .withIndex("by_creator_timestamp", (q) => q.eq("creatorId", userId))
          .filter((q) => q.eq(q.field("tokenId"), revenue.tokenId))
          .collect();

        const bondingCurveFees = transactions
          .filter(tx => tx.type === "bonding_curve_fee")
          .reduce((sum, tx) => sum + tx.amount, 0);

        const tradingFees = transactions
          .filter(tx => tx.type === "trading_fee")
          .reduce((sum, tx) => sum + tx.amount, 0);

        const dexFees = transactions
          .filter(tx => tx.type === "dex_fee")
          .reduce((sum, tx) => sum + tx.amount, 0);

        return {
          _id: revenue._id,
          tokenId: revenue.tokenId,
          tokenName: token.name,
          tokenSymbol: token.symbol,
          blockchain: token.blockchain || "ethereum",
          totalEarnings: revenue.totalEarned,
          availableBalance: revenue.pendingAmount,
          totalWithdrawn: revenue.totalWithdrawn,
          bondingCurveFees,
          tradingFees,
          dexFees,
          lastUpdated: revenue.lastUpdated,
        };
      })
    );

    return tokenRevenues.filter(rev => rev !== null);
  },
});

// Simplified withdrawal function for MVP
export const withdraw = mutation({
  args: {
    tokenId: v.id("memeCoins"),
    amount: v.number(),
    blockchain: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const token = await ctx.db.get(args.tokenId);
    if (!token || token.creatorId !== userId) {
      throw new Error("Not authorized");
    }

    const revenue = await ctx.db
      .query("creatorRevenue")
      .withIndex("by_creator_token", (q) =>
        q.eq("creatorId", userId).eq("tokenId", args.tokenId)
      )
      .first();

    if (!revenue || revenue.pendingAmount < args.amount) {
      throw new Error("Insufficient balance");
    }

    // Update revenue record
    await ctx.db.patch(revenue._id, {
      pendingAmount: revenue.pendingAmount - args.amount,
      totalWithdrawn: revenue.totalWithdrawn + args.amount,
      lastUpdated: Date.now(),
    });

    // Record withdrawal transaction
    await ctx.db.insert("revenueTransactions", {
      creatorId: userId,
      tokenId: args.tokenId,
      type: "withdrawal",
      amount: args.amount,
      blockchain: args.blockchain,
      timestamp: Date.now(),
      status: "pending",
      metadata: {
        withdrawalMethod: "manual",
      },
    });

    return { success: true, amount: args.amount };
  },
});