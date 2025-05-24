import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// Simulate smart contract deployment
export const deployContract = internalAction({
  args: {
    coinId: v.id("memeCoins"),
    blockchain: v.union(v.literal("ethereum"), v.literal("solana"), v.literal("bsc")),
  },
  handler: async (ctx, args) => {
    try {
      // Get coin details
      const coin = await ctx.runQuery(internal.blockchain.getCoinForDeployment, {
        coinId: args.coinId,
      });

      if (!coin) {
        throw new Error("Coin not found");
      }

      // Simulate deployment delay
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

      // Generate mock contract address and transaction hash
      const contractAddress = generateMockAddress(args.blockchain);
      const transactionHash = generateMockTxHash();
      const gasUsed = Math.floor(Math.random() * 500000) + 100000;
      const deploymentCost = Math.random() * 0.1 + 0.01; // 0.01-0.11 ETH equivalent

      // Simulate 95% success rate
      const success = Math.random() > 0.05;

      if (success) {
        // Record successful deployment
        await ctx.runMutation(internal.blockchain.recordDeployment, {
          coinId: args.coinId,
          blockchain: args.blockchain,
          contractAddress,
          transactionHash,
          gasUsed,
          deploymentCost,
        });

        // Update coin status
        await ctx.runMutation(internal.blockchain.updateCoinStatus, {
          coinId: args.coinId,
          status: "deployed",
        });

        // Start generating analytics data
        await ctx.scheduler.runAfter(0, internal.blockchain.generateInitialAnalytics, {
          coinId: args.coinId,
        });

        // Schedule periodic analytics updates
        await ctx.scheduler.runAfter(60000, internal.blockchain.scheduleAnalyticsUpdates, {
          coinId: args.coinId,
        });

      } else {
        // Deployment failed
        await ctx.runMutation(internal.blockchain.updateCoinStatus, {
          coinId: args.coinId,
          status: "failed",
        });
      }

    } catch (error) {
      console.error("Deployment error:", error);
      await ctx.runMutation(internal.blockchain.updateCoinStatus, {
        coinId: args.coinId,
        status: "failed",
      });
    }
  },
});

// Generate initial analytics data
export const generateInitialAnalytics = internalAction({
  args: {
    coinId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    // Generate realistic initial data
    const initialPrice = Math.random() * 0.001 + 0.0001; // $0.0001 - $0.0011
    const initialSupply = 1000000000; // 1B tokens (mock)
    const marketCap = initialPrice * initialSupply;
    const volume24h = marketCap * (Math.random() * 0.1 + 0.01); // 1-11% of market cap
    const holders = Math.floor(Math.random() * 100) + 10; // 10-110 holders
    const transactions24h = Math.floor(Math.random() * 500) + 50; // 50-550 transactions

    await ctx.runMutation(internal.analytics.updateAnalytics, {
      coinId: args.coinId,
      price: initialPrice,
      marketCap,
      volume24h,
      holders,
      transactions24h,
      priceChange24h: 0, // No change on first day
    });
  },
});

// Schedule periodic analytics updates
export const scheduleAnalyticsUpdates = internalAction({
  args: {
    coinId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    // Get latest analytics
    const latest = await ctx.runQuery(internal.blockchain.getLatestAnalytics, {
      coinId: args.coinId,
    });

    if (latest) {
      // Generate new data based on previous values with realistic volatility
      const priceChange = (Math.random() - 0.5) * 0.2; // ±10% max change
      const newPrice = Math.max(0.00001, latest.price * (1 + priceChange));
      const newMarketCap = newPrice * 1000000000; // Assuming 1B supply
      const volumeChange = (Math.random() - 0.5) * 0.3;
      const newVolume = Math.max(1000, latest.volume24h * (1 + volumeChange));
      const holdersChange = Math.floor((Math.random() - 0.3) * 10); // Slight bias toward growth
      const newHolders = Math.max(1, latest.holders + holdersChange);
      const txChange = Math.floor((Math.random() - 0.3) * 50);
      const newTransactions = Math.max(1, latest.transactions24h + txChange);

      await ctx.runMutation(internal.analytics.updateAnalytics, {
        coinId: args.coinId,
        price: newPrice,
        marketCap: newMarketCap,
        volume24h: newVolume,
        holders: newHolders,
        transactions24h: newTransactions,
        priceChange24h: priceChange * 100, // Convert to percentage
      });
    }

    // Schedule next update in 1-5 minutes
    const nextUpdate = Math.floor(Math.random() * 240000) + 60000; // 1-5 minutes
    await ctx.scheduler.runAfter(nextUpdate, internal.blockchain.scheduleAnalyticsUpdates, {
      coinId: args.coinId,
    });
  },
});

// Helper queries and mutations
export const getCoinForDeployment = internalQuery({
  args: {
    coinId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.coinId);
  },
});

export const recordDeployment = internalMutation({
  args: {
    coinId: v.id("memeCoins"),
    blockchain: v.union(v.literal("ethereum"), v.literal("solana"), v.literal("bsc")),
    contractAddress: v.string(),
    transactionHash: v.string(),
    gasUsed: v.number(),
    deploymentCost: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("deployments", {
      coinId: args.coinId,
      blockchain: args.blockchain,
      contractAddress: args.contractAddress,
      transactionHash: args.transactionHash,
      deployedAt: Date.now(),
      gasUsed: args.gasUsed,
      deploymentCost: args.deploymentCost,
    });
  },
});

export const updateCoinStatus = internalMutation({
  args: {
    coinId: v.id("memeCoins"),
    status: v.union(v.literal("pending"), v.literal("deployed"), v.literal("failed")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.coinId, {
      status: args.status,
    });
  },
});

export const getLatestAnalytics = internalQuery({
  args: {
    coinId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("analytics")
      .withIndex("by_coin", (q) => q.eq("coinId", args.coinId))
      .order("desc")
      .first();
  },
});

// Utility functions for generating mock blockchain data
function generateMockAddress(blockchain: string): string {
  const prefixes = {
    ethereum: "0x",
    solana: "",
    bsc: "0x",
  };
  
  const length = blockchain === "solana" ? 44 : 40;
  const chars = blockchain === "solana" 
    ? "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    : "0123456789abcdef";
  
  let result = prefixes[blockchain as keyof typeof prefixes];
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateMockTxHash(): string {
  const chars = "0123456789abcdef";
  let result = "0x";
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
