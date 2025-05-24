import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

// Cache configuration
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes for blockchain data
const RATE_LIMIT_DELAY = 200; // 200ms between requests (5 requests per second)

// Explorer URLs
const EXPLORER_URLS = {
  ethereum: {
    api: "https://api.etherscan.io/api",
    apiKeyEnv: "ETHERSCAN_API_KEY"
  },
  bsc: {
    api: "https://api.bscscan.com/api",
    apiKeyEnv: "BSCSCAN_API_KEY"
  },
  solana: {
    api: "https://api.solscan.io",
    apiKeyEnv: "SOLSCAN_API_KEY"
  }
} as const;

interface TokenAnalytics {
  holdersCount: number;
  transfersCount: number;
  totalTransactions: number;
  uniqueSenders: number;
  uniqueReceivers: number;
  topHolders: Array<{
    address: string;
    balance: string;
    percentage: number;
  }>;
}

interface TransactionData {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  blockNumber: number;
  gasUsed?: string;
  gasPrice?: string;
}

interface ExplorerCache {
  data: any;
  timestamp: number;
}

// In-memory cache
const cache = new Map<string, ExplorerCache>();

// Rate limiting
const rateLimitQueues = new Map<string, number>();

async function rateLimitedFetch(blockchain: string, url: string): Promise<Response> {
  const lastRequestTime = rateLimitQueues.get(blockchain) || 0;
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
  }
  
  rateLimitQueues.set(blockchain, Date.now());
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new ConvexError(`Explorer API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Check for API-specific error messages
  if (data.status === "0" && data.message !== "No transactions found") {
    throw new ConvexError(`Explorer API error: ${data.message || data.result}`);
  }
  
  return response;
}

// Fetch token holder analytics for Ethereum/BSC
async function fetchEVMTokenAnalytics(
  contractAddress: string,
  blockchain: "ethereum" | "bsc"
): Promise<TokenAnalytics> {
  const explorer = EXPLORER_URLS[blockchain];
  const apiKey = process.env[explorer.apiKeyEnv];
  
  if (!apiKey) {
    throw new ConvexError(`${explorer.apiKeyEnv} not configured`);
  }
  
  // Fetch top token holders
  const holdersUrl = `${explorer.api}?module=token&action=tokenholderlist&contractaddress=${contractAddress}&page=1&offset=100&apikey=${apiKey}`;
  const holdersResponse = await rateLimitedFetch(blockchain, holdersUrl);
  const holdersData = await holdersResponse.json();
  
  // Fetch token transfers
  const transfersUrl = `${explorer.api}?module=token&action=tokentx&contractaddress=${contractAddress}&page=1&offset=10000&sort=desc&apikey=${apiKey}`;
  const transfersResponse = await rateLimitedFetch(blockchain, transfersUrl);
  const transfersData = await transfersResponse.json();
  
  const holders = holdersData.result || [];
  const transfers = transfersData.result || [];
  
  // Calculate unique addresses
  const uniqueAddresses = new Set<string>();
  const senders = new Set<string>();
  const receivers = new Set<string>();
  
  transfers.forEach((tx: any) => {
    uniqueAddresses.add(tx.from.toLowerCase());
    uniqueAddresses.add(tx.to.toLowerCase());
    senders.add(tx.from.toLowerCase());
    receivers.add(tx.to.toLowerCase());
  });
  
  // Get total supply for percentage calculation
  const supplyUrl = `${explorer.api}?module=stats&action=tokensupply&contractaddress=${contractAddress}&apikey=${apiKey}`;
  const supplyResponse = await rateLimitedFetch(blockchain, supplyUrl);
  const supplyData = await supplyResponse.json();
  const totalSupply = BigInt(supplyData.result || "0");
  
  // Calculate top holders with percentages
  const topHolders = holders.slice(0, 10).map((holder: any) => {
    const balance = BigInt(holder.TokenHolderQuantity || "0");
    const percentage = totalSupply > 0n 
      ? Number((balance * 10000n) / totalSupply) / 100 
      : 0;
    
    return {
      address: holder.TokenHolderAddress,
      balance: holder.TokenHolderQuantity,
      percentage
    };
  });
  
  return {
    holdersCount: holders.length,
    transfersCount: transfers.length,
    totalTransactions: transfers.length,
    uniqueSenders: senders.size,
    uniqueReceivers: receivers.size,
    topHolders
  };
}

// Fetch token analytics for Solana
async function fetchSolanaTokenAnalytics(
  mintAddress: string
): Promise<TokenAnalytics> {
  const apiKey = process.env.SOLSCAN_API_KEY;
  
  if (!apiKey) {
    throw new ConvexError("SOLSCAN_API_KEY not configured");
  }
  
  // Fetch token holders
  const holdersUrl = `${EXPLORER_URLS.solana.api}/token/holders?token=${mintAddress}&offset=0&limit=100`;
  const holdersResponse = await rateLimitedFetch("solana", holdersUrl);
  const holdersData = await holdersResponse.json();
  
  // Fetch token meta for supply info
  const metaUrl = `${EXPLORER_URLS.solana.api}/token/meta?token=${mintAddress}`;
  const metaResponse = await rateLimitedFetch("solana", metaUrl);
  const metaData = await metaResponse.json();
  
  // Fetch transfer count
  const transferUrl = `${EXPLORER_URLS.solana.api}/token/transfer?token=${mintAddress}&offset=0&limit=1`;
  const transferResponse = await rateLimitedFetch("solana", transferUrl);
  const transferData = await transferResponse.json();
  
  const holders = holdersData.data?.holders || [];
  const totalSupply = BigInt(metaData.data?.supply || "0");
  const decimals = metaData.data?.decimals || 9;
  
  // Calculate top holders with percentages
  const topHolders = holders.slice(0, 10).map((holder: any) => {
    const balance = BigInt(holder.amount || "0");
    const percentage = totalSupply > 0n 
      ? Number((balance * 10000n) / totalSupply) / 100 
      : 0;
    
    return {
      address: holder.owner,
      balance: holder.amount,
      percentage
    };
  });
  
  return {
    holdersCount: holdersData.data?.total || 0,
    transfersCount: transferData.data?.total || 0,
    totalTransactions: transferData.data?.total || 0,
    uniqueSenders: 0, // Solscan doesn't provide this easily
    uniqueReceivers: 0, // Solscan doesn't provide this easily
    topHolders
  };
}

// Main function to fetch token analytics
export const fetchTokenAnalytics = internalAction({
  args: {
    contractAddress: v.string(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc"), v.literal("solana"))
  },
  handler: async (ctx, args) => {
    const { contractAddress, blockchain } = args;
    
    // Check cache first
    const cacheKey = `analytics:${blockchain}:${contractAddress.toLowerCase()}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      return cachedData.data;
    }
    
    try {
      let analytics: TokenAnalytics;
      
      if (blockchain === "solana") {
        analytics = await fetchSolanaTokenAnalytics(contractAddress);
      } else {
        analytics = await fetchEVMTokenAnalytics(contractAddress, blockchain);
      }
      
      const result = {
        ...analytics,
        lastUpdated: Date.now()
      };
      
      // Update cache
      cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      console.error("Blockchain explorer API error:", error);
      throw new ConvexError(`Failed to fetch token analytics: ${(error as Error).message}`);
    }
  }
});

