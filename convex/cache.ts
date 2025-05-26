import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

// Cache configuration
const CACHE_TTL = {
  tokenPrice: 60 * 1000, // 1 minute
  marketData: 5 * 60 * 1000, // 5 minutes
  trending: 10 * 60 * 1000, // 10 minutes
  userBalance: 30 * 1000, // 30 seconds
  gasPrice: 10 * 1000, // 10 seconds
} as const;

// Internal: Set cache value
export const set = internalMutation({
  args: {
    key: v.string(),
    value: v.any(),
    ttl: v.optional(v.number()), // milliseconds
  },
  handler: async (ctx, args) => {
    const expiresAt = Date.now() + (args.ttl || 60000); // Default 1 minute

    // Check if exists
    const existing = await ctx.db
      .query("cache")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        expiresAt,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("cache", {
        key: args.key,
        value: args.value,
        expiresAt,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// Internal: Get cache value
export const get = internalQuery({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const cached = await ctx.db
      .query("cache")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (!cached) return null;

    // Check if expired
    if (cached.expiresAt < Date.now()) {
      // Schedule deletion
      await ctx.scheduler.runAfter(0, "cache:invalidate", { key: args.key });
      return null;
    }

    return cached.value;
  },
});

// Internal: Invalidate cache
export const invalidate = internalMutation({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const cached = await ctx.db
      .query("cache")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (cached) {
      await ctx.db.delete(cached._id);
    }
  },
});

// Internal: Invalidate by pattern
export const invalidatePattern = internalMutation({
  args: {
    pattern: v.string(), // e.g., "token:*" or "price:ETH:*"
  },
  handler: async (ctx, args) => {
    const allCache = await ctx.db.query("cache").collect();
    
    const regex = new RegExp(
      "^" + args.pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
    );

    for (const item of allCache) {
      if (regex.test(item.key)) {
        await ctx.db.delete(item._id);
      }
    }
  },
});

// Clean up expired cache entries (run every hour)
export const cleanup = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("cache")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();

    let deleted = 0;
    for (const item of expired) {
      await ctx.db.delete(item._id);
      deleted++;
    }

    return { deleted };
  },
});

// Cached query wrapper
export function cachedQuery<Args extends Record<string, any>, Result>(
  key: (args: Args) => string,
  ttl: number,
  queryFn: (ctx: any, args: Args) => Promise<Result>
) {
  return internalQuery({
    args: v.object({}), // Define proper args based on your needs
    handler: async (ctx, args: Args) => {
      const cacheKey = key(args);
      
      // Try to get from cache
      const cached = await ctx.runQuery("cache:get", { key: cacheKey });
      if (cached !== null) {
        return cached as Result;
      }

      // Execute query
      const result = await queryFn(ctx, args);

      // Store in cache
      await ctx.scheduler.runAfter(0, "cache:set", {
        key: cacheKey,
        value: result,
        ttl,
      });

      return result;
    },
  });
}

// Example cached queries
export const getCachedTokenPrice = cachedQuery(
  (args: { tokenId: string; currency: string }) => 
    `price:${args.tokenId}:${args.currency}`,
  CACHE_TTL.tokenPrice,
  async (ctx, args) => {
    // Fetch from CoinGecko or calculate from bonding curve
    return { price: 0.001, currency: args.currency };
  }
);

export const getCachedGasPrice = cachedQuery(
  (args: { chain: string }) => `gas:${args.chain}`,
  CACHE_TTL.gasPrice,
  async (ctx, args) => {
    // Fetch current gas price from RPC
    return { gasPrice: "20", unit: "gwei" };
  }
);

// Cache statistics
export const getStats = query({
  handler: async (ctx) => {
    const allCache = await ctx.db.query("cache").collect();
    const now = Date.now();

    const stats = {
      total: allCache.length,
      expired: 0,
      active: 0,
      avgSize: 0,
      oldestKey: null as string | null,
      newestKey: null as string | null,
      byPrefix: {} as Record<string, number>,
    };

    let totalSize = 0;
    let oldestTime = Infinity;
    let newestTime = 0;

    for (const item of allCache) {
      if (item.expiresAt < now) {
        stats.expired++;
      } else {
        stats.active++;
      }

      // Estimate size (rough)
      const size = JSON.stringify(item.value).length;
      totalSize += size;

      // Track oldest/newest
      if (item.createdAt < oldestTime) {
        oldestTime = item.createdAt;
        stats.oldestKey = item.key;
      }
      if (item.createdAt > newestTime) {
        newestTime = item.createdAt;
        stats.newestKey = item.key;
      }

      // Group by prefix
      const prefix = item.key.split(":")[0];
      stats.byPrefix[prefix] = (stats.byPrefix[prefix] || 0) + 1;
    }

    stats.avgSize = allCache.length > 0 ? totalSize / allCache.length : 0;

    return stats;
  },
});