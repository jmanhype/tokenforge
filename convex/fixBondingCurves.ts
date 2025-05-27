import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const fixBondingCurvesSchema = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all bonding curves
    const bondingCurves = await ctx.db
      .query("bondingCurves")
      .collect();
    
    let fixed = 0;
    for (const curve of bondingCurves) {
      // If tokenId is missing, add it with the same value as coinId
      if (!curve.tokenId && curve.coinId) {
        await ctx.db.patch(curve._id, {
          tokenId: curve.coinId,
        });
        fixed++;
        console.log(`Fixed bonding curve ${curve._id} by adding tokenId`);
      }
    }
    
    return { 
      message: `Fixed ${fixed} bonding curves`, 
      total: bondingCurves.length,
      fixed 
    };
  },
});