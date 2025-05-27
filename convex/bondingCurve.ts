import { v } from "convex/values";
import { mutation, query, action, internalMutation, internalQuery } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

// Initialize bonding curve for a newly deployed token
export const initializeBondingCurve = mutation({
  args: {
    coinId: v.id("memeCoins"),
    initialSupply: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    // Get coin details
    const coin = await ctx.db.get(args.coinId);
    if (!coin) throw new Error("Coin not found");
    if (coin.creatorId !== userId) throw new Error("Not authorized");
    
    // Check if bonding curve already exists
    const existingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.coinId))
      .first();
    
    if (existingCurve) throw new Error("Bonding curve already initialized");
    
    // Create bonding curve record
    const bondingCurveId = await ctx.db.insert("bondingCurves", {
      coinId: args.coinId,
      tokenId: args.coinId, // For compatibility
      currentSupply: 0,
      currentPrice: 0.00001, // Starting price
      reserveBalance: 0,
      totalVolume: 0,
      totalTransactions: 0,
      uniqueHolders: 0,
      holders: 0,
      isActive: true,
      createdAt: Date.now(),
    });
    
    // Schedule bonding curve contract deployment
    await ctx.scheduler.runAfter(0, internal.bondingCurve.deployBondingCurveContract, {
      bondingCurveId,
      coinId: args.coinId,
      initialSupply: args.initialSupply,
    });
    
    return bondingCurveId;
  },
});

// Deploy bonding curve smart contract (internal action)
export const deployBondingCurveContract: any = action({
  args: {
    bondingCurveId: v.id("bondingCurves"),
    coinId: v.id("memeCoins"),
    initialSupply: v.number(),
  },
  handler: async (ctx, args) => {
    // Get coin and deployment details
    const coin = await ctx.runQuery(api.memeCoins.get, { id: args.coinId });
    const deployment = await ctx.runQuery(api.memeCoins.getDeployment, { coinId: args.coinId });
    
    if (!coin || !deployment || !deployment.contractAddress) {
      throw new Error("Token not deployed");
    }
    
    // Deploy bonding curve contract
    const result = await ctx.runAction(internal.blockchain.bondingCurveDeployment.deployBondingCurve, {
      tokenAddress: deployment.contractAddress,
      tokenId: args.coinId,
      blockchain: deployment.blockchain,
    });
    
    // Initialize bonding curve with tokens
    await ctx.runAction(internal.blockchain.bondingCurveDeployment.initializeBondingCurve, {
      bondingCurveAddress: result.bondingCurveAddress,
      tokenAddress: deployment.contractAddress,
      initialSupply: args.initialSupply * 0.4, // 40% of supply for bonding curve
      blockchain: deployment.blockchain,
    });
    
    // Update bonding curve record
    await ctx.runMutation(internal.bondingCurve.updateBondingCurveAddress, {
      bondingCurveId: args.bondingCurveId,
      contractAddress: result.bondingCurveAddress,
      currentSupply: args.initialSupply * 0.4,
    });
    
    return result;
  },
});

// Update bonding curve with contract address (internal mutation)
export const updateBondingCurveAddress = internalMutation({
  args: {
    bondingCurveId: v.id("bondingCurves"),
    contractAddress: v.string(),
    currentSupply: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.bondingCurveId, {
      dexPoolAddress: args.contractAddress, // Using dexPoolAddress field for now
      currentSupply: args.currentSupply,
    });
  },
});

// Record bonding curve deployment (internal mutation)
export const recordBondingCurveDeployment = internalMutation({
  args: {
    tokenId: v.id("memeCoins"),
    bondingCurveAddress: v.string(),
    blockchain: v.string(),
    transactionHash: v.string(),
    deploymentCost: v.string(),
  },
  handler: async (ctx, args) => {
    // Update bonding curve record
    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .first();
    
    if (bondingCurve) {
      await ctx.db.patch(bondingCurve._id, {
        dexPoolAddress: args.bondingCurveAddress,
      });
    }
    
    // Log deployment
    console.log(`Bonding curve deployed for token ${args.tokenId}:`);
    console.log(`- Address: ${args.bondingCurveAddress}`);
    console.log(`- Blockchain: ${args.blockchain}`);
    console.log(`- Transaction: ${args.transactionHash}`);
    console.log(`- Cost: ${args.deploymentCost} ETH/BNB`);
  },
});

