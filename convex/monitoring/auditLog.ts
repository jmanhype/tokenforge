import { v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";

// Event types for audit logging
export const AuditEventTypes = {
  // Token operations
  TOKEN_CREATED: "token_created",
  TOKEN_DEPLOYED: "token_deployed",
  TOKEN_DEPLOYMENT_FAILED: "token_deployment_failed",
  TOKEN_GRADUATED: "token_graduated",
  
  // Trading operations
  TRADE_BUY: "trade_buy",
  TRADE_SELL: "trade_sell",
  TRADE_FAILED: "trade_failed",
  
  // Liquidity operations
  LIQUIDITY_ADDED: "liquidity_added",
  LIQUIDITY_REMOVED: "liquidity_removed",
  
  // Fee operations
  FEE_COLLECTED: "fee_collected",
  FEE_DISTRIBUTED: "fee_distributed",
  FEE_CONFIG_UPDATED: "fee_config_updated",
  
  // Security operations
  MULTISIG_DEPLOYED: "multisig_deployed",
  MULTISIG_TX_SUBMITTED: "multisig_tx_submitted",
  MULTISIG_TX_CONFIRMED: "multisig_tx_confirmed",
  MULTISIG_TX_EXECUTED: "multisig_tx_executed",
  
  // Admin operations
  ADMIN_ACTION: "admin_action",
  CONFIG_CHANGED: "config_changed",
  EMERGENCY_ACTION: "emergency_action",
  
  // System events
  SYSTEM_ERROR: "system_error",
  CIRCUIT_BREAKER_TRIGGERED: "circuit_breaker_triggered",
  RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",
} as const;

// Severity levels
export const SeverityLevels = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
  CRITICAL: "critical",
} as const;

// Log an audit event
export const logAuditEvent = internalMutation({
  args: {
    eventType: v.string(),
    severity: v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("error"),
      v.literal("critical")
    ),
    userId: v.optional(v.string()),
    tokenId: v.optional(v.id("memeCoins")),
    action: v.string(),
    details: v.any(),
    metadata: v.optional(v.any()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auditLogId = await ctx.db.insert("auditLogs", {
      eventType: args.eventType,
      severity: args.severity,
      userId: args.userId,
      tokenId: args.tokenId,
      action: args.action,
      details: args.details,
      metadata: args.metadata,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      timestamp: Date.now(),
    });
    
    // For critical events, trigger alerts
    if (args.severity === "critical") {
      await ctx.scheduler.runAfter(0, internal.monitoring.alerts.sendCriticalAlert, {
        auditLogId,
        eventType: args.eventType,
        details: args.details,
      });
    }
    
    // Update metrics
    await ctx.runMutation(internal.monitoring.metrics.updateEventMetrics, {
      eventType: args.eventType,
      severity: args.severity,
    });
    
    return auditLogId;
  },
});

// Query audit logs with filters
export const queryAuditLogs = query({
  args: {
    eventType: v.optional(v.string()),
    severity: v.optional(v.string()),
    userId: v.optional(v.string()),
    tokenId: v.optional(v.id("memeCoins")),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("auditLogs");
    
    // Apply filters
    if (args.startTime) {
      query = query.withIndex("by_timestamp", (q) => q.gte("timestamp", args.startTime!));
    }
    
    let logs = await query.order("desc").take(args.limit || 100);
    
    // Filter in memory for additional criteria
    if (args.eventType) {
      logs = logs.filter(log => log.eventType === args.eventType);
    }
    
    if (args.severity) {
      logs = logs.filter(log => log.severity === args.severity);
    }
    
    if (args.userId) {
      logs = logs.filter(log => log.userId === args.userId);
    }
    
    if (args.tokenId) {
      logs = logs.filter(log => log.tokenId === args.tokenId);
    }
    
    if (args.endTime) {
      logs = logs.filter(log => log.timestamp <= args.endTime);
    }
    
    return logs;
  },
});

