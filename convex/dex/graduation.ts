import { v } from "convex/values";
import { action, mutation, internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";

// Graduation thresholds for moving to DEX
const GRADUATION_THRESHOLDS = {
  marketCap: 100000, // $100k market cap
  liquidity: 50000,  // $50k in bonding curve
  holders: 100,      // 100 unique holders
  volume24h: 25000,  // $25k daily volume
};

// Check if a token is ready for DEX graduation
export const checkGraduationEligibility = action({
  args: { tokenId: v.id("memeCoins") },
  handler: async (ctx, args) => {
    const token = await ctx.db.get(args.tokenId);
    if (!token) throw new Error("Token not found");
    
    // Get token analytics
    const analytics = await ctx.db
      .query("analytics")
      .withIndex("byCoinId", (q) => q.eq("coinId", args.tokenId))
      .order("desc")
      .first();
    
    if (!analytics) {
      return {
        eligible: false,
        reason: "No analytics data available",
        progress: {
          marketCap: 0,
          liquidity: 0,
          holders: 0,
          volume24h: 0,
        },
      };
    }
    
    // Get bonding curve data
    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("byTokenId", (q) => q.eq("tokenId", args.tokenId))
      .first();
    
    if (!bondingCurve) {
      return {
        eligible: false,
        reason: "No bonding curve data",
        progress: {
          marketCap: 0,
          liquidity: 0,
          holders: 0,
          volume24h: 0,
        },
      };
    }
    
    // Calculate current metrics
    const marketCap = analytics.currentPrice * bondingCurve.currentSupply;
    const liquidity = bondingCurve.reserveBalance;
    const holders = bondingCurve.uniqueHolders || 0;
    const volume24h = analytics.volume24h;
    
    // Check all criteria
    const criteria = {
      marketCap: marketCap >= GRADUATION_THRESHOLDS.marketCap,
      liquidity: liquidity >= GRADUATION_THRESHOLDS.liquidity,
      holders: holders >= GRADUATION_THRESHOLDS.holders,
      volume24h: volume24h >= GRADUATION_THRESHOLDS.volume24h,
    };
    
    const eligible = Object.values(criteria).every(Boolean);
    
    return {
      eligible,
      reason: eligible 
        ? "Token meets all graduation criteria" 
        : `Not all criteria met: ${Object.entries(criteria)
            .filter(([_, met]) => !met)
            .map(([criterion]) => criterion)
            .join(", ")}`,
      progress: {
        marketCap: (marketCap / GRADUATION_THRESHOLDS.marketCap) * 100,
        liquidity: (liquidity / GRADUATION_THRESHOLDS.liquidity) * 100,
        holders: (holders / GRADUATION_THRESHOLDS.holders) * 100,
        volume24h: (volume24h / GRADUATION_THRESHOLDS.volume24h) * 100,
      },
      currentMetrics: {
        marketCap,
        liquidity,
        holders,
        volume24h,
      },
      thresholds: GRADUATION_THRESHOLDS,
    };
  },
});

// Graduate a token from bonding curve to DEX
export const graduateToken = action({
  args: { 
    tokenId: v.id("memeCoins"),
    targetDex: v.union(v.literal("uniswap"), v.literal("pancakeswap")),
    liquidityPercentage: v.optional(v.number()), // Percentage of reserve to use for initial liquidity
  },
  handler: async (ctx, args) => {
    // Check if user is authorized (token creator or admin)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const token = await ctx.db.get(args.tokenId);
    if (!token) throw new Error("Token not found");
    
    if (token.creatorId !== identity.subject) {
      throw new Error("Only token creator can graduate token");
    }
    
    // Check graduation eligibility
    const eligibility = await checkGraduationEligibility(ctx, { tokenId: args.tokenId });
    if (!eligibility.eligible) {
      throw new Error(`Token not eligible for graduation: ${eligibility.reason}`);
    }
    
    // Get bonding curve data
    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("byTokenId", (q) => q.eq("tokenId", args.tokenId))
      .first();
    
    if (!bondingCurve) throw new Error("No bonding curve data");
    
    // Calculate liquidity amounts
    const liquidityPercentage = args.liquidityPercentage || 80; // Default 80% of reserves
    const ethLiquidity = (bondingCurve.reserveBalance * liquidityPercentage) / 100;
    const tokenLiquidity = bondingCurve.currentSupply * 0.3; // 30% of supply for liquidity
    
    // Create graduation record
    const graduationId = await ctx.db.insert("dexGraduations", {
      tokenId: args.tokenId,
      targetDex: args.targetDex,
      status: "pending",
      liquidityPercentage,
      ethLiquidity,
      tokenLiquidity,
      initiatedAt: Date.now(),
      initiatedBy: identity.subject,
    });
    
    // Schedule the graduation process
    await ctx.scheduler.runAfter(0, internal.dex.graduation.executeGraduation, {
      graduationId,
    });
    
    return {
      graduationId,
      message: "Token graduation initiated",
      estimatedTime: "2-5 minutes",
    };
  },
});

// Execute the actual graduation (internal action)
export const executeGraduation = internalAction({
  args: { graduationId: v.id("dexGraduations") },
  handler: async (ctx, args) => {
    // Get graduation details
    const graduation = await ctx.runQuery(internal.dex.graduation.getGraduation, {
      graduationId: args.graduationId,
    });
    
    if (!graduation) throw new Error("Graduation not found");
    if (graduation.status !== "pending") {
      throw new Error(`Graduation already ${graduation.status}`);
    }
    
    const token = await ctx.runQuery(internal.memeCoins.getToken, {
      tokenId: graduation.tokenId,
    });
    
    if (!token) throw new Error("Token not found");
    
    try {
      // Update status to processing
      await ctx.runMutation(internal.dex.graduation.updateGraduationStatus, {
        graduationId: args.graduationId,
        status: "processing",
      });
      
      // Determine which DEX integration to use
      let result;
      if (graduation.targetDex === "uniswap") {
        result = await ctx.runAction(internal.dex.uniswapV3.createUniswapV3Pool, {
          tokenAddress: token.contractAddress!,
          tokenName: token.name,
          tokenSymbol: token.symbol,
          tokenDecimals: 18,
          initialTokenAmount: graduation.tokenLiquidity,
          initialEthAmount: graduation.ethLiquidity / 1e18, // Convert from wei
          blockchain: token.blockchain as "ethereum" | "bsc",
          testnet: true, // Use testnet for now
        });
      } else {
        result = await ctx.runAction(internal.dex.pancakeswapV3.createPancakeSwapV3Pool, {
          tokenAddress: token.contractAddress!,
          tokenName: token.name,
          tokenSymbol: token.symbol,
          tokenDecimals: 18,
          initialTokenAmount: graduation.tokenLiquidity,
          initialBnbAmount: graduation.ethLiquidity / 1e18,
          testnet: true,
        });
      }
      
      // Update graduation record with success
      await ctx.runMutation(internal.dex.graduation.completeGraduation, {
        graduationId: args.graduationId,
        poolAddress: result.poolAddress,
        transactionHash: result.transactionHash,
      });
      
      // Update token status
      await ctx.runMutation(internal.memeCoins.updateTokenStatus, {
        tokenId: graduation.tokenId,
        dexListed: true,
        dexPool: result.poolAddress,
        bondingCurveActive: false,
      });
      
      // Notify token holders
      await ctx.runAction(internal.notifications.notifyGraduation, {
        tokenId: graduation.tokenId,
        dex: graduation.targetDex,
        poolAddress: result.poolAddress,
      });
      
    } catch (error) {
      // Update status to failed
      await ctx.runMutation(internal.dex.graduation.updateGraduationStatus, {
        graduationId: args.graduationId,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      
      throw error;
    }
  },
});

// Internal query for graduation process
export const getGraduation = internalQuery({
  args: { graduationId: v.id("dexGraduations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.graduationId);
  },
});

export const updateGraduationStatus = internalMutation({
  args: {
    graduationId: v.id("dexGraduations"),
    status: v.union(v.literal("pending"), v.literal("processing"), v.literal("completed"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.graduationId, {
      status: args.status,
      ...(args.error && { error: args.error }),
      updatedAt: Date.now(),
    });
  },
});

export const completeGraduation = internalMutation({
  args: {
    graduationId: v.id("dexGraduations"),
    poolAddress: v.string(),
    transactionHash: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.graduationId, {
      status: "completed",
      poolAddress: args.poolAddress,
      transactionHash: args.transactionHash,
      completedAt: Date.now(),
    });
  },
});