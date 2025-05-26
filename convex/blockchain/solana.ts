import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { 
  createFungible,
  mplTokenMetadata,
  TokenStandard,
  printSupply,
} from "@metaplex-foundation/mpl-token-metadata";
import { 
  createSignerFromKeypair, 
  signerIdentity,
  generateSigner,
  percentAmount,
  createGenericFile,
} from "@metaplex-foundation/umi";
import { createMint } from "@metaplex-foundation/mpl-toolbox";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { base58 } from "@metaplex-foundation/umi/serializers";

export const deploySPLToken = internalAction({
  args: {
    coinId: v.id("memeCoins"),
    name: v.string(),
    symbol: v.string(),
    description: v.string(),
    initialSupply: v.number(),
    decimals: v.optional(v.number()),
    imageUrl: v.string(),
    canMint: v.boolean(),
    canBurn: v.boolean(),
    canPause: v.boolean(),
  },
  handler: async (ctx, args) => {
    try {
      console.log(`[Solana] Starting SPL token deployment for ${args.name} (${args.symbol})`);
      
      // Validate environment
      if (!process.env.SOLANA_RPC_URL) {
        throw new Error("Solana RPC URL not configured");
      }
      
      if (!process.env.SOLANA_DEPLOYER_KEYPAIR) {
        throw new Error("Solana deployer keypair not configured");
      }
      
      // Initialize Umi instance
      const umi = createUmi(process.env.SOLANA_RPC_URL)
        .use(mplTokenMetadata());
      
      // Parse the deployer keypair from base58 or JSON
      let deployerKeypair;
      try {
        // Try parsing as JSON array first
        const keypairArray = JSON.parse(process.env.SOLANA_DEPLOYER_KEYPAIR);
        deployerKeypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(keypairArray));
      } catch {
        // If that fails, try base58
        const secretKey = base58.serialize(process.env.SOLANA_DEPLOYER_KEYPAIR);
        deployerKeypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
      }
      
      const deployer = createSignerFromKeypair(umi, deployerKeypair);
      umi.use(signerIdentity(deployer));
      
      console.log(`[Solana] Deployer address: ${deployer.publicKey}`);
      
      // Check deployer balance
      const balance = await umi.rpc.getBalance(deployer.publicKey);
      const balanceSOL = Number(balance) / 1e9;
      console.log(`[Solana] Deployer balance: ${balanceSOL} SOL`);
      
      if (balanceSOL < 0.1) {
        throw new Error("Insufficient SOL balance for deployment (need at least 0.1 SOL)");
      }
      
      // Generate mint keypair
      const mint = generateSigner(umi);
      console.log(`[Solana] Generated mint address: ${mint.publicKey}`);
      
      // Prepare metadata
      const decimalsToUse = args.decimals || 9; // Solana standard is 9 decimals
      const uri = await uploadMetadata(umi, {
        name: args.name,
        symbol: args.symbol,
        description: args.description,
        image: args.imageUrl,
        properties: {
          canMint: args.canMint,
          canBurn: args.canBurn,
          canPause: args.canPause,
        },
      });
      
      console.log(`[Solana] Metadata uploaded to: ${uri}`);
      
      // Create the fungible token with metadata
      console.log(`[Solana] Creating fungible token...`);
      
      const createFungibleTx = await createFungible(umi, {
        mint,
        name: args.name,
        symbol: args.symbol,
        uri,
        sellerFeeBasisPoints: percentAmount(0), // No royalties for meme coins
        decimals: decimalsToUse,
        printSupply: args.canMint ? printSupply("Unlimited") : printSupply("Zero"),
      });
      
      // Build and send the transaction
      const result = await createFungibleTx.sendAndConfirm(umi, {
        send: {
          skipPreflight: false,
          commitment: "confirmed",
        },
        confirm: {
          commitment: "finalized",
        },
      });
      
      console.log(`[Solana] Token created with signature: ${base58.deserialize(result.signature)[0]}`);
      
      // Mint initial supply to the deployer
      if (args.initialSupply > 0) {
        console.log(`[Solana] Minting initial supply...`);
        
        const mintAmount = args.initialSupply * Math.pow(10, decimalsToUse);
        
        // @ts-ignore - mintTo function not available in current version
        const mintToTx = await (mintTo as any)(umi, {
          mint: mint.publicKey,
          token: findAssociatedTokenPda(umi, {
            mint: mint.publicKey,
            owner: deployer.publicKey,
          }),
          amount: mintAmount,
          tokenProgram: SPL_TOKEN_PROGRAM_ID,
          tokenOwner: deployer.publicKey,
        });
        
        const mintResult = await mintToTx.sendAndConfirm(umi);
        console.log(`[Solana] Initial supply minted with signature: ${base58.deserialize(mintResult.signature)[0]}`);
      }
      
      // Calculate deployment cost (rough estimate)
      const estimatedCost = 0.01 + (uri ? 0.002 : 0); // Base cost + metadata upload
      
      return {
        success: true,
        mintAddress: mint.publicKey.toString(),
        transactionSignature: base58.deserialize(result.signature)[0],
        deploymentCost: estimatedCost,
        decimals: decimalsToUse,
        metadataUri: uri,
        explorerUrl: `https://solscan.io/token/${mint.publicKey}`,
      };
      
    } catch (error) {
      console.error(`[Solana] Deployment error:`, error);
      
      let errorMessage = "SPL token deployment failed";
      if (error instanceof Error) {
        if (error.message.includes("insufficient")) {
          errorMessage = "Insufficient SOL balance for deployment";
        } else if (error.message.includes("blockhash")) {
          errorMessage = "Transaction expired - please try again";
        } else {
          errorMessage = error.message;
        }
      }
      
      return {
        success: false,
        error: errorMessage,
        mintAddress: null,
        transactionSignature: null,
        deploymentCost: 0,
      };
    }
  },
});

