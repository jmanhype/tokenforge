import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { CoinData, formatTelegramMessage, calculateBackoff, DEFAULT_RETRY_CONFIG, RATE_LIMITS } from "./formatter";

// Rate limiting state (in-memory for this instance)
const rateLimitState = {
  requests: 0,
  windowStart: Date.now(),
};

// Check if we're within rate limits
function checkRateLimit(): boolean {
  const now = Date.now();
  const windowMs = RATE_LIMITS.telegram.windowMs;
  
  // Reset window if expired
  if (now - rateLimitState.windowStart > windowMs) {
    rateLimitState.requests = 0;
    rateLimitState.windowStart = now;
  }
  
  return rateLimitState.requests < RATE_LIMITS.telegram.maxRequests;
}

// Update rate limit counter
function updateRateLimit() {
  rateLimitState.requests++;
}

// Post to Telegram channel/group
export const postToTelegram = internalAction({
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
    type: v.optional(v.union(v.literal("launch"), v.literal("milestone"))),
    chatId: v.optional(v.string()), // Allow custom chat ID
  },
  handler: async (ctx, args) => {
    // Check environment variables
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error("Telegram bot token not configured");
    }

    const chatId = args.chatId || process.env.TELEGRAM_CHANNEL_ID;
    if (!chatId) {
      throw new Error("Telegram chat ID not configured");
    }

    // Check rate limit
    if (!checkRateLimit()) {
      throw new Error("Telegram rate limit exceeded. Please try again later.");
    }

    // Format the message
    const message = formatTelegramMessage(args.coin as CoinData, args.type || "launch");

    // Retry logic
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < DEFAULT_RETRY_CONFIG.maxAttempts; attempt++) {
      try {
        // In production, you would use the node-telegram-bot-api package
        // For now, we'll use the HTTP API directly
        const response = await sendTelegramMessage(
          process.env.TELEGRAM_BOT_TOKEN,
          chatId,
          message,
          args.coin.logoUrl
        );
        
        // Update rate limit counter on success
        updateRateLimit();
        
        return {
          success: true,
          messageId: response.message_id,
          chatId: chatId,
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

    throw new Error(`Failed to post to Telegram after ${DEFAULT_RETRY_CONFIG.maxAttempts} attempts: ${lastError?.message}`);
  },
});

// Send message with inline keyboard buttons
export const postTelegramWithButtons = internalAction({
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
    chatId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error("Telegram bot token not configured");
    }

    const chatId = args.chatId || process.env.TELEGRAM_CHANNEL_ID;
    if (!chatId) {
      throw new Error("Telegram chat ID not configured");
    }

    // Check rate limit
    if (!checkRateLimit()) {
      throw new Error("Telegram rate limit exceeded. Please try again later.");
    }

    // Format the message
    const message = formatTelegramMessage(args.coin as CoinData, "launch");

    // Create inline keyboard
    const inlineKeyboard = {
      inline_keyboard: args.coin.deployment ? [
        [
          {
            text: "📊 View on Explorer",
            url: getExplorerUrl(args.coin.deployment.blockchain, args.coin.deployment.contractAddress),
          },
          {
            text: "💱 Trade on DEX",
            url: getDexUrl(args.coin.deployment.blockchain, args.coin.deployment.contractAddress),
          },
        ],
        [
          {
            text: "🌐 Visit Website",
            url: "https://memecoingen.com",
          },
          {
            text: "💬 Join Community",
            url: `https://t.me/${args.coin.symbol.toLowerCase()}_community`,
          },
        ],
      ] : [
        [
          {
            text: "🌐 Visit MemeCoinGen",
            url: "https://memecoingen.com",
          },
        ],
      ],
    };

    try {
      const response = await sendTelegramMessage(
        process.env.TELEGRAM_BOT_TOKEN,
        chatId,
        message,
        args.coin.logoUrl,
        inlineKeyboard
      );
      
      updateRateLimit();
      
      return {
        success: true,
        messageId: response.message_id,
        chatId: chatId,
      };
    } catch (error) {
      throw new Error(`Failed to post to Telegram with buttons: ${error}`);
    }
  },
});

// Pin important messages
export const pinTelegramMessage = internalAction({
  args: {
    chatId: v.string(),
    messageId: v.number(),
    disableNotification: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error("Telegram bot token not configured");
    }

    try {
      const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/pinChatMessage`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: args.chatId,
          message_id: args.messageId,
          disable_notification: args.disableNotification ?? false,
        }),
      });

      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(`Telegram API error: ${data.description}`);
      }

      return {
        success: true,
        pinnedMessageId: args.messageId,
      };
    } catch (error) {
      throw new Error(`Failed to pin Telegram message: ${error}`);
    }
  },
});

// Helper function to send Telegram message
async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  photoUrl?: string,
  replyMarkup?: any
): Promise<any> {
  const method = photoUrl ? "sendPhoto" : "sendMessage";
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  
  const payload: any = {
    chat_id: chatId,
    parse_mode: "MarkdownV2",
  };

  if (photoUrl) {
    payload.photo = photoUrl;
    payload.caption = text;
  } else {
    payload.text = text;
  }

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description}`);
  }

  return data.result;
}

// Get Telegram message stats
export const getTelegramMessageStats = internalAction({
  args: {
    chatId: v.string(),
    messageId: v.number(),
  },
  handler: async (ctx, args) => {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error("Telegram bot token not configured");
    }

    try {
      // Note: Telegram Bot API doesn't provide view/reaction counts directly
      // You would need to use Telegram's Channel Statistics API or track interactions
      // For now, we'll return mock data
      return {
        views: Math.floor(Math.random() * 1000),
        forwards: Math.floor(Math.random() * 50),
        replies: Math.floor(Math.random() * 20),
      };
    } catch (error) {
      throw new Error(`Failed to get Telegram message stats: ${error}`);
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