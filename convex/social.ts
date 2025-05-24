import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { postToTwitter } from "./social/twitter";
import { postToDiscord } from "./social/discord";
import { postToTelegram } from "./social/telegram";
import { CoinData } from "./social/formatter";

// Share coin launch on social media
export const shareOnLaunch = internalAction({
  args: {
    coinId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    try {
      // Get coin details
      const coin = await ctx.runQuery(internal.social.getCoinForSharing, {
        coinId: args.coinId,
      });

      if (!coin) {
        throw new Error("Coin not found");
      }

      // Convert to CoinData format
      const coinData: CoinData = {
        name: coin.name,
        symbol: coin.symbol,
        initialSupply: coin.initialSupply,
        description: coin.description,
        logoUrl: coin.logoUrl,
        canMint: coin.canMint,
        canBurn: coin.canBurn,
        postQuantumSecurity: coin.postQuantumSecurity,
        deployment: coin.deployment ? {
          blockchain: coin.deployment.blockchain,
          contractAddress: coin.deployment.contractAddress,
          transactionHash: coin.deployment.transactionHash,
        } : undefined,
      };

      // Share on multiple platforms in parallel
      const sharePromises = [];

      // Twitter
      if (process.env.TWITTER_API_KEY) {
        sharePromises.push(
          ctx.runAction(internal.social.twitter.postToTwitter, { coin: coinData, type: "launch" })
            .then((result: any) => ({
              platform: "twitter" as const,
              success: true,
              response: `Tweet posted: ${result.url}`,
              postId: result.tweetId,
            }))
            .catch((error: any) => ({
              platform: "twitter" as const,
              success: false,
              response: `Error: ${error.message}`,
              postId: null,
            }))
        );
      }

      // Discord
      if (process.env.DISCORD_WEBHOOK_URL) {
        sharePromises.push(
          ctx.runAction(internal.social.discord.postToDiscord, { coin: coinData, type: "launch" })
            .then((result: any) => ({
              platform: "discord" as const,
              success: true,
              response: `Discord message posted at ${result.timestamp}`,
              postId: result.timestamp,
            }))
            .catch((error: any) => ({
              platform: "discord" as const,
              success: false,
              response: `Error: ${error.message}`,
              postId: null,
            }))
        );
      }

      // Telegram
      if (process.env.TELEGRAM_BOT_TOKEN) {
        sharePromises.push(
          ctx.runAction(internal.social.telegram.postToTelegram, { coin: coinData, type: "launch" })
            .then((result: any) => ({
              platform: "telegram" as const,
              success: true,
              response: `Telegram message posted: ${result.messageId}`,
              postId: String(result.messageId),
            }))
            .catch((error: any) => ({
              platform: "telegram" as const,
              success: false,
              response: `Error: ${error.message}`,
              postId: null,
            }))
        );
      }

      // Wait for all shares to complete
      const results = await Promise.all(sharePromises);

      // Record all share attempts
      for (const result of results) {
        await ctx.runMutation(internal.social.recordShare, {
          coinId: args.coinId,
          platform: result.platform,
          shareType: "launch",
          message: `${coin.name} (${coin.symbol}) launched on ${coin.deployment?.blockchain || 'blockchain'}`,
          success: result.success,
          response: result.response,
        });
      }

      // Log summary
      const successCount = results.filter((r: any) => r.success).length;
      console.log(`Social sharing completed: ${successCount}/${results.length} successful`);

    } catch (error) {
      console.error("Social sharing error:", error);
    }
  },
});

// Share milestone achievements
export const shareMilestone = internalAction({
  args: {
    coinId: v.id("memeCoins"),
    milestone: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const coin = await ctx.runQuery(internal.social.getCoinForSharing, {
        coinId: args.coinId,
      });

      if (!coin) return;

      // Convert to CoinData format
      const coinData: CoinData = {
        name: coin.name,
        symbol: coin.symbol,
        initialSupply: coin.initialSupply,
        description: coin.description,
        logoUrl: coin.logoUrl,
        canMint: coin.canMint,
        canBurn: coin.canBurn,
        postQuantumSecurity: coin.postQuantumSecurity,
        deployment: coin.deployment ? {
          blockchain: coin.deployment.blockchain,
          contractAddress: coin.deployment.contractAddress,
          transactionHash: coin.deployment.transactionHash,
        } : undefined,
      };

      // Share on multiple platforms
      const sharePromises = [];

      // Twitter - milestones get good engagement
      if (process.env.TWITTER_API_KEY) {
        sharePromises.push(
          ctx.runAction(internal.social.twitter.postToTwitter, { coin: coinData, type: "milestone" })
            .then((result: any) => ({
              platform: "twitter" as const,
              success: true,
              response: `Milestone tweet posted: ${result.url}`,
            }))
            .catch((error) => ({
              platform: "twitter" as const,
              success: false,
              response: `Error: ${error.message}`,
            }))
        );
      }

      // Discord - community loves milestones
      if (process.env.DISCORD_WEBHOOK_URL) {
        sharePromises.push(
          ctx.runAction(internal.social.discord.postToDiscord, { coin: coinData, type: "milestone" })
            .then((result: any) => ({
              platform: "discord" as const,
              success: true,
              response: `Discord milestone posted`,
            }))
            .catch((error) => ({
              platform: "discord" as const,
              success: false,
              response: `Error: ${error.message}`,
            }))
        );
      }

      // Telegram - optional for milestones
      if (process.env.TELEGRAM_BOT_TOKEN && args.milestone.includes("1000")) {
        sharePromises.push(
          ctx.runAction(internal.social.telegram.postToTelegram, { coin: coinData, type: "milestone" })
            .then((result: any) => ({
              platform: "telegram" as const,
              success: true,
              response: `Telegram milestone posted: ${result.messageId}`,
            }))
            .catch((error) => ({
              platform: "telegram" as const,
              success: false,
              response: `Error: ${error.message}`,
            }))
        );
      }

      // Wait for all shares to complete
      const results = await Promise.all(sharePromises);

      // Record all share attempts
      for (const result of results) {
        await ctx.runMutation(internal.social.recordShare, {
          coinId: args.coinId,
          platform: result.platform,
          shareType: "milestone",
          message: `${coin.name} reached ${args.milestone}!`,
          success: result.success,
          response: result.response,
        });
      }

    } catch (error) {
      console.error("Milestone sharing error:", error);
    }
  },
});

// Get social shares for a coin
export const getCoinShares = internalQuery({
  args: {
    coinId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("socialShares")
      .withIndex("by_coin", (q) => q.eq("coinId", args.coinId))
      .order("desc")
      .collect();
  },
});

// Helper functions
export const getCoinForSharing = internalQuery({
  args: {
    coinId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    const coin = await ctx.db.get(args.coinId);
    if (!coin) return null;

    const deployment = await ctx.db
      .query("deployments")
      .withIndex("by_coin", (q) => q.eq("coinId", args.coinId))
      .first();

    return { ...coin, deployment };
  },
});

export const recordShare = internalMutation({
  args: {
    coinId: v.id("memeCoins"),
    platform: v.union(v.literal("twitter"), v.literal("discord"), v.literal("telegram")),
    shareType: v.union(v.literal("launch"), v.literal("milestone"), v.literal("update")),
    message: v.string(),
    success: v.boolean(),
    response: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("socialShares", {
      coinId: args.coinId,
      platform: args.platform,
      shareType: args.shareType,
      message: args.message,
      success: args.success,
      response: args.response,
      sharedAt: Date.now(),
    });
  },
});

