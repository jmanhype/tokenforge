import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get system health status
export const getSystemHealth = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("systemHealth").collect();
  },
});

// Get recent alerts
export const getRecentAlerts = query({
  args: {
    limit: v.number(),
    severity: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical"))),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("alerts").withIndex("by_triggered").order("desc");
    
    if (args.severity) {
      query = query.filter((q) => q.eq(q.field("severity"), args.severity));
    }
    
    return await query.take(args.limit);
  },
});

// Get metrics summary
export const getMetricsSummary = query({
  args: {
    timeRange: v.union(v.literal("1h"), v.literal("24h"), v.literal("7d")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const timeRangeMs = {
      "1h": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
    };
    
    const startTime = now - timeRangeMs[args.timeRange];
    
    // Key metrics to track
    const metricNames = [
      "tokens_created",
      "total_trading_volume",
      "active_users",
      "successful_deployments",
      "failed_deployments",
      "api_calls",
      "error_rate",
      "avg_response_time",
    ];
    
    const summaries = await Promise.all(
      metricNames.map(async (name) => {
        const metrics = await ctx.db
          .query("metrics")
          .withIndex("by_name_time", (q) => 
            q.eq("name", name).gte("timestamp", startTime)
          )
          .collect();
        
        if (metrics.length === 0) {
          return {
            name: name.replace(/_/g, " ").toUpperCase(),
            value: 0,
            trend: 0,
            change: 0,
          };
        }
        
        const currentValue = metrics[metrics.length - 1].value;
        const oldestValue = metrics[0].value;
        const trend = currentValue > oldestValue ? 1 : currentValue < oldestValue ? -1 : 0;
        const change = oldestValue !== 0 ? ((currentValue - oldestValue) / oldestValue) * 100 : 0;
        
        return {
          name: name.replace(/_/g, " ").toUpperCase(),
          value: currentValue,
          trend,
          change,
        };
      })
    );
    
    return summaries;
  },
});

// Get recent audit logs
export const getRecentAuditLogs = query({
  args: {
    limit: v.number(),
    userId: v.optional(v.string()),
    action: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("auditLogs").withIndex("by_timestamp").order("desc");
    
    if (args.userId) {
      query = ctx.db.query("auditLogs").withIndex("by_user", (q) => q.eq("userId", args.userId));
    } else if (args.action) {
      query = ctx.db.query("auditLogs").withIndex("by_action", (q) => q.eq("action", args.action));
    }
    
    return await query.take(args.limit);
  },
});

// Acknowledge an alert
export const acknowledgeAlert = mutation({
  args: {
    alertId: v.id("alerts"),
    acknowledgedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const alert = await ctx.db.get(args.alertId);
    if (!alert) throw new Error("Alert not found");
    
    if (alert.status !== "triggered") {
      throw new Error("Alert is not in triggered state");
    }
    
    await ctx.db.patch(args.alertId, {
      status: "acknowledged",
      acknowledgedAt: Date.now(),
      acknowledgedBy: args.acknowledgedBy,
    });
    
    return { success: true };
  },
});

// Resolve an alert
export const resolveAlert = mutation({
  args: {
    alertId: v.id("alerts"),
    resolvedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const alert = await ctx.db.get(args.alertId);
    if (!alert) throw new Error("Alert not found");
    
    if (alert.status === "resolved") {
      throw new Error("Alert is already resolved");
    }
    
    await ctx.db.patch(args.alertId, {
      status: "resolved",
      resolvedAt: Date.now(),
      resolvedBy: args.resolvedBy,
    });
    
    return { success: true };
  },
});

// Create alert channel
export const createAlertChannel = mutation({
  args: {
    name: v.string(),
    type: v.union(v.literal("discord"), v.literal("telegram"), v.literal("webhook")),
    config: v.any(),
    testMode: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const channelId = await ctx.db.insert("alertChannels", {
      name: args.name,
      type: args.type,
      enabled: true,
      config: args.config,
      testMode: args.testMode || false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    return { channelId };
  },
});

// Create alert configuration
export const createAlertConfig = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    condition: v.object({
      metric: v.string(),
      operator: v.union(v.literal(">"), v.literal("<"), v.literal(">="), v.literal("<="), v.literal("==")),
      threshold: v.number(),
      duration: v.optional(v.number()),
    }),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    channels: v.array(v.id("alertChannels")),
    cooldown: v.number(),
  },
  handler: async (ctx, args) => {
    const configId = await ctx.db.insert("alertConfigs", {
      name: args.name,
      description: args.description,
      enabled: true,
      condition: args.condition,
      severity: args.severity,
      channels: args.channels,
      cooldown: args.cooldown,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    return { configId };
  },
});

// Toggle alert config
export const toggleAlertConfig = mutation({
  args: {
    configId: v.id("alertConfigs"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.configId, {
      enabled: args.enabled,
      updatedAt: Date.now(),
    });
    
    return { success: true };
  },
});

// Export audit logs for compliance
export const exportAuditLogs = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    format: v.union(v.literal("json"), v.literal("csv")),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp", (q) => 
        q.gte("timestamp", args.startDate).lte("timestamp", args.endDate)
      )
      .collect();
    
    if (args.format === "json") {
      return {
        format: "json",
        data: logs,
        count: logs.length,
      };
    } else {
      // Convert to CSV format
      const headers = ["timestamp", "userId", "action", "entityType", "entityId", "severity", "metadata"];
      const rows = logs.map(log => [
        new Date(log.timestamp).toISOString(),
        log.userId,
        log.action,
        log.entityType || "",
        log.entityId || "",
        log.severity,
        JSON.stringify(log.metadata || {}),
      ]);
      
      const csv = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
      ].join("\n");
      
      return {
        format: "csv",
        data: csv,
        count: logs.length,
      };
    }
  },
});

// Get system metrics for specific component
export const getComponentMetrics = query({
  args: {
    component: v.string(),
    metricType: v.string(),
    timeRange: v.union(v.literal("1h"), v.literal("24h"), v.literal("7d")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const timeRangeMs = {
      "1h": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
    };
    
    const startTime = now - timeRangeMs[args.timeRange];
    const metricName = `${args.component}_${args.metricType}`;
    
    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_name_time", (q) => 
        q.eq("name", metricName).gte("timestamp", startTime)
      )
      .collect();
    
    return metrics.map(m => ({
      timestamp: m.timestamp,
      value: m.value,
      labels: m.labels,
    }));
  },
});