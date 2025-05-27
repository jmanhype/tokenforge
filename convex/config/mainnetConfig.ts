import { v } from "convex/values";
import { query, mutation } from "../_generated/server";

// Mainnet configuration management in Convex

export const getMainnetConfig = query({
  args: {
    blockchain: v.union(v.literal("ethereum"), v.literal("bsc"), v.literal("solana")),
  },
  handler: async (ctx, args) => {
    // Check if mainnet is enabled
    const isMainnetEnabled = process.env.VITE_USE_TESTNET !== "true";
    
    if (!isMainnetEnabled) {
      return {
        enabled: false,
        message: "Mainnet deployment is currently disabled. Set VITE_USE_TESTNET=false to enable.",
      };
    }
    
    // Get network-specific configuration
    const config = {
      ethereum: {
        enabled: isMainnetEnabled,
        chainId: 1,
        rpcUrl: process.env.ETHEREUM_MAINNET_RPC_URL,
        contracts: {
          feeCollector: process.env.FEE_COLLECTOR_ETHEREUM,
          bondingCurveFactory: process.env.BONDING_CURVE_FACTORY_ETHEREUM,
          multiSigFactory: process.env.MULTISIG_FACTORY_ETHEREUM,
          uniswapV3Factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
          uniswapV3Router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        },
        gasSettings: {
          maxGasPrice: process.env.MAX_GAS_PRICE_GWEI || "200",
        },
        fees: {
          tokenCreation: process.env.TOKEN_CREATION_FEE || "0.1",
          bondingCurveTrade: process.env.BONDING_CURVE_TRADE_FEE_PERCENT || "1.0",
          dexGraduation: process.env.DEX_GRADUATION_FEE || "0.5",
        },
      },
      bsc: {
        enabled: isMainnetEnabled,
        chainId: 56,
        rpcUrl: process.env.BSC_MAINNET_RPC_URL,
        contracts: {
          feeCollector: process.env.FEE_COLLECTOR_BSC,
          bondingCurveFactory: process.env.BONDING_CURVE_FACTORY_BSC,
          multiSigFactory: process.env.MULTISIG_FACTORY_BSC,
          pancakeswapV3Factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
          pancakeswapV3Router: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
        },
        gasSettings: {
          maxGasPrice: process.env.MAX_GAS_PRICE_GWEI || "50",
        },
        fees: {
          tokenCreation: process.env.TOKEN_CREATION_FEE || "0.1",
          bondingCurveTrade: process.env.BONDING_CURVE_TRADE_FEE_PERCENT || "1.0",
          dexGraduation: process.env.DEX_GRADUATION_FEE || "0.5",
        },
      },
      solana: {
        enabled: isMainnetEnabled,
        chainId: 101,
        rpcUrl: process.env.SOLANA_MAINNET_RPC_URL,
        fees: {
          tokenCreation: "0.1",
          bondingCurveTrade: "1.0",
          dexGraduation: "0.5",
        },
      },
    };
    
    const networkConfig = config[args.blockchain];
    
    // Validate configuration
    const isConfigured = args.blockchain === "solana" 
      ? !!networkConfig.rpcUrl
      : !!networkConfig.rpcUrl && !!(networkConfig as any).contracts?.feeCollector;
    
    return {
      ...networkConfig,
      isConfigured,
      warnings: getConfigWarnings(args.blockchain, networkConfig),
    };
  },
});

