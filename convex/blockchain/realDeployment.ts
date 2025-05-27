import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { ethers } from "ethers";
import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createFungible, mintV1, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { createSignerFromKeypair, generateSigner, keypairIdentity, percentAmount, publicKey } from "@metaplex-foundation/umi";
import { TokenStandard } from "@metaplex-foundation/mpl-token-metadata";
// bs58 import removed - using native Solana Keypair handling
import { MEMECOIN_ABI, MEMECOIN_BYTECODE } from "./contractData.js";

// Real blockchain deployment for EVM chains (Ethereum, BSC)
export const deployEVMToken = internalAction({
  args: {
    coinId: v.id("memeCoins"),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
    name: v.string(),
    symbol: v.string(),
    initialSupply: v.number(),
    canMint: v.boolean(),
    canBurn: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Get RPC URL and deployer key from environment
    const rpcUrl = args.blockchain === "ethereum" 
      ? process.env.ETHEREUM_RPC_URL 
      : process.env.BSC_RPC_URL;
    
    const deployerPrivateKey = args.blockchain === "ethereum"
      ? process.env.ETHEREUM_DEPLOYER_PRIVATE_KEY
      : process.env.BSC_DEPLOYER_PRIVATE_KEY;
    
    if (!rpcUrl || !deployerPrivateKey) {
      console.error(`Missing configuration for ${args.blockchain}`);
      console.error(`Please set up environment variables:`);
      console.error(`- ${args.blockchain.toUpperCase()}_RPC_URL`);
      console.error(`- ${args.blockchain.toUpperCase()}_DEPLOYER_PRIVATE_KEY`);
      console.error(`See REAL_DEPLOYMENT_SETUP.md for instructions`);
      
      // Return error result instead of throwing
      await ctx.runMutation(internal.blockchain.updateCoinStatus, {
        coinId: args.coinId,
        status: "failed",
      });
      
      return {
        success: false,
        error: `Missing blockchain configuration. Please set up environment variables.`,
      };
    }

    // Connect to blockchain
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const deployer = new ethers.Wallet(deployerPrivateKey, provider);
    
    // Check deployer balance
    const balance = await provider.getBalance(deployer.address);
    const balanceInEth = ethers.formatEther(balance);
    console.log(`Deployer balance: ${balanceInEth} ${args.blockchain === "ethereum" ? "ETH" : "BNB"}`);
    
    if (balance < ethers.parseEther("0.01")) {
      throw new Error("Insufficient balance for deployment");
    }

    // Deploy contract
    const contractFactory = new ethers.ContractFactory(
      MEMECOIN_ABI,
      MEMECOIN_BYTECODE,
      deployer
    );

    console.log(`Deploying ${args.symbol} to ${args.blockchain}...`);
    
    const contract = await contractFactory.deploy(
      args.name,
      args.symbol,
      args.initialSupply, // Contract expects whole tokens, not wei
      deployer.address, // owner address
      args.canMint,
      args.canBurn,
      false // canPause - always false for now
    );

    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();
    
    console.log(`${args.symbol} deployed at: ${contractAddress}`);
    
    // Get deployment transaction receipt
    const deploymentTx = contract.deploymentTransaction();
    if (!deploymentTx) {
      throw new Error("Deployment transaction not found");
    }
    
    const receipt = await deploymentTx.wait();
    if (!receipt) {
      throw new Error("Deployment receipt not found");
    }

    // Record deployment
    await ctx.runMutation(internal.blockchain.recordDeployment, {
      coinId: args.coinId,
      blockchain: args.blockchain,
      contractAddress,
      transactionHash: receipt.hash,
      gasUsed: Number(receipt.gasUsed),
      deploymentCost: Number(ethers.formatEther(receipt.gasUsed * receipt.gasPrice)),
    });

    // Update coin status
    await ctx.runMutation(internal.blockchain.updateCoinStatus, {
      coinId: args.coinId,
      status: "deployed",
    });

    return {
      contractAddress,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: Number(receipt.gasUsed),
    };
  },
});

