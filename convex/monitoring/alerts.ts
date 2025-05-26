import { v } from "convex/values";
import { internalAction, internalMutation, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";

// Alert types
export const AlertTypes = {
  SECURITY_BREACH: "security_breach",
  HIGH_ERROR_RATE: "high_error_rate",
  SYSTEM_DOWN: "system_down",
  SUSPICIOUS_ACTIVITY: "suspicious_activity",
  RATE_LIMIT_ABUSE: "rate_limit_abuse",
  DEPLOYMENT_FAILURE: "deployment_failure",
  LOW_LIQUIDITY: "low_liquidity",
  CIRCUIT_BREAKER_OPEN: "circuit_breaker_open",
  UNUSUAL_TRADING: "unusual_trading",
  SMART_CONTRACT_ISSUE: "smart_contract_issue",
} as const;

// Alert channels
export const AlertChannels = {
  EMAIL: "email",
  DISCORD: "discord",
  TELEGRAM: "telegram",
  WEBHOOK: "webhook",
  SMS: "sms",
} as const;

// Send critical alert
export const sendCriticalAlert = internalAction({
  args: {
    auditLogId: v.id("auditLogs"),
    eventType: v.string(),
    details: v.any(),
  },
  handler: async (ctx, args) => {
    // Create alert record
    const alertId = await ctx.runMutation(internal.monitoring.alerts.createAlert, {
      type: AlertTypes.SECURITY_BREACH,
      severity: "critical",
      title: `Critical Event: ${args.eventType}`,
      message: `A critical security event has occurred`,
      details: args.details,
      source: "audit_log",
      sourceId: args.auditLogId,
    });
    
    // Send to all critical alert channels
    const channels = await ctx.runQuery(internal.monitoring.alerts.getAlertChannels, {
      severity: "critical",
    });
    
    for (const channel of channels) {
      await sendToChannel(ctx, {
        channel: channel.channel,
        config: channel.config,
        alert: {
          id: alertId,
          type: AlertTypes.SECURITY_BREACH,
          severity: "critical",
          title: `Critical Event: ${args.eventType}`,
          message: `A critical security event has occurred`,
          details: args.details,
        },
      });
    }
    
    return alertId;
  },
});

// Create alert record
export const createAlert = internalMutation({
  args: {
    type: v.string(),
    severity: v.union(v.literal("info"), v.literal("warning"), v.literal("error"), v.literal("critical")),
    title: v.string(),
    message: v.string(),
    details: v.any(),
    source: v.string(),
    sourceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const alertId = await ctx.db.insert("alerts", {
      type: args.type,
      severity: args.severity,
      title: args.title,
      message: args.message,
      details: args.details,
      source: args.source,
      sourceId: args.sourceId,
      status: "active",
      createdAt: Date.now(),
      acknowledgedAt: null,
      resolvedAt: null,
    });
    
    // Update alert metrics
    await ctx.runMutation(internal.monitoring.metrics.updateEventMetrics, {
      eventType: `alert_${args.type}`,
      severity: args.severity,
    });
    
    return alertId;
  },
});

// Get alert channels for severity
export const getAlertChannels = query({
  args: {
    severity: v.string(),
  },
  handler: async (ctx, args) => {
    const channels = await ctx.db
      .query("alertChannels")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    
    // Filter by severity threshold
    const severityLevels = ["info", "warning", "error", "critical"];
    const requiredLevel = severityLevels.indexOf(args.severity);
    
    return channels.filter(channel => {
      const channelLevel = severityLevels.indexOf(channel.minSeverity);
      return channelLevel <= requiredLevel;
    });
  },
});

// Send alert to channel
async function sendToChannel(
  ctx: any,
  args: {
    channel: string;
    config: any;
    alert: any;
  }
) {
  switch (args.channel) {
    case AlertChannels.DISCORD:
      await sendDiscordAlert(args.config, args.alert);
      break;
      
    case AlertChannels.TELEGRAM:
      await sendTelegramAlert(args.config, args.alert);
      break;
      
    case AlertChannels.WEBHOOK:
      await sendWebhookAlert(args.config, args.alert);
      break;
      
    case AlertChannels.EMAIL:
      // Email would be handled by a separate service
      console.log("Email alert:", args.alert);
      break;
      
    case AlertChannels.SMS:
      // SMS would be handled by Twilio or similar
      console.log("SMS alert:", args.alert);
      break;
  }
  
  // Record alert sent
  await ctx.runMutation(internal.monitoring.alerts.recordAlertSent, {
    alertId: args.alert.id,
    channel: args.channel,
    sentAt: Date.now(),
  });
}

// Send Discord alert
async function sendDiscordAlert(config: any, alert: any) {
  const webhookUrl = config.webhookUrl || process.env.DISCORD_ALERT_WEBHOOK;
  if (!webhookUrl) return;
  
  const embed = {
    title: alert.title,
    description: alert.message,
    color: alert.severity === "critical" ? 0xFF0000 : 
           alert.severity === "error" ? 0xFFA500 : 
           alert.severity === "warning" ? 0xFFFF00 : 0x00FF00,
    fields: [
      {
        name: "Type",
        value: alert.type,
        inline: true,
      },
      {
        name: "Severity",
        value: alert.severity.toUpperCase(),
        inline: true,
      },
      {
        name: "Time",
        value: new Date().toISOString(),
        inline: true,
      },
    ],
    footer: {
      text: "TokenForge Alert System",
    },
  };
  
  if (alert.details) {
    embed.fields.push({
      name: "Details",
      value: JSON.stringify(alert.details, null, 2).substring(0, 1000),
      inline: false,
    });
  }
  
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "TokenForge Alerts",
        embeds: [embed],
      }),
    });
    
    if (!response.ok) {
      console.error("Discord alert failed:", await response.text());
    }
  } catch (error) {
    console.error("Discord alert error:", error);
  }
}

