import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { ethers } from "ethers";
import { Token, CurrencyAmount, Percent } from "@uniswap/sdk-core";
import { Pool, Position, nearestUsableTick, TickMath, FeeAmount, TICK_SPACINGS } from "@uniswap/v3-sdk";

// Uniswap V3 contract addresses on various networks
const UNISWAP_V3_ADDRESSES = {
  ethereum: {
    factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    router: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    positionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    quoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
    weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  },
  sepolia: {
    factory: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c",
    router: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
    positionManager: "0x1238536071E1c677A632429e3655c799b22cDA52",
    quoter: "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3",
    weth: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
  },
  bsc: {
    factory: "0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7",
    router: "0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2",
    positionManager: "0x427bF5b37357632377eCbEC9de3626C71A5396c1",
    quoter: "0x78D78E420Da98ad378D7799bE8f4AF69033EB077",
    wbnb: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  },
  "bsc-testnet": {
    factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984", // Placeholder - need actual testnet addresses
    router: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    positionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    quoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
    wbnb: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
  },
};

// ABI for Uniswap V3 Position Manager
const POSITION_MANAGER_ABI = [
  "function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) external payable returns (address pool)",
  "function mint(tuple(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
  "function increaseLiquidity(tuple(uint256 tokenId, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, uint256 deadline)) external payable returns (uint128 liquidity, uint256 amount0, uint256 amount1)",
];

// ERC20 ABI for token approvals
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
];

