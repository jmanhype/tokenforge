import { ethers } from "ethers";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { withCircuitBreaker } from "./withCircuitBreaker";

// ABI for ERC20 token contract
const ERC20_ABI = [
  "constructor(string name, string symbol, uint256 initialSupply, address owner, bool canMint, bool canBurn, bool canPause)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
  "function burn(uint256 amount)",
  "function pause()",
  "function unpause()",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

// Import compiled contract data
import { MEMECOIN_BYTECODE, MEMECOIN_ABI } from "./contractData.js";

export const deployERC20Contract = internalAction({
  args: {
    coinId: v.id("memeCoins"),
    name: v.string(),
    symbol: v.string(),
    initialSupply: v.number(),
    decimals: v.optional(v.number()),
    canMint: v.boolean(),
    canBurn: v.boolean(),
    canPause: v.boolean(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
  },
  handler: async (ctx, args) => {
    try {
      console.log(`[Ethereum] Starting deployment for ${args.name} (${args.symbol}) on ${args.blockchain}`);
      
      // Select the appropriate RPC endpoint
      const rpcUrl = args.blockchain === "ethereum" 
        ? process.env.ETHEREUM_RPC_URL 
        : process.env.BSC_RPC_URL;
      
      if (!rpcUrl) {
        throw new Error(`RPC URL not configured for ${args.blockchain}`);
      }
      
      if (!process.env.DEPLOYER_PRIVATE_KEY) {
        throw new Error("Deployer private key not configured");
      }
      
      // Initialize provider and wallet
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
      
      console.log(`[Ethereum] Connected to ${args.blockchain} network`);
      console.log(`[Ethereum] Deployer address: ${wallet.address}`);
      
      // Check deployer balance
      const balance = await provider.getBalance(wallet.address);
      console.log(`[Ethereum] Deployer balance: ${ethers.formatEther(balance)} ETH`);
      
      if (balance === 0n) {
        throw new Error("Insufficient balance for deployment");
      }
      
      // Get current gas price and estimate gas
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits("20", "gwei");
      console.log(`[Ethereum] Gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
      
      // Convert initial supply to Wei (considering decimals)
      const decimalsToUse = args.decimals || 18;
      const initialSupplyWei = ethers.parseUnits(args.initialSupply.toString(), decimalsToUse);
      
      // Create contract factory
      const factory = new ethers.ContractFactory(MEMECOIN_ABI, MEMECOIN_BYTECODE, wallet);
      
      // Estimate gas for deployment
      const estimatedGas = await factory.getDeployTransaction(
        args.name,
        args.symbol,
        initialSupplyWei,
        wallet.address,
        args.canMint,
        args.canBurn,
        args.canPause
      ).then(tx => provider.estimateGas({
        ...tx,
        from: wallet.address
      }));
      
      const gasLimit = estimatedGas * 120n / 100n; // Add 20% buffer
      console.log(`[Ethereum] Estimated gas: ${estimatedGas.toString()}, Gas limit: ${gasLimit.toString()}`);
      
      // Calculate deployment cost
      const deploymentCostWei = gasLimit * gasPrice;
      const deploymentCostEth = parseFloat(ethers.formatEther(deploymentCostWei));
      console.log(`[Ethereum] Estimated deployment cost: ${deploymentCostEth} ETH`);
      
      // Deploy the contract
      console.log(`[Ethereum] Deploying contract...`);
      const contract = await factory.deploy(
        args.name,
        args.symbol,
        initialSupplyWei,
        wallet.address,
        args.canMint,
        args.canBurn,
        args.canPause,
        {
          gasLimit,
          gasPrice,
          // For production, consider using EIP-1559 gas pricing:
          // maxFeePerGas: feeData.maxFeePerGas,
          // maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        }
      );
      
      console.log(`[Ethereum] Transaction sent: ${contract.deploymentTransaction()?.hash}`);
      console.log(`[Ethereum] Waiting for confirmation...`);
      
      // Wait for deployment confirmation
      const receipt = await contract.waitForDeployment();
      const contractAddress = await contract.getAddress();
      
      console.log(`[Ethereum] Contract deployed at: ${contractAddress}`);
      
      // Get the actual gas used from the receipt
      const deploymentReceipt = contract.deploymentTransaction();
      const actualGasUsed = deploymentReceipt?.gasLimit || estimatedGas;
      const actualDeploymentCost = parseFloat(ethers.formatEther(actualGasUsed * gasPrice));
      
      // Verify the contract was deployed correctly
      const deployedCode = await provider.getCode(contractAddress);
      if (deployedCode === "0x") {
        throw new Error("Contract deployment failed - no code at address");
      }
      
      // Get block information for additional metadata
      const block = await provider.getBlock(deploymentReceipt?.blockNumber || "latest");
      
      return {
        success: true,
        contractAddress,
        transactionHash: contract.deploymentTransaction()?.hash || "",
        gasUsed: actualGasUsed.toString(),
        deploymentCost: actualDeploymentCost,
        blockNumber: block?.number || 0,
        timestamp: block?.timestamp || Math.floor(Date.now() / 1000),
        explorerUrl: getExplorerUrl(args.blockchain, contractAddress),
      };
      
    } catch (error) {
      console.error(`[Ethereum] Deployment error:`, error);
      
      // Parse error messages for better user feedback
      let errorMessage = "Contract deployment failed";
      if (error instanceof Error) {
        if (error.message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for deployment";
        } else if (error.message.includes("gas required exceeds allowance")) {
          errorMessage = "Gas limit exceeded";
        } else if (error.message.includes("nonce")) {
          errorMessage = "Transaction nonce conflict";
        } else {
          errorMessage = error.message;
        }
      }
      
      return {
        success: false,
        error: errorMessage,
        contractAddress: null,
        transactionHash: null,
        gasUsed: "0",
        deploymentCost: 0,
      };
    }
  },
});

// Helper function to get blockchain explorer URL
function getExplorerUrl(blockchain: "ethereum" | "bsc", address: string): string {
  const explorers = {
    ethereum: `https://etherscan.io/token/${address}`,
    bsc: `https://bscscan.com/token/${address}`,
  };
  return explorers[blockchain];
}

// Function to estimate gas costs before deployment
export const estimateDeploymentCost = internalAction({
  args: {
    name: v.string(),
    symbol: v.string(),
    initialSupply: v.number(),
    decimals: v.optional(v.number()),
    canMint: v.boolean(),
    canBurn: v.boolean(),
    canPause: v.boolean(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
  },
  handler: async (ctx, args) => {
    try {
      const rpcUrl = args.blockchain === "ethereum" 
        ? process.env.ETHEREUM_RPC_URL 
        : process.env.BSC_RPC_URL;
      
      if (!rpcUrl) {
        throw new Error(`RPC URL not configured for ${args.blockchain}`);
      }
      
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits("20", "gwei");
      
      // Estimate based on typical ERC20 deployment gas usage
      // Basic ERC20: ~1.5M gas, with features: ~2-2.5M gas
      const baseGas = 1500000n;
      const featureGas = (args.canMint ? 200000n : 0n) + 
                        (args.canBurn ? 200000n : 0n) + 
                        (args.canPause ? 300000n : 0n);
      const estimatedGas = baseGas + featureGas;
      
      const estimatedCostWei = estimatedGas * gasPrice;
      const estimatedCostEth = parseFloat(ethers.formatEther(estimatedCostWei));
      
      // Get current ETH price (in production, use a price oracle)
      const ethPriceUsd = 2000; // Placeholder - integrate with price feed
      const estimatedCostUsd = estimatedCostEth * ethPriceUsd;
      
      return {
        estimatedGas: estimatedGas.toString(),
        gasPrice: ethers.formatUnits(gasPrice, "gwei"),
        estimatedCostEth,
        estimatedCostUsd,
        blockchain: args.blockchain,
      };
      
    } catch (error) {
      console.error("[Ethereum] Cost estimation error:", error);
      return {
        error: error instanceof Error ? error.message : "Failed to estimate costs",
        estimatedGas: "0",
        gasPrice: "0",
        estimatedCostEth: 0,
        estimatedCostUsd: 0,
        blockchain: args.blockchain,
      };
    }
  },
});

// Function to verify contract on Etherscan/BSCScan
export const verifyContract = internalAction({
  args: {
    contractAddress: v.string(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
    constructorArgs: v.object({
      name: v.string(),
      symbol: v.string(),
      initialSupply: v.string(),
      owner: v.string(),
      canMint: v.boolean(),
      canBurn: v.boolean(),
      canPause: v.boolean(),
    }),
  },
  handler: async (ctx, args) => {
    try {
      const apiKey = args.blockchain === "ethereum" 
        ? process.env.ETHERSCAN_API_KEY 
        : process.env.BSCSCAN_API_KEY;
      
      if (!apiKey) {
        throw new Error(`API key not configured for ${args.blockchain} verification`);
      }
      
      const apiUrl = args.blockchain === "ethereum"
        ? "https://api.etherscan.io/api"
        : "https://api.bscscan.com/api";
      
      // Encode constructor arguments
      const abiCoder = new ethers.AbiCoder();
      const encodedArgs = abiCoder.encode(
        ["string", "string", "uint256", "address", "bool", "bool", "bool"],
        [
          args.constructorArgs.name,
          args.constructorArgs.symbol,
          args.constructorArgs.initialSupply,
          args.constructorArgs.owner,
          args.constructorArgs.canMint,
          args.constructorArgs.canBurn,
          args.constructorArgs.canPause,
        ]
      );
      
      // Submit verification request
      const verifyResponse = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          module: "contract",
          action: "verifysourcecode",
          apikey: apiKey,
          contractaddress: args.contractAddress,
          sourceCode: "", // In production, include the actual source code
          codeformat: "solidity-single-file",
          contractname: "MemeCoin",
          compilerversion: "v0.8.20+commit.a1b79de6", // Match your compiler version
          optimizationUsed: "1",
          runs: "200",
          constructorArguements: encodedArgs.slice(2), // Remove 0x prefix
          evmversion: "paris",
          licenseType: "3", // MIT
        }),
      });
      
      const result = await verifyResponse.json();
      
      if (result.status === "1") {
        console.log(`[Ethereum] Verification submitted: ${result.result}`);
        return {
          success: true,
          guid: result.result,
          message: "Verification submitted successfully",
        };
      } else {
        throw new Error(result.result || "Verification failed");
      }
      
    } catch (error) {
      console.error("[Ethereum] Verification error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Verification failed",
      };
    }
  },
});