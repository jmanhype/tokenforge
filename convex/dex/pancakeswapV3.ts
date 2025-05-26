import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { ethers } from "ethers";

// PancakeSwap V3 contract addresses on BSC
const PANCAKESWAP_V3_ADDRESSES = {
  bsc: {
    factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
    router: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
    positionManager: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
    quoter: "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997",
    wbnb: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  },
  "bsc-testnet": {
    factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865", // These are placeholders
    router: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
    positionManager: "0x427bF5b37357632377eCbEC9de3626C71A5396c1",
    quoter: "0x78D78E420Da98ad378D7799bE8f4AF69033EB077",
    wbnb: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
  },
};

// Position Manager ABI (same interface as Uniswap V3)
const POSITION_MANAGER_ABI = [
  "function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) external payable returns (address pool)",
  "function mint(tuple(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
];

// ERC20 ABI for token approvals
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
];

// Create a PancakeSwap V3 pool and add initial liquidity on BSC
export const createPancakeSwapV3Pool = internalAction({
  args: {
    tokenAddress: v.string(),
    tokenName: v.string(),
    tokenSymbol: v.string(),
    tokenDecimals: v.number(),
    initialTokenAmount: v.number(),
    initialBnbAmount: v.number(),
    testnet: v.boolean(),
  },
  handler: async (ctx, args) => {
    const network = args.testnet ? "bsc-testnet" : "bsc";
    const addresses = PANCAKESWAP_V3_ADDRESSES[network];
    const rpcUrl = process.env.BSC_RPC_URL;
    const deployerPrivateKey = process.env.BSC_DEPLOYER_PRIVATE_KEY;
    
    if (!rpcUrl || !deployerPrivateKey) {
      throw new Error("Missing BSC configuration");
    }

    // Connect to BSC
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const deployer = new ethers.Wallet(deployerPrivateKey, provider);
    
    // Sort tokens (PancakeSwap requires token0 < token1)
    const [token0, token1] = args.tokenAddress.toLowerCase() < addresses.wbnb.toLowerCase()
      ? [args.tokenAddress, addresses.wbnb]
      : [addresses.wbnb, args.tokenAddress];
    
    // Calculate initial price (BNB per token)
    const price = args.initialBnbAmount / args.initialTokenAmount;
    const sqrtPriceX96 = Math.sqrt(price) * (2 ** 96);
    
    // Connect to Position Manager
    const positionManager = new ethers.Contract(
      addresses.positionManager,
      POSITION_MANAGER_ABI,
      deployer
    );
    
    // Create and initialize pool if necessary
    console.log("Creating PancakeSwap V3 pool...");
    const poolTx = await positionManager.createAndInitializePoolIfNecessary(
      token0,
      token1,
      2500, // 0.25% fee tier (PancakeSwap's most common)
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
    const MIN_TICK = -887272;
    const MAX_TICK = 887272;
    const TICK_SPACING = 50; // For 0.25% fee tier
    
    const tickLower = Math.floor(MIN_TICK / TICK_SPACING) * TICK_SPACING;
    const tickUpper = Math.ceil(MAX_TICK / TICK_SPACING) * TICK_SPACING;
    
    // Prepare mint parameters
    const mintParams = {
      token0,
      token1,
      fee: 2500,
      tickLower,
      tickUpper,
      amount0Desired: token0 === args.tokenAddress 
        ? approvalAmount 
        : ethers.parseEther(args.initialBnbAmount.toString()),
      amount1Desired: token1 === args.tokenAddress 
        ? approvalAmount 
        : ethers.parseEther(args.initialBnbAmount.toString()),
      amount0Min: 0,
      amount1Min: 0,
      recipient: deployer.address,
      deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes
    };
    
    // Add liquidity
    console.log("Adding liquidity to pool...");
    const mintTx = await positionManager.mint(mintParams, {
      value: ethers.parseEther(args.initialBnbAmount.toString()), // Send BNB for WBNB
    });
    
    const mintReceipt = await mintTx.wait();
    console.log(`Liquidity added in tx: ${mintReceipt.hash}`);
    
    return {
      poolAddress: poolReceipt.contractAddress,
      transactionHash: mintReceipt.hash,
      liquidityAdded: true,
      network,
      dex: "pancakeswap",
    };
  },
});