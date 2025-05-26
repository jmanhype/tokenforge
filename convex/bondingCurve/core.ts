// Bonding curve calculation functions
export const PLATFORM_FEE_PERCENT = 1;
export const CREATOR_FEE_PERCENT = 1;

export function calculateBuyAmount(
  amountInUSD: number,
  currentSupply: number,
  reserveBalance: number
) {
  const totalFeePercent = PLATFORM_FEE_PERCENT + CREATOR_FEE_PERCENT;
  const feeAmount = amountInUSD * (totalFeePercent / 100);
  const amountAfterFee = amountInUSD - feeAmount;
  
  // Price = 0.00001 * (supply / 1e9)^1.5
  const k = 0.00001;
  const n = 1.5;
  
  // Calculate new supply using the bonding curve formula
  const currentPrice = k * Math.pow(currentSupply / 1e9, n);
  const averagePrice = currentPrice * 1.2; // Simplified average price
  const tokensOut = amountAfterFee / averagePrice;
  const newSupply = currentSupply + tokensOut;
  const newPrice = k * Math.pow(newSupply / 1e9, n);
  
  return {
    tokensOut,
    newSupply,
    newPrice,
    fees: {
      platform: amountInUSD * (PLATFORM_FEE_PERCENT / 100),
      creator: amountInUSD * (CREATOR_FEE_PERCENT / 100),
      total: feeAmount,
    },
  };
}

export function calculateSellAmount(
  tokenAmount: number,
  currentSupply: number,
  reserveBalance: number
) {
  const k = 0.00001;
  const n = 1.5;
  
  const newSupply = currentSupply - tokenAmount;
  const currentPrice = k * Math.pow(currentSupply / 1e9, n);
  const newPrice = k * Math.pow(newSupply / 1e9, n);
  const averagePrice = (currentPrice + newPrice) / 2;
  
  const amountBeforeFee = tokenAmount * averagePrice;
  const totalFeePercent = PLATFORM_FEE_PERCENT + CREATOR_FEE_PERCENT;
  const feeAmount = amountBeforeFee * (totalFeePercent / 100);
  const amountOut = amountBeforeFee - feeAmount;
  
  return {
    amountOut,
    newSupply,
    newPrice,
    fees: {
      platform: amountBeforeFee * (PLATFORM_FEE_PERCENT / 100),
      creator: amountBeforeFee * (CREATOR_FEE_PERCENT / 100),
      total: feeAmount,
    },
  };
}

export function calculateGraduationCheck(currentSupply: number, currentPrice: number) {
  const marketCap = currentSupply * currentPrice;
  const GRADUATION_THRESHOLD = 100000; // $100k
  
  return {
    shouldGraduate: marketCap >= GRADUATION_THRESHOLD,
    marketCap,
    progress: (marketCap / GRADUATION_THRESHOLD) * 100,
  };
}