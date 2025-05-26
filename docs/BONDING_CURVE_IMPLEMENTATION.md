# Bonding Curve Implementation Guide

## Overview

A bonding curve is a mathematical formula that determines the price of a token based on its supply. As more tokens are purchased, the price increases along the curve. This creates a fair, transparent pricing mechanism that prevents rugpulls and ensures liquidity.

## Mathematical Foundation

### Basic Formula
```
Price = m * Supply^n + b

Where:
- m = slope coefficient (determines steepness)
- n = curve exponent (1 = linear, 2 = quadratic)
- b = base price
```

### Pump.fun Style Implementation
```typescript
// Simplified bonding curve used by most platforms
const calculatePrice = (supply: number): number => {
  const k = 0.00000001; // Curve constant
  return k * Math.pow(supply, 1.5);
};

// Calculate tokens received for ETH amount
const calculatePurchaseReturn = (
  ethAmount: number,
  currentSupply: number,
  reserveBalance: number
): number => {
  const reserveRatio = 0.5; // 50% reserve ratio
  return currentSupply * ((1 + ethAmount / reserveBalance) ** reserveRatio - 1);
};
```

## Implementation Steps

### Step 1: Update Schema

```typescript
// convex/schema.ts
export const bondingCurves = defineTable({
  tokenId: v.id("memeCoins"),
  currentSupply: v.number(),
  reserveBalance: v.number(), // ETH/BNB/SOL in reserve
  totalRaised: v.number(),
  k: v.number(), // Curve constant
  n: v.number(), // Curve exponent
  targetMarketCap: v.number(), // Graduation threshold
  graduated: v.boolean(),
  graduatedAt: v.optional(v.number()),
  dexPoolAddress: v.optional(v.string()),
});

export const tokenTrades = defineTable({
  tokenId: v.id("memeCoins"),
  trader: v.string(),
  type: v.union(v.literal("buy"), v.literal("sell")),
  tokenAmount: v.number(),
  ethAmount: v.number(),
  price: v.number(),
  timestamp: v.number(),
  txHash: v.string(),
});
```

### Step 2: Bonding Curve Functions

```typescript
// convex/bondingCurve.ts
import { v } from "convex/values";
import { internalQuery, internalMutation, action } from "./_generated/server";

// Calculate current token price
export const getCurrentPrice = internalQuery({
  args: { tokenId: v.id("memeCoins") },
  handler: async (ctx, args) => {
    const curve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();
    
    if (!curve) throw new Error("Bonding curve not found");
    
    // Price = k * supply^n
    const price = curve.k * Math.pow(curve.currentSupply, curve.n);
    
    return {
      price,
      supply: curve.currentSupply,
      marketCap: price * curve.currentSupply,
      progress: (curve.totalRaised / curve.targetMarketCap) * 100,
    };
  },
});

// Calculate buy amount
export const calculateBuyAmount = internalQuery({
  args: {
    tokenId: v.id("memeCoins"),
    ethAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const curve = await ctx.db
      .query("bondingCurves")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .first();
    
    if (!curve) throw new Error("Bonding curve not found");
    
    // Integral of bonding curve formula
    const currentPrice = curve.k * Math.pow(curve.currentSupply, curve.n);
    const tokensOut = Math.sqrt(
      (2 * args.ethAmount) / curve.k + Math.pow(curve.currentSupply, 2)
    ) - curve.currentSupply;
    
    const priceImpact = ((tokensOut * currentPrice) / curve.currentSupply) * 100;
    
    return {
      tokensOut,
      pricePerToken: args.ethAmount / tokensOut,
      priceImpact,
      newSupply: curve.currentSupply + tokensOut,
    };
  },
});

// Execute buy transaction
export const buyTokens = action({
  args: {
    tokenId: v.id("memeCoins"),
    ethAmount: v.number(),
    minTokens: v.number(), // Slippage protection
    buyer: v.string(),
  },
  handler: async (ctx, args) => {
    // Calculate tokens to receive
    const buyAmount = await ctx.runQuery(internal.bondingCurve.calculateBuyAmount, {
      tokenId: args.tokenId,
      ethAmount: args.ethAmount,
    });
    
    if (buyAmount.tokensOut < args.minTokens) {
      throw new Error("Slippage tolerance exceeded");
    }
    
    // Execute blockchain transaction
    const txHash = await ctx.runAction(internal.blockchain.buyFromBondingCurve, {
      tokenId: args.tokenId,
      buyer: args.buyer,
      ethAmount: args.ethAmount,
      tokensOut: buyAmount.tokensOut,
    });
    
    // Update bonding curve state
    await ctx.runMutation(internal.bondingCurve.updateCurveAfterBuy, {
      tokenId: args.tokenId,
      tokensOut: buyAmount.tokensOut,
      ethAmount: args.ethAmount,
      buyer: args.buyer,
      txHash,
    });
    
    // Check for graduation
    await ctx.runAction(internal.bondingCurve.checkGraduation, {
      tokenId: args.tokenId,
    });
    
    return {
      success: true,
      tokensReceived: buyAmount.tokensOut,
      txHash,
    };
  },
});
```

