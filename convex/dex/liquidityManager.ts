import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { ethers } from "ethers";

// Uniswap V3 Periphery contract addresses
const UNISWAP_CONTRACTS = {
  ethereum: {
    nonfungiblePositionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    swapRouter: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
  },
  sepolia: {
    nonfungiblePositionManager: "0x1238536071E1c677A632429e3655c799b22cDA52",
    swapRouter: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
  },
};

// Position Manager ABI for liquidity operations
const POSITION_MANAGER_ABI = [
  "function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
  "function increaseLiquidity(tuple(uint256 tokenId, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, uint256 deadline)) external payable returns (uint128 liquidity, uint256 amount0, uint256 amount1)",
  "function decreaseLiquidity(tuple(uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline)) external payable returns (uint256 amount0, uint256 amount1)",
  "function collect(tuple(uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max)) external payable returns (uint256 amount0, uint256 amount1)",
];

// Auto-add liquidity when bonding curve reaches certain thresholds
export const autoAddLiquidity = internalAction({
  args: {
    tokenId: v.id("memeCoins"),
    bondingCurveAddress: v.string(),
    threshold: v.union(
      v.literal("initial"),    // First $10k in bonding curve
      v.literal("milestone1"), // $25k market cap
      v.literal("milestone2"), // $50k market cap
      v.literal("graduation")  // Ready for full DEX
    ),
  },
  handler: async (ctx, args) => {
    // Get token and bonding curve details
    const token = await ctx.runQuery(internal.memeCoins.getToken, {
      tokenId: args.tokenId,
    });
    
    if (!token || !token.contractAddress) {
      throw new Error("Token not found or not deployed");
    }
    
    const deployment = await ctx.runQuery(internal.memeCoins.getDeployment, {
      coinId: args.tokenId,
    });
    
    if (!deployment) {
      throw new Error("Deployment not found");
    }
    
    // Get liquidity amounts based on threshold
    const liquidityConfig = getLiquidityConfig(args.threshold);
    
    // Check if pool exists, if not create it first
    const poolInfo = await ctx.runAction(internal.dex.uniswapV3.getUniswapV3PoolInfo, {
      tokenAddress: token.contractAddress,
      blockchain: deployment.blockchain as "ethereum" | "bsc",
      testnet: true,
    });
    
    let poolAddress = poolInfo.poolAddress;
    let positionId = null;
    
    if (!poolInfo.poolExists) {
      // Create pool with initial liquidity
      const createResult = await ctx.runAction(internal.dex.uniswapV3.createUniswapV3Pool, {
        tokenAddress: token.contractAddress,
        tokenName: token.name,
        tokenSymbol: token.symbol,
        tokenDecimals: 18,
        initialTokenAmount: liquidityConfig.tokenAmount,
        initialEthAmount: liquidityConfig.ethAmount,
        blockchain: deployment.blockchain as "ethereum" | "bsc",
        testnet: true,
      });
      
      poolAddress = createResult.poolAddress;
      positionId = createResult.positionId;
    } else {
      // Add liquidity to existing pool
      const addResult = await addLiquidityToPool({
        poolAddress: poolInfo.poolAddress!,
        tokenAddress: token.contractAddress,
        tokenAmount: liquidityConfig.tokenAmount,
        ethAmount: liquidityConfig.ethAmount,
        blockchain: deployment.blockchain as "ethereum" | "bsc",
        testnet: true,
      });
      
      positionId = addResult.positionId;
    }
    
    // Record liquidity provision
    await ctx.runMutation(internal.dex.liquidityManager.recordLiquidityProvision, {
      tokenId: args.tokenId,
      poolAddress,
      positionId,
      tokenAmount: liquidityConfig.tokenAmount,
      ethAmount: liquidityConfig.ethAmount,
      threshold: args.threshold,
    });
    
    return {
      success: true,
      poolAddress,
      positionId,
      liquidityAdded: {
        tokens: liquidityConfig.tokenAmount,
        eth: liquidityConfig.ethAmount,
      },
    };
  },
});

