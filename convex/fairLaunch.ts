import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Fair launch configuration schema
const fairLaunchConfigSchema = v.object({
  maxBuyPerWallet: v.number(),     // Maximum tokens per wallet (in tokens)
  maxBuyPerTx: v.number(),         // Maximum tokens per transaction
  cooldownPeriod: v.number(),      // Cooldown between purchases (seconds)
  antiSnipeBlocks: v.number(),     // Number of blocks for anti-snipe
  vestingSchedule: v.optional(v.array(v.object({
    percentage: v.number(),        // Percentage to unlock
    unlockTime: v.number(),       // Time to unlock (seconds from launch)
  }))),
  enabled: v.boolean(),
});

// Initialize fair launch for a token
export const initializeFairLaunch = internalMutation({
  args: {
    tokenId: v.id("memeCoins"),
    totalSupply: v.number(),
    useDefaults: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const token = await ctx.db.get(args.tokenId);
    if (!token) throw new Error("Token not found");

    // Check if fair launch already exists
    const existing = await ctx.db
      .query("fairLaunches")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (existing) return existing._id;

    // Default configuration
    const defaultConfig = {
      maxBuyPerWallet: args.totalSupply * 0.01,      // 1% of supply
      maxBuyPerTx: args.totalSupply * 0.005,         // 0.5% of supply
      cooldownPeriod: 300,                           // 5 minutes
      antiSnipeBlocks: 3,                             // 3 blocks
      vestingSchedule: [],
      enabled: true,
    };

    const config = args.useDefaults !== false ? defaultConfig : {
      ...defaultConfig,
      enabled: false,
    };

    return await ctx.db.insert("fairLaunches", {
      tokenId: args.tokenId,
      config,
      launchTime: 0,
      tradingEnabled: false,
      totalParticipants: 0,
      totalRaised: 0,
      createdAt: Date.now(),
    });
  },
});