// Create a Uniswap V3 pool and add initial liquidity
export const createUniswapV3Pool = internalAction({
  args: {
    tokenAddress: v.string(),
    tokenName: v.string(),
    tokenSymbol: v.string(),
    tokenDecimals: v.number(),
    initialTokenAmount: v.number(), // Amount of tokens to add to pool
    initialEthAmount: v.number(), // Amount of ETH to add to pool
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
    testnet: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Get network configuration
    const network = args.testnet 
      ? (args.blockchain === "ethereum" ? "sepolia" : "bsc-testnet")
      : args.blockchain;
    
    const addresses = UNISWAP_V3_ADDRESSES[network];
    const rpcUrl = args.blockchain === "ethereum"
      ? process.env.ETHEREUM_RPC_URL
      : process.env.BSC_RPC_URL;
    
    const deployerPrivateKey = args.blockchain === "ethereum"
      ? process.env.ETHEREUM_DEPLOYER_PRIVATE_KEY
      : process.env.BSC_DEPLOYER_PRIVATE_KEY;
    
    if (!rpcUrl || !deployerPrivateKey) {
      throw new Error(`Missing configuration for ${args.blockchain}`);
    }

    // Connect to blockchain
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const deployer = new ethers.Wallet(deployerPrivateKey, provider);
    
    // Get wrapped native token address (WETH or WBNB)
    const wrappedNativeToken = args.blockchain === "ethereum" ? addresses.weth : addresses.wbnb;
    
    // Create token instances for Uniswap SDK
    const chainId = args.testnet 
      ? (args.blockchain === "ethereum" ? 11155111 : 97) // Sepolia or BSC Testnet
      : (args.blockchain === "ethereum" ? 1 : 56); // Mainnet or BSC
    
    const token0 = new Token(
      chainId,
      args.tokenAddress,
      args.tokenDecimals,
      args.tokenSymbol,
      args.tokenName
    );
    
    const token1 = new Token(
      chainId,
      wrappedNativeToken,
      18,
      args.blockchain === "ethereum" ? "WETH" : "WBNB",
      args.blockchain === "ethereum" ? "Wrapped Ether" : "Wrapped BNB"
    );
    
    // Sort tokens (Uniswap requires token0 < token1)
    const [sortedToken0, sortedToken1] = token0.address.toLowerCase() < token1.address.toLowerCase()
      ? [token0, token1]
      : [token1, token0];
    
    // Calculate initial price (ETH per token)
    const price = args.initialEthAmount / args.initialTokenAmount;
    const sqrtPriceX96 = Math.sqrt(price) * (2 ** 96);
    
    // Connect to Position Manager
    const positionManager = new ethers.Contract(
      addresses.positionManager,
      POSITION_MANAGER_ABI,
      deployer
    );
    
    // Create and initialize pool if necessary
    console.log("Creating Uniswap V3 pool...");
    const poolTx = await positionManager.createAndInitializePoolIfNecessary(
      sortedToken0.address,
      sortedToken1.address,
      FeeAmount.MEDIUM, // 0.3% fee tier
      BigInt(Math.floor(sqrtPriceX96))
    );
    
    const poolReceipt = await poolTx.wait();
    console.log(`Pool created/initialized in tx: ${poolReceipt.hash}`);
    
    // Approve tokens for Position Manager
    const tokenContract = new ethers.Contract(args.tokenAddress, ERC20_ABI, deployer);
    const approvalAmount = ethers.parseUnits(args.initialTokenAmount.toString(), args.tokenDecimals);
    
    console.log("Approving tokens for Position Manager...");
    const approveTx = await tokenContract.approve(addresses.positionManager, approvalAmount);
    await approveTx.wait();
    
    // Calculate tick range for full range position
    const tickLower = nearestUsableTick(TickMath.MIN_TICK, TICK_SPACINGS[FeeAmount.MEDIUM]);
    const tickUpper = nearestUsableTick(TickMath.MAX_TICK, TICK_SPACINGS[FeeAmount.MEDIUM]);
    
    // Prepare mint parameters
    const mintParams = {
      token0: sortedToken0.address,
      token1: sortedToken1.address,
      fee: FeeAmount.MEDIUM,
      tickLower,
      tickUpper,
      amount0Desired: sortedToken0.address === args.tokenAddress 
        ? approvalAmount 
        : ethers.parseEther(args.initialEthAmount.toString()),
      amount1Desired: sortedToken1.address === args.tokenAddress 
        ? approvalAmount 
        : ethers.parseEther(args.initialEthAmount.toString()),
      amount0Min: 0,
      amount1Min: 0,
      recipient: deployer.address,
      deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes
    };
    
    // Add liquidity
    console.log("Adding liquidity to pool...");
    const mintTx = await positionManager.mint(mintParams, {
      value: ethers.parseEther(args.initialEthAmount.toString()), // Send ETH for WETH
    });
    
    const mintReceipt = await mintTx.wait();
    console.log(`Liquidity added in tx: ${mintReceipt.hash}`);
    
    // Parse events to get position details
    const mintEvent = mintReceipt.logs.find(
      (log: any) => log.topics[0] === ethers.id("IncreaseLiquidity(uint256,uint128,uint256,uint256)")
    );
    
    return {
      poolAddress: poolReceipt.contractAddress,
      positionId: mintEvent ? ethers.toNumber(mintEvent.topics[1]) : null,
      transactionHash: mintReceipt.hash,
      liquidityAdded: true,
      network,
    };
  },
});

// Get pool information and current price
export const getUniswapV3PoolInfo = internalAction({
  args: {
    tokenAddress: v.string(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
    testnet: v.boolean(),
  },
  handler: async (ctx, args) => {
    const network = args.testnet 
      ? (args.blockchain === "ethereum" ? "sepolia" : "bsc-testnet")
      : args.blockchain;
    
    const addresses = UNISWAP_V3_ADDRESSES[network];
    const rpcUrl = args.blockchain === "ethereum"
      ? process.env.ETHEREUM_RPC_URL
      : process.env.BSC_RPC_URL;
    
    if (!rpcUrl) {
      throw new Error(`Missing RPC URL for ${args.blockchain}`);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Get wrapped native token address
    const wrappedNativeToken = args.blockchain === "ethereum" ? addresses.weth : addresses.wbnb;
    
    // TODO: Implement pool info fetching using Uniswap V3 factory
    // This would involve:
    // 1. Calling factory.getPool(token0, token1, fee)
    // 2. Getting pool state (sqrtPriceX96, liquidity, etc.)
    // 3. Calculating human-readable price from sqrtPriceX96
    
    return {
      poolExists: false,
      currentPrice: 0,
      liquidity: 0,
      volume24h: 0,
    };
  },
});