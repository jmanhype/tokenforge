import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

// Get multi-sig wallet details
export const getMultiSigWallet = query({
  args: {
    tokenId: v.id("memeCoins"),
  },
  handler: async (ctx, args) => {
    const wallet = await ctx.db
      .query("multiSigWallets")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!wallet) return null;
    
    // Get pending transactions
    const pendingTxs = await ctx.db
      .query("multiSigTransactions")
      .withIndex("by_multisig", (q) => q.eq("multiSigAddress", wallet.address))
      .filter((q) => q.eq(q.field("executed"), false))
      .collect();
    
    return {
      ...wallet,
      pendingTransactions: pendingTxs.length,
    };
  },
});

// Get multi-sig transactions
export const getMultiSigTransactions = query({
  args: {
    multiSigAddress: v.string(),
    status: v.optional(v.union(v.literal("pending"), v.literal("executed"))),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("multiSigTransactions")
      .withIndex("by_multisig", (q) => q.eq("multiSigAddress", args.multiSigAddress));
    
    if (args.status === "pending") {
      query = query.filter((q) => q.eq(q.field("executed"), false));
    } else if (args.status === "executed") {
      query = query.filter((q) => q.eq(q.field("executed"), true));
    }
    
    const transactions = await query.collect();
    
    return transactions.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Record multi-sig deployment
export const recordMultiSigDeployment = mutation({
  args: {
    tokenId: v.id("memeCoins"),
    address: v.string(),
    owners: v.array(v.string()),
    requiredConfirmations: v.number(),
    blockchain: v.string(),
    transactionHash: v.string(),
    deploymentCost: v.number(),
  },
  handler: async (ctx, args) => {
    // Deactivate any existing multi-sig for this token
    const existing = await ctx.db
      .query("multiSigWallets")
      .withIndex("by_token", (q) => q.eq("tokenId", args.tokenId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, { isActive: false });
    }
    
    // Record the new multi-sig
    await ctx.db.insert("multiSigWallets", {
      tokenId: args.tokenId,
      address: args.address,
      owners: args.owners,
      requiredConfirmations: args.requiredConfirmations,
      blockchain: args.blockchain,
      transactionHash: args.transactionHash,
      deploymentCost: args.deploymentCost,
      createdAt: Date.now(),
      isActive: true,
    });
    
    return { success: true };
  },
});

// Record multi-sig transaction
export const recordMultiSigTransaction = mutation({
  args: {
    multiSigAddress: v.string(),
    txIndex: v.number(),
    to: v.string(),
    value: v.string(),
    data: v.string(),
    description: v.string(),
    submitter: v.string(),
    submitTxHash: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("multiSigTransactions", {
      multiSigAddress: args.multiSigAddress,
      txIndex: args.txIndex,
      to: args.to,
      value: args.value,
      data: args.data,
      description: args.description,
      submitter: args.submitter,
      submitTxHash: args.submitTxHash,
      confirmations: [],
      executed: false,
      createdAt: Date.now(),
    });
    
    return { success: true };
  },
});

// Record transaction confirmation
export const recordTransactionConfirmation = mutation({
  args: {
    multiSigAddress: v.string(),
    txIndex: v.number(),
    confirmer: v.string(),
    confirmTxHash: v.string(),
  },
  handler: async (ctx, args) => {
    const tx = await ctx.db
      .query("multiSigTransactions")
      .withIndex("by_multisig_index", (q) => 
        q.eq("multiSigAddress", args.multiSigAddress)
         .eq("txIndex", args.txIndex)
      )
      .first();
    
    if (!tx) {
      throw new Error("Transaction not found");
    }
    
    if (tx.executed) {
      throw new Error("Transaction already executed");
    }
    
    // Add confirmation
    const confirmations = [...tx.confirmations, {
      confirmer: args.confirmer,
      confirmTxHash: args.confirmTxHash,
      timestamp: Date.now(),
    }];
    
    await ctx.db.patch(tx._id, { confirmations });
    
    return { success: true };
  },
});

// Mark transaction as executed
export const markTransactionExecuted = mutation({
  args: {
    multiSigAddress: v.string(),
    txIndex: v.number(),
    executeTxHash: v.string(),
  },
  handler: async (ctx, args) => {
    const tx = await ctx.db
      .query("multiSigTransactions")
      .withIndex("by_multisig_index", (q) => 
        q.eq("multiSigAddress", args.multiSigAddress)
         .eq("txIndex", args.txIndex)
      )
      .first();
    
    if (!tx) {
      throw new Error("Transaction not found");
    }
    
    if (tx.executed) {
      throw new Error("Transaction already executed");
    }
    
    await ctx.db.patch(tx._id, { 
      executed: true,
      executeTxHash: args.executeTxHash,
    });
    
    return { success: true };
  },
});