import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

// Cache configuration
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes for DEX data (more frequent updates)
const RATE_LIMIT_DELAY = 500; // 500ms between requests (GeckoTerminal is more lenient)

// Network mapping for GeckoTerminal
const NETWORK_MAPPING = {
  ethereum: "eth",
  bsc: "bsc",
  solana: "solana"
} as const;

// GeckoTerminal API base URL
const GECKOTERMINAL_BASE_URL = "https://api.geckoterminal.com/api/v2";

interface PoolData {
  dex: string;
  dexId: string;
  poolAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  price: number;
  priceUsd: number;
  volume24h: number;
  volumeChange24h: number;
  liquidity: number;
  liquidityUsd: number;
  priceChange24h: number;
  priceChange1h: number;
  txCount24h: number;
  buys24h: number;
  sells24h: number;
  fdv: number;
  marketCap: number;
}

interface GeckoTerminalCache {
  data: any;
  timestamp: number;
}

// In-memory cache (in production, use Redis)
const cache = new Map<string, GeckoTerminalCache>();

// Rate limiting
let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    if (response.status === 429) {
      // Rate limited, wait and retry
      await new Promise(resolve => setTimeout(resolve, 5000));
      return rateLimitedFetch(url);
    }
    throw new ConvexError(`GeckoTerminal API error: ${response.status} ${response.statusText}`);
  }
  
  return response;
}

// Fetch all pools for a token
export const fetchTokenPools = internalAction({
  args: {
    contractAddress: v.string(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc"), v.literal("solana"))
  },
  handler: async (ctx, args) => {
    const { contractAddress, blockchain } = args;
    const network = NETWORK_MAPPING[blockchain];
    
    // Check cache first
    const cacheKey = `pools:${network}:${contractAddress.toLowerCase()}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      return cachedData.data;
    }
    
    try {
      const url = `${GECKOTERMINAL_BASE_URL}/networks/${network}/tokens/${contractAddress}/pools`;
      const response = await rateLimitedFetch(url);
      const data = await response.json();
      
      if (!data.data || !Array.isArray(data.data)) {
        return { pools: [], totalLiquidity: 0, totalVolume24h: 0 };
      }
      
      const pools = data.data.map((pool: any) => ({
        dex: pool.relationships?.dex?.data?.id || "unknown",
        dexId: pool.attributes.dex_id,
        poolAddress: pool.attributes.address,
        baseToken: {
          address: pool.attributes.base_token_address,
          name: pool.attributes.base_token_name,
          symbol: pool.attributes.base_token_symbol
        },
        quoteToken: {
          address: pool.attributes.quote_token_address,
          name: pool.attributes.quote_token_name,
          symbol: pool.attributes.quote_token_symbol
        },
        price: parseFloat(pool.attributes.base_token_price_native_currency || "0"),
        priceUsd: parseFloat(pool.attributes.base_token_price_usd || "0"),
        volume24h: parseFloat(pool.attributes.volume_usd?.h24 || "0"),
        volumeChange24h: parseFloat(pool.attributes.volume_change_percentage?.h24 || "0"),
        liquidity: parseFloat(pool.attributes.reserve_in_usd || "0"),
        liquidityUsd: parseFloat(pool.attributes.reserve_in_usd || "0"),
        priceChange24h: parseFloat(pool.attributes.price_change_percentage?.h24 || "0"),
        priceChange1h: parseFloat(pool.attributes.price_change_percentage?.h1 || "0"),
        txCount24h: parseInt(pool.attributes.transactions?.h24?.buys || "0") + 
                   parseInt(pool.attributes.transactions?.h24?.sells || "0"),
        buys24h: parseInt(pool.attributes.transactions?.h24?.buys || "0"),
        sells24h: parseInt(pool.attributes.transactions?.h24?.sells || "0"),
        fdv: parseFloat(pool.attributes.fdv_usd || "0"),
        marketCap: parseFloat(pool.attributes.market_cap_usd || "0")
      }));
      
      // Calculate aggregated metrics
      const totalLiquidity = pools.reduce((sum: number, pool: PoolData) => sum + pool.liquidityUsd, 0);
      const totalVolume24h = pools.reduce((sum: number, pool: PoolData) => sum + pool.volume24h, 0);
      
      const result = {
        pools,
        totalLiquidity,
        totalVolume24h,
        poolCount: pools.length,
        lastUpdated: Date.now()
      };
      
      // Update cache
      cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      console.error("GeckoTerminal API error:", error);
      throw new ConvexError(`Failed to fetch token pools: ${(error as Error).message}`);
    }
  }
});

// Fetch specific pool data
export const fetchPoolData = internalAction({
  args: {
    poolAddress: v.string(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc"), v.literal("solana"))
  },
  handler: async (ctx, args) => {
    const { poolAddress, blockchain } = args;
    const network = NETWORK_MAPPING[blockchain];
    
    // Check cache first
    const cacheKey = `pool:${network}:${poolAddress.toLowerCase()}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      return cachedData.data;
    }
    
    try {
      const url = `${GECKOTERMINAL_BASE_URL}/networks/${network}/pools/${poolAddress}`;
      const response = await rateLimitedFetch(url);
      const data = await response.json();
      
      if (!data.data) {
        throw new ConvexError("Pool not found");
      }
      
      const pool = data.data;
      const result = {
        dex: pool.relationships?.dex?.data?.id || "unknown",
        dexId: pool.attributes.dex_id,
        poolAddress: pool.attributes.address,
        baseToken: {
          address: pool.attributes.base_token_address,
          name: pool.attributes.base_token_name,
          symbol: pool.attributes.base_token_symbol
        },
        quoteToken: {
          address: pool.attributes.quote_token_address,
          name: pool.attributes.quote_token_name,
          symbol: pool.attributes.quote_token_symbol
        },
        price: parseFloat(pool.attributes.base_token_price_native_currency || "0"),
        priceUsd: parseFloat(pool.attributes.base_token_price_usd || "0"),
        volume24h: parseFloat(pool.attributes.volume_usd?.h24 || "0"),
        liquidity: parseFloat(pool.attributes.reserve_in_usd || "0"),
        priceChange24h: parseFloat(pool.attributes.price_change_percentage?.h24 || "0"),
        priceChange1h: parseFloat(pool.attributes.price_change_percentage?.h1 || "0"),
        txCount24h: parseInt(pool.attributes.transactions?.h24?.buys || "0") + 
                   parseInt(pool.attributes.transactions?.h24?.sells || "0"),
        buys24h: parseInt(pool.attributes.transactions?.h24?.buys || "0"),
        sells24h: parseInt(pool.attributes.transactions?.h24?.sells || "0"),
        lastUpdated: Date.now()
      };
      
      // Update cache
      cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      console.error("GeckoTerminal API error:", error);
      throw new ConvexError(`Failed to fetch pool data: ${(error as Error).message}`);
    }
  }
});

