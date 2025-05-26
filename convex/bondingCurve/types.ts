// Bonding curve types to avoid circular dependencies
export interface BuyAmountResult {
  tokensReceived: number;
  pricePerToken: number;
  priceImpact: number;
  newSupply: number;
  newPrice: number;
  fee: number;
  ethAfterFee: number;
}

export interface SellAmountResult {
  ethReceived: number;
  pricePerToken: number;
  priceImpact: number;
  newSupply: number;
  newPrice: number;
  fee: number;
  tokensAfterFee: number;
}

export interface CurveData {
  tokenId: string;
  currentSupply: number;
  reserveBalance: number;
  totalRaised: number;
  k: number;
  n: number;
  targetMarketCap: number;
  graduated: boolean;
  graduatedAt?: number;
  dexPoolAddress?: string;
  currentPrice: number;
  marketCap: number;
  progress: number;
}

export interface BuyTransactionResult {
  success: true;
  tokensReceived: number;
  txHash: string;
  price: number;
  totalCost: number;
}

export interface SellTransactionResult {
  success: true;
  ethReceived: number;
  txHash: string;
  price: number;
}

export interface GraduationResult {
  graduated: true;
  poolAddress: string;
  txHash: string;
  liquidityETH: number;
  liquidityTokens: number;
  burnedTokens: number;
}