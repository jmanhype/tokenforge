import { internalMutation } from "../_generated/server";

export const addTokenIdToBondingCurves = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all bonding curves without tokenId
    const bondingCurves = await ctx.db
      .query("bondingCurves")
      .collect();
    
    let updated = 0;
    for (const curve of bondingCurves) {
      // If tokenId is missing, set it to coinId
      if (!curve.tokenId && curve.coinId) {
        await ctx.db.patch(curve._id, {
          tokenId: curve.coinId,
        });
        updated++;
      }
    }
    
    console.log(`Updated ${updated} bonding curves with tokenId`);
    return { updated };
  },
});