// Network configurations for both testnet and mainnet deployments

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  contracts?: {
    multicall?: string;
    feeCollector?: string;
    bondingCurveFactory?: string;
    multiSigFactory?: string;
  };
  gasSettings?: {
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    gasLimit?: bigint;
  };
  confirmations: number;
  isTestnet: boolean;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  // Ethereum Networks
  "ethereum-mainnet": {
    name: "Ethereum Mainnet",
    chainId: 1,
    rpcUrl: process.env.ETHEREUM_MAINNET_RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY",
    blockExplorer: "https://etherscan.io",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    contracts: {
      multicall: "0xcA11bde05977b3631167028862bE2a173976CA11",
      feeCollector: process.env.FEE_COLLECTOR_ETHEREUM,
      bondingCurveFactory: process.env.BONDING_CURVE_FACTORY_ETHEREUM,
      multiSigFactory: process.env.MULTISIG_FACTORY_ETHEREUM,
    },
    gasSettings: {
      maxFeePerGas: BigInt("100000000000"), // 100 gwei
      maxPriorityFeePerGas: BigInt("2000000000"), // 2 gwei
    },
    confirmations: 2,
    isTestnet: false,
  },
  
  "ethereum-sepolia": {
    name: "Ethereum Sepolia",
    chainId: 11155111,
    rpcUrl: process.env.ETHEREUM_SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY",
    blockExplorer: "https://sepolia.etherscan.io",
    nativeCurrency: {
      name: "Sepolia Ether",
      symbol: "ETH",
      decimals: 18,
    },
    contracts: {
      multicall: "0xcA11bde05977b3631167028862bE2a173976CA11",
      feeCollector: process.env.FEE_COLLECTOR_SEPOLIA,
      bondingCurveFactory: process.env.BONDING_CURVE_FACTORY_SEPOLIA,
      multiSigFactory: process.env.MULTISIG_FACTORY_SEPOLIA,
    },
    confirmations: 1,
    isTestnet: true,
  },
  
  // BSC Networks
  "bsc-mainnet": {
    name: "BNB Smart Chain",
    chainId: 56,
    rpcUrl: process.env.BSC_MAINNET_RPC_URL || "https://bsc-dataseed1.binance.org",
    blockExplorer: "https://bscscan.com",
    nativeCurrency: {
      name: "BNB",
      symbol: "BNB",
      decimals: 18,
    },
    contracts: {
      multicall: "0xcA11bde05977b3631167028862bE2a173976CA11",
      feeCollector: process.env.FEE_COLLECTOR_BSC,
      bondingCurveFactory: process.env.BONDING_CURVE_FACTORY_BSC,
      multiSigFactory: process.env.MULTISIG_FACTORY_BSC,
    },
    gasSettings: {
      maxFeePerGas: BigInt("10000000000"), // 10 gwei
      maxPriorityFeePerGas: BigInt("2000000000"), // 2 gwei
    },
    confirmations: 3,
    isTestnet: false,
  },
  
  "bsc-testnet": {
    name: "BNB Smart Chain Testnet",
    chainId: 97,
    rpcUrl: process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545",
    blockExplorer: "https://testnet.bscscan.com",
    nativeCurrency: {
      name: "Test BNB",
      symbol: "tBNB",
      decimals: 18,
    },
    contracts: {
      multicall: "0xcA11bde05977b3631167028862bE2a173976CA11",
      feeCollector: process.env.FEE_COLLECTOR_BSC_TESTNET,
      bondingCurveFactory: process.env.BONDING_CURVE_FACTORY_BSC_TESTNET,
      multiSigFactory: process.env.MULTISIG_FACTORY_BSC_TESTNET,
    },
    confirmations: 1,
    isTestnet: true,
  },
  
  // Solana Networks
  "solana-mainnet": {
    name: "Solana Mainnet",
    chainId: 101,
    rpcUrl: process.env.SOLANA_MAINNET_RPC_URL || "https://api.mainnet-beta.solana.com",
    blockExplorer: "https://explorer.solana.com",
    nativeCurrency: {
      name: "Solana",
      symbol: "SOL",
      decimals: 9,
    },
    confirmations: 31, // Solana finality
    isTestnet: false,
  },
  
  "solana-devnet": {
    name: "Solana Devnet",
    chainId: 103,
    rpcUrl: process.env.SOLANA_DEVNET_RPC_URL || "https://api.devnet.solana.com",
    blockExplorer: "https://explorer.solana.com?cluster=devnet",
    nativeCurrency: {
      name: "Solana",
      symbol: "SOL",
      decimals: 9,
    },
    confirmations: 1,
    isTestnet: true,
  },
};

// Get network config by blockchain and environment
export function getNetworkConfig(blockchain: string, isTestnet: boolean): NetworkConfig {
  const networkKey = `${blockchain}-${isTestnet ? 'testnet' : 'mainnet'}`;
  // Special case for Solana devnet
  if (blockchain === 'solana' && isTestnet) {
    return NETWORKS['solana-devnet'];
  }
  
  const config = NETWORKS[networkKey];
  if (!config) {
    throw new Error(`Network configuration not found for ${networkKey}`);
  }
  
  return config;
}

// Validate network configuration
export function validateNetworkConfig(config: NetworkConfig): string[] {
  const errors: string[] = [];
  
  if (!config.rpcUrl || config.rpcUrl.includes('YOUR_KEY')) {
    errors.push(`RPC URL not properly configured for ${config.name}`);
  }
  
  if (!config.isTestnet && !config.contracts?.feeCollector) {
    errors.push(`Fee collector contract not configured for ${config.name}`);
  }
  
  if (config.chainId === 1 || config.chainId === 56) {
    // Mainnet specific validations
    if (!config.gasSettings) {
      errors.push(`Gas settings not configured for mainnet ${config.name}`);
    }
    
    if (config.confirmations < 2) {
      errors.push(`Confirmation count too low for mainnet ${config.name}`);
    }
  }
  
  return errors;
}

// Get all configured networks
export function getConfiguredNetworks(includeTestnets: boolean = true): NetworkConfig[] {
  return Object.values(NETWORKS).filter(network => 
    includeTestnets || !network.isTestnet
  );
}

// Check if network is properly configured for production
export function isNetworkProductionReady(blockchain: string): boolean {
  try {
    const config = getNetworkConfig(blockchain, false);
    const errors = validateNetworkConfig(config);
    return errors.length === 0;
  } catch {
    return false;
  }
}