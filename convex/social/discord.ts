import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { CoinData, formatDiscordEmbed, calculateBackoff, DEFAULT_RETRY_CONFIG, RATE_LIMITS } from "./formatter";

// Rate limiting state (in-memory for this instance)
const rateLimitState = {
  requests: 0,
  windowStart: Date.now(),
};

// Check if we're within rate limits
function checkRateLimit(): boolean {
  const now = Date.now();
  const windowMs = RATE_LIMITS.discord.windowMs;
  
  // Reset window if expired
  if (now - rateLimitState.windowStart > windowMs) {
    rateLimitState.requests = 0;
    rateLimitState.windowStart = now;
  }
  
  return rateLimitState.requests < RATE_LIMITS.discord.maxRequests;
}

// Update rate limit counter
function updateRateLimit() {
  rateLimitState.requests++;
}

// Post to Discord using webhooks
export const postToDiscord = internalAction({
  args: {
    coin: v.object({
      name: v.string(),
      symbol: v.string(),
      initialSupply: v.number(),
      description: v.optional(v.string()),
      logoUrl: v.optional(v.string()),
      canMint: v.boolean(),
      canBurn: v.boolean(),
      postQuantumSecurity: v.boolean(),
      deployment: v.optional(v.object({
        blockchain: v.string(),
        contractAddress: v.string(),
        transactionHash: v.string(),
      })),
    }),
    type: v.optional(v.union(v.literal("launch"), v.literal("milestone"), v.literal("update"))),
    customMessage: v.optional(v.string()),
    webhookUrl: v.optional(v.string()), // Allow custom webhook URL
  },
  handler: async (ctx, args) => {
    // Get webhook URL from args or environment
    const webhookUrl = args.webhookUrl || process.env.DISCORD_WEBHOOK_URL;
    
    if (!webhookUrl) {
      throw new Error("Discord webhook URL not configured");
    }

    // Check rate limit
    if (!checkRateLimit()) {
      throw new Error("Discord rate limit exceeded. Please try again later.");
    }

    // Format the embed - use custom message if provided
    const embed = args.customMessage 
      ? {
          title: `${args.coin.name} Update`,
          description: args.customMessage,
          color: 0x00ff00,
          timestamp: new Date().toISOString(),
        }
      : formatDiscordEmbed(args.coin as CoinData, args.type || "launch");

    // Prepare webhook payload
    const payload = {
      username: "MemeCoinGen Bot",
      avatar_url: "https://memecoingen.com/bot-avatar.png",
      embeds: [embed],
      // Add buttons for interaction
      components: args.coin.deployment ? [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5, // Link button
              label: "View on Explorer",
              url: getExplorerUrl(args.coin.deployment.blockchain, args.coin.deployment.contractAddress),
              emoji: {
                name: "🔍",
              },
            },
            {
              type: 2,
              style: 5, // Link button
              label: "Trade on DEX",
              url: getDexUrl(args.coin.deployment.blockchain, args.coin.deployment.contractAddress),
              emoji: {
                name: "💱",
              },
            },
          ],
        },
      ] : undefined,
    };

    // Retry logic
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < DEFAULT_RETRY_CONFIG.maxAttempts; attempt++) {
      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Discord webhook failed: ${response.status} - ${errorText}`);
        }

        // Update rate limit counter on success
        updateRateLimit();

        return {
          success: true,
          webhookUrl: webhookUrl.replace(/\/[^\/]+\/[^\/]+$/, "/*****/******"), // Hide token
          message: embed.title,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on rate limit errors
        if (error instanceof Error && error.message.includes("rate limit")) {
          throw error;
        }
        
        // Wait before retry with exponential backoff
        if (attempt < DEFAULT_RETRY_CONFIG.maxAttempts - 1) {
          const delay = calculateBackoff(attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to post to Discord after ${DEFAULT_RETRY_CONFIG.maxAttempts} attempts: ${lastError?.message}`);
  },
});

// Send a follow-up message in a thread
export const postDiscordFollowUp = internalAction({
  args: {
    webhookUrl: v.optional(v.string()),
    threadId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const webhookUrl = args.webhookUrl || process.env.DISCORD_WEBHOOK_URL;
    
    if (!webhookUrl) {
      throw new Error("Discord webhook URL not configured");
    }

    // Check rate limit
    if (!checkRateLimit()) {
      throw new Error("Discord rate limit exceeded. Please try again later.");
    }

    const payload = {
      content: args.message,
      thread_id: args.threadId,
    };

    try {
      const response = await fetch(`${webhookUrl}?thread_id=${args.threadId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Discord webhook failed: ${response.status}`);
      }

      updateRateLimit();

      return {
        success: true,
        threadId: args.threadId,
      };
    } catch (error) {
      throw new Error(`Failed to post Discord follow-up: ${error}`);
    }
  },
});

// Post announcement with role pings
export const postDiscordAnnouncement = internalAction({
  args: {
    coin: v.object({
      name: v.string(),
      symbol: v.string(),
      initialSupply: v.number(),
      description: v.optional(v.string()),
      logoUrl: v.optional(v.string()),
      canMint: v.boolean(),
      canBurn: v.boolean(),
      postQuantumSecurity: v.boolean(),
      deployment: v.optional(v.object({
        blockchain: v.string(),
        contractAddress: v.string(),
        transactionHash: v.string(),
      })),
    }),
    roleIds: v.optional(v.array(v.string())), // Discord role IDs to ping
    channelWebhook: v.optional(v.string()), // Specific channel webhook
  },
  handler: async (ctx, args) => {
    const webhookUrl = args.channelWebhook || process.env.DISCORD_ANNOUNCEMENT_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
    
    if (!webhookUrl) {
      throw new Error("Discord webhook URL not configured");
    }

    // Check rate limit
    if (!checkRateLimit()) {
      throw new Error("Discord rate limit exceeded. Please try again later.");
    }

    // Format the embed
    const embed = formatDiscordEmbed(args.coin as CoinData, "launch");

    // Build mention string
    const mentions = args.roleIds?.map(id => `<@&${id}>`).join(" ") || "";

    const payload = {
      content: mentions ? `${mentions} 🚨 New Meme Coin Alert!` : "🚨 New Meme Coin Alert!",
      username: "MemeCoinGen Announcements",
      avatar_url: "https://memecoingen.com/announcement-avatar.png",
      embeds: [embed],
      allowed_mentions: {
        roles: args.roleIds || [],
      },
    };

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Discord webhook failed: ${response.status}`);
      }

      updateRateLimit();

      return {
        success: true,
        announcementSent: true,
        rolesPinged: args.roleIds?.length || 0,
      };
    } catch (error) {
      throw new Error(`Failed to post Discord announcement: ${error}`);
    }
  },
});

// Helper function to get explorer URL
function getExplorerUrl(blockchain: string, contractAddress: string): string {
  const explorers: Record<string, string> = {
    ethereum: `https://etherscan.io/token/${contractAddress}`,
    bsc: `https://bscscan.com/token/${contractAddress}`,
    solana: `https://solscan.io/token/${contractAddress}`,
  };
  return explorers[blockchain] || "#";
}

// Helper function to get DEX URL
function getDexUrl(blockchain: string, contractAddress: string): string {
  const dexUrls: Record<string, string> = {
    ethereum: `https://app.uniswap.org/#/tokens/ethereum/${contractAddress}`,
    bsc: `https://pancakeswap.finance/info/v2/tokens/${contractAddress}`,
    solana: `https://raydium.io/token/${contractAddress}`,
  };
  return dexUrls[blockchain] || "#";
}