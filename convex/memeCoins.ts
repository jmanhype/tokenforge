import { v } from "convex/values";
import { query, mutation, action, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Get all meme coins with pagination
export const listMemeCoins = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    
    const coins = await ctx.db
      .query("memeCoins")
      .order("desc")
      .take(limit);

    // Get deployment info for each coin
    const coinsWithDeployments = await Promise.all(
      coins.map(async (coin) => {
        const deployment = await ctx.db
          .query("deployments")
          .withIndex("by_coin", (q) => q.eq("coinId", coin._id))
          .first();
        
        const creator = await ctx.db.get(coin.creatorId);
        
        // Get bonding curve info if exists
        const bondingCurve = await ctx.db
          .query("bondingCurves")
          .withIndex("by_coin", (q) => q.eq("coinId", coin._id))
          .first();
        
        return {
          ...coin,
          deployment,
          creatorName: creator?.name || creator?.email || "Anonymous",
          bondingCurve: bondingCurve ? {
            isActive: bondingCurve.isActive,
            currentPrice: bondingCurve.currentPrice,
            marketCap: bondingCurve.currentSupply * bondingCurve.currentPrice,
            progress: (bondingCurve.currentSupply * bondingCurve.currentPrice / 100000) * 100,
            totalVolume: bondingCurve.totalVolume,
            holders: bondingCurve.holders,
          } : undefined,
        };
      })
    );

    return coinsWithDeployments;
  },
});

// Get user's meme coins
export const getUserMemeCoins = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const coins = await ctx.db
      .query("memeCoins")
      .withIndex("by_creator", (q) => q.eq("creatorId", userId))
      .order("desc")
      .collect();

    // Get deployment info for each coin
    const coinsWithDeployments = await Promise.all(
      coins.map(async (coin) => {
        const deployment = await ctx.db
          .query("deployments")
          .withIndex("by_coin", (q) => q.eq("coinId", coin._id))
          .first();
        
        // Get bonding curve info if exists
        const bondingCurve = await ctx.db
          .query("bondingCurves")
          .withIndex("by_coin", (q) => q.eq("coinId", coin._id))
          .first();
        
        return {
          ...coin,
          deployment,
          bondingCurve: bondingCurve ? {
            isActive: bondingCurve.isActive,
            currentPrice: bondingCurve.currentPrice,
            marketCap: bondingCurve.currentSupply * bondingCurve.currentPrice,
            progress: (bondingCurve.currentSupply * bondingCurve.currentPrice / 100000) * 100,
            totalVolume: bondingCurve.totalVolume,
            holders: bondingCurve.holders,
          } : undefined,
        };
      })
    );

    return coinsWithDeployments;
  },
});

// Check rate limit for coin creation
export const checkRateLimit = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Count coins created in the last 24 hours
    const recentCoins = await ctx.db
      .query("memeCoins")
      .withIndex("by_creator", (q) => q.eq("creatorId", userId))
      .filter((q) => q.gt(q.field("_creationTime"), oneDayAgo))
      .collect();

    const canCreate = recentCoins.length < 3;
    const remaining = Math.max(0, 3 - recentCoins.length);

    return {
      canCreate,
      remaining,
      used: recentCoins.length,
      resetAt: oneDayAgo + 24 * 60 * 60 * 1000,
    };
  },
});