// Execute buy order on bonding curve
export const buyTokens: any = action({
  args: {
    tokenId: v.id("memeCoins"),
    ethAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) throw new Error("Not authenticated");
    
    // Get bonding curve details
    const bondingCurve = await ctx.runQuery(api.bondingCurve.getBondingCurve, {
      tokenId: args.tokenId,
    });
    
    if (!bondingCurve || !bondingCurve.isActive) {
      throw new Error("Bonding curve not active");
    }

    if (!bondingCurve.contractAddress) {
      throw new Error("Bonding curve contract not deployed");
    }
    
    // Calculate buy amount using bonding curve formula
    const buyAmount = await ctx.runQuery(api.bondingCurve.calculateBuyAmount, {
      tokenId: args.tokenId,
      amountInUSD: args.ethAmount,
    });

    // Get deployment info
    const deployment = await ctx.runQuery(api.memeCoins.getDeployment, {
      coinId: args.tokenId,
    });

    if (!deployment) {
      throw new Error("Token deployment not found");
    }
    
    // Get transaction data for frontend execution
    const txData = await ctx.runAction(internal.blockchain.bondingCurveIntegration.executeBondingCurveBuy, {
      bondingCurveAddress: bondingCurve.contractAddress,
      tokenId: args.tokenId,
      blockchain: deployment.blockchain,
      buyer: userId.subject,
      ethAmount: args.ethAmount,
      minTokensOut: buyAmount.tokensOut * 0.99, // 1% slippage tolerance
    });
    
    // Return transaction data for frontend to execute
    return {
      success: true,
      txData,
      expectedTokens: buyAmount.tokensOut,
      avgPrice: buyAmount.avgPrice,
    };
  },
});

// Execute sell order on bonding curve
export const sellTokens: any = action({
  args: {
    tokenId: v.id("memeCoins"),
    tokenAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) throw new Error("Not authenticated");
    
    // Get bonding curve details
    const bondingCurve = await ctx.runQuery(api.bondingCurve.getBondingCurve, {
      tokenId: args.tokenId,
    });
    
    if (!bondingCurve || !bondingCurve.isActive) {
      throw new Error("Bonding curve not active");
    }

    if (!bondingCurve.contractAddress) {
      throw new Error("Bonding curve contract not deployed");
    }
    
    // Calculate sell return using bonding curve formula
    const sellReturn = await ctx.runQuery(api.bondingCurve.calculateSellReturn, {
      tokenId: args.tokenId,
      tokenAmount: args.tokenAmount,
    });

    // Get deployment info
    const deployment = await ctx.runQuery(api.memeCoins.getDeployment, {
      coinId: args.tokenId,
    });

    if (!deployment) {
      throw new Error("Token deployment not found");
    }
    
    // Get transaction data for frontend execution
    const txData = await ctx.runAction(internal.blockchain.bondingCurveIntegration.executeBondingCurveSell, {
      bondingCurveAddress: bondingCurve.contractAddress,
      tokenId: args.tokenId,
      blockchain: deployment.blockchain,
      seller: userId.subject,
      tokenAmount: args.tokenAmount,
      minEthOut: sellReturn.amountOut * 0.99, // 1% slippage tolerance
    });
    
    // Return transaction data for frontend to execute
    return {
      success: true,
      txData,
      expectedEth: sellReturn.amountOut,
      avgPrice: sellReturn.avgPrice,
    };
  },
});

// Internal mutation to create bonding curve record
export const createBondingCurveRecord = internalMutation({
  args: {
    coinId: v.id("memeCoins"),
    currentSupply: v.number(),
    currentPrice: v.number(),
    reserveBalance: v.number(),
    totalVolume: v.number(),
    totalTransactions: v.number(),
    holders: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("bondingCurves", {
      coinId: args.coinId,
      tokenId: args.coinId, // For compatibility
      currentSupply: args.currentSupply,
      currentPrice: args.currentPrice,
      reserveBalance: args.reserveBalance,
      totalVolume: args.totalVolume,
      totalTransactions: args.totalTransactions,
      uniqueHolders: 0,
      holders: args.holders,
      isActive: args.isActive,
      createdAt: args.createdAt,
    });
  },
});

// Get bonding curve details
export const getBondingCurve = query({
  args: { tokenId: v.id("memeCoins") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .first();
  },
});

// Calculate buy amount based on bonding curve
export const calculateBuyAmount = query({
  args: {
    tokenId: v.id("memeCoins"),
    amountInUSD: v.number(),
  },
  handler: async (ctx, args) => {
    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .first();
    
    if (!bondingCurve) throw new Error("Bonding curve not found");
    
    // Implement bonding curve formula: Price = 0.00001 * (supply / 1e9)^1.5
    const k = 0.00001;
    const n = 1.5;
    
    const currentSupply = bondingCurve.currentSupply;
    const reserveBalance = bondingCurve.reserveBalance;
    
    // Calculate tokens out using numerical integration
    let tokensOut = 0;
    let remainingAmount = args.amountInUSD;
    let tempSupply = currentSupply;
    const step = 1000; // 1000 tokens per step
    
    while (remainingAmount > 0 && tempSupply < 1e12) { // Max 1 trillion tokens
      const price = k * Math.pow(tempSupply / 1e9, n);
      const stepCost = price * step;
      
      if (stepCost <= remainingAmount) {
        tokensOut += step;
        tempSupply += step;
        remainingAmount -= stepCost;
      } else {
        // Calculate partial step
        const partialTokens = remainingAmount / price;
        tokensOut += partialTokens;
        remainingAmount = 0;
      }
    }
    
    const avgPrice = args.amountInUSD / tokensOut;
    const newSupply = currentSupply + tokensOut;
    const newPrice = k * Math.pow(newSupply / 1e9, n);
    
    return {
      tokensOut,
      avgPrice,
      newPrice,
      priceImpact: ((newPrice - bondingCurve.currentPrice) / bondingCurve.currentPrice) * 100,
    };
  },
});