// Fetch OHLCV (candlestick) data for a pool
export const fetchPoolOHLCV = internalAction({
  args: {
    poolAddress: v.string(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc"), v.literal("solana")),
    timeframe: v.optional(v.union(v.literal("1m"), v.literal("5m"), v.literal("15m"), v.literal("1h"), v.literal("4h"), v.literal("1d"))),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { poolAddress, blockchain, timeframe = "1h", limit = 100 } = args;
    const network = NETWORK_MAPPING[blockchain];
    
    // Check cache first
    const cacheKey = `ohlcv:${network}:${poolAddress.toLowerCase()}:${timeframe}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      return cachedData.data;
    }
    
    try {
      const url = `${GECKOTERMINAL_BASE_URL}/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}?limit=${limit}`;
      const response = await rateLimitedFetch(url);
      const data = await response.json();
      
      if (!data.data || !data.data.attributes?.ohlcv_list) {
        return { candles: [] };
      }
      
      const candles = data.data.attributes.ohlcv_list.map((candle: number[]) => ({
        timestamp: candle[0] * 1000, // Convert to milliseconds
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5]
      }));
      
      const result = {
        candles,
        timeframe,
        lastUpdated: Date.now()
      };
      
      // Update cache
      cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      console.error("GeckoTerminal API error:", error);
      throw new ConvexError(`Failed to fetch OHLCV data: ${(error as Error).message}`);
    }
  }
});

// Fetch trades for a pool
export const fetchPoolTrades = internalAction({
  args: {
    poolAddress: v.string(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc"), v.literal("solana")),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { poolAddress, blockchain, limit = 50 } = args;
    const network = NETWORK_MAPPING[blockchain];
    
    try {
      const url = `${GECKOTERMINAL_BASE_URL}/networks/${network}/pools/${poolAddress}/trades?limit=${limit}`;
      const response = await rateLimitedFetch(url);
      const data = await response.json();
      
      if (!data.data || !Array.isArray(data.data)) {
        return { trades: [] };
      }
      
      const trades = data.data.map((trade: any) => ({
        id: trade.id,
        blockNumber: trade.attributes.block_number,
        txHash: trade.attributes.tx_hash,
        txFromAddress: trade.attributes.tx_from_address,
        kind: trade.attributes.kind, // "buy" or "sell"
        volumeInUsd: parseFloat(trade.attributes.volume_in_usd || "0"),
        fromTokenAmount: parseFloat(trade.attributes.from_token_amount || "0"),
        toTokenAmount: parseFloat(trade.attributes.to_token_amount || "0"),
        priceFromInUsd: parseFloat(trade.attributes.price_from_in_usd || "0"),
        priceToInUsd: parseFloat(trade.attributes.price_to_in_usd || "0"),
        timestamp: new Date(trade.attributes.block_timestamp).getTime()
      }));
      
      return {
        trades,
        lastUpdated: Date.now()
      };
    } catch (error) {
      console.error("GeckoTerminal API error:", error);
      throw new ConvexError(`Failed to fetch pool trades: ${(error as Error).message}`);
    }
  }
});

// Get trending pools for a network
export const fetchTrendingPools = internalAction({
  args: {
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc"), v.literal("solana")),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { blockchain, limit = 10 } = args;
    const network = NETWORK_MAPPING[blockchain];
    
    // Check cache first
    const cacheKey = `trending:${network}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      return cachedData.data;
    }
    
    try {
      const url = `${GECKOTERMINAL_BASE_URL}/networks/${network}/trending_pools?limit=${limit}`;
      const response = await rateLimitedFetch(url);
      const data = await response.json();
      
      if (!data.data || !Array.isArray(data.data)) {
        return { pools: [] };
      }
      
      const pools = data.data.map((pool: any) => ({
        poolAddress: pool.attributes.address,
        name: pool.attributes.name,
        baseTokenSymbol: pool.attributes.base_token_symbol,
        quoteTokenSymbol: pool.attributes.quote_token_symbol,
        priceUsd: parseFloat(pool.attributes.base_token_price_usd || "0"),
        volume24h: parseFloat(pool.attributes.volume_usd?.h24 || "0"),
        priceChange24h: parseFloat(pool.attributes.price_change_percentage?.h24 || "0"),
        liquidity: parseFloat(pool.attributes.reserve_in_usd || "0")
      }));
      
      const result = {
        pools,
        lastUpdated: Date.now()
      };
      
      // Update cache
      cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      console.error("GeckoTerminal API error:", error);
      throw new ConvexError(`Failed to fetch trending pools: ${(error as Error).message}`);
    }
  }
});

// Clear expired cache entries
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