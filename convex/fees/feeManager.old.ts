"use node";

import { v } from "convex/values";
import { internalAction, internalMutation, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";

// Fee types enum matching contract
export const FeeTypes = {
  TOKEN_CREATION: 0,
  BONDING_CURVE_TRADE: 1,
  DEX_GRADUATION: 2,
  LIQUIDITY_PROVISION: 3,
  MULTI_SIG_DEPLOYMENT: 4,
} as const;

// Get FeeCollector contract artifact
const getFeeCollectorArtifact = () => {
  const artifactPath = path.join(process.cwd(), "artifacts/contracts/FeeCollector.sol/FeeCollector.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  return {
    abi: artifact.abi,
    bytecode: artifact.bytecode,
  };
};

// Fee collector addresses by network
const FEE_COLLECTOR_ADDRESSES = {
  ethereum: process.env.FEE_COLLECTOR_ETH,
  sepolia: process.env.FEE_COLLECTOR_SEPOLIA,
  bsc: process.env.FEE_COLLECTOR_BSC,
  "bsc-testnet": process.env.FEE_COLLECTOR_BSC_TESTNET,
};

// Deploy fee collector contract
export const deployFeeCollector = internalAction({
  args: {
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
    testnet: v.boolean(),
    treasury: v.string(),
    emergencyAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const network = args.testnet 
      ? (args.blockchain === "ethereum" ? "sepolia" : "bsc-testnet")
      : args.blockchain;
    
    const rpcUrl = args.blockchain === "ethereum"
      ? process.env.ETHEREUM_RPC_URL
      : process.env.BSC_RPC_URL;
    
    const deployerPrivateKey = args.blockchain === "ethereum"
      ? process.env.ETHEREUM_DEPLOYER_PRIVATE_KEY
      : process.env.BSC_DEPLOYER_PRIVATE_KEY;
    
    if (!rpcUrl || !deployerPrivateKey) {
      throw new Error(`Missing configuration for ${args.blockchain}`);
    }
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const deployer = new ethers.Wallet(deployerPrivateKey, provider);
    
    // Get contract artifact
    const { abi, bytecode } = getFeeCollectorArtifact();
    
    // Deploy fee collector
    console.log("Deploying fee collector contract...");
    
    const contractFactory = new ethers.ContractFactory(abi, bytecode, deployer);
    const feeCollector = await contractFactory.deploy(
      args.treasury,
      args.emergencyAddress
    );
    
    await feeCollector.waitForDeployment();
    const feeCollectorAddress = await feeCollector.getAddress();
    
    console.log(`Fee collector deployed at: ${feeCollectorAddress}`);
    
    // Save deployment info
    await ctx.runMutation(internal.fees.feeManager.recordFeeCollectorDeployment, {
      network,
      address: feeCollectorAddress,
      treasury: args.treasury,
      emergencyAddress: args.emergencyAddress,
    });
    
    return {
      address: feeCollectorAddress,
      network,
    };
  },
});

// Record fee collector deployment
export const recordFeeCollectorDeployment = internalMutation({
  args: {
    network: v.string(),
    address: v.string(),
    treasury: v.string(),
    emergencyAddress: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("feeCollectors", {
      network: args.network,
      address: args.address,
      treasury: args.treasury,
      emergencyAddress: args.emergencyAddress,
      deployedAt: Date.now(),
      isActive: true,
    });
  },
});

// Calculate fee for an operation
export const calculateFee = query({
  args: {
    feeType: v.number(),
    amount: v.optional(v.number()),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
    testnet: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Get fee configuration from database
    const feeConfig = await ctx.db
      .query("feeConfigurations")
      .withIndex("by_type", (q) => q.eq("feeType", args.feeType))
      .first();
    
    if (!feeConfig || !feeConfig.isEnabled) {
      return { fee: 0, isEnabled: false };
    }
    
    let feeAmount: number;
    
    if (feeConfig.isPercentage && args.amount) {
      feeAmount = (args.amount * feeConfig.amount) / 10000;
    } else {
      feeAmount = feeConfig.amount;
    }
    
    // Apply min/max limits
    if (feeAmount < feeConfig.minAmount) {
      feeAmount = feeConfig.minAmount;
    }
    
    if (feeConfig.maxAmount > 0 && feeAmount > feeConfig.maxAmount) {
      feeAmount = feeConfig.maxAmount;
    }
    
    return {
      fee: feeAmount,
      isEnabled: true,
      config: feeConfig,
    };
  },
});

// Collect fee for token creation
export const collectTokenCreationFee = internalAction({
  args: {
    userId: v.string(),
    tokenId: v.id("memeCoins"),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
    testnet: v.boolean(),
  },
  handler: async (ctx, args) => {
    const network = args.testnet 
      ? (args.blockchain === "ethereum" ? "sepolia" : "bsc-testnet")
      : args.blockchain;
    
    const feeCollectorAddress = FEE_COLLECTOR_ADDRESSES[network];
    if (!feeCollectorAddress) {
      console.warn(`No fee collector deployed on ${network}`);
      return { success: true, fee: 0 };
    }
    
    // Calculate fee
    const feeData = await ctx.runQuery(internal.fees.feeManager.calculateFee, {
      feeType: FeeTypes.TOKEN_CREATION,
      blockchain: args.blockchain,
      testnet: args.testnet,
    });
    
    if (!feeData.isEnabled || feeData.fee === 0) {
      return { success: true, fee: 0 };
    }
    
    // Record fee collection
    await ctx.runMutation(internal.fees.feeManager.recordFeeCollection, {
      userId: args.userId,
      tokenId: args.tokenId,
      feeType: FeeTypes.TOKEN_CREATION,
      amount: feeData.fee,
      blockchain: args.blockchain,
      status: "pending",
    });
    
    return {
      success: true,
      fee: feeData.fee,
      feeCollectorAddress,
    };
  },
});

// Collect trading fee
export const collectTradingFee = internalAction({
  args: {
    userId: v.string(),
    tokenId: v.id("memeCoins"),
    tradeAmount: v.number(),
    tradeType: v.union(v.literal("buy"), v.literal("sell")),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
    testnet: v.boolean(),
  },
  handler: async (ctx, args) => {
    const network = args.testnet 
      ? (args.blockchain === "ethereum" ? "sepolia" : "bsc-testnet")
      : args.blockchain;
    
    const feeCollectorAddress = FEE_COLLECTOR_ADDRESSES[network];
    if (!feeCollectorAddress) {
      return { success: true, fee: 0 };
    }
    
    // Calculate fee
    const feeData = await ctx.runQuery(internal.fees.feeManager.calculateFee, {
      feeType: FeeTypes.BONDING_CURVE_TRADE,
      amount: args.tradeAmount,
      blockchain: args.blockchain,
      testnet: args.testnet,
    });
    
    if (!feeData.isEnabled || feeData.fee === 0) {
      return { success: true, fee: 0 };
    }
    
    // Record fee collection
    await ctx.runMutation(internal.fees.feeManager.recordFeeCollection, {
      userId: args.userId,
      tokenId: args.tokenId,
      feeType: FeeTypes.BONDING_CURVE_TRADE,
      amount: feeData.fee,
      blockchain: args.blockchain,
      status: "collected",
      metadata: {
        tradeType: args.tradeType,
        tradeAmount: args.tradeAmount,
      },
    });
    
    return {
      success: true,
      fee: feeData.fee,
      feeCollectorAddress,
    };
  },
});

// Record fee collection in database
export const recordFeeCollection = internalMutation({
  args: {
    userId: v.string(),
    tokenId: v.id("memeCoins"),
    feeType: v.number(),
    amount: v.number(),
    blockchain: v.string(),
    status: v.union(v.literal("pending"), v.literal("collected"), v.literal("distributed")),
    metadata: v.optional(v.any()),
    transactionHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const feeId = await ctx.db.insert("feeCollections", {
      userId: args.userId,
      tokenId: args.tokenId,
      feeType: args.feeType,
      amount: args.amount,
      blockchain: args.blockchain,
      status: args.status,
      metadata: args.metadata,
      transactionHash: args.transactionHash,
      collectedAt: Date.now(),
    });
    
    // Update user fee stats
    const userStats = await ctx.db
      .query("userFeeStats")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    
    if (userStats) {
      await ctx.db.patch(userStats._id, {
        totalFeesPaid: userStats.totalFeesPaid + args.amount,
        lastFeeAt: Date.now(),
        [`fees_${args.feeType}`]: (userStats[`fees_${args.feeType}`] || 0) + args.amount,
      });
    } else {
      await ctx.db.insert("userFeeStats", {
        userId: args.userId,
        totalFeesPaid: args.amount,
        lastFeeAt: Date.now(),
        [`fees_${args.feeType}`]: args.amount,
      });
    }
    
    return feeId;
  },
});

// Update fee configuration
export const updateFeeConfiguration = mutation({
  args: {
    feeType: v.number(),
    amount: v.number(),
    minAmount: v.number(),
    maxAmount: v.number(),
    isEnabled: v.boolean(),
    isPercentage: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Check admin permissions
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.tokenIdentifier?.includes("admin")) {
      throw new Error("Not authorized");
    }
    
    // Validate fee percentage
    if (args.isPercentage && args.amount > 1000) {
      throw new Error("Fee percentage cannot exceed 10%");
    }
    
    // Update or create fee configuration
    const existingConfig = await ctx.db
      .query("feeConfigurations")
      .withIndex("by_type", (q) => q.eq("feeType", args.feeType))
      .first();
    
    if (existingConfig) {
      await ctx.db.patch(existingConfig._id, {
        amount: args.amount,
        minAmount: args.minAmount,
        maxAmount: args.maxAmount,
        isEnabled: args.isEnabled,
        isPercentage: args.isPercentage,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("feeConfigurations", {
        feeType: args.feeType,
        amount: args.amount,
        minAmount: args.minAmount,
        maxAmount: args.maxAmount,
        isEnabled: args.isEnabled,
        isPercentage: args.isPercentage,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    
    return { success: true };
  },
});

// Get fee statistics
export const getFeeStatistics = query({
  args: {
    timeframe: v.optional(v.union(
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d"),
      v.literal("all")
    )),
  },
  handler: async (ctx, args) => {
    const timeframe = args.timeframe || "all";
    const now = Date.now();
    const timeframes = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      "all": 0,
    };
    
    const since = timeframe === "all" ? 0 : now - timeframes[timeframe];
    
    // Get fee collections within timeframe
    const feeCollections = await ctx.db
      .query("feeCollections")
      .withIndex("by_collected", (q) => q.gte("collectedAt", since))
      .collect();
    
    // Calculate statistics
    const stats = {
      totalCollected: 0,
      byType: {} as Record<number, number>,
      byBlockchain: {} as Record<string, number>,
      uniqueUsers: new Set<string>(),
      recentCollections: [] as any[],
    };
    
    feeCollections.forEach(fee => {
      stats.totalCollected += fee.amount;
      stats.byType[fee.feeType] = (stats.byType[fee.feeType] || 0) + fee.amount;
      stats.byBlockchain[fee.blockchain] = (stats.byBlockchain[fee.blockchain] || 0) + fee.amount;
      stats.uniqueUsers.add(fee.userId);
    });
    
    // Get recent collections
    stats.recentCollections = feeCollections
      .sort((a, b) => b.collectedAt - a.collectedAt)
      .slice(0, 10)
      .map(fee => ({
        id: fee._id,
        userId: fee.userId,
        tokenId: fee.tokenId,
        feeType: fee.feeType,
        amount: fee.amount,
        blockchain: fee.blockchain,
        collectedAt: fee.collectedAt,
      }));
    
    return {
      totalCollected: stats.totalCollected,
      byType: stats.byType,
      byBlockchain: stats.byBlockchain,
      uniqueUsers: stats.uniqueUsers.size,
      recentCollections: stats.recentCollections,
      timeframe,
    };
  },
});

// Get user fee history
export const getUserFeeHistory = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    
    const fees = await ctx.db
      .query("feeCollections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
    
    const stats = await ctx.db
      .query("userFeeStats")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    
    return {
      fees,
      stats,
    };
  },
});

// Distribute collected fees
export const distributeFees = internalAction({
  args: {
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
    testnet: v.boolean(),
  },
  handler: async (ctx, args) => {
    const network = args.testnet 
      ? (args.blockchain === "ethereum" ? "sepolia" : "bsc-testnet")
      : args.blockchain;
    
    const feeCollectorAddress = FEE_COLLECTOR_ADDRESSES[network];
    if (!feeCollectorAddress) {
      throw new Error(`No fee collector deployed on ${network}`);
    }
    
    const rpcUrl = args.blockchain === "ethereum"
      ? process.env.ETHEREUM_RPC_URL
      : process.env.BSC_RPC_URL;
    
    const deployerPrivateKey = args.blockchain === "ethereum"
      ? process.env.ETHEREUM_DEPLOYER_PRIVATE_KEY
      : process.env.BSC_DEPLOYER_PRIVATE_KEY;
    
    if (!rpcUrl || !deployerPrivateKey) {
      throw new Error(`Missing configuration for ${args.blockchain}`);
    }
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(deployerPrivateKey, provider);
    
    const feeCollectorAbi = [
      "function distributeRevenue() external",
      "function distributeTokenRevenue(address token) external",
    ];
    
    const feeCollector = new ethers.Contract(feeCollectorAddress, feeCollectorAbi, signer);
    
    // Distribute ETH revenue
    console.log("Distributing collected fees...");
    const tx = await feeCollector.distributeRevenue();
    const receipt = await tx.wait();
    
    console.log(`Fees distributed in tx: ${receipt.hash}`);
    
    // Update fee collection records
    await ctx.runMutation(internal.fees.feeManager.markFeesDistributed, {
      blockchain: args.blockchain,
      transactionHash: receipt.hash,
    });
    
    return {
      success: true,
      transactionHash: receipt.hash,
    };
  },
});

// Update fee collection with actual token ID
export const updateFeeTokenId = internalMutation({
  args: {
    userId: v.string(),
    tokenId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    // Find the most recent pending fee collection for this user
    const pendingFee = await ctx.db
      .query("feeCollections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .order("desc")
      .first();
    
    if (pendingFee) {
      await ctx.db.patch(pendingFee._id, {
        tokenId: args.tokenId,
      });
    }
  },
});

// Mark fees as distributed
export const markFeesDistributed = internalMutation({
  args: {
    blockchain: v.string(),
    transactionHash: v.string(),
  },
  handler: async (ctx, args) => {
    // Update pending fees to distributed
    const pendingFees = await ctx.db
      .query("feeCollections")
      .withIndex("by_status", (q) => q.eq("status", "collected"))
      .filter((q) => q.eq(q.field("blockchain"), args.blockchain))
      .collect();
    
    for (const fee of pendingFees) {
      await ctx.db.patch(fee._id, {
        status: "distributed",
        distributedAt: Date.now(),
        distributionTxHash: args.transactionHash,
      });
    }
    
    // Record distribution event
    await ctx.db.insert("feeDistributions", {
      blockchain: args.blockchain,
      transactionHash: args.transactionHash,
      feesDistributed: pendingFees.length,
      totalAmount: pendingFees.reduce((sum, fee) => sum + fee.amount, 0),
      distributedAt: Date.now(),
    });
  },
});