import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { ethers } from "ethers";

// Bonding Curve Contract ABI (essential functions)
const BONDING_CURVE_ABI = [
  "function buy(uint256 minTokensOut) external payable returns (uint256 tokensReceived)",
  "function sell(uint256 tokenAmount, uint256 minEthOut) external returns (uint256 ethReceived)",
  "function calculateBuyReturn(uint256 ethAmount) external view returns (uint256 tokenAmount)",
  "function calculateSellReturn(uint256 tokenAmount) external view returns (uint256 ethAmount)",
  "function currentPrice() external view returns (uint256)",
  "function reserveBalance() external view returns (uint256)",
  "function tokenSupply() external view returns (uint256)",
  "function isGraduated() external view returns (bool)",
  "function graduationMarketCap() external view returns (uint256)",
  "event TokensPurchased(address indexed buyer, uint256 ethSpent, uint256 tokensReceived, uint256 newPrice)",
  "event TokensSold(address indexed seller, uint256 tokensSold, uint256 ethReceived, uint256 newPrice)",
  "event Graduated(uint256 finalMarketCap, address dexPool)"
];

// Execute real bonding curve buy transaction
export const executeBondingCurveBuy = internalAction({
  args: {
    bondingCurveAddress: v.string(),
    tokenId: v.id("memeCoins"),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
    buyer: v.string(),
    ethAmount: v.number(),
    minTokensOut: v.number(),
  },
  handler: async (ctx, args) => {
    const rpcUrl = args.blockchain === "ethereum" 
      ? process.env.ETHEREUM_RPC_URL 
      : process.env.BSC_RPC_URL;
    
    if (!rpcUrl) {
      throw new Error(`Missing RPC URL for ${args.blockchain}`);
    }

    // For user transactions, we return the transaction data for the frontend to execute
    // The frontend will use the user's wallet to sign and send the transaction
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const bondingCurve = new ethers.Contract(args.bondingCurveAddress, BONDING_CURVE_ABI, provider);
    
    // Calculate current buy return to verify slippage
    const expectedTokens = await bondingCurve.calculateBuyReturn(
      ethers.parseEther(args.ethAmount.toString())
    );
    
    if (expectedTokens < ethers.parseEther(args.minTokensOut.toString())) {
      throw new Error("Slippage tolerance exceeded");
    }

    // Return transaction data for frontend execution
    const txData = await bondingCurve.buy.populateTransaction(
      ethers.parseEther(args.minTokensOut.toString())
    );

    return {
      to: args.bondingCurveAddress,
      data: txData.data,
      value: ethers.parseEther(args.ethAmount.toString()).toString(),
      expectedTokens: ethers.formatEther(expectedTokens),
    };
  },
});

