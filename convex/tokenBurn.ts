import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Initialize burn configuration for a new token
export const initializeBurnConfig = internalMutation({
  args: {
    tokenId: v.id("memeCoins"),
    autoBurnEnabled: v.boolean(),
    burnFeePercent: v.number(),
    manualBurnEnabled: v.boolean(),
    burnOnGraduation: v.boolean(),
    graduationBurnPercent: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if config already exists
    const existing = await ctx.db
      .query("burnConfigs")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("burnConfigs", {
      tokenId: args.tokenId,
      autoBurnEnabled: args.autoBurnEnabled,
      burnFeePercent: args.burnFeePercent,
      manualBurnEnabled: args.manualBurnEnabled,
      burnOnGraduation: args.burnOnGraduation,
      graduationBurnPercent: args.graduationBurnPercent,
      totalBurned: 0,
      lastBurnTime: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Burn configuration for tokens
export const configureBurn = mutation({
  args: {
    tokenId: v.id("memeCoins"),
    autoBurnEnabled: v.boolean(),
    burnFeePercent: v.optional(v.number()), // Basis points (100 = 1%)
    manualBurnEnabled: v.optional(v.boolean()),
    burnOnGraduation: v.optional(v.boolean()),
    graduationBurnPercent: v.optional(v.number()), // Percentage to burn on graduation
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const token = await ctx.db.get(args.tokenId);
    if (!token || token.creatorId !== userId) {
      throw new Error("Not authorized");
    }

    // Check if burn config exists
    let burnConfig = await ctx.db
      .query("burnConfigs")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (burnConfig) {
      // Update existing config
      await ctx.db.patch(burnConfig._id, {
        autoBurnEnabled: args.autoBurnEnabled,
        burnFeePercent: args.burnFeePercent || burnConfig.burnFeePercent,
        manualBurnEnabled: args.manualBurnEnabled !== undefined ? args.manualBurnEnabled : burnConfig.manualBurnEnabled,
        burnOnGraduation: args.burnOnGraduation !== undefined ? args.burnOnGraduation : burnConfig.burnOnGraduation,
        graduationBurnPercent: args.graduationBurnPercent || burnConfig.graduationBurnPercent,
        updatedAt: Date.now(),
      });
    } else {
      // Create new config
      await ctx.db.insert("burnConfigs", {
        tokenId: args.tokenId,
        autoBurnEnabled: args.autoBurnEnabled,
        burnFeePercent: args.burnFeePercent || 100, // Default 1%
        manualBurnEnabled: args.manualBurnEnabled !== false,
        burnOnGraduation: args.burnOnGraduation !== false,
        graduationBurnPercent: args.graduationBurnPercent || 2000, // Default 20%
        totalBurned: 0,
        lastBurnTime: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Manual burn tokens
export const burnTokens = mutation({
  args: {
    tokenId: v.id("memeCoins"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (args.amount <= 0) {
      throw new Error("Invalid burn amount");
    }

    const token = await ctx.db.get(args.tokenId);
    if (!token) throw new Error("Token not found");

    const burnConfig = await ctx.db
      .query("burnConfigs")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (!burnConfig?.manualBurnEnabled) {
      throw new Error("Manual burn not enabled for this token");
    }

    // Check user balance (would be from blockchain in production)
    const userBalance = await getUserTokenBalance(ctx, userId, args.tokenId);
    if (userBalance < args.amount) {
      throw new Error("Insufficient balance");
    }

    // Record burn transaction
    const burnId = await ctx.db.insert("burnTransactions", {
      tokenId: args.tokenId,
      burner: userId,
      amount: args.amount,
      burnType: "manual",
      txHash: "", // Would be from blockchain
      timestamp: Date.now(),
      status: "pending",
    });

    // Update burn config
    await ctx.db.patch(burnConfig._id, {
      totalBurned: burnConfig.totalBurned + args.amount,
      lastBurnTime: Date.now(),
    });

    // Update token analytics to reflect the burn
    await updateTokenSupplyAfterBurn(ctx, args.tokenId, args.amount);

    return { 
      success: true, 
      burnId,
      amount: args.amount,
    };
  },
});

// Record automatic burn from trading
export const recordAutoBurn = internalMutation({
  args: {
    tokenId: v.id("memeCoins"),
    amount: v.number(),
    txHash: v.string(),
    burnType: v.union(v.literal("trading_fee"), v.literal("graduation"), v.literal("manual")),
  },
  handler: async (ctx, args) => {
    const burnConfig = await ctx.db
      .query("burnConfigs")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (!burnConfig) return;

    // Record burn transaction
    await ctx.db.insert("burnTransactions", {
      tokenId: args.tokenId,
      burner: "system",
      amount: args.amount,
      burnType: args.burnType,
      txHash: args.txHash,
      timestamp: Date.now(),
      status: "completed",
    });

    // Update burn config
    await ctx.db.patch(burnConfig._id, {
      totalBurned: burnConfig.totalBurned + args.amount,
      lastBurnTime: Date.now(),
    });

    // Update token analytics
    await updateTokenSupplyAfterBurn(ctx, args.tokenId, args.amount);
  },
});

// Get burn statistics
export const getBurnStats = query({
  args: {
    tokenId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    const burnConfig = await ctx.db
      .query("burnConfigs")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (!burnConfig) {
      return {
        configured: false,
        autoBurnEnabled: false,
        totalBurned: 0,
        burnTransactions: [],
      };
    }

    // Get recent burn transactions
    const recentBurns = await ctx.db
      .query("burnTransactions")
      .withIndex("by_token_timestamp", (q) => q.eq("tokenId", args.tokenId))
      .order("desc")
      .take(20);

    // Get token info for supply calculation
    const token = await ctx.db.get(args.tokenId);
    const burnPercentage = token ? (burnConfig.totalBurned / token.initialSupply) * 100 : 0;

    return {
      configured: true,
      ...burnConfig,
      burnPercentage,
      recentBurns: recentBurns.map(burn => ({
        ...burn,
        burnerDisplay: burn.burner === "system" 
          ? "Auto Burn" 
          : `${burn.burner.slice(0, 6)}...${burn.burner.slice(-4)}`,
      })),
    };
  },
});

// Schedule graduation burn
export const scheduleGraduationBurn = internalMutation({
  args: {
    tokenId: v.id("memeCoins"),
    totalSupply: v.number(),
  },
  handler: async (ctx, args) => {
    const burnConfig = await ctx.db
      .query("burnConfigs")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (!burnConfig || !burnConfig.burnOnGraduation) return;

    const burnAmount = (args.totalSupply * burnConfig.graduationBurnPercent) / 10000;
    
    // Record the scheduled graduation burn
    await ctx.db.insert("burnTransactions", {
      tokenId: args.tokenId,
      burner: "system",
      amount: burnAmount,
      burnType: "graduation",
      txHash: "", // Will be updated when executed
      timestamp: Date.now(),
      status: "scheduled",
      metadata: {
        graduationBurnPercent: burnConfig.graduationBurnPercent,
      },
    });

    return { burnAmount };
  },
});

// Helper function to get user token balance
async function getUserTokenBalance(
  ctx: any,
  userId: string,
  tokenId: Id<"memeCoins">
): Promise<number> {
  // In production, this would query the blockchain
  // For now, check bonding curve holdings
  const bondingCurve = await ctx.db
    .query("bondingCurves")
    .withIndex("by_coin", (q) => q.eq("coinId", tokenId))
    .first();

  if (!bondingCurve) return 0;

  const holdings = await ctx.db
    .query("bondingCurveHoldings")
    .withIndex("by_user_and_curve", (q) => 
      q.eq("userId", userId).eq("bondingCurveId", bondingCurve._id)
    )
    .first();

  return holdings?.balance || 0;
}

// Helper function to update token supply after burn
async function updateTokenSupplyAfterBurn(
  ctx: any,
  tokenId: Id<"memeCoins">,
  burnAmount: number
): Promise<void> {
  const bondingCurve = await ctx.db
    .query("bondingCurves")
    .withIndex("by_coin", (q) => q.eq("coinId", tokenId))
    .first();

  if (bondingCurve) {
    await ctx.db.patch(bondingCurve._id, {
      currentSupply: Math.max(0, bondingCurve.currentSupply - burnAmount),
    });
  }

  // Update analytics
  const latestAnalytics = await ctx.db
    .query("analytics")
    .withIndex("by_coin", (q) => q.eq("coinId", tokenId))
    .order("desc")
    .first();

  if (latestAnalytics) {
    await ctx.db.insert("analytics", {
      ...latestAnalytics,
      _id: undefined,
      _creationTime: undefined,
      timestamp: Date.now(),
      // Adjust market cap based on burn
      marketCap: latestAnalytics.marketCap * ((latestAnalytics.holders - burnAmount) / latestAnalytics.holders),
    });
  }
}