// Configure fair launch parameters
export const configureFairLaunch = mutation({
  args: {
    tokenId: v.id("memeCoins"),
    config: fairLaunchConfigSchema,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const token = await ctx.db.get(args.tokenId);
    if (!token || token.creatorId !== userId) {
      throw new Error("Not authorized");
    }

    const fairLaunch = await ctx.db
      .query("fairLaunches")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (!fairLaunch) {
      throw new Error("Fair launch not initialized");
    }

    if (fairLaunch.tradingEnabled) {
      throw new Error("Cannot modify after trading is enabled");
    }

    await ctx.db.patch(fairLaunch._id, {
      config: args.config,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Enable trading (launch the token)
export const enableTrading = mutation({
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

    const fairLaunch = await ctx.db
      .query("fairLaunches")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (!fairLaunch) {
      throw new Error("Fair launch not initialized");
    }

    if (fairLaunch.tradingEnabled) {
      throw new Error("Trading already enabled");
    }

    await ctx.db.patch(fairLaunch._id, {
      tradingEnabled: true,
      launchTime: Date.now(),
      launchBlock: 0, // Would be set from blockchain
    });

    // Update token status
    await ctx.db.patch(args.tokenId, {
      status: "deployed" as const,
    });

    return { success: true, launchTime: Date.now() };
  },
});

// Track purchase for fair launch rules
export const trackPurchase = internalMutation({
  args: {
    tokenId: v.id("memeCoins"),
    buyer: v.string(),
    amount: v.number(),
    ethAmount: v.number(),
    txHash: v.string(),
  },
  handler: async (ctx, args) => {
    const fairLaunch = await ctx.db
      .query("fairLaunches")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (!fairLaunch) return;

    // Check if buyer exists in participants
    let participant = await ctx.db
      .query("fairLaunchParticipants")
      .withIndex("by_launch_buyer", (q) =>
        q.eq("fairLaunchId", fairLaunch._id).eq("buyer", args.buyer)
      )
      .first();

    if (!participant) {
      // New participant
      await ctx.db.insert("fairLaunchParticipants", {
        fairLaunchId: fairLaunch._id,
        buyer: args.buyer,
        totalBought: args.amount,
        totalSpent: args.ethAmount,
        lastBuyTime: Date.now(),
        buyCount: 1,
        isBlacklisted: false,
      });

      // Update total participants
      await ctx.db.patch(fairLaunch._id, {
        totalParticipants: fairLaunch.totalParticipants + 1,
        totalRaised: fairLaunch.totalRaised + args.ethAmount,
      });
    } else {
      // Update existing participant
      await ctx.db.patch(participant._id, {
        totalBought: participant.totalBought + args.amount,
        totalSpent: participant.totalSpent + args.ethAmount,
        lastBuyTime: Date.now(),
        buyCount: participant.buyCount + 1,
      });

      await ctx.db.patch(fairLaunch._id, {
        totalRaised: fairLaunch.totalRaised + args.ethAmount,
      });
    }

    // Record transaction
    await ctx.db.insert("fairLaunchTransactions", {
      fairLaunchId: fairLaunch._id,
      buyer: args.buyer,
      tokenAmount: args.amount,
      ethAmount: args.ethAmount,
      txHash: args.txHash,
      timestamp: Date.now(),
      type: "buy",
    });
  },
});

// Check if purchase is allowed
export const checkPurchaseAllowed = query({
  args: {
    tokenId: v.id("memeCoins"),
    buyer: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const fairLaunch = await ctx.db
      .query("fairLaunches")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (!fairLaunch || !fairLaunch.config.enabled) {
      return { allowed: true, reason: null };
    }

    if (!fairLaunch.tradingEnabled) {
      return { allowed: false, reason: "Trading not enabled yet" };
    }

    const participant = await ctx.db
      .query("fairLaunchParticipants")
      .withIndex("by_launch_buyer", (q) =>
        q.eq("fairLaunchId", fairLaunch._id).eq("buyer", args.buyer)
      )
      .first();

    // Check blacklist
    if (participant?.isBlacklisted) {
      return { allowed: false, reason: "Address is blacklisted" };
    }

    // Check max buy per transaction
    if (args.amount > fairLaunch.config.maxBuyPerTx) {
      return { 
        allowed: false, 
        reason: `Exceeds max buy per transaction (${fairLaunch.config.maxBuyPerTx} tokens)` 
      };
    }

    // Check max buy per wallet
    const totalBought = participant?.totalBought || 0;
    if (totalBought + args.amount > fairLaunch.config.maxBuyPerWallet) {
      return { 
        allowed: false, 
        reason: `Exceeds max buy per wallet (${fairLaunch.config.maxBuyPerWallet} tokens)` 
      };
    }

    // Check cooldown period
    if (participant && participant.lastBuyTime) {
      const cooldownEnd = participant.lastBuyTime + (fairLaunch.config.cooldownPeriod * 1000);
      if (Date.now() < cooldownEnd) {
        const remainingSeconds = Math.ceil((cooldownEnd - Date.now()) / 1000);
        return { 
          allowed: false, 
          reason: `Cooldown period active (${remainingSeconds}s remaining)` 
        };
      }
    }

    // Check anti-snipe (simplified - in real implementation would check block numbers)
    const antiSnipeEnd = fairLaunch.launchTime + (fairLaunch.config.antiSnipeBlocks * 15000); // ~15s per block
    if (Date.now() < antiSnipeEnd) {
      return { 
        allowed: false, 
        reason: "Anti-snipe protection active" 
      };
    }

    return { allowed: true, reason: null };
  },
});

// Get fair launch stats
export const getFairLaunchStats = query({
  args: {
    tokenId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    const fairLaunch = await ctx.db
      .query("fairLaunches")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (!fairLaunch) return null;

    // Get top holders
    const participants = await ctx.db
      .query("fairLaunchParticipants")
      .withIndex("by_launch_buyer", (q) => q.eq("fairLaunchId", fairLaunch._id))
      .order("desc")
      .take(10);

    // Get recent transactions
    const recentTxs = await ctx.db
      .query("fairLaunchTransactions")
      .withIndex("by_launch_timestamp", (q) => q.eq("fairLaunchId", fairLaunch._id))
      .order("desc")
      .take(20);

    return {
      ...fairLaunch,
      topHolders: participants.map(p => ({
        address: p.buyer.slice(0, 6) + "..." + p.buyer.slice(-4),
        amount: p.totalBought,
        percentage: (p.totalBought / fairLaunch.config.maxBuyPerWallet) * 100,
      })),
      recentTransactions: recentTxs,
      timeUntilFullLaunch: fairLaunch.launchTime > 0 
        ? Math.max(0, (fairLaunch.launchTime + fairLaunch.config.antiSnipeBlocks * 15000) - Date.now())
        : null,
    };
  },
});

// Blacklist/whitelist management
export const setBlacklist = mutation({
  args: {
    tokenId: v.id("memeCoins"),
    address: v.string(),
    blacklisted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const token = await ctx.db.get(args.tokenId);
    if (!token || token.creatorId !== userId) {
      throw new Error("Not authorized");
    }

    const fairLaunch = await ctx.db
      .query("fairLaunches")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (!fairLaunch) {
      throw new Error("Fair launch not found");
    }

    const participant = await ctx.db
      .query("fairLaunchParticipants")
      .withIndex("by_launch_buyer", (q) =>
        q.eq("fairLaunchId", fairLaunch._id).eq("buyer", args.address)
      )
      .first();

    if (participant) {
      await ctx.db.patch(participant._id, {
        isBlacklisted: args.blacklisted,
      });
    } else if (args.blacklisted) {
      // Pre-blacklist address
      await ctx.db.insert("fairLaunchParticipants", {
        fairLaunchId: fairLaunch._id,
        buyer: args.address,
        totalBought: 0,
        totalSpent: 0,
        lastBuyTime: 0,
        buyCount: 0,
        isBlacklisted: true,
      });
    }

    return { success: true };
  },
});