import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const runBondingCurveMigration = mutation({
  args: {},
  handler: async (ctx) => {
    // Run the migration
    const result = await ctx.runMutation(internal.migrations.addTokenIdToBondingCurves, {});
    return result;
  },
});