import { v } from "convex/values";
import { internalAction, internalMutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { ethers } from "ethers";

// Chainlink Price Feed addresses
const CHAINLINK_FEEDS = {
  ethereum: {
    "ETH/USD": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    "BTC/USD": "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
  },
  sepolia: {
    "ETH/USD": "0x694AA1769357215DE4FAC081bf1f309aDC325306",
    "BTC/USD": "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43",
  },
  bsc: {
    "BNB/USD": "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE",
    "ETH/USD": "0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e",
  },
  "bsc-testnet": {
    "BNB/USD": "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526",
    "ETH/USD": "0x143db3CEEfbdfe5631aDD3E50f7614B6ba708BA7",
  },
};

// Uniswap V3 Oracle (TWAP) contract addresses
const UNISWAP_V3_ORACLE = {
  ethereum: "0x75c0530885F385721fddA23C539AF3701d6183D4",
  sepolia: "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997",
};

// Chainlink Aggregator ABI
const CHAINLINK_ABI = [
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() external view returns (uint8)",
];

// Get price from Chainlink oracle
export const getChainlinkPrice = internalAction({
  args: {
    pair: v.string(), // e.g., "ETH/USD"
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
    testnet: v.boolean(),
  },
  handler: async (ctx, args) => {
    const network = args.testnet 
      ? (args.blockchain === "ethereum" ? "sepolia" : "bsc-testnet")
      : args.blockchain;
    
    const feedAddress = CHAINLINK_FEEDS[network]?.[args.pair];
    if (!feedAddress) {
      throw new Error(`No Chainlink feed for ${args.pair} on ${network}`);
    }
    
    const rpcUrl = args.blockchain === "ethereum"
      ? process.env.ETHEREUM_RPC_URL
      : process.env.BSC_RPC_URL;
    
    if (!rpcUrl) {
      throw new Error(`Missing RPC URL for ${args.blockchain}`);
    }
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const priceFeed = new ethers.Contract(feedAddress, CHAINLINK_ABI, provider);
    
    try {
      const [roundData, decimals] = await Promise.all([
        priceFeed.latestRoundData(),
        priceFeed.decimals(),
      ]);
      
      const price = Number(roundData.answer) / Math.pow(10, decimals);
      
      return {
        price,
        timestamp: Number(roundData.updatedAt),
        roundId: roundData.roundId.toString(),
        source: "chainlink",
      };
    } catch (error) {
      console.error("Chainlink price fetch error:", error);
      throw new Error("Failed to fetch Chainlink price");
    }
  },
});

// Get token price from Uniswap V3 TWAP
export const getUniswapV3TWAP = internalAction({
  args: {
    tokenAddress: v.string(),
    poolAddress: v.string(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
    testnet: v.boolean(),
    period: v.optional(v.number()), // TWAP period in seconds (default: 600 = 10 minutes)
  },
  handler: async (ctx, args) => {
    const network = args.testnet ? "sepolia" : args.blockchain;
    const period = args.period || 600; // 10 minutes default
    
    const rpcUrl = args.blockchain === "ethereum"
      ? process.env.ETHEREUM_RPC_URL
      : process.env.BSC_RPC_URL;
    
    if (!rpcUrl) {
      throw new Error(`Missing RPC URL for ${args.blockchain}`);
    }
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Uniswap V3 Pool ABI for oracle functionality
    const POOL_ABI = [
      "function observe(uint32[] calldata secondsAgos) external view returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)",
      "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
      "function token0() external view returns (address)",
      "function token1() external view returns (address)",
    ];
    
    const pool = new ethers.Contract(args.poolAddress, POOL_ABI, provider);
    
    try {
      // Get current and historical observations
      const secondsAgos = [period, 0]; // [past, current]
      const observations = await pool.observe(secondsAgos);
      
      // Calculate average tick
      const tickCumulativesDelta = Number(observations.tickCumulatives[1] - observations.tickCumulatives[0]);
      const averageTick = Math.floor(tickCumulativesDelta / period);
      
      // Convert tick to price
      const sqrtPriceX96 = Math.pow(1.0001, averageTick) * Math.pow(2, 96);
      const price = Math.pow(sqrtPriceX96 / Math.pow(2, 96), 2);
      
      // Get token ordering
      const [token0, token1] = await Promise.all([
        pool.token0(),
        pool.token1(),
      ]);
      
      // Adjust price based on token ordering
      const isToken0 = token0.toLowerCase() === args.tokenAddress.toLowerCase();
      const adjustedPrice = isToken0 ? price : 1 / price;
      
      return {
        price: adjustedPrice,
        timestamp: Math.floor(Date.now() / 1000),
        period,
        source: "uniswapV3TWAP",
      };
    } catch (error) {
      console.error("Uniswap V3 TWAP error:", error);
      throw new Error("Failed to fetch Uniswap V3 TWAP");
    }
  },
});

// Get aggregated price from multiple sources
export const getAggregatedPrice = internalAction({
  args: {
    tokenAddress: v.string(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
    testnet: v.boolean(),
    sources: v.optional(v.array(v.union(
      v.literal("chainlink"),
      v.literal("uniswapV3"),
      v.literal("coingecko"),
      v.literal("internal")
    ))),
  },
  handler: async (ctx, args) => {
    const sources = args.sources || ["chainlink", "uniswapV3", "internal"];
    const prices: { source: string; price: number; weight: number }[] = [];
    
    // Get native token price from Chainlink
    const nativePair = args.blockchain === "ethereum" ? "ETH/USD" : "BNB/USD";
    let nativePrice = 1800; // Default ETH price
    
    try {
      const chainlinkNative = await getChainlinkPrice(ctx, {
        pair: nativePair,
        blockchain: args.blockchain,
        testnet: args.testnet,
      });
      nativePrice = chainlinkNative.price;
    } catch (error) {
      console.warn("Failed to get native token price:", error);
    }
    
    // Get token price from various sources
    for (const source of sources) {
      try {
        switch (source) {
          case "chainlink":
            // Most tokens won't have direct Chainlink feeds
            // Would need to implement routing through ETH/USD
            break;
            
          case "uniswapV3":
            // Get from Uniswap V3 pool if exists
            const poolInfo = await ctx.runAction(internal.dex.uniswapV3.getUniswapV3PoolInfo, {
              tokenAddress: args.tokenAddress,
              blockchain: args.blockchain,
              testnet: args.testnet,
            });
            
            if (poolInfo.poolExists && poolInfo.poolAddress) {
              const twap = await getUniswapV3TWAP(ctx, {
                tokenAddress: args.tokenAddress,
                poolAddress: poolInfo.poolAddress,
                blockchain: args.blockchain,
                testnet: args.testnet,
              });
              
              prices.push({
                source: "uniswapV3",
                price: twap.price * nativePrice, // Convert to USD
                weight: 0.4,
              });
            }
            break;
            
          case "coingecko":
            // Get from CoinGecko API if listed
            const coingeckoPrice = await ctx.runAction(internal.analytics.coingecko.getTokenPrice, {
              contractAddress: args.tokenAddress,
              blockchain: args.blockchain,
            });
            
            if (coingeckoPrice) {
              prices.push({
                source: "coingecko",
                price: coingeckoPrice,
                weight: 0.3,
              });
            }
            break;
            
          case "internal":
            // Get from internal bonding curve
            const token = await ctx.runQuery(internal.memeCoins.getByContractAddress, {
              contractAddress: args.tokenAddress,
            });
            
            if (token) {
              const bondingCurve = await ctx.runQuery(internal.bondingCurve.getBondingCurve, {
                tokenId: token._id,
              });
              
              if (bondingCurve && bondingCurve.currentPrice > 0) {
                prices.push({
                  source: "internal",
                  price: bondingCurve.currentPrice,
                  weight: 0.3,
                });
              }
            }
            break;
        }
      } catch (error) {
        console.warn(`Failed to get price from ${source}:`, error);
      }
    }
    
    if (prices.length === 0) {
      throw new Error("No price sources available");
    }
    
    // Calculate weighted average price
    const totalWeight = prices.reduce((sum, p) => sum + p.weight, 0);
    const weightedPrice = prices.reduce((sum, p) => sum + (p.price * p.weight), 0) / totalWeight;
    
    // Store price in database
    await ctx.runMutation(internal.oracles.priceOracle.recordPrice, {
      tokenAddress: args.tokenAddress,
      price: weightedPrice,
      sources: prices.map(p => ({
        source: p.source,
        price: p.price,
      })),
      timestamp: Date.now(),
    });
    
    return {
      price: weightedPrice,
      sources: prices,
      confidence: calculatePriceConfidence(prices),
      timestamp: Date.now(),
    };
  },
});

// Calculate price confidence based on source agreement
function calculatePriceConfidence(prices: { price: number; weight: number }[]): number {
  if (prices.length <= 1) return 0.5;
  
  const avg = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
  const variance = prices.reduce((sum, p) => sum + Math.pow(p.price - avg, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = stdDev / avg;
  
  // Higher confidence when prices agree (lower CV)
  return Math.max(0, Math.min(1, 1 - coefficientOfVariation));
}

// Record price in database
export const recordPrice = internalMutation({
  args: {
    tokenAddress: v.string(),
    price: v.number(),
    sources: v.array(v.object({
      source: v.string(),
      price: v.number(),
    })),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    // Store in price history
    await ctx.db.insert("priceHistory", {
      tokenAddress: args.tokenAddress,
      price: args.price,
      sources: args.sources,
      timestamp: args.timestamp,
    });
    
    // Update latest price cache
    const cacheKey = `price:${args.tokenAddress}`;
    const existingCache = await ctx.db
      .query("cache")
      .withIndex("by_key", (q) => q.eq("key", cacheKey))
      .first();
    
    const cacheData = {
      key: cacheKey,
      value: {
        price: args.price,
        sources: args.sources,
        timestamp: args.timestamp,
      },
      expiresAt: args.timestamp + 300000, // 5 minutes
      createdAt: args.timestamp,
      updatedAt: args.timestamp,
    };
    
    if (existingCache) {
      await ctx.db.patch(existingCache._id, cacheData);
    } else {
      await ctx.db.insert("cache", cacheData);
    }
  },
});

// Get latest cached price
export const getLatestPrice = query({
  args: {
    tokenAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const cacheKey = `price:${args.tokenAddress}`;
    const cached = await ctx.db
      .query("cache")
      .withIndex("by_key", (q) => q.eq("key", cacheKey))
      .first();
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as {
        price: number;
        sources: { source: string; price: number }[];
        timestamp: number;
      };
    }
    
    return null;
  },
});

// Get historical prices
export const getPriceHistory = query({
  args: {
    tokenAddress: v.string(),
    timeframe: v.union(
      v.literal("1h"),
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d")
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const timeframes = {
      "1h": 3600000,
      "24h": 86400000,
      "7d": 604800000,
      "30d": 2592000000,
    };
    
    const since = now - timeframes[args.timeframe];
    
    const history = await ctx.db
      .query("priceHistory")
      .withIndex("by_token_time", (q) => 
        q.eq("tokenAddress", args.tokenAddress)
         .gte("timestamp", since)
      )
      .order("desc")
      .take(1000);
    
    return history;
  },
});