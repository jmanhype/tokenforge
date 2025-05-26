import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Reaction type to emoji mapping
export const REACTION_EMOJIS = {
  rocket: "🚀",
  fire: "🔥",
  diamond: "💎",
  trash: "🗑️",
  moon: "🌙",
  bear: "🐻",
} as const;

// Add or update a reaction
export const addReaction = mutation({
  args: {
    tokenId: v.id("memeCoins"),
    type: v.union(
      v.literal("rocket"),
      v.literal("fire"),
      v.literal("diamond"),
      v.literal("trash"),
      v.literal("moon"),
      v.literal("bear")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if user already has a reaction
    const existingReaction = await ctx.db
      .query("reactions")
      .withIndex("by_token_user", (q) =>
        q.eq("tokenId", args.tokenId).eq("userId", userId)
      )
      .first();

    if (existingReaction) {
      if (existingReaction.type === args.type) {
        // Remove reaction if clicking the same one
        await ctx.db.delete(existingReaction._id);
        return { action: "removed", type: args.type };
      } else {
        // Update to new reaction
        await ctx.db.patch(existingReaction._id, {
          type: args.type,
          timestamp: Date.now(),
        });
        return { action: "updated", type: args.type };
      }
    } else {
      // Add new reaction
      await ctx.db.insert("reactions", {
        tokenId: args.tokenId,
        userId,
        type: args.type,
        timestamp: Date.now(),
      });

      // Add to activity feed
      await ctx.db.insert("activityFeed", {
        userId,
        type: "reaction_added",
        tokenId: args.tokenId,
        data: { reaction: args.type },
        timestamp: Date.now(),
      });

      return { action: "added", type: args.type };
    }
  },
});

// Get reactions for a token
export const getReactions = query({
  args: {
    tokenId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .collect();

    // Count reactions by type
    const counts: Record<string, number> = {
      rocket: 0,
      fire: 0,
      diamond: 0,
      trash: 0,
      moon: 0,
      bear: 0,
    };

    reactions.forEach((reaction) => {
      counts[reaction.type]++;
    });

    // Get current user's reaction
    const userId = await getAuthUserId(ctx);
    let userReaction = null;

    if (userId) {
      const reaction = reactions.find((r) => r.userId === userId);
      userReaction = reaction?.type || null;
    }

    return {
      counts,
      total: reactions.length,
      userReaction,
    };
  },
});

// Get top reacting users for a token
export const getTopReactors = query({
  args: {
    tokenId: v.id("memeCoins"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .order("desc")
      .take(limit * 2); // Get more to ensure we have enough unique users

    // Get unique users and their reactions
    const userReactions = new Map<string, { type: string; timestamp: number }>();
    
    for (const reaction of reactions) {
      if (!userReactions.has(reaction.userId)) {
        userReactions.set(reaction.userId, {
          type: reaction.type,
          timestamp: reaction.timestamp,
        });
      }
    }

    // Get user details
    const topReactors = await Promise.all(
      Array.from(userReactions.entries())
        .slice(0, limit)
        .map(async ([userId, reactionData]) => {
          const user = await ctx.db.get(userId as any);
          return {
            userId,
            userName: user?.name || user?.email || "Anonymous",
            userImage: user?.image,
            reaction: reactionData.type,
            timestamp: reactionData.timestamp,
          };
        })
    );

    return topReactors;
  },
});

// Get reaction statistics across all tokens
export const getReactionStats = query({
  args: {},
  handler: async (ctx) => {
    const reactions = await ctx.db.query("reactions").collect();

    // Count total reactions by type
    const typeCount: Record<string, number> = {
      rocket: 0,
      fire: 0,
      diamond: 0,
      trash: 0,
      moon: 0,
      bear: 0,
    };

    reactions.forEach((reaction) => {
      typeCount[reaction.type]++;
    });

    // Get most reacted tokens
    const tokenReactions = new Map<string, number>();
    reactions.forEach((reaction) => {
      const count = tokenReactions.get(reaction.tokenId) || 0;
      tokenReactions.set(reaction.tokenId, count + 1);
    });

    const sortedTokens = Array.from(tokenReactions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Get token details for top tokens
    const topTokens = await Promise.all(
      sortedTokens.map(async ([tokenId, count]) => {
        const token = await ctx.db.get(tokenId as any);
        return {
          tokenId,
          tokenName: token?.name || "Unknown",
          tokenSymbol: token?.symbol || "???",
          reactionCount: count,
        };
      })
    );

    return {
      totalReactions: reactions.length,
      reactionsByType: typeCount,
      topTokens,
    };
  },
});

// Get user's reaction history
export const getUserReactions = query({
  args: {
    userId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId || (await getAuthUserId(ctx));
    if (!userId) throw new Error("Not authenticated");

    const limit = args.limit || 20;

    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    // Get token details for each reaction
    const reactionsWithTokens = await Promise.all(
      reactions.map(async (reaction) => {
        const token = await ctx.db.get(reaction.tokenId);
        return {
          ...reaction,
          tokenName: token?.name || "Unknown",
          tokenSymbol: token?.symbol || "???",
        };
      })
    );

    return reactionsWithTokens;
  },
});