import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";

// Simple monitoring API endpoints for the dashboard

export const getSystemHealth = query({
  args: {},
  handler: async (ctx) => {
    const components = await ctx.db.query("systemHealth").collect();
    return components.map(c => ({
      component: c.component,
      status: c.status,
      lastCheck: c.lastCheck,
      responseTime: c.responseTime,
      errorRate: c.errorRate,
    }));
  },
});

export const getRecentAlerts = query({
  args: { 
    limit: v.number() 
  },
  handler: async (ctx, args) => {
    const alerts = await ctx.db
      .query("alerts")
      .order("desc")
      .take(args.limit);
    
    return alerts;
  },
});

export const getMetricsSummary = query({
  args: {
    timeRange: v.union(v.literal("1h"), v.literal("24h"), v.literal("7d")),
  },
  handler: async (ctx, args) => {
    // For now, return mock data until metrics are properly populated
    return [
      {
        name: "TOKENS CREATED",
        value: 42,
        trend: 1,
        change: 15.5,
      },
      {
        name: "TOTAL TRADING VOLUME",
        value: 125430,
        trend: 1,
        change: 8.2,
      },
      {
        name: "ACTIVE USERS",
        value: 234,
        trend: -1,
        change: -2.1,
      },
      {
        name: "SUCCESSFUL DEPLOYMENTS",
        value: 38,
        trend: 1,
        change: 12.0,
      },
    ];
  },
});

export const getRecentAuditLogs = query({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("auditLogs")
      .order("desc")
      .take(args.limit);
    
    return logs;
  },
});

// Internal mutations for recording events
export const recordAuditLog = internalMutation({
  args: {
    userId: v.string(),
    action: v.string(),
    entityId: v.optional(v.string()),
    entityType: v.optional(v.string()),
    severity: v.union(v.literal("info"), v.literal("warning"), v.literal("error"), v.literal("critical")),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      ...args,
      timestamp: Date.now(),
      ipAddress: undefined,
      userAgent: undefined,
    });
  },
});

export const recordMetric = internalMutation({
  args: {
    name: v.string(),
    value: v.number(),
    type: v.union(v.literal("counter"), v.literal("gauge"), v.literal("histogram")),
    labels: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("metrics", {
      ...args,
      timestamp: Date.now(),
    });
  },
});