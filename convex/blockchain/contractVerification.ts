import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

// Etherscan API endpoints
const EXPLORER_APIS = {
  ethereum: {
    mainnet: "https://api.etherscan.io/api",
    sepolia: "https://api-sepolia.etherscan.io/api",
  },
  bsc: {
    mainnet: "https://api.bscscan.com/api",
    testnet: "https://api-testnet.bscscan.com/api",
  },
};

// Verify contract on blockchain explorer
export const verifyContract = internalAction({
  args: {
    contractAddress: v.string(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc"), v.literal("solana")),
    constructorArguments: v.optional(v.string()),
    contractName: v.optional(v.string()),
    compilerVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.blockchain === "solana") {
      // Solana contracts are automatically verified on Solscan
      console.log(`Solana contract ${args.contractAddress} is automatically visible on Solscan`);
      return {
        success: true,
        explorerUrl: `https://solscan.io/token/${args.contractAddress}?cluster=devnet`,
      };
    }

    // Get API key from environment
    const apiKey = args.blockchain === "ethereum" 
      ? process.env.ETHERSCAN_API_KEY 
      : process.env.BSCSCAN_API_KEY;

    if (!apiKey) {
      console.warn(`No ${args.blockchain} explorer API key configured`);
      return {
        success: false,
        error: "Explorer API key not configured",
      };
    }

    // Determine network (always testnet for now)
    const network = args.blockchain === "ethereum" ? "sepolia" : "testnet";
    const explorersForChain = EXPLORER_APIS[args.blockchain];
    const apiUrl = args.blockchain === "ethereum" 
      ? (explorersForChain as { mainnet: string; sepolia: string }).sepolia
      : (explorersForChain as { mainnet: string; testnet: string }).testnet;

    // Get contract source code (would be stored during deployment)
    const contractSource = await getContractSourceCode(args.contractName || "MemeCoin");
    
    // Prepare verification request
    const verificationParams = new URLSearchParams({
      apikey: apiKey,
      module: "contract",
      action: "verifysourcecode",
      contractaddress: args.contractAddress,
      sourceCode: contractSource,
      contractname: args.contractName || "MemeCoin",
      compilerversion: args.compilerVersion || "v0.8.19+commit.7dd6d404",
      optimizationUsed: "1",
      runs: "200",
      constructorArguements: args.constructorArguments || "",
      evmversion: "paris",
      licenseType: "3", // MIT
    });

    try {
      // Submit verification request
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: verificationParams.toString(),
      });

      const data = await response.json();

      if (data.status === "1") {
        // Verification request submitted successfully
        const guid = data.result;
        
        // Check verification status (would normally poll this)
        const checkParams = new URLSearchParams({
          apikey: apiKey,
          module: "contract",
          action: "checkverifystatus",
          guid: guid,
        });

        // Wait a bit before checking
        await new Promise(resolve => setTimeout(resolve, 5000));

        const checkResponse = await fetch(`${apiUrl}?${checkParams}`);
        const checkData = await checkResponse.json();

        if (checkData.status === "1") {
          return {
            success: true,
            explorerUrl: `${getExplorerUrl(args.blockchain, network)}/address/${args.contractAddress}#code`,
            message: "Contract verified successfully",
          };
        } else {
          return {
            success: false,
            error: checkData.result,
            guid: guid,
            message: "Verification pending or failed",
          };
        }
      } else {
        return {
          success: false,
          error: data.result,
        };
      }
    } catch (error) {
      console.error("Contract verification error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// Get contract source code (simplified - in production this would be from build artifacts)
function getContractSourceCode(contractName: string): string {
  // This would normally read from the compiled contract artifacts
  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ${contractName} is ERC20, Ownable {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
    }
}`;
}

// Get explorer URL for the given blockchain and network
function getExplorerUrl(blockchain: string, network: string): string {
  const explorers = {
    ethereum: {
      mainnet: "https://etherscan.io",
      sepolia: "https://sepolia.etherscan.io",
    },
    bsc: {
      mainnet: "https://bscscan.com",
      testnet: "https://testnet.bscscan.com",
    },
  };

  if (blockchain === "ethereum") {
    return (explorers.ethereum as { mainnet: string; sepolia: string })[network as "mainnet" | "sepolia"];
  } else {
    return (explorers.bsc as { mainnet: string; testnet: string })[network as "mainnet" | "testnet"];
  }
}

// Check verification status
export const checkVerificationStatus = internalAction({
  args: {
    guid: v.string(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
  },
  handler: async (ctx, args) => {
    const apiKey = args.blockchain === "ethereum" 
      ? process.env.ETHERSCAN_API_KEY 
      : process.env.BSCSCAN_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        error: "Explorer API key not configured",
      };
    }

    const network = args.blockchain === "ethereum" ? "sepolia" : "testnet";
    const explorersForChain = EXPLORER_APIS[args.blockchain];
    const apiUrl = args.blockchain === "ethereum" 
      ? (explorersForChain as { mainnet: string; sepolia: string }).sepolia
      : (explorersForChain as { mainnet: string; testnet: string }).testnet;

    const params = new URLSearchParams({
      apikey: apiKey,
      module: "contract",
      action: "checkverifystatus",
      guid: args.guid,
    });

    try {
      const response = await fetch(`${apiUrl}?${params}`);
      const data = await response.json();

      return {
        success: data.status === "1",
        status: data.result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});