### Step 3: Smart Contract Integration

```solidity
// contracts/BondingCurve.sol
pragma solidity ^0.8.0;

contract BondingCurve {
    using SafeMath for uint256;
    
    struct Curve {
        uint256 currentSupply;
        uint256 reserveBalance;
        uint256 k; // Price coefficient
        uint256 n; // Curve exponent (scaled by 1e18)
        bool graduated;
        address poolAddress;
    }
    
    mapping(address => Curve) public curves;
    
    function buy(address token, uint256 minTokens) 
        external 
        payable 
        returns (uint256 tokensOut) 
    {
        Curve storage curve = curves[token];
        require(!curve.graduated, "Token has graduated");
        
        // Calculate tokens out
        tokensOut = calculatePurchaseReturn(
            msg.value,
            curve.currentSupply,
            curve.reserveBalance
        );
        
        require(tokensOut >= minTokens, "Slippage exceeded");
        
        // Update state
        curve.currentSupply = curve.currentSupply.add(tokensOut);
        curve.reserveBalance = curve.reserveBalance.add(msg.value);
        
        // Mint tokens to buyer
        IToken(token).mint(msg.sender, tokensOut);
        
        emit TokensPurchased(token, msg.sender, msg.value, tokensOut);
    }
    
    function calculatePurchaseReturn(
        uint256 ethAmount,
        uint256 currentSupply,
        uint256 reserveBalance
    ) public pure returns (uint256) {
        // Bancor formula implementation
        uint256 reserveRatio = 500000; // 50% in ppm
        return currentSupply.mul(
            (ethAmount.add(reserveBalance)).pow(reserveRatio).div(
                reserveBalance.pow(reserveRatio)
            ).sub(1e18)
        ).div(1e18);
    }
}
```

### Step 4: Frontend Components

```typescript
// src/components/BondingCurveChart.tsx
import { Line } from 'react-chartjs-2';
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function BondingCurveChart({ tokenId }: { tokenId: Id<"memeCoins"> }) {
  const curveData = useQuery(api.bondingCurve.getCurveData, { tokenId });
  
  if (!curveData) return <div>Loading...</div>;
  
  const data = {
    labels: curveData.supplyPoints,
    datasets: [{
      label: 'Token Price',
      data: curveData.pricePoints,
      borderColor: 'rgb(75, 192, 192)',
      tension: 0.1,
      fill: {
        target: 'origin',
        above: 'rgba(75, 192, 192, 0.1)',
      },
    }],
  };
  
  return (
    <div className="w-full h-64">
      <Line data={data} options={{
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: 'Supply' } },
          y: { title: { display: true, text: 'Price (ETH)' } },
        },
      }} />
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-500">Current Price</p>
          <p className="text-xl font-bold">{curveData.currentPrice} ETH</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Progress to DEX</p>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{ width: `${curveData.progress}%` }}
            />
          </div>
          <p className="text-xs mt-1">{curveData.progress}% of $100k</p>
        </div>
      </div>
    </div>
  );
}
```

