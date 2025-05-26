import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { 
  calculateBuyAmount,
  calculateSellAmount,
  calculateGraduationCheck,
  PLATFORM_FEE_PERCENT,
  CREATOR_FEE_PERCENT
} from "./bondingCurve/core";
// Execute with real blockchain transaction
async function executeWithBreaker<T>(
  ctx: any,
  serviceName: string, 
  operation: () => Promise<T>
): Promise<T> {
  try {
    const startTime = Date.now();
    const result = await operation();
    const duration = Date.now() - startTime;
    console.log(`${serviceName} completed in ${duration}ms`);
    return result;
  } catch (error: any) {
    console.error(`${serviceName} error:`, error);
    throw error;
  }
}

export const buy = mutation({
  args: {
    coinId: v.id("memeCoins"),
    amountInUSD: v.number(),
    minTokensOut: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, error: "Unauthorized" };
    }

    const coin = await ctx.db.get(args.coinId);
    if (!coin || coin.status !== "deployed") {
      return { success: false, error: "Coin not found or not deployed" };
    }

    // Get bonding curve state
    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.coinId))
      .first();

    if (!bondingCurve || !bondingCurve.isActive) {
      return { success: false, error: "Bonding curve not active" };
    }

    // Calculate buy amount
    const { tokensOut, newSupply, newPrice, fees } = calculateBuyAmount(
      args.amountInUSD,
      bondingCurve.currentSupply,
      bondingCurve.reserveBalance
    );

    // Check slippage
    if (tokensOut < args.minTokensOut) {
      return { success: false, error: "Slippage too high" };
    }

    // Execute transaction with circuit breaker
    const result = await executeWithBreaker(
      ctx,
      "bonding_curve_buy",
      async () => {
        // Update bonding curve state
        await ctx.db.patch(bondingCurve._id, {
          currentSupply: newSupply,
          currentPrice: newPrice,
          reserveBalance: bondingCurve.reserveBalance + args.amountInUSD - fees.total,
          totalVolume: bondingCurve.totalVolume + args.amountInUSD,
          totalTransactions: bondingCurve.totalTransactions + 1,
        });

        // Record transaction
        await ctx.db.insert("bondingCurveTransactions", {
          bondingCurveId: bondingCurve._id,
          type: "buy",
          user: identity.tokenIdentifier,
          amountIn: args.amountInUSD,
          tokensOut,
          price: newPrice,
          timestamp: Date.now(),
        });

        // Update holder count
        const existingHolder = await ctx.db
          .query("bondingCurveHolders")
          .withIndex("by_curve_user", (q) =>
            q.eq("bondingCurveId", bondingCurve._id).eq("user", identity.tokenIdentifier)
          )
          .first();

        if (existingHolder) {
          await ctx.db.patch(existingHolder._id, {
            balance: existingHolder.balance + tokensOut,
          });
        } else {
          await ctx.db.insert("bondingCurveHolders", {
            bondingCurveId: bondingCurve._id,
            user: identity.tokenIdentifier,
            balance: tokensOut,
          });
          await ctx.db.patch(bondingCurve._id, {
            holders: bondingCurve.holders + 1,
          });
        }

        // Check for graduation
        const { shouldGraduate, marketCap } = calculateGraduationCheck(
          newSupply,
          newPrice
        );

        if (shouldGraduate) {
          await ctx.db.patch(bondingCurve._id, { isActive: false });
          await ctx.db.patch(args.coinId, { status: "graduated" as any });
          
          // Queue DEX deployment
          await ctx.scheduler.runAfter(0, "jobQueue.enqueue", {
            type: "deploy_to_dex",
            payload: {
              coinId: args.coinId,
              bondingCurveId: bondingCurve._id,
              finalPrice: newPrice,
              finalSupply: newSupply,
              reserveBalance: bondingCurve.reserveBalance + args.amountInUSD - fees.total,
            },
          });
        }

        return {
          success: true,
          tokensOut,
          amountIn: args.amountInUSD,
          newPrice,
          fees,
        };
      }
    );

    return result;
  },
});

