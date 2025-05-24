import { v } from "convex/values";

// Types for coin and deployment data
export interface CoinData {
  name: string;
  symbol: string;
  initialSupply: number;
  description?: string;
  logoUrl?: string;
  canMint: boolean;
  canBurn: boolean;
  postQuantumSecurity: boolean;
  deployment?: {
    blockchain: string;
    contractAddress: string;
    transactionHash: string;
  };
}

// Blockchain explorer URLs
const EXPLORER_URLS = {
  ethereum: "https://etherscan.io",
  bsc: "https://bscscan.com",
  solana: "https://solscan.io",
};

// Get explorer URL for contract
export function getExplorerUrl(blockchain: string, contractAddress: string): string {
  const baseUrl = EXPLORER_URLS[blockchain as keyof typeof EXPLORER_URLS];
  if (!baseUrl) return "";
  
  if (blockchain === "solana") {
    return `${baseUrl}/token/${contractAddress}`;
  }
  return `${baseUrl}/token/${contractAddress}`;
}

// Get DEX tools URL
export function getDexToolsUrl(blockchain: string, contractAddress: string): string {
  if (blockchain === "ethereum") {
    return `https://www.dextools.io/app/ether/pair-explorer/${contractAddress}`;
  } else if (blockchain === "bsc") {
    return `https://www.dextools.io/app/bnb/pair-explorer/${contractAddress}`;
  }
  return "";
}

// Format large numbers with K, M, B suffixes
export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1) + "B";
  } else if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + "M";
  } else if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + "K";
  }
  return num.toString();
}

// Generate hashtags for the coin
export function generateHashtags(coin: CoinData): string[] {
  const hashtags = [
    `#${coin.symbol}`,
    "#MemeCoin",
    "#DeFi",
    "#CryptoLaunch",
    "#NewToken",
  ];
  
  if (coin.deployment?.blockchain) {
    const chainHashtag = {
      ethereum: "#Ethereum",
      bsc: "#BSC #BinanceSmartChain",
      solana: "#Solana",
    }[coin.deployment.blockchain];
    if (chainHashtag) hashtags.push(chainHashtag);
  }
  
  if (coin.postQuantumSecurity) {
    hashtags.push("#QuantumSafe");
  }
  
  return hashtags;
}

// Format Twitter/X message (280 char limit)
export function formatTwitterMessage(coin: CoinData, type: "launch" | "milestone" = "launch"): string {
  if (type === "launch") {
    const explorerUrl = coin.deployment 
      ? getExplorerUrl(coin.deployment.blockchain, coin.deployment.contractAddress)
      : "";
    
    const message = `🚀 ${coin.name} ($${coin.symbol}) just launched!

💰 Supply: ${formatNumber(coin.initialSupply)}
⛓️ Chain: ${coin.deployment?.blockchain || "TBD"}
📝 Contract: ${coin.deployment?.contractAddress?.slice(0, 6)}...${coin.deployment?.contractAddress?.slice(-4)}

${explorerUrl}

${generateHashtags(coin).slice(0, 4).join(" ")}`;
    
    // Ensure we don't exceed Twitter's character limit
    return message.length > 280 ? message.substring(0, 277) + "..." : message;
  }
  
  // Milestone message format
  return `🎯 ${coin.name} ($${coin.symbol}) milestone achieved! 🚀

The community is growing strong! 💪

${generateHashtags(coin).slice(0, 3).join(" ")}`;
}

