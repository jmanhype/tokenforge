import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { CoinData, formatTwitterMessage, calculateBackoff, DEFAULT_RETRY_CONFIG, RATE_LIMITS } from "./formatter";

// Rate limiting state (in-memory for this instance)
const rateLimitState = {
  requests: 0,
  windowStart: Date.now(),
};

// Check if we're within rate limits
function checkRateLimit(): boolean {
  const now = Date.now();
  const windowMs = RATE_LIMITS.twitter.windowMs;
  
  // Reset window if expired
  if (now - rateLimitState.windowStart > windowMs) {
    rateLimitState.requests = 0;
    rateLimitState.windowStart = now;
  }
  
  return rateLimitState.requests < RATE_LIMITS.twitter.maxRequests;
}

// Update rate limit counter
function updateRateLimit() {
  rateLimitState.requests++;
}

// Post to Twitter using API v2
export const postToTwitter = internalAction({
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
  },
  handler: async (ctx, args) => {
    // Check environment variables
    if (!process.env.TWITTER_API_KEY || 
        !process.env.TWITTER_API_SECRET || 
        !process.env.TWITTER_ACCESS_TOKEN || 
        !process.env.TWITTER_ACCESS_SECRET) {
      throw new Error("Twitter API credentials not configured");
    }

    // Check rate limit
    if (!checkRateLimit()) {
      throw new Error("Twitter rate limit exceeded. Please try again later.");
    }

    // Format the message - use custom message if provided
    const message = args.customMessage || formatTwitterMessage(args.coin as CoinData, args.type || "launch");

    // Retry logic
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < DEFAULT_RETRY_CONFIG.maxAttempts; attempt++) {
      try {
        // In production, you would use the twitter-api-v2 package here
        // For now, we'll simulate the API call
        const response = await simulateTwitterPost(message, args.coin.logoUrl);
        
        // Update rate limit counter on success
        updateRateLimit();
        
        return {
          success: true,
          tweetId: response.id,
          url: `https://twitter.com/i/status/${response.id}`,
          message,
        };
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on rate limit or auth errors
        if (error instanceof Error && (
          error.message.includes("rate limit") ||
          error.message.includes("authentication") ||
          error.message.includes("credentials")
        )) {
          throw error;
        }
        
        // Wait before retry with exponential backoff
        if (attempt < DEFAULT_RETRY_CONFIG.maxAttempts - 1) {
          const delay = calculateBackoff(attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to post to Twitter after ${DEFAULT_RETRY_CONFIG.maxAttempts} attempts: ${lastError?.message}`);
  },
});

// Simulate Twitter post (replace with actual twitter-api-v2 implementation)
async function simulateTwitterPost(message: string, imageUrl?: string): Promise<{ id: string }> {
  // In production, this would be:
  /*
  import { TwitterApi } from 'twitter-api-v2';
  
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY!,
    appSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_SECRET!,
  });
  
  // Upload media if image provided
  let mediaId: string | undefined;
  if (imageUrl) {
    try {
      const mediaUpload = await client.v1.uploadMedia(imageUrl);
      mediaId = mediaUpload;
    } catch (error) {
      console.error("Failed to upload media:", error);
    }
  }
  
  // Post tweet
  const tweet = await client.v2.tweet({
    text: message,
    media: mediaId ? { media_ids: [mediaId] } : undefined,
  });
  
  return { id: tweet.data.id };
  */
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
  
  // Simulate occasional failures
  if (Math.random() < 0.1) {
    throw new Error("Twitter API error: Could not authenticate");
  }
  
  // Return mock tweet ID
  return { id: `${Date.now()}${Math.floor(Math.random() * 1000)}` };
}

// Delete a tweet (useful for cleanup or moderation)
export const deleteTwitterPost = internalAction({
  args: {
    tweetId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check environment variables
    if (!process.env.TWITTER_API_KEY || 
        !process.env.TWITTER_API_SECRET || 
        !process.env.TWITTER_ACCESS_TOKEN || 
        !process.env.TWITTER_ACCESS_SECRET) {
      throw new Error("Twitter API credentials not configured");
    }

    try {
      // In production:
      /*
      const client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY!,
        appSecret: process.env.TWITTER_API_SECRET!,
        accessToken: process.env.TWITTER_ACCESS_TOKEN!,
        accessSecret: process.env.TWITTER_ACCESS_SECRET!,
      });
      
      await client.v2.deleteTweet(args.tweetId);
      */
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return {
        success: true,
        deletedTweetId: args.tweetId,
      };
    } catch (error) {
      throw new Error(`Failed to delete tweet: ${error}`);
    }
  },
});

// Get engagement metrics for a tweet
export const getTwitterEngagement = internalAction({
  args: {
    tweetId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // In production:
      /*
      const client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY!,
        appSecret: process.env.TWITTER_API_SECRET!,
        accessToken: process.env.TWITTER_ACCESS_TOKEN!,
        accessSecret: process.env.TWITTER_ACCESS_SECRET!,
      });
      
      const tweet = await client.v2.singleTweet(args.tweetId, {
        'tweet.fields': ['public_metrics'],
      });
      
      return {
        likes: tweet.data.public_metrics?.like_count || 0,
        retweets: tweet.data.public_metrics?.retweet_count || 0,
        replies: tweet.data.public_metrics?.reply_count || 0,
        impressions: tweet.data.public_metrics?.impression_count || 0,
      };
      */
      
      // Simulate metrics
      return {
        likes: Math.floor(Math.random() * 100),
        retweets: Math.floor(Math.random() * 50),
        replies: Math.floor(Math.random() * 20),
        impressions: Math.floor(Math.random() * 1000),
      };
    } catch (error) {
      throw new Error(`Failed to get tweet engagement: ${error}`);
    }
  },
});