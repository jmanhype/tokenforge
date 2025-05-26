import { v } from "convex/values";
import { internalAction, internalQuery } from "../_generated/server";
import { internal, api } from "../_generated/api";

// Fetch real price data from blockchain
export const fetchTokenPrice = internalAction({
  args: {
    tokenId: v.id("memeCoins"),
    contractAddress: v.string(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc"), v.literal("solana")),
  },
  handler: async (ctx, args) => {
    // Get bonding curve state from blockchain
    const bondingCurve = await ctx.runQuery(api.bondingCurve.getBondingCurve, { tokenId: args.tokenId });

    if (!bondingCurve || !bondingCurve.contractAddress) {
      throw new Error("Bonding curve not found");
    }

    // Fetch real state from blockchain
    const state = await ctx.runAction(internal.blockchain.bondingCurveIntegration.getBondingCurveState, {
      bondingCurveAddress: bondingCurve.contractAddress,
      blockchain: args.blockchain as "ethereum" | "bsc",
    });

    return {
      price: parseFloat(state.currentPrice),
      marketCap: state.marketCap,
      supply: parseFloat(state.tokenSupply),
      reserveBalance: parseFloat(state.reserveBalance),
      isGraduated: state.isGraduated,
    };
  },
});

// Fetch trading events from blockchain
export const fetchTradingEvents = internalAction({
  args: {
    tokenId: v.id("memeCoins"),
    bondingCurveAddress: v.string(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
    fromBlock: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const events = await ctx.runAction(internal.blockchain.bondingCurveIntegration.monitorBondingCurveEvents, {
      bondingCurveAddress: args.bondingCurveAddress,
      tokenId: args.tokenId,
      blockchain: args.blockchain,
      fromBlock: args.fromBlock,
    });

    // Calculate volume and holder count from events
    let volume24h = 0;
    let transactions24h = 0;
    const uniqueBuyers = new Set<string>();
    const currentTime = Date.now();
    const dayAgo = currentTime - 24 * 60 * 60 * 1000;

    for (const event of events.events) {
      const eventTime = event.blockNumber * 15000; // Approximate block time
      
      if (event.type === "buy") {
        uniqueBuyers.add(event.buyer);
        if (eventTime > dayAgo) {
          volume24h += parseFloat(event.ethSpent);
          transactions24h++;
        }
      } else if (event.type === "sell" && eventTime > dayAgo) {
        volume24h += parseFloat(event.ethReceived);
        transactions24h++;
      }
    }

    return {
      volume24h,
      transactions24h,
      holders: uniqueBuyers.size,
      lastBlock: events.lastBlock,
      events: events.events,
    };
  },
});

// Update analytics with real blockchain data
export const updateAnalyticsFromBlockchain = internalAction({
  args: {
    tokenId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    // Get token deployment info
    const deployment = await ctx.runQuery(internal.memeCoins.getDeployment, { coinId: args.tokenId });
    if (!deployment) throw new Error("Token not deployed");

    // Get bonding curve info
    const bondingCurve = await ctx.runQuery(api.bondingCurve.getBondingCurve, { tokenId: args.tokenId });
    if (!bondingCurve || !bondingCurve.contractAddress) throw new Error("Bonding curve not found");

    // Fetch real price data
    const priceData = await ctx.runAction(internal.analytics.blockchainData.fetchTokenPrice, {
      tokenId: args.tokenId,
      contractAddress: deployment.contractAddress,
      blockchain: deployment.blockchain as "ethereum" | "bsc" | "solana",
    });

    // Fetch trading events
    const eventData = await ctx.runAction(internal.analytics.blockchainData.fetchTradingEvents, {
      tokenId: args.tokenId,
      bondingCurveAddress: bondingCurve.contractAddress,
      blockchain: deployment.blockchain as "ethereum" | "bsc",
    });

    // Get previous analytics for price change calculation
    const previousAnalytics = await ctx.runQuery(internal.analytics.getLatestAnalytics, {
      coinId: args.tokenId,
    });

    const priceChange24h = previousAnalytics 
      ? ((priceData.price - previousAnalytics.price) / previousAnalytics.price) * 100
      : 0;

    // Update analytics in database
    await ctx.runMutation(internal.analytics.updateTokenAnalytics, {
      coinId: args.tokenId,
      price: priceData.price,
      marketCap: priceData.marketCap,
      volume24h: eventData.volume24h,
      holders: eventData.holders,
      transactions24h: eventData.transactions24h,
      priceChange24h,
    });

    // Update bonding curve state
    await ctx.runMutation(internal.bondingCurve.updateBondingCurveState, {
      tokenId: args.tokenId,
      currentPrice: priceData.price,
      currentSupply: priceData.supply,
      reserveBalance: priceData.reserveBalance,
      totalVolume: bondingCurve.totalVolume + eventData.volume24h,
      holders: eventData.holders,
      isGraduated: priceData.isGraduated,
    });

    return {
      price: priceData.price,
      marketCap: priceData.marketCap,
      volume24h: eventData.volume24h,
      holders: eventData.holders,
      transactions24h: eventData.transactions24h,
      priceChange24h,
    };
  },
});

// Get holder balances from blockchain
export const fetchHolderBalances = internalAction({
  args: {
    tokenAddress: v.string(),
    holders: v.array(v.string()),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
  },
  handler: async (ctx, args) => {
    // TODO: Implement real blockchain balance fetching
    // This would use ethers to batch fetch token balances
    const balances: Record<string, number> = {};
    
    // Placeholder until Web3 batch balance fetching is implemented
    for (const holder of args.holders) {
      balances[holder] = 0;
    }

    return balances;
  },
});