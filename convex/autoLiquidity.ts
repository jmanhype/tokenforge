import { v } from "convex/values";
import { mutation, query, internalMutation, action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

// Auto-liquidity configuration
export const configureAutoLiquidity = mutation({
  args: {
    tokenId: v.id("memeCoins"),
    enabled: v.boolean(),
    liquidityFeePercent: v.number(), // Basis points (100 = 1%)
    minTokensBeforeSwap: v.number(), // Minimum tokens collected before adding liquidity
    targetLiquidityPercent: v.number(), // Target % of supply in liquidity
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const token = await ctx.db.get(args.tokenId);
    if (!token || token.creatorId !== userId) {
      throw new Error("Not authorized");
    }

    // Validate percentages
    if (args.liquidityFeePercent > 500) { // Max 5%
      throw new Error("Liquidity fee cannot exceed 5%");
    }

    // Check if config exists
    let config = await ctx.db
      .query("autoLiquidityConfigs")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (config) {
      await ctx.db.patch(config._id, {
        enabled: args.enabled,
        liquidityFeePercent: args.liquidityFeePercent,
        minTokensBeforeSwap: args.minTokensBeforeSwap,
        targetLiquidityPercent: args.targetLiquidityPercent,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("autoLiquidityConfigs", {
        tokenId: args.tokenId,
        enabled: args.enabled,
        liquidityFeePercent: args.liquidityFeePercent,
        minTokensBeforeSwap: args.minTokensBeforeSwap,
        targetLiquidityPercent: args.targetLiquidityPercent,
        collectedTokens: 0,
        collectedETH: 0,
        totalLiquidityAdded: 0,
        lastSwapTime: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Initialize auto-liquidity for a new token
export const initializeAutoLiquidity = internalMutation({
  args: {
    tokenId: v.id("memeCoins"),
    initialSupply: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("autoLiquidityConfigs")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("autoLiquidityConfigs", {
      tokenId: args.tokenId,
      enabled: false, // Off by default
      liquidityFeePercent: 200, // 2% default
      minTokensBeforeSwap: args.initialSupply * 0.001, // 0.1% of supply
      targetLiquidityPercent: 1000, // 10% target liquidity
      collectedTokens: 0,
      collectedETH: 0,
      totalLiquidityAdded: 0,
      lastSwapTime: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Collect tokens for auto-liquidity
export const collectForLiquidity = internalMutation({
  args: {
    tokenId: v.id("memeCoins"),
    tokenAmount: v.number(),
    ethAmount: v.number(),
    fromTrade: v.boolean(),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("autoLiquidityConfigs")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (!config || !config.enabled) return;

    // Update collected amounts
    await ctx.db.patch(config._id, {
      collectedTokens: config.collectedTokens + args.tokenAmount,
      collectedETH: config.collectedETH + args.ethAmount,
    });

    // Check if we should add liquidity
    if (config.collectedTokens >= config.minTokensBeforeSwap) {
      // Schedule liquidity addition
      await ctx.scheduler.runAfter(0, internal.autoLiquidity.addLiquidityToPool, {
        tokenId: args.tokenId,
        configId: config._id,
      });
    }

    // Record collection event
    await ctx.db.insert("liquidityEvents", {
      tokenId: args.tokenId,
      type: "collection",
      tokenAmount: args.tokenAmount,
      ethAmount: args.ethAmount,
      fromTrade: args.fromTrade,
      timestamp: Date.now(),
    });
  },
});

// Add collected liquidity to DEX pool
export const addLiquidityToPool = action({
  args: {
    tokenId: v.id("memeCoins"),
    configId: v.id("autoLiquidityConfigs"),
  },
  handler: async (ctx, args) => {
    const config = await ctx.runQuery(internal.autoLiquidity.getConfig, {
      configId: args.configId,
    });

    if (!config || config.collectedTokens === 0) return;

    const token = await ctx.runQuery(internal.memeCoins.getToken, { tokenId: args.tokenId });
    if (!token) throw new Error("Token not found");

    const deployment = await ctx.runQuery(internal.memeCoins.getDeployment, {
      coinId: args.tokenId,
    });

    if (!deployment) throw new Error("Token not deployed");

    // Execute real liquidity addition to DEX
    const dexConfig = deployment.blockchain === "bsc" ? "pancakeswap" : "uniswap";
    
    const liquidityResult = await ctx.runAction(internal.dex.liquidityManager.addLiquidity, {
      tokenAddress: deployment.contractAddress,
      tokenAmount: config.collectedTokens,
      ethAmount: config.collectedETH,
      blockchain: deployment.blockchain as "ethereum" | "bsc",
      dex: dexConfig as "uniswap" | "pancakeswap",
      slippageTolerance: 0.01, // 1% slippage
    });

    // Record liquidity addition
    await ctx.runMutation(internal.autoLiquidity.recordLiquidityAddition, {
      configId: args.configId,
      tokenId: args.tokenId,
      tokenAmount: liquidityResult.tokenAmount,
      ethAmount: liquidityResult.ethAmount,
      lpTokensReceived: liquidityResult.lpTokensReceived,
      poolAddress: liquidityResult.poolAddress,
      txHash: liquidityResult.txHash,
    });

    return liquidityResult;
  },
});

// Record liquidity addition
export const recordLiquidityAddition = internalMutation({
  args: {
    configId: v.id("autoLiquidityConfigs"),
    tokenId: v.id("memeCoins"),
    tokenAmount: v.number(),
    ethAmount: v.number(),
    lpTokensReceived: v.number(),
    poolAddress: v.string(),
    txHash: v.string(),
  },
  handler: async (ctx, args) => {
    // Update config
    const config = await ctx.db.get(args.configId);
    if (!config) throw new Error("Config not found");

    await ctx.db.patch(args.configId, {
      collectedTokens: 0, // Reset collected amounts
      collectedETH: 0,
      totalLiquidityAdded: config.totalLiquidityAdded + args.ethAmount,
      lastSwapTime: Date.now(),
    });

    // Record liquidity provision
    await ctx.db.insert("liquidityProvisions", {
      tokenId: args.tokenId,
      poolAddress: args.poolAddress,
      positionId: null,
      tokenAmount: args.tokenAmount,
      ethAmount: args.ethAmount,
      threshold: args.lpTokensReceived.toString(),
      timestamp: Date.now(),
      provider: "auto",
      transactionHash: args.txHash,
    });

    // Record event
    await ctx.db.insert("liquidityEvents", {
      tokenId: args.tokenId,
      type: "addition",
      tokenAmount: args.tokenAmount,
      ethAmount: args.ethAmount,
      metadata: {
        lpTokensReceived: args.lpTokensReceived,
        poolAddress: args.poolAddress,
        txHash: args.txHash,
      },
      timestamp: Date.now(),
    });
  },
});

// Get auto-liquidity stats
export const getAutoLiquidityStats = query({
  args: {
    tokenId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("autoLiquidityConfigs")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (!config) {
      return {
        configured: false,
        enabled: false,
        stats: null,
      };
    }

    // Get recent events
    const recentEvents = await ctx.db
      .query("liquidityEvents")
      .withIndex("by_token_timestamp", (q) => q.eq("tokenId", args.tokenId))
      .order("desc")
      .take(20);

    // Get total liquidity provisions
    const provisions = await ctx.db
      .query("liquidityProvisions")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .filter((q) => q.eq(q.field("provider"), "auto"))
      .collect();

    const totalTokensInLiquidity = provisions.reduce((sum, p) => sum + p.tokenAmount, 0);
    const totalETHInLiquidity = provisions.reduce((sum, p) => sum + p.ethAmount, 0);

    // Calculate progress
    const token = await ctx.db.get(args.tokenId);
    const targetTokens = token ? (token.initialSupply * config.targetLiquidityPercent) / 10000 : 0;
    const progress = targetTokens > 0 ? (totalTokensInLiquidity / targetTokens) * 100 : 0;

    return {
      configured: true,
      enabled: config.enabled,
      stats: {
        ...config,
        totalTokensInLiquidity,
        totalETHInLiquidity,
        liquidityProgress: progress,
        provisionCount: provisions.length,
        recentEvents,
      },
    };
  },
});

// Get config (internal)
export const getConfig = internalQuery({
  args: {
    configId: v.id("autoLiquidityConfigs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.configId);
  },
});

// Manual liquidity addition (for testing/emergency)
export const manualAddLiquidity = mutation({
  args: {
    tokenId: v.id("memeCoins"),
    tokenAmount: v.number(),
    ethAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const token = await ctx.db.get(args.tokenId);
    if (!token || token.creatorId !== userId) {
      throw new Error("Not authorized");
    }

    // Record manual liquidity provision
    await ctx.db.insert("liquidityProvisions", {
      tokenId: args.tokenId,
      poolAddress: "", // Will be set when actually added
      positionId: null,
      tokenAmount: args.tokenAmount,
      ethAmount: args.ethAmount,
      threshold: "0",
      timestamp: Date.now(),
      provider: "manual",
    });

    // Record event
    await ctx.db.insert("liquidityEvents", {
      tokenId: args.tokenId,
      type: "manual_addition",
      tokenAmount: args.tokenAmount,
      ethAmount: args.ethAmount,
      timestamp: Date.now(),
    });

    return { success: true };
  },
});