```typescript
// src/components/TradingInterface.tsx
import { useState } from 'react';
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function TradingInterface({ tokenId }: { tokenId: Id<"memeCoins"> }) {
  const [amount, setAmount] = useState("");
  const [isBuying, setIsBuying] = useState(true);
  
  const price = useQuery(api.bondingCurve.getCurrentPrice, { tokenId });
  const buyTokens = useMutation(api.bondingCurve.buyTokens);
  const sellTokens = useMutation(api.bondingCurve.sellTokens);
  
  const estimate = useQuery(
    isBuying ? api.bondingCurve.calculateBuyAmount : api.bondingCurve.calculateSellAmount,
    amount ? { tokenId, amount: parseFloat(amount) } : "skip"
  );
  
  const handleTrade = async () => {
    if (!amount) return;
    
    if (isBuying) {
      await buyTokens({
        tokenId,
        ethAmount: parseFloat(amount),
        minTokens: estimate!.tokensOut * 0.95, // 5% slippage
        buyer: address!,
      });
    } else {
      await sellTokens({
        tokenId,
        tokenAmount: parseFloat(amount),
        minEth: estimate!.ethOut * 0.95,
        seller: address!,
      });
    }
    
    setAmount("");
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex gap-2 mb-4">
        <button
          className={`flex-1 py-2 rounded ${isBuying ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setIsBuying(true)}
        >
          Buy
        </button>
        <button
          className={`flex-1 py-2 rounded ${!isBuying ? 'bg-red-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setIsBuying(false)}
        >
          Sell
        </button>
      </div>
      
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={isBuying ? "ETH amount" : "Token amount"}
        className="w-full p-2 border rounded mb-4"
      />
      
      {estimate && (
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <p className="text-sm">
            You'll receive: {estimate.tokensOut.toFixed(2)} tokens
          </p>
          <p className="text-xs text-gray-500">
            Price impact: {estimate.priceImpact.toFixed(2)}%
          </p>
        </div>
      )}
      
      <button
        onClick={handleTrade}
        className="w-full py-3 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        {isBuying ? 'Buy Tokens' : 'Sell Tokens'}
      </button>
    </div>
  );
}
```

### Step 5: Auto-Graduation Logic

```typescript
// convex/graduation.ts
export const checkGraduation = internalAction({
  args: { tokenId: v.id("memeCoins") },
  handler: async (ctx, args) => {
    const curve = await ctx.runQuery(internal.bondingCurve.getCurve, { 
      tokenId: args.tokenId 
    });
    
    if (curve.graduated || curve.totalRaised < curve.targetMarketCap) {
      return { graduated: false };
    }
    
    // Graduate to DEX
    const result = await ctx.runAction(internal.dex.createAndMigratePool, {
      tokenId: args.tokenId,
      liquidityETH: curve.reserveBalance * 0.85, // 85% to liquidity
      liquidityTokens: curve.currentSupply * 0.85,
      burnTokens: curve.currentSupply * 0.15, // Burn 15%
    });
    
    // Update curve status
    await ctx.runMutation(internal.bondingCurve.markGraduated, {
      tokenId: args.tokenId,
      poolAddress: result.poolAddress,
    });
    
    // Notify creator and holders
    await ctx.runAction(internal.notifications.announceGraduation, {
      tokenId: args.tokenId,
      poolAddress: result.poolAddress,
      platform: "all",
    });
    
    return { 
      graduated: true, 
      poolAddress: result.poolAddress,
      txHash: result.txHash,
    };
  },
});
```

## Testing Strategy

### Unit Tests
```typescript
// __tests__/bondingCurve.test.ts
describe('Bonding Curve', () => {
  it('should calculate correct price for supply', () => {
    const price = calculatePrice(1000000);
    expect(price).toBeCloseTo(0.0316, 4);
  });
  
  it('should calculate correct tokens for ETH', () => {
    const tokens = calculatePurchaseReturn(1, 1000000, 10);
    expect(tokens).toBeCloseTo(47619, 0);
  });
  
  it('should graduate at target market cap', async () => {
    // Test graduation trigger
  });
});
```

## Security Considerations

1. **Reentrancy Protection**: Use OpenZeppelin's ReentrancyGuard
2. **Integer Overflow**: Use SafeMath or Solidity 0.8+
3. **Front-Running**: Implement commit-reveal or time-weighted pricing
4. **Sandwich Attacks**: Max slippage and per-block purchase limits
5. **Flash Loan Attacks**: Ensure curve state updates atomically

## Gas Optimization

1. Pack struct variables to use fewer storage slots
2. Use events instead of storage for historical data
3. Batch operations where possible
4. Cache frequently accessed values

## Deployment Checklist

- [ ] Deploy BondingCurve contract
- [ ] Initialize curve parameters for each chain
- [ ] Set up monitoring for graduation events
- [ ] Test buy/sell with small amounts
- [ ] Verify gas costs are reasonable
- [ ] Enable trading interface in UI
- [ ] Monitor first 24 hours closely

## Expected Outcomes

- **Increased Liquidity**: Every token has immediate liquidity
- **Fair Pricing**: No presales or team allocations
- **Reduced Rugpulls**: Liquidity locked in curve
- **Higher Engagement**: Users can trade immediately
- **Revenue Growth**: 1% fee on all trades

This bonding curve implementation will transform TokenForge from a simple launcher into a full trading platform, matching the success of Pump.fun while maintaining the multi-chain advantage.