// Send Telegram alert
async function sendTelegramAlert(config: any, alert: any) {
  const botToken = config.botToken || process.env.TELEGRAM_ALERT_BOT_TOKEN;
  const chatId = config.chatId || process.env.TELEGRAM_ALERT_CHAT_ID;
  
  if (!botToken || !chatId) return;
  
  const severityEmoji = {
    critical: "🚨",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
  };
  
  const message = `${severityEmoji[alert.severity as keyof typeof severityEmoji]} *${alert.title}*

${alert.message}

*Type:* ${alert.type}
*Severity:* ${alert.severity.toUpperCase()}
*Time:* ${new Date().toISOString()}

${alert.details ? `*Details:*\n\`\`\`\n${JSON.stringify(alert.details, null, 2).substring(0, 500)}\n\`\`\`` : ""}`;
  
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
        }),
      }
    );
    
    if (!response.ok) {
      console.error("Telegram alert failed:", await response.text());
    }
  } catch (error) {
    console.error("Telegram alert error:", error);
  }
}

// Send webhook alert
async function sendWebhookAlert(config: any, alert: any) {
  const webhookUrl = config.url;
  if (!webhookUrl) return;
  
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.headers || {}),
      },
      body: JSON.stringify({
        alert,
        timestamp: Date.now(),
        platform: "TokenForge",
      }),
    });
    
    if (!response.ok) {
      console.error("Webhook alert failed:", await response.text());
    }
  } catch (error) {
    console.error("Webhook alert error:", error);
  }
}

// Record alert sent
export const recordAlertSent = internalMutation({
  args: {
    alertId: v.id("alerts"),
    channel: v.string(),
    sentAt: v.number(),
  },
  handler: async (ctx, args) => {
    const alert = await ctx.db.get(args.alertId);
    if (!alert) return;
    
    const sentChannels = alert.sentChannels || [];
    sentChannels.push({
      channel: args.channel,
      sentAt: args.sentAt,
    });
    
    await ctx.db.patch(args.alertId, {
      sentChannels,
    });
  },
});

// Acknowledge alert
export const acknowledgeAlert = mutation({
  args: {
    alertId: v.id("alerts"),
    acknowledgedBy: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const alert = await ctx.db.get(args.alertId);
    if (!alert) throw new Error("Alert not found");
    
    await ctx.db.patch(args.alertId, {
      status: "acknowledged",
      acknowledgedAt: Date.now(),
      acknowledgedBy: args.acknowledgedBy,
      notes: args.notes,
    });
    
    return { success: true };
  },
});

// Resolve alert
export const resolveAlert = mutation({
  args: {
    alertId: v.id("alerts"),
    resolvedBy: v.string(),
    resolution: v.string(),
  },
  handler: async (ctx, args) => {
    const alert = await ctx.db.get(args.alertId);
    if (!alert) throw new Error("Alert not found");
    
    await ctx.db.patch(args.alertId, {
      status: "resolved",
      resolvedAt: Date.now(),
      resolvedBy: args.resolvedBy,
      resolution: args.resolution,
    });
    
    return { success: true };
  },
});

// Get active alerts
export const getActiveAlerts = query({
  args: {
    severity: v.optional(v.string()),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("alerts")
      .withIndex("by_status", (q) => q.eq("status", "active"));
    
    let alerts = await query.order("desc").collect();
    
    // Filter by criteria
    if (args.severity) {
      alerts = alerts.filter(a => a.severity === args.severity);
    }
    
    if (args.type) {
      alerts = alerts.filter(a => a.type === args.type);
    }
    
    return alerts;
  },
});

// Configure alert channel
export const configureAlertChannel = mutation({
  args: {
    channel: v.string(),
    config: v.any(),
    minSeverity: v.union(v.literal("info"), v.literal("warning"), v.literal("error"), v.literal("critical")),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Check admin permissions
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.tokenIdentifier?.includes("admin")) {
      throw new Error("Not authorized");
    }
    
    // Check if channel exists
    const existing = await ctx.db
      .query("alertChannels")
      .withIndex("by_channel", (q) => q.eq("channel", args.channel))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        config: args.config,
        minSeverity: args.minSeverity,
        isActive: args.isActive,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("alertChannels", {
        channel: args.channel,
        config: args.config,
        minSeverity: args.minSeverity,
        isActive: args.isActive,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    
    return { success: true };
  },
});

// Check alert rules and trigger if needed
export const checkAlertRules = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get system health
    const health = await ctx.runQuery(internal.monitoring.metrics.getSystemHealth);
    
    // Check error rate
    if (health.metrics.errorRate > 10) {
      await ctx.runMutation(internal.monitoring.alerts.createAlert, {
        type: AlertTypes.HIGH_ERROR_RATE,
        severity: "error",
        title: "High Error Rate Detected",
        message: `Error rate is ${health.metrics.errorRate.toFixed(2)}%`,
        details: {
          errorRate: health.metrics.errorRate,
          threshold: 10,
        },
        source: "system_health",
      });
    }
    
    // Check latency
    if (health.metrics.avgLatency > 2000) {
      await ctx.runMutation(internal.monitoring.alerts.createAlert, {
        type: AlertTypes.SYSTEM_DOWN,
        severity: "warning",
        title: "High System Latency",
        message: `Average latency is ${health.metrics.avgLatency}ms`,
        details: {
          avgLatency: health.metrics.avgLatency,
          threshold: 2000,
        },
        source: "system_health",
      });
    }
    
    // Check circuit breakers
    const circuitBreakers = await ctx.runQuery(internal.cache.getOpenCircuitBreakers);
    for (const breaker of circuitBreakers) {
      await ctx.runMutation(internal.monitoring.alerts.createAlert, {
        type: AlertTypes.CIRCUIT_BREAKER_OPEN,
        severity: "warning",
        title: "Circuit Breaker Open",
        message: `Circuit breaker for ${breaker.service} is open`,
        details: {
          service: breaker.service,
          failures: breaker.failures,
          lastFailure: breaker.lastFailureTime,
        },
        source: "circuit_breaker",
        sourceId: breaker._id,
      });
    }
  },
});