// Check mainnet deployment readiness
export const checkMainnetReadiness = query({
  args: {},
  handler: async (ctx) => {
    const checks = {
      environmentVariables: {
        ethereum: {
          rpcUrl: !!process.env.ETHEREUM_MAINNET_RPC_URL,
          deployerKey: !!process.env.ETHEREUM_DEPLOYER_PRIVATE_KEY,
          feeCollector: !!process.env.FEE_COLLECTOR_ETHEREUM,
          etherscanApi: !!process.env.ETHERSCAN_API_KEY,
        },
        bsc: {
          rpcUrl: !!process.env.BSC_MAINNET_RPC_URL,
          deployerKey: !!process.env.BSC_DEPLOYER_PRIVATE_KEY,
          feeCollector: !!process.env.FEE_COLLECTOR_BSC,
          bscscanApi: !!process.env.BSCSCAN_API_KEY,
        },
        solana: {
          rpcUrl: !!process.env.SOLANA_MAINNET_RPC_URL,
          deployerKey: !!process.env.SOLANA_DEPLOYER_PRIVATE_KEY,
        },
      },
      security: {
        treasuryAddress: !!process.env.MAINNET_TREASURY_ADDRESS,
        emergencyAddress: !!process.env.MAINNET_EMERGENCY_ADDRESS,
        multiSigOwners: !!process.env.MULTISIG_OWNERS,
      },
      monitoring: {
        sentryDsn: !!process.env.SENTRY_DSN_MAINNET,
        discordWebhook: !!process.env.DISCORD_WEBHOOK_MAINNET,
        telegramBot: !!process.env.TELEGRAM_BOT_TOKEN_MAINNET,
      },
      contracts: {
        feeCollectorDeployed: !!process.env.FEE_COLLECTOR_ETHEREUM || !!process.env.FEE_COLLECTOR_BSC,
        bondingCurveFactoryDeployed: !!process.env.BONDING_CURVE_FACTORY_ETHEREUM || !!process.env.BONDING_CURVE_FACTORY_BSC,
        multiSigFactoryDeployed: !!process.env.MULTISIG_FACTORY_ETHEREUM || !!process.env.MULTISIG_FACTORY_BSC,
      },
    };
    
    // Calculate readiness scores
    const calculateScore = (checks: Record<string, boolean>) => {
      const total = Object.keys(checks).length;
      const passed = Object.values(checks).filter(Boolean).length;
      return { passed, total, percentage: Math.round((passed / total) * 100) };
    };
    
    const scores = {
      ethereum: calculateScore(checks.environmentVariables.ethereum),
      bsc: calculateScore(checks.environmentVariables.bsc),
      solana: calculateScore(checks.environmentVariables.solana),
      security: calculateScore(checks.security),
      monitoring: calculateScore(checks.monitoring),
      contracts: calculateScore(checks.contracts),
    };
    
    const overallScore = calculateScore({
      ...checks.environmentVariables.ethereum,
      ...checks.environmentVariables.bsc,
      ...checks.environmentVariables.solana,
      ...checks.security,
      ...checks.monitoring,
      ...checks.contracts,
    });
    
    return {
      isReady: overallScore.percentage >= 80,
      scores,
      overallScore,
      checks,
      recommendations: getReadinessRecommendations(checks, scores),
    };
  },
});

// Toggle mainnet mode
export const toggleMainnetMode = mutation({
  args: {
    enabled: v.boolean(),
    adminCode: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify admin code (in production, this would be more secure)
    if (args.adminCode !== process.env.ADMIN_OVERRIDE_CODE) {
      throw new Error("Invalid admin code");
    }
    
    // Log the change
    await ctx.db.insert("auditLogs", {
      userId: "system",
      action: args.enabled ? "mainnet_enabled" : "mainnet_disabled",
      severity: "critical",
      timestamp: Date.now(),
      metadata: {
        previousState: process.env.VITE_USE_TESTNET === "true" ? "testnet" : "mainnet",
        newState: args.enabled ? "mainnet" : "testnet",
      },
    });
    
    return {
      success: true,
      message: `Mainnet mode ${args.enabled ? "enabled" : "disabled"}. Restart the application for changes to take effect.`,
    };
  },
});

// Helper functions
function getConfigWarnings(blockchain: string, config: any): string[] {
  const warnings: string[] = [];
  
  if (!config.rpcUrl) {
    warnings.push(`Missing RPC URL for ${blockchain} mainnet`);
  }
  
  if (blockchain !== "solana" && !config.contracts?.feeCollector) {
    warnings.push(`Fee collector contract not deployed on ${blockchain} mainnet`);
  }
  
  if (parseFloat(config.fees?.tokenCreation || "0") < 0.01) {
    warnings.push("Token creation fee might be too low for mainnet");
  }
  
  return warnings;
}

function getReadinessRecommendations(checks: any, scores: any): string[] {
  const recommendations: string[] = [];
  
  if (scores.ethereum.percentage < 100) {
    recommendations.push("Complete Ethereum mainnet configuration");
  }
  
  if (scores.bsc.percentage < 100) {
    recommendations.push("Complete BSC mainnet configuration");
  }
  
  if (!checks.contracts.feeCollectorDeployed) {
    recommendations.push("Deploy fee collector contracts to mainnet");
  }
  
  if (!checks.security.treasuryAddress) {
    recommendations.push("Set up mainnet treasury multi-signature wallet");
  }
  
  if (scores.monitoring.percentage < 100) {
    recommendations.push("Configure all monitoring and alerting services");
  }
  
  return recommendations;
}