// Add liquidity to existing Uniswap V3 pool
async function addLiquidityToPool(params: {
  poolAddress: string;
  tokenAddress: string;
  tokenAmount: number;
  ethAmount: number;
  blockchain: "ethereum" | "bsc";
  testnet: boolean;
}) {
  const network = params.testnet ? "sepolia" : params.blockchain;
  const contracts = UNISWAP_CONTRACTS[network];
  
  const rpcUrl = params.blockchain === "ethereum"
    ? process.env.ETHEREUM_RPC_URL
    : process.env.BSC_RPC_URL;
  
  const deployerPrivateKey = params.blockchain === "ethereum"
    ? process.env.ETHEREUM_DEPLOYER_PRIVATE_KEY
    : process.env.BSC_DEPLOYER_PRIVATE_KEY;
  
  if (!rpcUrl || !deployerPrivateKey) {
    throw new Error(`Missing configuration for ${params.blockchain}`);
  }
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(deployerPrivateKey, provider);
  
  // Get Position Manager contract
  const positionManager = new ethers.Contract(
    contracts.nonfungiblePositionManager,
    POSITION_MANAGER_ABI,
    deployer
  );
  
  // Approve tokens
  const tokenContract = new ethers.Contract(
    params.tokenAddress,
    ["function approve(address spender, uint256 amount) external returns (bool)"],
    deployer
  );
  
  const approvalAmount = ethers.parseUnits(params.tokenAmount.toString(), 18);
  await tokenContract.approve(contracts.nonfungiblePositionManager, approvalAmount);
  
  // Add liquidity
  const increaseLiquidityParams = {
    tokenId: 0, // This would be the existing position NFT ID
    amount0Desired: approvalAmount,
    amount1Desired: ethers.parseEther(params.ethAmount.toString()),
    amount0Min: 0,
    amount1Min: 0,
    deadline: Math.floor(Date.now() / 1000) + 60 * 20,
  };
  
  const tx = await positionManager.increaseLiquidity(increaseLiquidityParams, {
    value: ethers.parseEther(params.ethAmount.toString()),
  });
  
  const receipt = await tx.wait();
  
  return {
    transactionHash: receipt.hash,
    positionId: 0, // Would extract from event logs
  };
}

// Get liquidity configuration based on milestone
function getLiquidityConfig(threshold: string) {
  switch (threshold) {
    case "initial":
      return {
        tokenAmount: 100000, // 100k tokens
        ethAmount: 0.5,     // 0.5 ETH
        priceRange: 0.5,    // ±50% price range
      };
    case "milestone1":
      return {
        tokenAmount: 250000, // 250k tokens  
        ethAmount: 1.0,      // 1 ETH
        priceRange: 0.4,     // ±40% price range
      };
    case "milestone2":
      return {
        tokenAmount: 500000, // 500k tokens
        ethAmount: 2.0,      // 2 ETH
        priceRange: 0.3,     // ±30% price range
      };
    case "graduation":
      return {
        tokenAmount: 1000000, // 1M tokens
        ethAmount: 5.0,       // 5 ETH
        priceRange: 0.2,      // ±20% price range
      };
    default:
      throw new Error("Invalid threshold");
  }
}

// Record liquidity provision in database
export const recordLiquidityProvision = internalMutation({
  args: {
    tokenId: v.id("memeCoins"),
    poolAddress: v.string(),
    positionId: v.union(v.number(), v.null()),
    tokenAmount: v.number(),
    ethAmount: v.number(),
    threshold: v.string(),
  },
  handler: async (ctx, args) => {
    // Create liquidity provision record
    await ctx.db.insert("liquidityProvisions", {
      tokenId: args.tokenId,
      poolAddress: args.poolAddress,
      positionId: args.positionId,
      tokenAmount: args.tokenAmount,
      ethAmount: args.ethAmount,
      threshold: args.threshold,
      timestamp: Date.now(),
      provider: "auto", // Automated provision
    });
    
    // Update bonding curve with DEX pool info if not already set
    const bondingCurve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_coin", (q) => q.eq("coinId", args.tokenId))
      .first();
    
    if (bondingCurve && !bondingCurve.dexPoolAddress) {
      await ctx.db.patch(bondingCurve._id, {
        dexPoolAddress: args.poolAddress,
      });
    }
  },
});