// Fetch recent transactions
export const fetchRecentTransactions = internalAction({
  args: {
    contractAddress: v.string(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc"), v.literal("solana")),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { contractAddress, blockchain, limit = 50 } = args;
    
    // Check cache first
    const cacheKey = `transactions:${blockchain}:${contractAddress.toLowerCase()}:${limit}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      return cachedData.data;
    }
    
    try {
      let transactions: TransactionData[] = [];
      
      if (blockchain === "ethereum" || blockchain === "bsc") {
        const explorer = EXPLORER_URLS[blockchain];
        const apiKey = process.env[explorer.apiKeyEnv];
        
        if (!apiKey) {
          throw new ConvexError(`${explorer.apiKeyEnv} not configured`);
        }
        
        const url = `${explorer.api}?module=token&action=tokentx&contractaddress=${contractAddress}&page=1&offset=${limit}&sort=desc&apikey=${apiKey}`;
        const response = await rateLimitedFetch(blockchain, url);
        const data = await response.json();
        
        transactions = (data.result || []).map((tx: any) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value,
          timestamp: parseInt(tx.timeStamp) * 1000,
          blockNumber: parseInt(tx.blockNumber),
          gasUsed: tx.gasUsed,
          gasPrice: tx.gasPrice
        }));
      } else if (blockchain === "solana") {
        const apiKey = process.env.SOLSCAN_API_KEY;
        
        if (!apiKey) {
          throw new ConvexError("SOLSCAN_API_KEY not configured");
        }
        
        const url = `${EXPLORER_URLS.solana.api}/token/transfer?token=${contractAddress}&offset=0&limit=${limit}`;
        const response = await rateLimitedFetch(blockchain, url);
        const data = await response.json();
        
        transactions = (data.data?.transfers || []).map((tx: any) => ({
          hash: tx.signature,
          from: tx.from,
          to: tx.to,
          value: tx.amount,
          timestamp: tx.blockTime * 1000,
          blockNumber: tx.slot
        }));
      }
      
      const result = {
        transactions,
        count: transactions.length,
        lastUpdated: Date.now()
      };
      
      // Update cache
      cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      console.error("Blockchain explorer API error:", error);
      throw new ConvexError(`Failed to fetch recent transactions: ${(error as Error).message}`);
    }
  }
});

// Fetch transaction volume over time
export const fetchTransactionVolume = internalAction({
  args: {
    contractAddress: v.string(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc"), v.literal("solana")),
    days: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { contractAddress, blockchain, days = 7 } = args;
    
    // Check cache first
    const cacheKey = `volume:${blockchain}:${contractAddress.toLowerCase()}:${days}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      return cachedData.data;
    }
    
    try {
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - (days * 24 * 60 * 60);
      
      if (blockchain === "ethereum" || blockchain === "bsc") {
        const explorer = EXPLORER_URLS[blockchain];
        const apiKey = process.env[explorer.apiKeyEnv];
        
        if (!apiKey) {
          throw new ConvexError(`${explorer.apiKeyEnv} not configured`);
        }
        
        // Get the starting block number
        const startBlockUrl = `${explorer.api}?module=block&action=getblocknobytime&timestamp=${startTime}&closest=before&apikey=${apiKey}`;
        const startBlockResponse = await rateLimitedFetch(blockchain, startBlockUrl);
        const startBlockData = await startBlockResponse.json();
        const startBlock = startBlockData.result;
        
        // Fetch transfers within the time range
        const url = `${explorer.api}?module=token&action=tokentx&contractaddress=${contractAddress}&startblock=${startBlock}&endblock=latest&sort=asc&apikey=${apiKey}`;
        const response = await rateLimitedFetch(blockchain, url);
        const data = await response.json();
        
        // Group transactions by day
        const volumeByDay = new Map<string, { count: number; volume: bigint }>();
        
        (data.result || []).forEach((tx: any) => {
          const date = new Date(parseInt(tx.timeStamp) * 1000).toISOString().split('T')[0];
          const existing = volumeByDay.get(date) || { count: 0, volume: 0n };
          volumeByDay.set(date, {
            count: existing.count + 1,
            volume: existing.volume + BigInt(tx.value || "0")
          });
        });
        
        const result = {
          volumeData: Array.from(volumeByDay.entries()).map(([date, data]) => ({
            date,
            transactionCount: data.count,
            volume: data.volume.toString()
          })),
          totalTransactions: data.result?.length || 0,
          lastUpdated: Date.now()
        };
        
        // Update cache
        cache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
        
        return result;
      } else {
        // Solana implementation would go here
        return {
          volumeData: [],
          totalTransactions: 0,
          lastUpdated: Date.now()
        };
      }
    } catch (error) {
      console.error("Blockchain explorer API error:", error);
      throw new ConvexError(`Failed to fetch transaction volume: ${(error as Error).message}`);
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