// Calculate sell return based on bonding curve
export const calculateSellReturn = query({
  args: {
    tokenId: v.id("memeCoins"),
    tokenAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .first();
    
    if (!bondingCurve) throw new Error("Bonding curve not found");
    
    // Implement bonding curve formula
    const k = 0.00001;
    const n = 1.5;
    
    const currentSupply = bondingCurve.currentSupply;
    
    if (args.tokenAmount > currentSupply) {
      throw new Error("Insufficient liquidity");
    }
    
    // Calculate ETH out using numerical integration
    let ethOut = 0;
    let remainingTokens = args.tokenAmount;
    let tempSupply = currentSupply;
    const step = 1000; // 1000 tokens per step
    
    while (remainingTokens > 0 && tempSupply > 0) {
      const price = k * Math.pow(tempSupply / 1e9, n);
      
      if (step <= remainingTokens && step <= tempSupply) {
        ethOut += price * step;
        tempSupply -= step;
        remainingTokens -= step;
      } else {
        // Calculate partial step
        const partialTokens = Math.min(remainingTokens, tempSupply);
        ethOut += price * partialTokens;
        remainingTokens = 0;
      }
    }
    
    const avgPrice = ethOut / args.tokenAmount;
    const newSupply = currentSupply - args.tokenAmount;
    const newPrice = k * Math.pow(newSupply / 1e9, n);
    
    return {
      amountOut: ethOut,
      avgPrice,
      newPrice,
      priceImpact: ((bondingCurve.currentPrice - newPrice) / bondingCurve.currentPrice) * 100,
    };
  },
});

// Record buy transaction
export const recordBuyTransaction = mutation({
  args: {
    tokenId: v.id("memeCoins"),
    user: v.string(),
    ethAmount: v.number(),
    tokenAmount: v.number(),
    price: v.number(),
  },
  handler: async (ctx, args) => {
    // Get bonding curve
    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .first();
    
    if (!bondingCurve) throw new Error("Bonding curve not found");
    
    // Calculate fees (1% fee as per smart contract)
    const feeAmount = args.ethAmount * 0.01;
    
    // Update bonding curve state
    await ctx.db.patch(bondingCurve._id, {
      currentSupply: bondingCurve.currentSupply + args.tokenAmount,
      currentPrice: args.price,
      reserveBalance: bondingCurve.reserveBalance + args.ethAmount,
      totalVolume: bondingCurve.totalVolume + args.ethAmount,
      totalTransactions: bondingCurve.totalTransactions + 1,
    });
    
    // Record transaction
    await ctx.db.insert("bondingCurveTransactions", {
      bondingCurveId: bondingCurve._id,
      type: "buy",
      user: args.user,
      amountIn: args.ethAmount,
      tokensOut: args.tokenAmount,
      price: args.price,
      timestamp: Date.now(),
    });
    
    // Record revenue for creator
    await ctx.scheduler.runAfter(0, internal.revenue.creatorRevenue.recordBondingCurveFee, {
      tokenId: args.tokenId,
      feeAmount,
      blockchain: bondingCurve.blockchain || "ethereum",
    });

    // Check for auto-burn on buy
    const burnConfig = await ctx.db
      .query("burnConfigs")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (burnConfig?.autoBurnEnabled && burnConfig.burnFeePercent > 0) {
      const burnAmount = (args.tokenAmount * burnConfig.burnFeePercent) / 10000;
      if (burnAmount > 0) {
        await ctx.scheduler.runAfter(0, internal.tokenBurn.recordAutoBurn, {
          tokenId: args.tokenId,
          amount: burnAmount,
          txHash: "",
          burnType: "trading_fee",
        });
      }
    }
    
    // Update holder tracking
    const holder = await ctx.db
      .query("bondingCurveHolders")
      .withIndex("by_curve_user", (q) => 
        q.eq("bondingCurveId", bondingCurve._id).eq("user", args.user)
      )
      .first();
    
    if (holder) {
      await ctx.db.patch(holder._id, {
        balance: holder.balance + args.tokenAmount,
      });
    } else {
      await ctx.db.insert("bondingCurveHolders", {
        bondingCurveId: bondingCurve._id,
        user: args.user,
        balance: args.tokenAmount,
      });
      
      // Update unique holders count
      await ctx.db.patch(bondingCurve._id, {
        uniqueHolders: (bondingCurve.uniqueHolders || 0) + 1,
        holders: bondingCurve.holders + 1,
      });
    }
  },
});