export const sell = mutation({
  args: {
    coinId: v.id("memeCoins"),
    tokenAmount: v.number(),
    minUSDOut: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, error: "Unauthorized" };
    }

    const coin = await ctx.db.get(args.coinId);
    if (!coin || coin.status !== "deployed") {
      return { success: false, error: "Coin not found or not deployed" };
    }

    // Get bonding curve state
    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.coinId))
      .first();

    if (!bondingCurve || !bondingCurve.isActive) {
      return { success: false, error: "Bonding curve not active" };
    }

    // Check user balance
    const holder = await ctx.db
      .query("bondingCurveHolders")
      .withIndex("by_curve_user", (q) =>
        q.eq("bondingCurveId", bondingCurve._id).eq("user", identity.tokenIdentifier)
      )
      .first();

    if (!holder || holder.balance < args.tokenAmount) {
      return { success: false, error: "Insufficient balance" };
    }

    // Calculate sell amount
    const { amountOut, newSupply, newPrice, fees } = calculateSellAmount(
      args.tokenAmount,
      bondingCurve.currentSupply,
      bondingCurve.reserveBalance
    );

    // Check slippage
    if (amountOut < args.minUSDOut) {
      return { success: false, error: "Slippage too high" };
    }

    // Execute transaction with circuit breaker
    const result = await executeWithBreaker(
      ctx,
      "bonding_curve_sell",
      async () => {
        // Update bonding curve state
        await ctx.db.patch(bondingCurve._id, {
          currentSupply: newSupply,
          currentPrice: newPrice,
          reserveBalance: bondingCurve.reserveBalance - amountOut,
          totalVolume: bondingCurve.totalVolume + amountOut,
          totalTransactions: bondingCurve.totalTransactions + 1,
        });

        // Record transaction
        await ctx.db.insert("bondingCurveTransactions", {
          bondingCurveId: bondingCurve._id,
          type: "sell",
          user: identity.tokenIdentifier,
          tokensIn: args.tokenAmount,
          amountOut,
          price: newPrice,
          timestamp: Date.now(),
        });

        // Update holder balance
        const newBalance = holder.balance - args.tokenAmount;
        if (newBalance === 0) {
          await ctx.db.delete(holder._id);
          await ctx.db.patch(bondingCurve._id, {
            holders: Math.max(0, bondingCurve.holders - 1),
          });
        } else {
          await ctx.db.patch(holder._id, { balance: newBalance });
        }

        return {
          success: true,
          tokensIn: args.tokenAmount,
          amountOut,
          newPrice,
          fees,
        };
      }
    );

    return result;
  },
});

export const getCurveData = query({
  args: { coinId: v.id("memeCoins") },
  handler: async (ctx, args) => {
    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.coinId))
      .first();

    if (!bondingCurve) {
      return null;
    }

    // Get recent transactions
    const recentTransactions = await ctx.db
      .query("bondingCurveTransactions")
      .withIndex("by_curve", (q) => q.eq("bondingCurveId", bondingCurve._id))
      .order("desc")
      .take(50);

    // Calculate price history
    const priceHistory = recentTransactions
      .filter((tx) => tx.price !== undefined)
      .map((tx) => ({
        timestamp: tx.timestamp,
        price: tx.price!,
        supply: tx.type === "buy" 
          ? bondingCurve.currentSupply - (tx.tokensOut || 0)
          : bondingCurve.currentSupply + (tx.tokensIn || 0),
      }))
      .reverse();

    const { marketCap, progress } = calculateGraduationCheck(
      bondingCurve.currentSupply,
      bondingCurve.currentPrice
    );

    return {
      ...bondingCurve,
      marketCap,
      progress,
      priceHistory,
      recentTransactions: recentTransactions.slice(0, 10),
    };
  },
});

export const getUserBalance = query({
  args: { coinId: v.id("memeCoins") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { balance: 0, usdBalance: 1000 }; // Default USD balance
    }

    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.coinId))
      .first();

    if (!bondingCurve) {
      return { balance: 0, usdBalance: 1000 };
    }

    const holder = await ctx.db
      .query("bondingCurveHolders")
      .withIndex("by_curve_user", (q) =>
        q.eq("bondingCurveId", bondingCurve._id).eq("user", identity.tokenIdentifier)
      )
      .first();

    // Mock USD balance - in production, this would come from a wallet integration
    const usdBalance = 1000; // $1000 demo balance

    return {
      balance: holder?.balance || 0,
      usdBalance,
    };
  },
});