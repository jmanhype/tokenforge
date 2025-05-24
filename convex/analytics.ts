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

// Fetch real-time analytics data from multiple sources
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
      // Fetch data from multiple sources in parallel
      const [priceData, dexData, blockchainData]: [any, any, any] = await Promise.all([
        // Fetch price data from CoinGecko
        ctx.runAction(internal.analytics.coingecko.fetchTokenPriceData, {
          contractAddress: deployment.contractAddress,
          blockchain: deployment.blockchain
        }),
        
        // Fetch DEX data from GeckoTerminal
        ctx.runAction(internal.analytics.geckoterminal.fetchTokenPools, {
          contractAddress: deployment.contractAddress,
          blockchain: deployment.blockchain
        }),
        
        // Fetch blockchain analytics
        ctx.runAction(internal.analytics.blockchainExplorers.fetchTokenAnalytics, {
          contractAddress: deployment.contractAddress,
          blockchain: deployment.blockchain
        })
      ]);

      // Calculate aggregated metrics
      const totalVolume24h = priceData.volume24h + (dexData.totalVolume24h || 0);
      const holders = blockchainData.holdersCount || 0;
      const transactions24h = blockchainData.transfersCount || 0;

      // Update analytics in database
      await ctx.runMutation(internal.analytics.updateAnalytics, {
        coinId: args.coinId,
        price: priceData.price || 0,
        marketCap: priceData.marketCap || 0,
        volume24h: totalVolume24h,
        holders: holders,
        transactions24h: transactions24h,
        priceChange24h: priceData.priceChange24h || 0
      });

      return {
        success: true,
        data: {
          price: priceData.price,
          marketCap: priceData.marketCap,
          volume24h: totalVolume24h,
          holders: holders,
          transactions24h: transactions24h,
          priceChange24h: priceData.priceChange24h,
          dexPools: dexData.pools?.length || 0,
          totalLiquidity: dexData.totalLiquidity || 0
        }
      };
    } catch (error) {
      console.error("Failed to fetch real-time analytics:", error);
      
      // In case of API failures, try to use cached data
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