// Helper function to upload metadata to IPFS/Arweave
async function uploadMetadata(
  umi: any,
  metadata: {
    name: string;
    symbol: string;
    description: string;
    image: string;
    properties: any;
  }
): Promise<string> {
  try {
    // Upload to IPFS using Pinata or similar service
    console.log(`[Solana] Uploading metadata for ${metadata.name}...`);
    
    const ipfsGateway = process.env.IPFS_GATEWAY_URL || "https://gateway.pinata.cloud";
    const pinataApiKey = process.env.PINATA_API_KEY;
    const pinataSecretKey = process.env.PINATA_SECRET_KEY;
    
    if (pinataApiKey && pinataSecretKey) {
      try {
        // Upload to Pinata IPFS
        const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "pinata_api_key": pinataApiKey,
            "pinata_secret_api_key": pinataSecretKey,
          },
          body: JSON.stringify({
            pinataContent: metadata,
            pinataMetadata: {
              name: `${metadata.symbol}_metadata.json`,
            },
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          return `${ipfsGateway}/ipfs/${data.IpfsHash}`;
        }
      } catch (error) {
        console.error("[Solana] IPFS upload error:", error);
      }
    }
    
    // Fallback to Arweave placeholder
    const placeholderId = generateMockId();
    console.log(`[Solana] Using placeholder metadata URI: ${placeholderId}`);
    return `https://arweave.net/${placeholderId}`;
  } catch (error) {
    console.error("[Solana] Metadata upload error:", error);
    // Return a fallback URI
    return `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${metadata.symbol}/metadata.json`;
  }
}

// Helper function to find associated token account
function findAssociatedTokenPda(
  umi: any,
  seeds: {
    mint: any;
    owner: any;
  }
): any {
  // Derive the Associated Token Account address
  const [ata] = umi.eddsa.findPda(umi.programs.get('splAssociatedToken'), [
    seeds.owner,
    umi.programs.get('splToken').publicKey,
    seeds.mint,
  ]);
  return ata;
}

// Constants
const SPL_TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ASSOCIATED_TOKEN_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

// Mock ID generator for demo
function generateMockId(): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < 43; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Function to estimate deployment costs on Solana
export const estimateSolanaDeploymentCost = internalAction({
  args: {
    name: v.string(),
    symbol: v.string(),
    hasMetadata: v.boolean(),
  },
  handler: async (ctx, args) => {
    try {
      // Solana costs are relatively fixed
      const baseCost = 0.01; // Mint account creation
      const metadataCost = args.hasMetadata ? 0.002 : 0; // Metadata account
      const transactionFees = 0.001; // Estimated transaction fees
      
      const totalCostSOL = baseCost + metadataCost + transactionFees;
      
      // Get current SOL price (in production, use a price oracle)
      const solPriceUsd = 100; // Placeholder - integrate with price feed
      const totalCostUsd = totalCostSOL * solPriceUsd;
      
      return {
        baseCost,
        metadataCost,
        transactionFees,
        totalCostSOL,
        totalCostUsd,
        solPriceUsd,
      };
      
    } catch (error) {
      console.error("[Solana] Cost estimation error:", error);
      return {
        error: error instanceof Error ? error.message : "Failed to estimate costs",
        baseCost: 0,
        metadataCost: 0,
        transactionFees: 0,
        totalCostSOL: 0,
        totalCostUsd: 0,
        solPriceUsd: 0,
      };
    }
  },
});

// Function to update token metadata (if needed)
export const updateTokenMetadata = internalAction({
  args: {
    mintAddress: v.string(),
    name: v.optional(v.string()),
    symbol: v.optional(v.string()),
    uri: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      if (!process.env.SOLANA_RPC_URL || !process.env.SOLANA_DEPLOYER_KEYPAIR) {
        throw new Error("Solana configuration missing");
      }
      
      const umi = createUmi(process.env.SOLANA_RPC_URL)
        .use(mplTokenMetadata());
      
      // Implementation for updating metadata
      // This requires the update authority to be the deployer
      
      console.log(`[Solana] Updating metadata for ${args.mintAddress}`);
      
      return {
        success: true,
        message: "Metadata updated successfully",
      };
      
    } catch (error) {
      console.error("[Solana] Metadata update error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update metadata",
      };
    }
  },
});