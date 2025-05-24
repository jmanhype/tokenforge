import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_DELAY = 1000; // 1 second between requests

// Network mapping for CoinGecko
const NETWORK_MAPPING = {
  ethereum: "ethereum",
  bsc: "binance-smart-chain",
  solana: "solana"
} as const;

// CoinGecko Pro API endpoints
const COINGECKO_PRO_BASE_URL = "https://pro-api.coingecko.com/api/v3";

interface TokenPriceData {
  usd: number;
  usd_market_cap: number;
  usd_24h_vol: number;
  usd_24h_change: number;
}

interface CoinGeckoCache {
  data: any;
  timestamp: number;
}

// In-memory cache (in production, use Redis)
const cache = new Map<string, CoinGeckoCache>();

// Rate limiting queue
let lastRequestTime = 0;

async function rateLimitedFetch(url: string, options: RequestInit): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  
  const response = await fetch(url, options);
  
  if (!response.ok) {
    if (response.status === 429) {
      // Rate limited, wait and retry with exponential backoff
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60') * 1000;
      await new Promise(resolve => setTimeout(resolve, retryAfter));
      return rateLimitedFetch(url, options);
    }
    throw new ConvexError(`CoinGecko API error: ${response.status} ${response.statusText}`);
  }
  
  return response;
}

// Fetch token price data with on-chain DEX data
export const fetchTokenPriceData = internalAction({
  args: {
    contractAddress: v.string(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc"), v.literal("solana"))
  },
  handler: async (ctx, args) => {
    const { contractAddress, blockchain } = args;
    const chainId = NETWORK_MAPPING[blockchain];
    
    if (!process.env.COINGECKO_API_KEY) {
      throw new ConvexError("COINGECKO_API_KEY not configured");
    }
    
    // Check cache first
    const cacheKey = `price:${chainId}:${contractAddress.toLowerCase()}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      return cachedData.data;
    }
    
    try {
      // CoinGecko Pro API with on-chain DEX data
      const url = `${COINGECKO_PRO_BASE_URL}/onchain/simple/networks/${chainId}/token_price/${contractAddress}?include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`;
      
      const response = await rateLimitedFetch(url, {
        headers: {
          'X-Cg-Pro-Api-Key': process.env.COINGECKO_API_KEY
        }
      });
      
      const data = await response.json();
      const tokenData = data[contractAddress.toLowerCase()];
      
      if (!tokenData) {
        throw new ConvexError("Token data not found");
      }
      
      const result = {
        price: tokenData.usd || 0,
        marketCap: tokenData.usd_market_cap || 0,
        volume24h: tokenData.usd_24h_vol || 0,
        priceChange24h: tokenData.usd_24h_change || 0,
        lastUpdated: Date.now()
      };
      
      // Update cache
      cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      console.error("CoinGecko API error:", error);
      throw new ConvexError(`Failed to fetch token price data: ${error.message}`);
    }
  }
});

// Fetch detailed token information
export const fetchTokenInfo = internalAction({
  args: {
    contractAddress: v.string(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc"), v.literal("solana"))
  },
  handler: async (ctx, args) => {
    const { contractAddress, blockchain } = args;
    const chainId = NETWORK_MAPPING[blockchain];
    
    if (!process.env.COINGECKO_API_KEY) {
      throw new ConvexError("COINGECKO_API_KEY not configured");
    }
    
    // Check cache first
    const cacheKey = `info:${chainId}:${contractAddress.toLowerCase()}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      return cachedData.data;
    }
    
    try {
      // Get detailed token information
      const url = `${COINGECKO_PRO_BASE_URL}/onchain/networks/${chainId}/tokens/${contractAddress}`;
      
      const response = await rateLimitedFetch(url, {
        headers: {
          'X-Cg-Pro-Api-Key': process.env.COINGECKO_API_KEY
        }
      });
      
      const data = await response.json();
      
      const result = {
        name: data.name,
        symbol: data.symbol,
        decimals: data.decimals,
        totalSupply: data.total_supply,
        circulatingSupply: data.circulating_supply,
        pools: data.pools || [],
        lastUpdated: Date.now()
      };
      
      // Update cache
      cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      console.error("CoinGecko API error:", error);
      throw new ConvexError(`Failed to fetch token info: ${error.message}`);
    }
  }
});

// Fetch historical price data
export const fetchHistoricalPrices = internalAction({
  args: {
    contractAddress: v.string(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc"), v.literal("solana")),
    days: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { contractAddress, blockchain, days = 7 } = args;
    const chainId = NETWORK_MAPPING[blockchain];
    
    if (!process.env.COINGECKO_API_KEY) {
      throw new ConvexError("COINGECKO_API_KEY not configured");
    }
    
    // Check cache first
    const cacheKey = `historical:${chainId}:${contractAddress.toLowerCase()}:${days}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      return cachedData.data;
    }
    
    try {
      const url = `${COINGECKO_PRO_BASE_URL}/onchain/networks/${chainId}/tokens/${contractAddress}/ohlcv/historical?days=${days}&vs_currency=usd`;
      
      const response = await rateLimitedFetch(url, {
        headers: {
          'X-Cg-Pro-Api-Key': process.env.COINGECKO_API_KEY
        }
      });
      
      const data = await response.json();
      
      const result = {
        prices: data.prices || [],
        marketCaps: data.market_caps || [],
        volumes: data.total_volumes || [],
        lastUpdated: Date.now()
      };
      
      // Update cache
      cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      console.error("CoinGecko API error:", error);
      throw new ConvexError(`Failed to fetch historical prices: ${error.message}`);
    }
  }
});

// Clear expired cache entries (to be called periodically)
export const clearExpiredCache = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    cache.forEach((value, key) => {
      if (now - value.timestamp > CACHE_DURATION) {
        expiredKeys.push(key);
      }
    });
    
    expiredKeys.forEach(key => cache.delete(key));
    
    return { cleared: expiredKeys.length };
  }
});