import { cronJobs } from "convex/server";
import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { Doc } from "../_generated/dataModel";

// Check system health every minute
export const checkSystemHealth = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    // Check blockchain connections
    const blockchains = ["ethereum", "bsc", "solana"] as const;
    for (const blockchain of blockchains) {
      try {
        // In production, this would ping the actual RPC endpoints
        const isHealthy = Math.random() > 0.05; // 95% healthy for demo
        const responseTime = isHealthy ? Math.floor(Math.random() * 200) + 50 : undefined;
        
        await ctx.db.patch(
          await ctx.db.query("systemHealth")
            .withIndex("by_component", (q) => q.eq("component", `blockchain_${blockchain}`))
            .first()
            .then(doc => doc?._id) || 
          await ctx.db.insert("systemHealth", {
            component: `blockchain_${blockchain}`,
            status: isHealthy ? "healthy" : "down",
            lastCheck: now,
            responseTime,
            errorRate: isHealthy ? 0 : 1,
            metadata: { blockchain },
          }),
          {
            status: isHealthy ? "healthy" : "down",
            lastCheck: now,
            responseTime,
            errorRate: isHealthy ? 0 : 1,
          }
        );
      } catch (error) {
        console.error(`Failed to check ${blockchain} health:`, error);
      }
    }
    
    // Check database health
    try {
      const startTime = Date.now();
      await ctx.db.query("memeCoins").take(1);
      const responseTime = Date.now() - startTime;
      
      await ctx.db.patch(
        await ctx.db.query("systemHealth")
          .withIndex("by_component", (q) => q.eq("component", "database"))
          .first()
          .then(doc => doc?._id) ||
        await ctx.db.insert("systemHealth", {
          component: "database",
          status: responseTime < 1000 ? "healthy" : "degraded",
          lastCheck: now,
          responseTime,
          errorRate: 0,
          metadata: { type: "convex" },
        }),
        {
          status: responseTime < 1000 ? "healthy" : "degraded",
          lastCheck: now,
          responseTime,
          errorRate: 0,
        }
      );
    } catch (error) {
      console.error("Failed to check database health:", error);
    }
    
    // Check API health
    const apiEndpoints = ["coingecko", "etherscan", "bscscan"];
    for (const api of apiEndpoints) {
      try {
        // Check circuit breaker state
        const circuitBreaker = await ctx.db.query("circuitBreakers")
          .withIndex("by_service", (q) => q.eq("service", api))
          .first();
        
        const status = circuitBreaker?.state === "open" ? "down" : 
                       circuitBreaker?.state === "half_open" ? "degraded" : "healthy";
        
        await ctx.db.patch(
          await ctx.db.query("systemHealth")
            .withIndex("by_component", (q) => q.eq("component", `api_${api}`))
            .first()
            .then(doc => doc?._id) ||
          await ctx.db.insert("systemHealth", {
            component: `api_${api}`,
            status,
            lastCheck: now,
            errorRate: circuitBreaker ? circuitBreaker.failures / Math.max(circuitBreaker.totalRequests, 1) : 0,
            metadata: { api, circuitBreakerState: circuitBreaker?.state },
          }),
          {
            status,
            lastCheck: now,
            errorRate: circuitBreaker ? circuitBreaker.failures / Math.max(circuitBreaker.totalRequests, 1) : 0,
          }
        );
      } catch (error) {
        console.error(`Failed to check ${api} health:`, error);
      }
    }
  },
});

// Check alert conditions every 30 seconds
export const checkAlerts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    // Get all enabled alert configs
    const alertConfigs = await ctx.db.query("alertConfigs")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
    
    for (const config of alertConfigs) {
      try {
        // Check if alert is in cooldown
        const recentAlert = await ctx.db.query("alerts")
          .withIndex("by_config", (q) => q.eq("configId", config._id))
          .order("desc")
          .first();
        
        if (recentAlert && now - recentAlert.triggeredAt < config.cooldown * 1000) {
          continue; // Skip if in cooldown
        }
        
        // Get metric value
        const metric = await ctx.db.query("metrics")
          .withIndex("by_name", (q) => q.eq("name", config.condition.metric))
          .order("desc")
          .first();
        
        if (!metric) continue;
        
        // Check if condition is met
        let conditionMet = false;
        const value = metric.value;
        const threshold = config.condition.threshold;
        
        switch (config.condition.operator) {
          case ">":
            conditionMet = value > threshold;
            break;
          case "<":
            conditionMet = value < threshold;
            break;
          case ">=":
            conditionMet = value >= threshold;
            break;
          case "<=":
            conditionMet = value <= threshold;
            break;
          case "==":
            conditionMet = value === threshold;
            break;
        }
        
        // Check duration requirement if specified
        if (conditionMet && config.condition.duration) {
          const durationMs = config.condition.duration * 1000;
          const metricsInDuration = await ctx.db.query("metrics")
            .withIndex("by_name_time", (q) => 
              q.eq("name", config.condition.metric)
               .gte("timestamp", now - durationMs)
            )
            .collect();
          
          // Check if all metrics in duration meet condition
          conditionMet = metricsInDuration.every(m => {
            switch (config.condition.operator) {
              case ">": return m.value > threshold;
              case "<": return m.value < threshold;
              case ">=": return m.value >= threshold;
              case "<=": return m.value <= threshold;
              case "==": return m.value === threshold;
              default: return false;
            }
          });
        }
        
        if (conditionMet) {
          // Trigger alert
          const alertId = await ctx.db.insert("alerts", {
            configId: config._id,
            title: `Alert: ${config.name}`,
            message: `${config.description}. Current value: ${value}, Threshold: ${threshold}`,
            severity: config.severity,
            status: "triggered",
            triggeredAt: now,
            metadata: {
              metricName: config.condition.metric,
              metricValue: value,
              threshold: config.condition.threshold,
              operator: config.condition.operator,
            },
            notificationsSent: [],
          });
          
          // Schedule notifications
          await ctx.scheduler.runAfter(0, "monitoring/alerts:sendAlertNotifications", {
            alertId,
          });
        }
      } catch (error) {
        console.error(`Failed to check alert ${config.name}:`, error);
      }
    }
  },
});

// Clean up old metrics and logs
export const cleanupOldData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    
    // Delete metrics older than 7 days
    const oldMetrics = await ctx.db.query("metrics")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", sevenDaysAgo))
      .collect();
    
    for (const metric of oldMetrics) {
      await ctx.db.delete(metric._id);
    }
    
    // Delete audit logs older than 30 days (keep for compliance)
    const oldAuditLogs = await ctx.db.query("auditLogs")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", thirtyDaysAgo))
      .collect();
    
    for (const log of oldAuditLogs) {
      await ctx.db.delete(log._id);
    }
    
    // Delete resolved alerts older than 7 days
    const oldAlerts = await ctx.db.query("alerts")
      .withIndex("by_status", (q) => q.eq("status", "resolved"))
      .filter((q) => q.lt(q.field("resolvedAt"), sevenDaysAgo))
      .collect();
    
    for (const alert of oldAlerts) {
      await ctx.db.delete(alert._id);
    }
  },
});

// Export cron configuration
export default {
  // Run health checks every minute
  checkSystemHealth: {
    schedule: "* * * * *", // Every minute
    handler: checkSystemHealth,
  },
  
  // Check alerts every 30 seconds
  checkAlerts: {
    schedule: "*/30 * * * * *", // Every 30 seconds
    handler: checkAlerts,
  },
  
  // Clean up old data daily at 3 AM
  cleanupOldData: {
    schedule: "0 3 * * *", // Daily at 3 AM
    handler: cleanupOldData,
  },
};