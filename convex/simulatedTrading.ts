import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

// Simulated buy tokens without requiring blockchain deployment
export const simulatedBuyTokens = action({
  args: {
    tokenId: v.id("memeCoins"),
    ethAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    // Get bonding curve details
    const bondingCurve = await ctx.runQuery(api.bondingCurve.getBondingCurve, {
      tokenId: args.tokenId,
    });
    
    if (!bondingCurve || !bondingCurve.isActive) {
      throw new Error("Bonding curve not active");
    }
    
    // Calculate buy amount using bonding curve formula
    const buyAmount = await ctx.runQuery(api.bondingCurve.calculateBuyAmount, {
      tokenId: args.tokenId,
      amountInUSD: args.ethAmount,
    });
    
    // Check fair launch restrictions
    const fairLaunchCheck = await ctx.runQuery(api.fairLaunch.checkPurchaseAllowed, {
      tokenId: args.tokenId,
      buyer: identity.email || identity.tokenIdentifier,
      amount: buyAmount.tokensOut,
    });
    
    if (!fairLaunchCheck.allowed) {
      throw new Error(fairLaunchCheck.reason);
    }
    
    // Record the buy transaction
    await ctx.runMutation(api.bondingCurve.recordBuyTransaction, {
      tokenId: args.tokenId,
      user: identity.tokenIdentifier,
      ethAmount: args.ethAmount,
      tokenAmount: buyAmount.tokensOut,
      price: buyAmount.newPrice,
    });
    
    // Return simulated transaction result
    return {
      success: true,
      txHash: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      expectedTokens: buyAmount.tokensOut,
      avgPrice: buyAmount.avgPrice,
      priceImpact: buyAmount.priceImpact,
    };
  },
});

// Simulated sell tokens without requiring blockchain deployment
export const simulatedSellTokens = action({
  args: {
    tokenId: v.id("memeCoins"),
    tokenAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    // Get bonding curve details
    const bondingCurve = await ctx.runQuery(api.bondingCurve.getBondingCurve, {
      tokenId: args.tokenId,
    });
    
    if (!bondingCurve || !bondingCurve.isActive) {
      throw new Error("Bonding curve not active");
    }
    
    // Get user holdings
    const userHoldings = await ctx.runQuery(api.bondingCurve.getUserHoldings, {
      coinId: args.tokenId,
      userId: userId,
    });
    
    if (!userHoldings || userHoldings.balance < args.tokenAmount) {
      throw new Error("Insufficient balance");
    }
    
    // Calculate sell return using bonding curve formula
    const sellReturn = await ctx.runQuery(api.bondingCurve.calculateSellReturn, {
      tokenId: args.tokenId,
      tokenAmount: args.tokenAmount,
    });
    
    // Record the sell transaction
    await ctx.runMutation(api.bondingCurve.recordSellTransaction, {
      tokenId: args.tokenId,
      user: identity.tokenIdentifier,
      tokenAmount: args.tokenAmount,
      ethAmount: sellReturn.amountOut,
      price: sellReturn.newPrice,
    });
    
    // Return simulated transaction result
    return {
      success: true,
      txHash: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      expectedEth: sellReturn.amountOut,
      avgPrice: sellReturn.avgPrice,
      priceImpact: sellReturn.priceImpact,
    };
  },
});

// Check if trading is simulated for a token
export const isSimulatedTrading = query({
  args: {
    tokenId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .first();
    
    if (!bondingCurve) return false;
    
    // If no contract address or starts with 'sim_', it's simulated
    return !bondingCurve.dexPoolAddress || bondingCurve.dexPoolAddress.startsWith('sim_');
  },
});