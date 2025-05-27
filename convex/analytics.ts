import { v } from "convex/values";
import { query, mutation, internalMutation, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";

// Get analytics for a specific coin
export const getCoinAnalytics = query({
  args: {
    coinId: v.id("memeCoins"),
    timeframe: v.optional(v.union(v.literal("1h"), v.literal("24h"), v.literal("7d"), v.literal("30d"))),
  },
  handler: async (ctx, args) => {
    const timeframe = args.timeframe ?? "24h";
    const now = Date.now();
    
    let startTime: number;
    switch (timeframe) {
      case "1h":
        startTime = now - 60 * 60 * 1000;
        break;
      case "24h":
        startTime = now - 24 * 60 * 60 * 1000;
        break;
      case "7d":
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case "30d":
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
    }

    const analytics = await ctx.db
      .query("analytics")
      .withIndex("by_coin", (q) => q.eq("coinId", args.coinId))
      .filter((q) => q.gte(q.field("timestamp"), startTime))
      .order("asc")
      .collect();

    // Get latest data point
    const latest = await ctx.db
      .query("analytics")
      .withIndex("by_coin", (q) => q.eq("coinId", args.coinId))
      .order("desc")
      .first();

    return {
      data: analytics,
      latest,
      timeframe,
    };
  },
});

// Get detailed analytics for the dashboard
export const getTokenAnalytics = query({
  args: {
    tokenId: v.id("memeCoins"),
    timeRange: v.optional(v.union(v.literal("24h"), v.literal("7d"), v.literal("30d"), v.literal("all"))),
  },
  handler: async (ctx, args) => {
    const timeRange = args.timeRange ?? "7d";
    const now = Date.now();
    
    let startTime: number = 0;
    switch (timeRange) {
      case "24h":
        startTime = now - 24 * 60 * 60 * 1000;
        break;
      case "7d":
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case "30d":
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case "all":
        startTime = 0;
        break;
    }

    // Get token details
    const token = await ctx.db.get(args.tokenId);
    if (!token) {
      throw new Error("Token not found");
    }

    // Get deployment details
    const deployment = await ctx.db
      .query("deployments")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .first();

    // Get analytics data
    const analyticsData = await ctx.db
      .query("analytics")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .filter((q) => q.gte(q.field("timestamp"), startTime))
      .order("asc")
      .collect();

    // Get latest analytics
    const latestAnalytics = await ctx.db
      .query("analytics")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .order("desc")
      .first();

    // Get social shares
    const socialShares = await ctx.db
      .query("socialShares")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .collect();

    // Get bonding curve for real blockchain data
    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("byTokenId", (q) => q.eq("tokenId", args.tokenId))
      .first();

    let holderDistribution: any[] = [];
    let topHolders: any[] = [];
    let tradingActivity: any[] = [];

    if (bondingCurve && bondingCurve.contractAddress && deployment) {
      try {
        // Get latest analytics for trading activity
        const latestAnalytics = await ctx.db
          .query("analytics")
          .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
          .order("desc")
          .take(20);
        
        // Mock event data structure for now
        const eventData = { events: [] as any[] };

        // Process trading events into activity
        tradingActivity = eventData.events.slice(0, 20).map((event: any) => ({
          type: event.type,
          amount: event.tokenAmount,
          price: (event.ethAmount / event.tokenAmount).toFixed(6),
          timestamp: event.timestamp * 1000,
          txHash: event.txHash,
        }));

        // Get unique holders from events
        const uniqueHolders = new Set<string>();
        eventData.events.forEach((event: any) => {
          if (event.type === "buy") {
            uniqueHolders.add(event.buyer);
          }
        });

        // For holder distribution, we'll use a simplified approach based on events
        // In production, this would query actual token balances
        const holderCount = uniqueHolders.size;
        holderDistribution = [
          { range: "0-100", count: Math.floor(holderCount * 0.6) },
          { range: "100-1K", count: Math.floor(holderCount * 0.25) },
          { range: "1K-10K", count: Math.floor(holderCount * 0.1) },
          { range: "10K-100K", count: Math.floor(holderCount * 0.04) },
          { range: "100K+", count: Math.floor(holderCount * 0.01) },
        ];

        // Top holders would require balance queries
        // For now, use the buyers from events
        const buyerTotals = new Map<string, number>();
        eventData.events.forEach((event: any) => {
          if (event.type === "buy") {
            const current = buyerTotals.get(event.buyer) || 0;
            buyerTotals.set(event.buyer, current + event.tokenAmount);
          } else if (event.type === "sell") {
            const current = buyerTotals.get(event.seller) || 0;
            buyerTotals.set(event.seller, Math.max(0, current - event.tokenAmount));
          }
        });

        // Sort by balance and get top 10
        const sortedHolders = Array.from(buyerTotals.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

        const totalBalance = Array.from(buyerTotals.values()).reduce((sum, bal) => sum + bal, 0);
        
        topHolders = sortedHolders.map(([address, balance]) => ({
          address,
          balance,
          percentage: (balance / totalBalance) * 100,
        }));
      } catch (error) {
        console.error("Failed to fetch blockchain data:", error);
        // Fallback to empty data
        holderDistribution = [];
        topHolders = [];
        tradingActivity = [];
      }
    }

    // Calculate metrics
    const priceData = analyticsData.map(a => ({
      timestamp: a.timestamp,
      price: a.price,
    }));

    const volumeData = analyticsData.map(a => ({
      timestamp: a.timestamp,
      volume: a.volume24h,
    }));

    const holdersData = analyticsData.map(a => ({
      timestamp: a.timestamp,
      holders: a.holders,
    }));

    return {
      token: {
        ...token,
        deployment,
      },
      metrics: {
        price: latestAnalytics?.price || 0,
        priceChange24h: latestAnalytics?.priceChange24h || 0,
        marketCap: latestAnalytics?.marketCap || 0,
        volume24h: latestAnalytics?.volume24h || 0,
        holders: latestAnalytics?.holders || 0,
        transactions24h: latestAnalytics?.transactions24h || 0,
        totalSupply: token.initialSupply,
        circulatingSupply: token.initialSupply * 0.7, // 70% circulating
      },
      charts: {
        price: priceData,
        volume: volumeData,
        holders: holdersData,
      },
      holderDistribution,
      topHolders,
      tradingActivity,
      socialMetrics: {
        totalShares: socialShares.length,
        platforms: {
          twitter: socialShares.filter(s => s.platform === "twitter").length,
          telegram: socialShares.filter(s => s.platform === "telegram").length,
          discord: socialShares.filter(s => s.platform === "discord").length,
        },
      },
    };
  },
});

// Get analytics for all coins (for dashboard)
export const getAllCoinsAnalytics = query({
  args: {},
  handler: async (ctx) => {
    // Get all deployed coins
    const coins = await ctx.db
      .query("memeCoins")
      .withIndex("by_status", (q) => q.eq("status", "deployed"))
      .collect();

    // Get latest analytics for each coin
    const analyticsData = await Promise.all(
      coins.map(async (coin) => {
        const analytics = await ctx.db
          .query("analytics")
          .withIndex("by_coin", (q) => q.eq("coinId", coin._id))
          .order("desc")
          .first();

        return {
          coin,
          analytics,
        };
      })
    );

    return analyticsData.filter(item => item.analytics !== null);
  },
});

// Internal function to update analytics (called by scheduled job)
export const updateAnalytics = internalMutation({
  args: {
    coinId: v.id("memeCoins"),
    price: v.number(),
    marketCap: v.number(),
    volume24h: v.number(),
    holders: v.number(),
    transactions24h: v.number(),
    priceChange24h: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("analytics", {
      coinId: args.coinId,
      price: args.price,
      marketCap: args.marketCap,
      volume24h: args.volume24h,
      holders: args.holders,
      transactions24h: args.transactions24h,
      priceChange24h: args.priceChange24h,
      timestamp: Date.now(),
    });
  },
});

// Internal function to update token analytics from blockchain
export const updateTokenAnalytics = internalMutation({
  args: {
    coinId: v.id("memeCoins"),
    price: v.number(),
    marketCap: v.number(),
    volume24h: v.number(),
    holders: v.number(),
    transactions24h: v.number(),
    priceChange24h: v.number(),
  },
  handler: async (ctx, args) => {
    // Same as updateAnalytics but explicitly for blockchain data
    await ctx.db.insert("analytics", {
      coinId: args.coinId,
      price: args.price,
      marketCap: args.marketCap,
      volume24h: args.volume24h,
      holders: args.holders,
      transactions24h: args.transactions24h,
      priceChange24h: args.priceChange24h,
      timestamp: Date.now(),
    });
  },
});

// Fetch real-time analytics data from blockchain
// Get trade history for a token
export const getTradeHistory = query({
  args: {
    tokenId: v.id("memeCoins"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    
    // Get bonding curve transactions
    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .first();
    
    if (!bondingCurve) {
      return [];
    }
    
    const transactions = await ctx.db
      .query("bondingCurveTransactions")
      .withIndex("by_curve", (q) => q.eq("bondingCurveId", bondingCurve._id))
      .order("desc")
      .take(limit);
    
    return transactions.map((tx) => ({
      type: tx.type,
      price: tx.price,
      amount: tx.type === "buy" ? tx.tokensOut : tx.tokensIn,
      value: tx.type === "buy" ? tx.amountIn : tx.amountOut,
      timestamp: tx.timestamp,
      user: tx.user,
    }));
  },
});

// Get holder distribution
export const getHolderDistribution = query({
  args: {
    tokenId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .first();
    
    if (!bondingCurve) {
      return [];
    }
    
    const holders = await ctx.db
      .query("bondingCurveHolders")
      .withIndex("by_curve", (q) => q.eq("bondingCurveId", bondingCurve._id))
      .collect();
    
    // Group holders by balance range
    const ranges = [
      { label: "0-100", min: 0, max: 100 },
      { label: "100-1K", min: 100, max: 1000 },
      { label: "1K-10K", min: 1000, max: 10000 },
      { label: "10K-100K", min: 10000, max: 100000 },
      { label: "100K+", min: 100000, max: Infinity },
    ];
    
    const distribution = ranges.map((range) => ({
      range: range.label,
      count: holders.filter((h) => h.balance >= range.min && h.balance < range.max).length,
    }));
    
    return distribution;
  },
});

// Get social metrics
export const getSocialMetrics = query({
  args: {
    tokenId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    const socialShares = await ctx.db
      .query("socialShares")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .collect();
    
    const comments = await ctx.db
      .query("tokenComments")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .collect();
    
    const reactions = await ctx.db
      .query("tokenReactions")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .collect();
    
    return {
      totalShares: socialShares.length,
      totalComments: comments.length,
      totalReactions: reactions.length,
      platforms: {
        twitter: socialShares.filter((s) => s.platform === "twitter").length,
        telegram: socialShares.filter((s) => s.platform === "telegram").length,
        discord: socialShares.filter((s) => s.platform === "discord").length,
      },
      reactionCounts: {
        rocket: reactions.filter((r) => r.reaction === "rocket").length,
        fire: reactions.filter((r) => r.reaction === "fire").length,
        gem: reactions.filter((r) => r.reaction === "gem").length,
        moon: reactions.filter((r) => r.reaction === "moon").length,
      },
    };
  },
});

export const fetchRealTimeAnalytics = internalAction({
  args: {
    coinId: v.id("memeCoins"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; data?: any; error?: string; cachedData?: any }> => {
    // Get coin details
    // @ts-ignore - Type instantiation depth issue
    const coin = await ctx.runQuery(api.memeCoins.getById, { coinId: args.coinId });
    if (!coin) {
      throw new Error("Coin not found");
    }

    // Get deployment details
    const deployment: any = await ctx.runQuery(api.memeCoins.getDeployment, { coinId: args.coinId });
    if (!deployment || !deployment.contractAddress) {
      throw new Error("Coin not deployed");
    }

    try {
      // Update analytics from blockchain is now done via cron job
      // For immediate update, we'll return the latest cached data
      const latestAnalytics = await ctx.runQuery(internal.analytics.getLatestAnalytics, {
        coinId: args.coinId,
      });
      
      const analyticsData = latestAnalytics || {
        price: 0,
        marketCap: 0,
        volume24h: 0,
        holders: 0,
        transactions24h: 0,
        priceChange24h: 0,
      };

      return {
        success: true,
        data: analyticsData
      };
    } catch (error) {
      console.error("Failed to fetch real-time analytics:", error);
      
      // In case of blockchain failures, try to use cached data
      const latestAnalytics: any = await ctx.runQuery(api.analytics.getLatestAnalytics, {
        coinId: args.coinId
      });
      
      if (latestAnalytics) {
        return {
          success: false,
          error: (error as Error).message,
          cachedData: latestAnalytics
        };
      }
      
      throw error;
    }
  }
});

// Batch update analytics for all deployed coins
export const batchUpdateAnalytics = internalAction({
  args: {},
  handler: async (ctx): Promise<{ total: number; successful: number; failed: number; results: any[] }> => {
    // Get all deployed coins
    const deployedCoins: any[] = await ctx.runQuery(api.memeCoins.getAllDeployedCoins, {});
    
    const results = [];
    
    // Process coins in batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < deployedCoins.length; i += batchSize) {
      const batch = deployedCoins.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map((coin: any) => 
          ctx.runAction(internal.analytics.fetchRealTimeAnalytics, {
            coinId: coin._id
          })
        )
      );
      
      results.push(...batchResults);
      
      // Wait between batches to respect rate limits
      if (i + batchSize < deployedCoins.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const successful = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;
    
    return {
      total: deployedCoins.length,
      successful,
      failed,
      results: results.map((r, i) => ({
        coinId: deployedCoins[i]._id,
        status: r.status,
        error: r.status === "rejected" ? r.reason : undefined
      }))
    };
  }
});

// Get latest analytics for a coin (internal query)
export const getLatestAnalytics = query({
  args: {
    coinId: v.id("memeCoins")
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("analytics")
      .withIndex("by_coin", (q) => q.eq("coinId", args.coinId))
      .order("desc")
      .first();
  }
});

// Get historical price data
export const getHistoricalPrices = internalAction({
  args: {
    coinId: v.id("memeCoins"),
    days: v.optional(v.number())
  },
  handler: async (ctx, args): Promise<any> => {
    const coin = await ctx.runQuery(api.memeCoins.getById, { coinId: args.coinId });
    if (!coin) {
      throw new Error("Coin not found");
    }

    const deployment: any = await ctx.runQuery(api.memeCoins.getDeployment, { coinId: args.coinId });
    if (!deployment || !deployment.contractAddress) {
      throw new Error("Coin not deployed");
    }

    try {
      const historicalData: any = await ctx.runAction(internal.analytics.coingecko.fetchHistoricalPrices, {
        contractAddress: deployment.contractAddress,
        blockchain: deployment.blockchain,
        days: args.days || 7
      });

      return historicalData;
    } catch (error) {
      console.error("Failed to fetch historical prices:", error);
      throw error;
    }
  }
});

// Get DEX liquidity pools for a coin
export const getDEXPools = internalAction({
  args: {
    coinId: v.id("memeCoins")
  },
  handler: async (ctx, args): Promise<any> => {
    const coin = await ctx.runQuery(api.memeCoins.getById, { coinId: args.coinId });
    if (!coin) {
      throw new Error("Coin not found");
    }

    const deployment: any = await ctx.runQuery(api.memeCoins.getDeployment, { coinId: args.coinId });
    if (!deployment || !deployment.contractAddress) {
      throw new Error("Coin not deployed");
    }

    try {
      const poolsData: any = await ctx.runAction(internal.analytics.geckoterminal.fetchTokenPools, {
        contractAddress: deployment.contractAddress,
        blockchain: deployment.blockchain
      });

      return poolsData;
    } catch (error) {
      console.error("Failed to fetch DEX pools:", error);
      throw error;
    }
  }
});

// Clear expired cache entries (to be called periodically)
export const clearAnalyticsCache = internalAction({
  args: {},
  handler: async (ctx): Promise<{ totalCleared: number; services: { coingecko: number; geckoterminal: number; blockchainExplorers: number } }> => {
    const results: any[] = await Promise.all([
      ctx.runAction(internal.analytics.coingecko.clearExpiredCache, {}),
      ctx.runAction(internal.analytics.geckoterminal.clearExpiredCache, {}),
      ctx.runAction(internal.analytics.blockchainExplorers.clearExpiredCache, {})
    ]);

    const totalCleared = results.reduce((sum: number, result: any) => sum + result.cleared, 0);

    return {
      totalCleared,
      services: {
        coingecko: results[0].cleared,
        geckoterminal: results[1].cleared,
        blockchainExplorers: results[2].cleared
      }
    };
  }
});