// Create a new meme coin
export const createMemeCoin = mutation({
  args: {
    name: v.string(),
    symbol: v.string(),
    initialSupply: v.number(),
    canMint: v.boolean(),
    canBurn: v.boolean(),
    postQuantumSecurity: v.boolean(),
    description: v.optional(v.string()),
    blockchain: v.union(v.literal("ethereum"), v.literal("solana"), v.literal("bsc")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Validate inputs
    if (args.name.length < 2 || args.name.length > 50) {
      throw new Error("Coin name must be between 2 and 50 characters");
    }
    
    if (args.symbol.length < 2 || args.symbol.length > 10) {
      throw new Error("Symbol must be between 2 and 10 characters");
    }
    
    if (args.initialSupply <= 0 || args.initialSupply > 1e15) {
      throw new Error("Initial supply must be between 1 and 1,000,000,000,000,000");
    }

    // Check rate limit
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    const recentCoins = await ctx.db
      .query("memeCoins")
      .withIndex("by_creator", (q) => q.eq("creatorId", userId))
      .filter((q) => q.gt(q.field("_creationTime"), oneDayAgo))
      .collect();

    if (recentCoins.length >= 3) {
      throw new Error("Rate limit exceeded. You can only create 3 coins per day.");
    }

    // Check for duplicate symbol
    const existingCoin = await ctx.db
      .query("memeCoins")
      .filter((q) => q.eq(q.field("symbol"), args.symbol.toUpperCase()))
      .first();

    if (existingCoin) {
      throw new Error("A coin with this symbol already exists");
    }

    // Create the meme coin
    const coinId = await ctx.db.insert("memeCoins", {
      name: args.name,
      symbol: args.symbol.toUpperCase(),
      initialSupply: args.initialSupply,
      canMint: args.canMint,
      canBurn: args.canBurn,
      postQuantumSecurity: args.postQuantumSecurity,
      creatorId: userId,
      description: args.description,
      status: "pending",
    });

    // Initialize bonding curve for the token
    await ctx.db.insert("bondingCurves", {
      coinId,
      currentSupply: 0,
      currentPrice: 0.00001, // Starting price
      reserveBalance: 0,
      totalVolume: 0,
      totalTransactions: 0,
      holders: 0,
      isActive: true,
      createdAt: Date.now(),
    });

    // Queue deployment job instead of direct scheduling
    const jobId = await ctx.runMutation(internal.jobQueue.enqueue, {
      type: "deploy_token",
      payload: {
        coinId,
        blockchain: args.blockchain,
        useTestnet: process.env.VITE_USE_TESTNET === 'true',
      },
      maxAttempts: 3,
    });

    // Schedule social media sharing
    await ctx.scheduler.runAfter(5000, internal.social.shareOnLaunch, {
      coinId,
    });

    return coinId;
  },
});

// Get coin details
export const getCoinDetails = query({
  args: {
    coinId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    const coin = await ctx.db.get(args.coinId);
    if (!coin) {
      throw new Error("Coin not found");
    }

    const deployment = await ctx.db
      .query("deployments")
      .withIndex("by_coin", (q) => q.eq("coinId", args.coinId))
      .first();

    const creator = await ctx.db.get(coin.creatorId);

    // Get latest analytics
    const analytics = await ctx.db
      .query("analytics")
      .withIndex("by_coin", (q) => q.eq("coinId", args.coinId))
      .order("desc")
      .first();

    return {
      ...coin,
      deployment,
      analytics,
      creatorName: creator?.name || creator?.email || "Anonymous",
    };
  },
});

// Get coin by ID (for trading page)
export const getCoin = query({
  args: { coinId: v.id("memeCoins") },
  handler: async (ctx, args) => {
    const coin = await ctx.db.get(args.coinId);
    if (!coin) return null;
    
    // Get deployment info
    const deployment = await ctx.db
      .query("deployments")
      .withIndex("by_coin", (q) => q.eq("coinId", args.coinId))
      .first();
    
    // Get bonding curve info if exists
    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.coinId))
      .first();
    
    return {
      ...coin,
      deployment,
      bondingCurve: bondingCurve ? {
        isActive: bondingCurve.isActive,
        currentPrice: bondingCurve.currentPrice,
        marketCap: bondingCurve.currentSupply * bondingCurve.currentPrice,
        progress: (bondingCurve.currentSupply * bondingCurve.currentPrice / 100000) * 100,
        totalVolume: bondingCurve.totalVolume,
        holders: bondingCurve.holders,
      } : undefined,
    };
  },
});

// Internal query to get coin by ID
export const getById = query({
  args: {
    coinId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.coinId);
  },
});

// Internal query to get deployment by coin ID
export const getDeployment = query({
  args: {
    coinId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("deployments")
      .withIndex("by_coin", (q) => q.eq("coinId", args.coinId))
      .first();
  },
});

// Internal query to get all deployed coins
export const getAllDeployedCoins = query({
  args: {},
  handler: async (ctx) => {
    const deployedCoins = await ctx.db
      .query("memeCoins")
      .withIndex("by_status", (q) => q.eq("status", "deployed"))
      .collect();
    
    // Only return coins that have actual deployments
    const coinsWithDeployments = await Promise.all(
      deployedCoins.map(async (coin) => {
        const deployment = await ctx.db
          .query("deployments")
          .withIndex("by_coin", (q) => q.eq("coinId", coin._id))
          .first();
        
        if (deployment && deployment.contractAddress) {
          return coin;
        }
        return null;
      })
    );
    
    return coinsWithDeployments.filter(coin => coin !== null);
  },
});

// Internal query to get coin by ID
export const get = internalQuery({
  args: {
    id: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    const coin = await ctx.db.get(args.id);
    if (!coin) {
      throw new Error("Coin not found");
    }
    return coin;
  },
});