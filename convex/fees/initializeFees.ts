import { internalMutation } from "../_generated/server";
import { FeeTypes } from "./feeManager";

// Initialize default fee configurations
export const initializeDefaultFees = internalMutation({
  args: {},
  handler: async (ctx) => {
    const defaultFees = [
      {
        feeType: FeeTypes.TOKEN_CREATION,
        amount: 0.01 * 1e18, // 0.01 ETH in wei
        minAmount: 0.01 * 1e18,
        maxAmount: 0.01 * 1e18,
        isEnabled: true,
        isPercentage: false,
      },
      {
        feeType: FeeTypes.BONDING_CURVE_TRADE,
        amount: 100, // 1% in basis points
        minAmount: 0.0001 * 1e18,
        maxAmount: 1 * 1e18,
        isEnabled: true,
        isPercentage: true,
      },
      {
        feeType: FeeTypes.DEX_GRADUATION,
        amount: 250, // 2.5% in basis points
        minAmount: 0.01 * 1e18,
        maxAmount: 10 * 1e18,
        isEnabled: true,
        isPercentage: true,
      },
      {
        feeType: FeeTypes.LIQUIDITY_PROVISION,
        amount: 50, // 0.5% in basis points
        minAmount: 0.001 * 1e18,
        maxAmount: 0,
        isEnabled: true,
        isPercentage: true,
      },
      {
        feeType: FeeTypes.MULTI_SIG_DEPLOYMENT,
        amount: 0.005 * 1e18, // 0.005 ETH in wei
        minAmount: 0.005 * 1e18,
        maxAmount: 0.005 * 1e18,
        isEnabled: true,
        isPercentage: false,
      },
    ];
    
    // Check and create fee configurations
    for (const fee of defaultFees) {
      const existing = await ctx.db
        .query("feeConfigurations")
        .withIndex("by_type", (q) => q.eq("feeType", fee.feeType))
        .first();
      
      if (!existing) {
        await ctx.db.insert("feeConfigurations", {
          ...fee,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        
        console.log(`Initialized fee configuration for type ${fee.feeType}`);
      }
    }
    
    return { initialized: true };
  },
});