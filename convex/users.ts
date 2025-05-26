import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

// Get user by ID
export const getUser = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // For now, return a mock user object
    // In production, this should query from a users table
    return {
      _id: args.userId,
      address: args.userId,
      balance: 1000, // Mock balance
      createdAt: Date.now(),
    };
  },
});

// Get user by wallet address
export const getUserByAddress = internalQuery({
  args: {
    address: v.string(),
  },
  handler: async (ctx, args) => {
    // Mock implementation
    return {
      _id: args.address,
      address: args.address,
      balance: 1000,
      createdAt: Date.now(),
    };
  },
});