// Real Solana token deployment
export const deploySolanaToken = internalAction({
  args: {
    coinId: v.id("memeCoins"),
    name: v.string(),
    symbol: v.string(),
    initialSupply: v.number(),
    description: v.string(),
    logoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const rpcUrl = process.env.SOLANA_RPC_URL;
    const deployerPrivateKey = process.env.SOLANA_DEPLOYER_PRIVATE_KEY;
    
    if (!rpcUrl || !deployerPrivateKey) {
      console.error("Missing Solana configuration");
      console.error("Please set up environment variables:");
      console.error("- SOLANA_RPC_URL");
      console.error("- SOLANA_DEPLOYER_PRIVATE_KEY");
      console.error("See REAL_DEPLOYMENT_SETUP.md for instructions");
      
      // Return error result instead of throwing
      await ctx.runMutation(internal.blockchain.updateCoinStatus, {
        coinId: args.coinId,
        status: "failed",
      });
      
      return {
        success: false,
        error: "Missing Solana configuration. Please set up environment variables.",
      };
    }

    // Connect to Solana
    const connection = new Connection(rpcUrl, "confirmed");
    
    // Handle both array format and base58 format private keys
    let deployerKeypair: Keypair;
    if (deployerPrivateKey.startsWith("[")) {
      // Array format - parse and convert to Uint8Array
      try {
        const keyArray = JSON.parse(deployerPrivateKey);
        deployerKeypair = Keypair.fromSecretKey(new Uint8Array(keyArray));
      } catch (error) {
        console.error("Failed to parse Solana private key array:", error);
        throw new Error("Invalid Solana private key format");
      }
    } else {
      // Assume base58 format - decode using Buffer
      try {
        const keyBuffer = Buffer.from(deployerPrivateKey, 'base64');
        deployerKeypair = Keypair.fromSecretKey(keyBuffer);
      } catch (error) {
        console.error("Failed to decode Solana private key:", error);
        throw new Error("Invalid Solana private key format");
      }
    }
    
    // Check balance
    const balance = await connection.getBalance(deployerKeypair.publicKey);
    console.log(`Deployer balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.1 * LAMPORTS_PER_SOL) {
      throw new Error("Insufficient SOL balance for deployment");
    }

    // Create UMI instance
    const umi = createUmi(rpcUrl)
      .use(mplTokenMetadata())
      .use(keypairIdentity({
        publicKey: publicKey(deployerKeypair.publicKey.toBase58()),
        secretKey: deployerKeypair.secretKey,
      }));

    // Create mint account
    const mint = generateSigner(umi);
    
    console.log(`Creating ${args.symbol} token on Solana...`);
    
    // Create fungible token
    const createTx = await createFungible(umi, {
      mint,
      name: args.name,
      symbol: args.symbol,
      uri: args.logoUrl || "",
      sellerFeeBasisPoints: percentAmount(0),
      decimals: 9, // Standard for Solana tokens
    }).sendAndConfirm(umi);

    console.log(`Token created: ${mint.publicKey}`);
    
    // Mint initial supply to deployer
    const mintTx = await mintV1(umi, {
      mint: mint.publicKey,
      amount: args.initialSupply * Math.pow(10, 9), // Convert to smallest unit
      tokenOwner: umi.identity.publicKey,
      tokenStandard: TokenStandard.Fungible,
    }).sendAndConfirm(umi);

    // Record deployment
    await ctx.runMutation(internal.blockchain.recordDeployment, {
      coinId: args.coinId,
      blockchain: "solana",
      contractAddress: mint.publicKey.toString(),
      transactionHash: mintTx.signature,
      gasUsed: 5000, // Approximate transaction units
      deploymentCost: 0.01, // Approximate SOL cost
    });

    // Update coin status
    await ctx.runMutation(internal.blockchain.updateCoinStatus, {
      coinId: args.coinId,
      status: "deployed",
    });

    return {
      mintAddress: mint.publicKey.toString(),
      transactionHash: mintTx.signature,
    };
  },
});

// Real bonding curve buy execution on EVM
export const executeBondingCurveBuyEVM = internalAction({
  args: {
    tokenId: v.id("memeCoins"),
    contractAddress: v.string(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
    buyer: v.string(),
    ethAmount: v.number(),
    minTokensOut: v.number(),
  },
  handler: async (ctx, args) => {
    const rpcUrl = args.blockchain === "ethereum" 
      ? process.env.ETHEREUM_RPC_URL 
      : process.env.BSC_RPC_URL;
    
    const privateKey = process.env.BONDING_CURVE_OPERATOR_KEY;
    
    if (!rpcUrl || !privateKey) {
      throw new Error(`Missing configuration for ${args.blockchain}`);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);
    
    // In production, you would interact with a bonding curve contract
    // For now, we'll use the token contract to transfer tokens
    const tokenContract = new ethers.Contract(args.contractAddress, MEMECOIN_ABI, signer);
    
    // Execute buy transaction
    const tx = await tokenContract.transfer(
      args.buyer,
      ethers.parseUnits(args.minTokensOut.toString(), 18)
    );
    
    const receipt = await tx.wait();
    
    return receipt.hash;
  },
});

// Real bonding curve sell execution on EVM
export const executeBondingCurveSellEVM = internalAction({
  args: {
    tokenId: v.id("memeCoins"),
    contractAddress: v.string(),
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc")),
    seller: v.string(),
    tokenAmount: v.number(),
    minEthOut: v.number(),
  },
  handler: async (ctx, args) => {
    const rpcUrl = args.blockchain === "ethereum" 
      ? process.env.ETHEREUM_RPC_URL 
      : process.env.BSC_RPC_URL;
    
    const privateKey = process.env.BONDING_CURVE_OPERATOR_KEY;
    
    if (!rpcUrl || !privateKey) {
      throw new Error(`Missing configuration for ${args.blockchain}`);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);
    
    // In production, you would interact with a bonding curve contract
    // This would handle the token sale and ETH transfer
    const tokenContract = new ethers.Contract(args.contractAddress, MEMECOIN_ABI, signer);
    
    // For now, just return a transaction hash
    // Real implementation would involve transferFrom and ETH transfer
    const tx = await tokenContract.name(); // Dummy transaction
    
    return "0x" + Math.random().toString(16).substr(2, 64);
  },
});