// Execute real bonding curve sell transaction
export const executeBondingCurveSell = internalAction({
  args: {
    bondingCurveAddress: v.string(),
    tokenId: v.id("memeCoins"),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
    seller: v.string(),
    tokenAmount: v.number(),
    minEthOut: v.number(),
  },
  handler: async (ctx, args) => {
    const rpcUrl = args.blockchain === "ethereum" 
      ? process.env.ETHEREUM_RPC_URL 
      : process.env.BSC_RPC_URL;
    
    if (!rpcUrl) {
      throw new Error(`Missing RPC URL for ${args.blockchain}`);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const bondingCurve = new ethers.Contract(args.bondingCurveAddress, BONDING_CURVE_ABI, provider);
    
    // Calculate current sell return to verify slippage
    const expectedEth = await bondingCurve.calculateSellReturn(
      ethers.parseEther(args.tokenAmount.toString())
    );
    
    if (expectedEth < ethers.parseEther(args.minEthOut.toString())) {
      throw new Error("Slippage tolerance exceeded");
    }

    // Return transaction data for frontend execution
    const txData = await bondingCurve.sell.populateTransaction(
      ethers.parseEther(args.tokenAmount.toString()),
      ethers.parseEther(args.minEthOut.toString())
    );

    return {
      to: args.bondingCurveAddress,
      data: txData.data,
      value: "0",
      expectedEth: ethers.formatEther(expectedEth),
    };
  },
});

// Get real bonding curve state from blockchain
export const getBondingCurveState = internalAction({
  args: {
    bondingCurveAddress: v.string(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
  },
  handler: async (ctx, args) => {
    const rpcUrl = args.blockchain === "ethereum" 
      ? process.env.ETHEREUM_RPC_URL 
      : process.env.BSC_RPC_URL;
    
    if (!rpcUrl) {
      throw new Error(`Missing RPC URL for ${args.blockchain}`);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const bondingCurve = new ethers.Contract(args.bondingCurveAddress, BONDING_CURVE_ABI, provider);
    
    // Fetch all state in parallel
    const [
      currentPrice,
      reserveBalance,
      tokenSupply,
      isGraduated,
      graduationMarketCap
    ] = await Promise.all([
      bondingCurve.currentPrice(),
      bondingCurve.reserveBalance(),
      bondingCurve.tokenSupply(),
      bondingCurve.isGraduated(),
      bondingCurve.graduationMarketCap(),
    ]);

    return {
      currentPrice: ethers.formatEther(currentPrice),
      reserveBalance: ethers.formatEther(reserveBalance),
      tokenSupply: ethers.formatEther(tokenSupply),
      isGraduated,
      graduationMarketCap: ethers.formatEther(graduationMarketCap),
      marketCap: parseFloat(ethers.formatEther(currentPrice)) * parseFloat(ethers.formatEther(tokenSupply)),
    };
  },
});

// Monitor bonding curve events
export const monitorBondingCurveEvents = internalAction({
  args: {
    bondingCurveAddress: v.string(),
    tokenId: v.id("memeCoins"),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
    fromBlock: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rpcUrl = args.blockchain === "ethereum" 
      ? process.env.ETHEREUM_RPC_URL 
      : process.env.BSC_RPC_URL;
    
    if (!rpcUrl) {
      throw new Error(`Missing RPC URL for ${args.blockchain}`);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const bondingCurve = new ethers.Contract(args.bondingCurveAddress, BONDING_CURVE_ABI, provider);
    
    const fromBlock = args.fromBlock || await provider.getBlockNumber() - 1000; // Last 1000 blocks
    const toBlock = await provider.getBlockNumber();

    // Get all events
    const [buyEvents, sellEvents, graduationEvents] = await Promise.all([
      bondingCurve.queryFilter(bondingCurve.filters.TokensPurchased(), fromBlock, toBlock),
      bondingCurve.queryFilter(bondingCurve.filters.TokensSold(), fromBlock, toBlock),
      bondingCurve.queryFilter(bondingCurve.filters.Graduated(), fromBlock, toBlock),
    ]);

    // Process events
    const events = [];

    for (const event of buyEvents) {
      events.push({
        type: "buy",
        buyer: (event as any).args.buyer,
        ethSpent: ethers.formatEther((event as any).args.ethSpent),
        tokensReceived: ethers.formatEther((event as any).args.tokensReceived),
        newPrice: ethers.formatEther((event as any).args.newPrice),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
      });
    }

    for (const event of sellEvents) {
      events.push({
        type: "sell",
        seller: (event as any).args.seller,
        tokensSold: ethers.formatEther((event as any).args.tokensSold),
        ethReceived: ethers.formatEther((event as any).args.ethReceived),
        newPrice: ethers.formatEther((event as any).args.newPrice),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
      });
    }

    for (const event of graduationEvents) {
      events.push({
        type: "graduation",
        finalMarketCap: ethers.formatEther((event as any).args.finalMarketCap),
        dexPool: (event as any).args.dexPool,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
      });
    }

    // Sort by block number
    events.sort((a, b) => a.blockNumber - b.blockNumber);

    return {
      events,
      lastBlock: toBlock,
    };
  },
});

// Deploy bonding curve contract
export const deployBondingCurveContract = internalAction({
  args: {
    tokenAddress: v.string(),
    tokenId: v.id("memeCoins"),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
    graduationTarget: v.optional(v.number()), // in ETH
    feePercent: v.optional(v.number()), // basis points
  },
  handler: async (ctx, args) => {
    const rpcUrl = args.blockchain === "ethereum" 
      ? process.env.ETHEREUM_RPC_URL 
      : process.env.BSC_RPC_URL;
    
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    
    if (!rpcUrl || !privateKey) {
      throw new Error(`Missing configuration for ${args.blockchain}`);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);

    // Bonding Curve contract bytecode (compiled from BondingCurve.sol)
    const BONDING_CURVE_BYTECODE = process.env.BONDING_CURVE_BYTECODE;
    
    if (!BONDING_CURVE_BYTECODE) {
      throw new Error("Bonding curve bytecode not configured");
    }

    // Deploy bonding curve contract
    const BondingCurveFactory = new ethers.ContractFactory(
      BONDING_CURVE_ABI,
      BONDING_CURVE_BYTECODE,
      signer
    );

    const graduationTarget = args.graduationTarget || 100; // 100 ETH default
    const feePercent = args.feePercent || 100; // 1% default

    const bondingCurve = await BondingCurveFactory.deploy(
      args.tokenAddress,
      ethers.parseEther(graduationTarget.toString()),
      feePercent
    );

    await bondingCurve.waitForDeployment();
    const bondingCurveAddress = await bondingCurve.getAddress();

    // Get deployment transaction receipt
    const deployTx = bondingCurve.deploymentTransaction();
    const receipt = await deployTx.wait();

    return {
      bondingCurveAddress,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    };
  },
});