// Record sell transaction
export const recordSellTransaction = mutation({
  args: {
    tokenId: v.id("memeCoins"),
    user: v.string(),
    tokenAmount: v.number(),
    ethAmount: v.number(),
    price: v.number(),
  },
  handler: async (ctx, args) => {
    // Get bonding curve
    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .first();
    
    if (!bondingCurve) throw new Error("Bonding curve not found");
    
    // Calculate fees (1% fee as per smart contract)
    const feeAmount = args.ethAmount * 0.01;
    
    // Update bonding curve state
    await ctx.db.patch(bondingCurve._id, {
      currentSupply: bondingCurve.currentSupply - args.tokenAmount,
      currentPrice: args.price,
      reserveBalance: bondingCurve.reserveBalance - args.ethAmount,
      totalVolume: bondingCurve.totalVolume + args.ethAmount,
      totalTransactions: bondingCurve.totalTransactions + 1,
    });
    
    // Record transaction
    await ctx.db.insert("bondingCurveTransactions", {
      bondingCurveId: bondingCurve._id,
      type: "sell",
      user: args.user,
      tokensIn: args.tokenAmount,
      amountOut: args.ethAmount,
      price: args.price,
      timestamp: Date.now(),
    });
    
    // Record revenue for creator
    await ctx.scheduler.runAfter(0, internal.revenue.creatorRevenue.recordBondingCurveFee, {
      tokenId: args.tokenId,
      feeAmount,
      blockchain: bondingCurve.blockchain || "ethereum",
    });

    // Check for auto-burn on buy
    const burnConfig = await ctx.db
      .query("burnConfigs")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();

    if (burnConfig?.autoBurnEnabled && burnConfig.burnFeePercent > 0) {
      const burnAmount = (args.tokenAmount * burnConfig.burnFeePercent) / 10000;
      if (burnAmount > 0) {
        await ctx.scheduler.runAfter(0, internal.tokenBurn.recordAutoBurn, {
          tokenId: args.tokenId,
          amount: burnAmount,
          txHash: "",
          burnType: "trading_fee",
        });
      }
    }
    
    // Update holder tracking
    const holder = await ctx.db
      .query("bondingCurveHolders")
      .withIndex("by_curve_user", (q) => 
        q.eq("bondingCurveId", bondingCurve._id).eq("user", args.user)
      )
      .first();
    
    if (holder) {
      const newBalance = holder.balance - args.tokenAmount;
      
      if (newBalance <= 0) {
        await ctx.db.delete(holder._id);
        
        // Update unique holders count
        await ctx.db.patch(bondingCurve._id, {
          uniqueHolders: Math.max(0, (bondingCurve.uniqueHolders || 0) - 1),
          holders: Math.max(0, bondingCurve.holders - 1),
        });
      } else {
        await ctx.db.patch(holder._id, {
          balance: newBalance,
        });
      }
    }
  },
});

// Internal mutation to update bonding curve state from blockchain
export const updateBondingCurveState = internalMutation({
  args: {
    tokenId: v.id("memeCoins"),
    currentPrice: v.number(),
    currentSupply: v.number(),
    reserveBalance: v.number(),
    totalVolume: v.number(),
    holders: v.number(),
    isGraduated: v.boolean(),
  },
  handler: async (ctx, args) => {
    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .first();
    
    if (!bondingCurve) throw new Error("Bonding curve not found");
    
    await ctx.db.patch(bondingCurve._id, {
      currentPrice: args.currentPrice,
      currentSupply: args.currentSupply,
      reserveBalance: args.reserveBalance,
      totalVolume: args.totalVolume,
      holders: args.holders,
      uniqueHolders: args.holders,
      isActive: !args.isGraduated,
    });

    // If graduated, update status
    if (args.isGraduated && bondingCurve.isActive) {
      await ctx.db.patch(bondingCurve._id, {
        isActive: false,
        graduatedAt: Date.now(),
      });

      // Update token status
      await ctx.db.patch(args.tokenId, {
        status: "graduated",
      });
    }
  },
});

// Internal mutation to reset 24h volume
export const reset24hVolume = internalMutation({
  args: {},
  handler: async (ctx) => {
    const activeBondingCurves = await ctx.db
      .query("bondingCurves")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    
    for (const curve of activeBondingCurves) {
      // Store current volume as previous 24h volume
      await ctx.db.patch(curve._id, {
        volume24h: 0,
        // Remove previousDayVolume as it's not in schema
      });
    }
  },
});