// Get audit summary statistics
export const getAuditSummary = query({
  args: {
    timeframe: v.union(
      v.literal("1h"),
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d")
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const timeframes = {
      "1h": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    
    const since = now - timeframes[args.timeframe];
    
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", since))
      .collect();
    
    // Calculate summary statistics
    const summary = {
      total: logs.length,
      bySeverity: {} as Record<string, number>,
      byEventType: {} as Record<string, number>,
      criticalEvents: [] as any[],
      errorRate: 0,
      uniqueUsers: new Set<string>(),
      recentEvents: [] as any[],
    };
    
    logs.forEach(log => {
      // Count by severity
      summary.bySeverity[log.severity] = (summary.bySeverity[log.severity] || 0) + 1;
      
      // Count by event type
      summary.byEventType[log.eventType] = (summary.byEventType[log.eventType] || 0) + 1;
      
      // Collect critical events
      if (log.severity === "critical") {
        summary.criticalEvents.push({
          id: log._id,
          eventType: log.eventType,
          details: log.details,
          timestamp: log.timestamp,
        });
      }
      
      // Track unique users
      if (log.userId) {
        summary.uniqueUsers.add(log.userId);
      }
    });
    
    // Calculate error rate
    const errorCount = (summary.bySeverity.error || 0) + (summary.bySeverity.critical || 0);
    summary.errorRate = logs.length > 0 ? (errorCount / logs.length) * 100 : 0;
    
    // Get recent events
    summary.recentEvents = logs
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10)
      .map(log => ({
        id: log._id,
        eventType: log.eventType,
        severity: log.severity,
        action: log.action,
        timestamp: log.timestamp,
      }));
    
    return {
      ...summary,
      uniqueUsers: summary.uniqueUsers.size,
      timeframe: args.timeframe,
    };
  },
});

// Log token creation
export const logTokenCreation = internalMutation({
  args: {
    userId: v.string(),
    tokenId: v.id("memeCoins"),
    tokenName: v.string(),
    tokenSymbol: v.string(),
    blockchain: v.string(),
    initialSupply: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(internal.monitoring.auditLog.logAuditEvent, {
      eventType: AuditEventTypes.TOKEN_CREATED,
      severity: SeverityLevels.INFO,
      userId: args.userId,
      tokenId: args.tokenId,
      action: `Created token ${args.tokenSymbol}`,
      details: {
        tokenName: args.tokenName,
        tokenSymbol: args.tokenSymbol,
        blockchain: args.blockchain,
        initialSupply: args.initialSupply,
      },
    });
  },
});

// Log trading activity
export const logTradeActivity = internalMutation({
  args: {
    userId: v.string(),
    tokenId: v.id("memeCoins"),
    tradeType: v.union(v.literal("buy"), v.literal("sell")),
    amount: v.number(),
    price: v.number(),
    success: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const eventType = args.success 
      ? (args.tradeType === "buy" ? AuditEventTypes.TRADE_BUY : AuditEventTypes.TRADE_SELL)
      : AuditEventTypes.TRADE_FAILED;
    
    const severity = args.success ? SeverityLevels.INFO : SeverityLevels.WARNING;
    
    return await ctx.runMutation(internal.monitoring.auditLog.logAuditEvent, {
      eventType,
      severity,
      userId: args.userId,
      tokenId: args.tokenId,
      action: `${args.tradeType} ${args.amount} tokens at ${args.price}`,
      details: {
        tradeType: args.tradeType,
        amount: args.amount,
        price: args.price,
        success: args.success,
        error: args.error,
      },
    });
  },
});

// Log security events
export const logSecurityEvent = internalMutation({
  args: {
    userId: v.optional(v.string()),
    eventType: v.string(),
    severity: v.string(),
    action: v.string(),
    details: v.any(),
    threat: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auditLogId = await ctx.runMutation(internal.monitoring.auditLog.logAuditEvent, {
      eventType: args.eventType,
      severity: args.severity as any,
      userId: args.userId,
      action: args.action,
      details: args.details,
      metadata: {
        threat: args.threat,
        securityContext: "production",
      },
    });
    
    // For security events, also update security metrics
    await ctx.runMutation(internal.monitoring.metrics.updateSecurityMetrics, {
      eventType: args.eventType,
      severity: args.severity,
      threat: args.threat,
    });
    
    return auditLogId;
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
    // Check admin permissions
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.tokenIdentifier?.includes("admin")) {
      throw new Error("Not authorized to export audit logs");
    }
    
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
        exportDate: Date.now(),
      };
    }
    
    // Convert to CSV format
    const headers = [
      "ID",
      "Timestamp",
      "Event Type",
      "Severity",
      "User ID",
      "Token ID",
      "Action",
      "Details",
    ];
    
    const rows = logs.map(log => [
      log._id,
      new Date(log.timestamp).toISOString(),
      log.eventType,
      log.severity,
      log.userId || "",
      log.tokenId || "",
      log.action,
      JSON.stringify(log.details),
    ]);
    
    return {
      format: "csv",
      headers,
      rows,
      count: logs.length,
      exportDate: Date.now(),
    };
  },
});