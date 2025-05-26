import { v } from "convex/values";
import { internalMutation, query } from "../_generated/server";

// Metric types
export const MetricTypes = {
  // Performance metrics
  API_LATENCY: "api_latency",
  DB_QUERY_TIME: "db_query_time",
  BLOCKCHAIN_CALL_TIME: "blockchain_call_time",
  
  // Business metrics
  TOKENS_CREATED: "tokens_created",
  TRADES_EXECUTED: "trades_executed",
  LIQUIDITY_PROVIDED: "liquidity_provided",
  FEES_COLLECTED: "fees_collected",
  
  // Error metrics
  ERROR_RATE: "error_rate",
  FAILED_DEPLOYMENTS: "failed_deployments",
  FAILED_TRADES: "failed_trades",
  
  // Security metrics
  SUSPICIOUS_ACTIVITY: "suspicious_activity",
  RATE_LIMIT_HITS: "rate_limit_hits",
  UNAUTHORIZED_ATTEMPTS: "unauthorized_attempts",
} as const;

// Update event metrics
export const updateEventMetrics = internalMutation({
  args: {
    eventType: v.string(),
    severity: v.string(),
  },
  handler: async (ctx, args) => {
    const hourKey = Math.floor(Date.now() / (60 * 60 * 1000));
    const dayKey = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    
    // Update hourly metrics
    const hourlyMetric = await ctx.db
      .query("metrics")
      .withIndex("by_type_period", (q) => 
        q.eq("metricType", "event_count")
         .eq("periodKey", hourKey.toString())
      )
      .first();
    
    if (hourlyMetric) {
      await ctx.db.patch(hourlyMetric._id, {
        value: hourlyMetric.value + 1,
        metadata: {
          ...hourlyMetric.metadata,
          [args.eventType]: (hourlyMetric.metadata[args.eventType] || 0) + 1,
          [`severity_${args.severity}`]: (hourlyMetric.metadata[`severity_${args.severity}`] || 0) + 1,
        },
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("metrics", {
        metricType: "event_count",
        periodType: "hourly",
        periodKey: hourKey.toString(),
        value: 1,
        metadata: {
          [args.eventType]: 1,
          [`severity_${args.severity}`]: 1,
        },
        timestamp: Date.now(),
        updatedAt: Date.now(),
      });
    }
    
    // Update daily metrics
    const dailyMetric = await ctx.db
      .query("metrics")
      .withIndex("by_type_period", (q) => 
        q.eq("metricType", "event_count_daily")
         .eq("periodKey", dayKey.toString())
      )
      .first();
    
    if (dailyMetric) {
      await ctx.db.patch(dailyMetric._id, {
        value: dailyMetric.value + 1,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("metrics", {
        metricType: "event_count_daily",
        periodType: "daily",
        periodKey: dayKey.toString(),
        value: 1,
        metadata: {},
        timestamp: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// Update security metrics
export const updateSecurityMetrics = internalMutation({
  args: {
    eventType: v.string(),
    severity: v.string(),
    threat: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const dayKey = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    
    const metric = await ctx.db
      .query("metrics")
      .withIndex("by_type_period", (q) => 
        q.eq("metricType", "security_events")
         .eq("periodKey", dayKey.toString())
      )
      .first();
    
    if (metric) {
      await ctx.db.patch(metric._id, {
        value: metric.value + 1,
        metadata: {
          ...metric.metadata,
          [args.eventType]: (metric.metadata[args.eventType] || 0) + 1,
          threats: args.threat 
            ? [...(metric.metadata.threats || []), args.threat]
            : metric.metadata.threats,
        },
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("metrics", {
        metricType: "security_events",
        periodType: "daily",
        periodKey: dayKey.toString(),
        value: 1,
        metadata: {
          [args.eventType]: 1,
          threats: args.threat ? [args.threat] : [],
        },
        timestamp: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// Record performance metric
export const recordPerformanceMetric = internalMutation({
  args: {
    metricType: v.string(),
    value: v.number(),
    operation: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("performanceMetrics", {
      metricType: args.metricType,
      value: args.value,
      operation: args.operation,
      metadata: args.metadata,
      timestamp: Date.now(),
    });
    
    // Update aggregated metrics
    const hourKey = Math.floor(Date.now() / (60 * 60 * 1000));
    
    const aggregated = await ctx.db
      .query("metrics")
      .withIndex("by_type_period", (q) => 
        q.eq("metricType", `${args.metricType}_avg`)
         .eq("periodKey", hourKey.toString())
      )
      .first();
    
    if (aggregated) {
      const newCount = (aggregated.metadata.count || 0) + 1;
      const newSum = (aggregated.metadata.sum || 0) + args.value;
      const newAvg = newSum / newCount;
      
      await ctx.db.patch(aggregated._id, {
        value: newAvg,
        metadata: {
          count: newCount,
          sum: newSum,
          min: Math.min(aggregated.metadata.min || Infinity, args.value),
          max: Math.max(aggregated.metadata.max || 0, args.value),
        },
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("metrics", {
        metricType: `${args.metricType}_avg`,
        periodType: "hourly",
        periodKey: hourKey.toString(),
        value: args.value,
        metadata: {
          count: 1,
          sum: args.value,
          min: args.value,
          max: args.value,
        },
        timestamp: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// Get performance metrics
export const getPerformanceMetrics = query({
  args: {
    metricType: v.string(),
    timeframe: v.union(
      v.literal("1h"),
      v.literal("24h"),
      v.literal("7d")
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const timeframes = {
      "1h": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
    };
    
    const since = now - timeframes[args.timeframe];
    
    const metrics = await ctx.db
      .query("performanceMetrics")
      .withIndex("by_type_time", (q) => 
        q.eq("metricType", args.metricType)
         .gte("timestamp", since)
      )
      .order("desc")
      .take(1000);
    
    // Calculate statistics
    const values = metrics.map(m => m.value);
    const stats = {
      count: values.length,
      avg: values.reduce((a, b) => a + b, 0) / values.length || 0,
      min: Math.min(...values) || 0,
      max: Math.max(...values) || 0,
      p50: percentile(values, 0.5),
      p95: percentile(values, 0.95),
      p99: percentile(values, 0.99),
    };
    
    // Get time series data
    const bucketSize = args.timeframe === "1h" ? 5 * 60 * 1000 : // 5 minutes
                      args.timeframe === "24h" ? 60 * 60 * 1000 : // 1 hour
                      24 * 60 * 60 * 1000; // 1 day
    
    const timeSeries = bucketizeMetrics(metrics, bucketSize);
    
    return {
      stats,
      timeSeries,
      metricType: args.metricType,
      timeframe: args.timeframe,
    };
  },
});

// Get system health metrics
export const getSystemHealth = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    
    // Get recent metrics
    const recentMetrics = await ctx.db
      .query("metrics")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", hourAgo))
      .collect();
    
    // Calculate health scores
    const errorRate = calculateErrorRate(recentMetrics);
    const avgLatency = calculateAvgLatency(recentMetrics);
    const successRate = calculateSuccessRate(recentMetrics);
    
    // Determine overall health
    let healthStatus = "healthy";
    let healthScore = 100;
    const issues = [];
    
    if (errorRate > 5) {
      healthStatus = "degraded";
      healthScore -= 30;
      issues.push(`High error rate: ${errorRate.toFixed(2)}%`);
    }
    
    if (avgLatency > 1000) {
      healthStatus = "degraded";
      healthScore -= 20;
      issues.push(`High latency: ${avgLatency.toFixed(0)}ms`);
    }
    
    if (successRate < 95) {
      healthStatus = "degraded";
      healthScore -= 25;
      issues.push(`Low success rate: ${successRate.toFixed(2)}%`);
    }
    
    if (healthScore < 50) {
      healthStatus = "critical";
    }
    
    return {
      status: healthStatus,
      score: Math.max(0, healthScore),
      metrics: {
        errorRate,
        avgLatency,
        successRate,
        uptime: 99.9, // Placeholder
      },
      issues,
      lastChecked: now,
    };
  },
});

// Get metric trends
export const getMetricTrends = query({
  args: {
    metrics: v.array(v.string()),
    timeframe: v.union(
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d")
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const timeframes = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    
    const since = now - timeframes[args.timeframe];
    const trends: Record<string, any> = {};
    
    for (const metricType of args.metrics) {
      const metrics = await ctx.db
        .query("metrics")
        .withIndex("by_type_time", (q) => 
          q.eq("metricType", metricType)
           .gte("timestamp", since)
        )
        .collect();
      
      // Calculate trend
      const values = metrics.map(m => ({ time: m.timestamp, value: m.value }));
      const trend = calculateTrend(values);
      
      trends[metricType] = {
        current: values[values.length - 1]?.value || 0,
        trend: trend.direction,
        changePercent: trend.changePercent,
        sparkline: values.slice(-20).map(v => v.value),
      };
    }
    
    return trends;
  },
});

// Helper functions
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = values.sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[index] || 0;
}

function bucketizeMetrics(metrics: any[], bucketSize: number) {
  const buckets: Record<number, { sum: number; count: number }> = {};
  
  metrics.forEach(metric => {
    const bucketKey = Math.floor(metric.timestamp / bucketSize) * bucketSize;
    if (!buckets[bucketKey]) {
      buckets[bucketKey] = { sum: 0, count: 0 };
    }
    buckets[bucketKey].sum += metric.value;
    buckets[bucketKey].count += 1;
  });
  
  return Object.entries(buckets)
    .map(([time, data]) => ({
      time: parseInt(time),
      value: data.sum / data.count,
    }))
    .sort((a, b) => a.time - b.time);
}

function calculateErrorRate(metrics: any[]): number {
  const errorMetrics = metrics.filter(m => 
    m.metricType === "event_count" && 
    (m.metadata?.severity_error || m.metadata?.severity_critical)
  );
  
  const totalEvents = metrics
    .filter(m => m.metricType === "event_count")
    .reduce((sum, m) => sum + m.value, 0);
  
  const errorEvents = errorMetrics
    .reduce((sum, m) => sum + (m.metadata?.severity_error || 0) + (m.metadata?.severity_critical || 0), 0);
  
  return totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0;
}

function calculateAvgLatency(metrics: any[]): number {
  const latencyMetrics = metrics.filter(m => m.metricType.includes("_avg"));
  if (latencyMetrics.length === 0) return 0;
  
  const totalLatency = latencyMetrics.reduce((sum, m) => sum + m.value, 0);
  return totalLatency / latencyMetrics.length;
}

function calculateSuccessRate(metrics: any[]): number {
  // This would calculate based on successful vs failed operations
  return 98.5; // Placeholder
}

function calculateTrend(values: { time: number; value: number }[]) {
  if (values.length < 2) return { direction: "stable", changePercent: 0 };
  
  const recent = values.slice(-10);
  const older = values.slice(-20, -10);
  
  const recentAvg = recent.reduce((sum, v) => sum + v.value, 0) / recent.length || 0;
  const olderAvg = older.reduce((sum, v) => sum + v.value, 0) / older.length || 0;
  
  const changePercent = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
  
  return {
    direction: changePercent > 5 ? "up" : changePercent < -5 ? "down" : "stable",
    changePercent,
  };
}