// Monitor and rebalance liquidity positions
export const rebalanceLiquidity = internalAction({
  args: {
    tokenId: v.id("memeCoins"),
    positionId: v.number(),
  },
  handler: async (ctx, args) => {
    // Get current pool state
    const token = await ctx.runQuery(internal.memeCoins.getToken, {
      tokenId: args.tokenId,
    });
    
    if (!token || !token.contractAddress) {
      throw new Error("Token not found");
    }
    
    // Check if position needs rebalancing
    // This would involve:
    // 1. Checking current price vs position range
    // 2. Calculating impermanent loss
    // 3. Deciding whether to rebalance
    
    // For now, return monitoring data
    return {
      needsRebalancing: false,
      currentPrice: 0,
      positionRange: { lower: 0, upper: 0 },
      impermanentLoss: 0,
    };
  },
});

// Add liquidity to DEX (called by auto-liquidity)
export const addLiquidity = internalAction({
  args: {
    tokenAddress: v.string(),
    tokenAmount: v.number(),
    ethAmount: v.number(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
    dex: v.union(v.literal("uniswap"), v.literal("pancakeswap")),
    slippageTolerance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const slippage = args.slippageTolerance || 0.01; // 1% default
    
    if (args.dex === "uniswap") {
      const result = await addLiquidityToPool({
        poolAddress: "", // Will be determined by factory
        tokenAddress: args.tokenAddress,
        tokenAmount: args.tokenAmount,
        ethAmount: args.ethAmount,
        blockchain: args.blockchain,
        testnet: true,
      });
      
      return {
        tokenAmount: args.tokenAmount,
        ethAmount: args.ethAmount,
        lpTokensReceived: Math.sqrt(args.tokenAmount * args.ethAmount), // Approximation
        poolAddress: result.transactionHash, // Should extract from events
        txHash: result.transactionHash,
      };
    } else {
      // PancakeSwap implementation would go here
      throw new Error("PancakeSwap liquidity addition not yet implemented");
    }
  },
});

// Collect fees from liquidity positions
export const collectLiquidityFees = internalAction({
  args: {
    tokenId: v.id("memeCoins"),
    positionIds: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const token = await ctx.runQuery(internal.memeCoins.getToken, {
      tokenId: args.tokenId,
    });
    
    if (!token) throw new Error("Token not found");
    
    const deployment = await ctx.runQuery(internal.memeCoins.getDeployment, {
      coinId: args.tokenId,
    });
    
    if (!deployment) throw new Error("Deployment not found");
    
    const network = "sepolia"; // Always testnet for now
    const contracts = UNISWAP_CONTRACTS[network];
    
    const rpcUrl = deployment.blockchain === "ethereum"
      ? process.env.ETHEREUM_RPC_URL
      : process.env.BSC_RPC_URL;
    
    const deployerPrivateKey = deployment.blockchain === "ethereum"
      ? process.env.ETHEREUM_DEPLOYER_PRIVATE_KEY
      : process.env.BSC_DEPLOYER_PRIVATE_KEY;
    
    if (!rpcUrl || !deployerPrivateKey) {
      throw new Error(`Missing configuration for ${deployment.blockchain}`);
    }
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const deployer = new ethers.Wallet(deployerPrivateKey, provider);
    
    const positionManager = new ethers.Contract(
      contracts.nonfungiblePositionManager,
      POSITION_MANAGER_ABI,
      deployer
    );
    
    let totalFees = { token: 0, eth: 0 };
    
    // Collect fees from each position
    for (const positionId of args.positionIds) {
      const collectParams = {
        tokenId: positionId,
        recipient: deployer.address,
        amount0Max: ethers.MaxUint256,
        amount1Max: ethers.MaxUint256,
      };
      
      const tx = await positionManager.collect(collectParams);
      const receipt = await tx.wait();
      
      // Parse events to get collected amounts
      // totalFees would be updated based on event data
    }
    
    return {
      success: true,
      feesCollected: totalFees,
    };
  },
});