import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

// Rate limiting configuration
export const RATE_LIMITS = {
  twitter: {
    posts: { limit: 300, window: 900000 }, // 300 posts per 15 minutes
    dailyPosts: { limit: 2400, window: 86400000 }, // 2400 posts per day
  },
  discord: {
    messages: { limit: 5, window: 5000 }, // 5 messages per 5 seconds
    dailyMessages: { limit: 10000, window: 86400000 }, // 10k messages per day
  },
  telegram: {
    messages: { limit: 30, window: 1000 }, // 30 messages per second
    dailyMessages: { limit: 100000, window: 86400000 }, // 100k messages per day
  },
};

// Check rate limit
export const checkRateLimit = internalQuery({
  args: {
    key: v.string(),
    limit: v.number(),
    window: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const windowStart = now - args.window;
    
    // Get rate limit record
    const rateLimitRecord = await ctx.db
      .query("rateLimits")
      .withIndex("by_user_action", (q) => q.eq("userId", args.key as any).eq("action", args.key))
      .first();
    
    if (!rateLimitRecord || rateLimitRecord.resetAt < now) {
      return { allowed: true, remaining: args.limit - 1, resetAt: now + args.window };
    }
    
    if (rateLimitRecord.count >= args.limit) {
      return { 
        allowed: false, 
        remaining: 0, 
        resetAt: rateLimitRecord.resetAt,
        retryAfter: rateLimitRecord.resetAt - now,
      };
    }
    
    return { 
      allowed: true, 
      remaining: args.limit - rateLimitRecord.count - 1,
      resetAt: rateLimitRecord.resetAt,
    };
  },
});

// Update rate limit
export const updateRateLimit = internalMutation({
  args: {
    key: v.string(),
    window: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_user_action", (q) => q.eq("userId", args.key as any).eq("action", args.key))
      .first();
    
    if (!existing || existing.resetAt < now) {
      // Create new rate limit record
      await ctx.db.insert("rateLimits", {
        userId: args.key as any,
        action: args.key,
        count: 1,
        resetAt: now + args.window,
      });
    } else {
      // Increment existing count
      await ctx.db.patch(existing._id, {
        count: existing.count + 1,
      });
    }
  },
});

// Format coin data for social media
export interface CoinSocialData {
  name: string;
  symbol: string;
  description?: string;
  initialSupply: number;
  logoUrl?: string;
  canMint: boolean;
  canBurn: boolean;
  postQuantumSecurity: boolean;
  deployment?: {
    blockchain: string;
    contractAddress: string;
    transactionHash: string;
  };
  analytics?: {
    price: number;
    marketCap: number;
    volume24h: number;
    holders: number;
    priceChange24h: number;
  };
}

// Format numbers for display
export function formatNumber(num: number): string {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
  return num.toLocaleString();
}

// Format percentage
export function formatPercentage(value: number): string {
  const formatted = value.toFixed(2);
  return value >= 0 ? `+${formatted}%` : `${formatted}%`;
}

// Shorten address
export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// Get blockchain explorer URL
export function getExplorerUrl(blockchain: string, address: string): string {
  switch (blockchain.toLowerCase()) {
    case "ethereum":
      return `https://etherscan.io/token/${address}`;
    case "bsc":
      return `https://bscscan.com/token/${address}`;
    case "solana":
      return `https://solscan.io/token/${address}`;
    default:
      return "#";
  }
}

// Get DEX URL
export function getDexUrl(blockchain: string, address: string): string {
  switch (blockchain.toLowerCase()) {
    case "ethereum":
      return `https://www.dextools.io/app/ether/pair-explorer/${address}`;
    case "bsc":
      return `https://www.dextools.io/app/bsc/pair-explorer/${address}`;
    case "solana":
      return `https://birdeye.so/token/${address}`;
    default:
      return "#";
  }
}

// Generate hashtags for social media
export function generateHashtags(coin: CoinSocialData): string[] {
  const hashtags = ["MemeCoin", coin.symbol, "DeFi", "Crypto"];
  
  // Add blockchain-specific hashtags
  if (coin.deployment) {
    switch (coin.deployment.blockchain.toLowerCase()) {
      case "ethereum":
        hashtags.push("ETH", "Ethereum");
        break;
      case "bsc":
        hashtags.push("BSC", "BNB", "BinanceSmartChain");
        break;
      case "solana":
        hashtags.push("SOL", "Solana");
        break;
    }
  }
  
  // Add feature-specific hashtags
  if (coin.postQuantumSecurity) {
    hashtags.push("QuantumSafe", "FutureProof");
  }
  
  return hashtags;
}

// Escape text for different platforms
export const escapeText = {
  telegram: (text: string): string => {
    // Escape for Telegram MarkdownV2
    return text.replace(/[_*\[\]()~`>#+=|{}.!-]/g, '\\$&');
  },
  discord: (text: string): string => {
    // Discord markdown doesn't need as much escaping
    return text.replace(/[*_`~]/g, '\\$&');
  },
  twitter: (text: string): string => {
    // Twitter doesn't use markdown
    return text;
  },
};

// Retry with exponential backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error("Max retries exceeded");
}

// Batch social media posts
export interface SocialPost {
  platform: "twitter" | "discord" | "telegram";
  content: string;
  options?: any;
}

export async function batchSocialPosts(
  posts: SocialPost[],
  delayBetween: number = 1000
): Promise<Array<{ platform: string; success: boolean; error?: string }>> {
  const results = [];
  
  for (const post of posts) {
    try {
      // Add delay between posts to avoid rate limits
      if (results.length > 0) {
        await new Promise(resolve => setTimeout(resolve, delayBetween));
      }
      
      // Post would be sent here
      results.push({ platform: post.platform, success: true });
    } catch (error) {
      results.push({ 
        platform: post.platform, 
        success: false, 
        error: (error as Error).message 
      });
    }
  }
  
  return results;
}