import { v } from "convex/values";
import { internalMutation, query, internalQuery } from "../_generated/server";
import { api, internal } from "../_generated/api";

// Calculate trending score for a token
export const calculateTrendingScore = internalQuery({
  args: {
    tokenId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    // Get analytics data
    const analytics = await ctx.db
      .query("analytics")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .order("desc")
      .first();

    // Get bonding curve data
    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .first();

    // Get social engagement (last 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    const recentComments = await ctx.db
      .query("comments")
      .withIndex("by_token_timestamp", (q) =>
        q.eq("tokenId", args.tokenId).gte("timestamp", oneDayAgo)
      )
      .collect();

    const recentReactions = await ctx.db
      .query("reactions")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .filter((q) => q.gte(q.field("timestamp"), oneDayAgo))
      .collect();

    // Calculate scores (0-100 scale)
    let volumeScore = 0;
    let socialScore = 0;
    let priceScore = 0;

    // Volume score (40% weight)
    if (analytics && bondingCurve) {
      const volume24h = analytics.volume24h || bondingCurve.totalVolume || 0;
      // Normalize volume (assuming $100k is max for scoring)
      volumeScore = Math.min((volume24h / 100000) * 100, 100);
    }

    // Social score (40% weight)
    const commentScore = Math.min(recentComments.length * 5, 50); // Max 50 points from comments
    const reactionScore = Math.min(recentReactions.length * 2.5, 50); // Max 50 points from reactions
    socialScore = commentScore + reactionScore;

    // Price score (20% weight) - based on 24h price change
    if (analytics) {
      const priceChange = analytics.priceChange24h || 0;
      // Positive changes boost score, negative changes reduce it
      priceScore = Math.max(0, Math.min(50 + priceChange, 100));
    }

    // Calculate weighted total score
    const totalScore = (volumeScore * 0.4) + (socialScore * 0.4) + (priceScore * 0.2);

    return {
      score: totalScore,
      volumeScore,
      socialScore,
      priceScore,
      metrics: {
        volume24h: analytics?.volume24h || 0,
        priceChange24h: analytics?.priceChange24h || 0,
        commentCount: recentComments.length,
        reactionCount: recentReactions.length,
        holders: analytics?.holders || bondingCurve?.holders || 0,
      },
    };
  },
});

// Update trending scores for all tokens
export const updateTrendingScores = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all deployed tokens
    const tokens = await ctx.db
      .query("memeCoins")
      .withIndex("by_status", (q) => q.eq("status", "deployed"))
      .collect();

    const scores = [];

    // Calculate score for each token
    for (const token of tokens) {
      const scoreData = await ctx.runQuery(
        internal.social.trending.calculateTrendingScore,
        { tokenId: token._id }
      );

      scores.push({
        tokenId: token._id,
        ...scoreData,
      });
    }

    // Sort by score
    scores.sort((a, b) => b.score - a.score);

    // Update trending table
    for (let i = 0; i < scores.length; i++) {
      const scoreData = scores[i];
      
      // Check if trending entry exists
      const existing = await ctx.db
        .query("trending")
        .withIndex("by_token", (q) => q.eq("tokenId", scoreData.tokenId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          score: scoreData.score,
          volumeScore: scoreData.volumeScore,
          socialScore: scoreData.socialScore,
          priceScore: scoreData.priceScore,
          lastUpdated: Date.now(),
          rank: i + 1,
        });
      } else {
        await ctx.db.insert("trending", {
          tokenId: scoreData.tokenId,
          score: scoreData.score,
          volumeScore: scoreData.volumeScore,
          socialScore: scoreData.socialScore,
          priceScore: scoreData.priceScore,
          lastUpdated: Date.now(),
          rank: i + 1,
        });
      }
    }

    return { updated: scores.length };
  },
});

// Get trending tokens
export const getTrendingTokens = query({
  args: {
    limit: v.optional(v.number()),
    timeframe: v.optional(v.union(v.literal("24h"), v.literal("7d"), v.literal("30d"))),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    // Get trending entries
    const trending = await ctx.db
      .query("trending")
      .withIndex("by_rank", (q) => q.lte("rank", limit))
      .order("asc")
      .collect();

    // Get token details and additional data
    const trendingWithDetails = await Promise.all(
      trending.map(async (entry) => {
        const token = await ctx.db.get(entry.tokenId);
        if (!token) return null;

        // Get analytics
        const analytics = await ctx.db
          .query("analytics")
          .withIndex("by_coin", (q) => q.eq("coinId", entry.tokenId))
          .order("desc")
          .first();

        // Get bonding curve
        const bondingCurve = await ctx.db
          .query("bondingCurves")
          .withIndex("by_coin", (q) => q.eq("coinId", entry.tokenId))
          .first();

        // Get deployment
        const deployment = await ctx.db
          .query("deployments")
          .withIndex("by_coin", (q) => q.eq("coinId", entry.tokenId))
          .first();

        return {
          ...entry,
          token: {
            _id: token._id,
            name: token.name,
            symbol: token.symbol,
            description: token.description,
            logoUrl: token.logoUrl,
            createdAt: token._creationTime,
          },
          analytics: analytics ? {
            price: analytics.price,
            marketCap: analytics.marketCap,
            volume24h: analytics.volume24h,
            priceChange24h: analytics.priceChange24h,
            holders: analytics.holders,
          } : null,
          bondingCurve: bondingCurve ? {
            isActive: bondingCurve.isActive,
            progress: (bondingCurve.currentSupply * bondingCurve.currentPrice / 100000) * 100,
          } : null,
          blockchain: deployment?.blockchain,
        };
      })
    );

    return trendingWithDetails.filter(t => t !== null);
  },
});

// Get trending breakdown for a specific token
export const getTokenTrendingDetails = query({
  args: {
    tokenId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    // Get trending entry
    const trending = await ctx.db
      .query("trending")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (!trending) {
      // Calculate on the fly if not in trending table
      const scoreData = await ctx.runQuery(
        internal.social.trending.calculateTrendingScore,
        { tokenId: args.tokenId }
      );
      return {
        ...scoreData,
        rank: null,
        lastUpdated: Date.now(),
      };
    }

    // Get detailed metrics
    const scoreData = await ctx.runQuery(
      internal.social.trending.calculateTrendingScore,
      { tokenId: args.tokenId }
    );

    return {
      ...trending,
      metrics: scoreData.metrics,
    };
  },
});

// Get trending changes (gainers/losers)
export const getTrendingChanges = query({
  args: {
    type: v.union(v.literal("gainers"), v.literal("losers")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 5;

    // Get all trending entries from the last update
    const trending = await ctx.db.query("trending").collect();

    // Calculate score changes (simplified - in production, store historical scores)
    const changes = trending.map(entry => ({
      ...entry,
      scoreChange: Math.random() * 20 - 10, // Mock change for now
    }));

    // Sort by change
    changes.sort((a, b) => {
      if (args.type === "gainers") {
        return b.scoreChange - a.scoreChange;
      } else {
        return a.scoreChange - b.scoreChange;
      }
    });

    // Get top movers with token details
    const topMovers = await Promise.all(
      changes.slice(0, limit).map(async (entry) => {
        const token = await ctx.db.get(entry.tokenId);
        return {
          tokenId: entry.tokenId,
          tokenName: token?.name || "Unknown",
          tokenSymbol: token?.symbol || "???",
          rank: entry.rank,
          score: entry.score,
          scoreChange: entry.scoreChange,
          scoreChangePercent: (entry.scoreChange / (entry.score - entry.scoreChange)) * 100,
        };
      })
    );

    return topMovers;
  },
});