// Format Discord embed message
export function formatDiscordEmbed(coin: CoinData, type: "launch" | "milestone" = "launch") {
  const explorerUrl = coin.deployment 
    ? getExplorerUrl(coin.deployment.blockchain, coin.deployment.contractAddress)
    : "";
  const dexToolsUrl = coin.deployment 
    ? getDexToolsUrl(coin.deployment.blockchain, coin.deployment.contractAddress)
    : "";

  const embed = {
    title: type === "launch" 
      ? `🚀 ${coin.name} (${coin.symbol}) Launched!`
      : `🎯 ${coin.name} (${coin.symbol}) Milestone`,
    color: 0x5865F2, // Discord blurple
    thumbnail: coin.logoUrl ? { url: coin.logoUrl } : undefined,
    description: coin.description || `${coin.name} is a new meme coin ready to moon!`,
    fields: [
      {
        name: "📊 Initial Supply",
        value: formatNumber(coin.initialSupply),
        inline: true,
      },
      {
        name: "⛓️ Blockchain",
        value: coin.deployment?.blockchain || "Pending",
        inline: true,
      },
      {
        name: "📝 Contract Address",
        value: coin.deployment?.contractAddress 
          ? `\`${coin.deployment.contractAddress}\``
          : "Pending deployment",
        inline: false,
      },
      {
        name: "💎 Features",
        value: [
          coin.canMint ? "✅ Mintable" : "❌ No Minting",
          coin.canBurn ? "✅ Burnable" : "❌ No Burning",
          coin.postQuantumSecurity ? "✅ Quantum-Safe" : "❌ Standard Security",
        ].join("\n"),
        inline: true,
      },
    ],
    footer: {
      text: "MemeCoinGen | Create your own meme coin",
      icon_url: "https://memecoingen.com/logo.png",
    },
    timestamp: new Date().toISOString(),
  };

  // Add links field if we have URLs
  if (explorerUrl || dexToolsUrl) {
    const links = [];
    if (explorerUrl) links.push(`[View on Explorer](${explorerUrl})`);
    if (dexToolsUrl) links.push(`[DexTools](${dexToolsUrl})`);
    
    embed.fields.push({
      name: "🔗 Links",
      value: links.join(" | "),
      inline: false,
    });
  }

  return embed;
}

// Format Telegram message with Markdown
export function formatTelegramMessage(coin: CoinData, type: "launch" | "milestone" = "launch"): string {
  const explorerUrl = coin.deployment 
    ? getExplorerUrl(coin.deployment.blockchain, coin.deployment.contractAddress)
    : "";

  if (type === "launch") {
    // Escape special characters for Telegram MarkdownV2
    const escapeMd = (text: string) => text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
    
    return `🚀 *${escapeMd(coin.name)} \\($${escapeMd(coin.symbol)}\\) Launched\\!*

📊 *Supply:* ${escapeMd(formatNumber(coin.initialSupply))}
⛓️ *Chain:* ${escapeMd(coin.deployment?.blockchain || "TBD")}
📝 *Contract:* \`${coin.deployment?.contractAddress || "Pending"}\`

💎 *Features:*
${coin.canMint ? '✅' : '❌'} Mintable
${coin.canBurn ? '✅' : '❌'} Burnable
${coin.postQuantumSecurity ? '✅' : '❌'} Quantum\\-Safe

${explorerUrl ? `[View on Explorer](${explorerUrl})` : ""}

${escapeMd(generateHashtags(coin).join(" "))}`;
  }

  // Milestone format
  const escapeMd = (text: string) => text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  return `🎯 *${escapeMd(coin.name)} \\($${escapeMd(coin.symbol)}\\) Milestone\\!*

The community is growing strong\\! 💪

${escapeMd(generateHashtags(coin).join(" "))}`;
}

// Rate limiting helper
export interface RateLimitConfig {
  platform: "twitter" | "discord" | "telegram";
  maxRequests: number;
  windowMs: number;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  twitter: {
    platform: "twitter",
    maxRequests: 300,
    windowMs: 3 * 60 * 60 * 1000, // 3 hours
  },
  discord: {
    platform: "discord",
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
  },
  telegram: {
    platform: "telegram",
    maxRequests: 30,
    windowMs: 1000, // 1 second
  },
};

// Exponential backoff calculator
export function calculateBackoff(attempt: number, baseDelayMs: number = 1000): number {
  return Math.min(baseDelayMs * Math.pow(2, attempt), 30000); // Max 30 seconds
}

// Retry configuration
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
};