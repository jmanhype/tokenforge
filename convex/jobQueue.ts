import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";

// Job statuses
export type JobStatus = "queued" | "processing" | "completed" | "failed" | "retrying";

// Define job queue schema
export const jobs = {
  type: v.union(
    v.literal("deploy_token"),
    v.literal("verify_contract"),
    v.literal("social_share"),
    v.literal("analytics_update")
  ),
  status: v.union(
    v.literal("queued"),
    v.literal("processing"),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("retrying")
  ),
  payload: v.any(),
  result: v.optional(v.any()),
  error: v.optional(v.string()),
  attempts: v.number(),
  maxAttempts: v.number(),
  createdAt: v.number(),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  nextRetryAt: v.optional(v.number()),
};

// Queue a new job
export const enqueue = mutation({
  args: {
    type: jobs.type,
    payload: v.any(),
    maxAttempts: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("jobs", {
      type: args.type,
      status: "queued",
      payload: args.payload,
      attempts: 0,
      maxAttempts: args.maxAttempts || 3,
      createdAt: Date.now(),
    });

    // Schedule job processing immediately
    await ctx.scheduler.runAfter(0, "jobQueue:processJob", { jobId });

    return jobId;
  },
});

// Internal: Process a job
export const processJob = internalMutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.status !== "queued") return;

    // Mark job as processing
    await ctx.db.patch(args.jobId, {
      status: "processing",
      startedAt: Date.now(),
      attempts: job.attempts + 1,
    });

    try {
      // Route to appropriate handler based on job type
      let result;
      switch (job.type) {
        case "deploy_token":
          result = await ctx.scheduler.runAfter(0, "blockchain:deploymentStrategy:deployToken", job.payload);
          break;
        case "verify_contract":
          result = await ctx.scheduler.runAfter(0, "blockchain:ethereum:verifyContract", job.payload);
          break;
        case "social_share":
          result = await ctx.scheduler.runAfter(0, "social:shareOnPlatform", job.payload);
          break;
        case "analytics_update":
          result = await ctx.scheduler.runAfter(0, "analytics:updateAnalytics", job.payload);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      // Mark job as completed
      await ctx.db.patch(args.jobId, {
        status: "completed",
        result,
        completedAt: Date.now(),
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      // Check if we should retry
      if (job.attempts < job.maxAttempts) {
        // Calculate exponential backoff
        const backoffMs = Math.min(1000 * Math.pow(2, job.attempts), 60000); // Max 1 minute
        const nextRetryAt = Date.now() + backoffMs;

        await ctx.db.patch(args.jobId, {
          status: "retrying",
          error: errorMessage,
          nextRetryAt,
        });

        // Schedule retry
        await ctx.scheduler.runAt(nextRetryAt, "jobQueue:retryJob", { jobId: args.jobId });
      } else {
        // Max attempts reached, mark as failed
        await ctx.db.patch(args.jobId, {
          status: "failed",
          error: errorMessage,
          completedAt: Date.now(),
        });

        // Notify about failure (if critical job)
        if (job.type === "deploy_token") {
          await ctx.scheduler.runAfter(0, "notifications:notifyDeploymentFailure", {
            jobId: args.jobId,
            error: errorMessage,
          });
        }
      }
    }
  },
});

// Internal: Retry a job
export const retryJob = internalMutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.status !== "retrying") return;

    // Reset to queued and process again
    await ctx.db.patch(args.jobId, {
      status: "queued",
      nextRetryAt: undefined,
    });

    await ctx.scheduler.runAfter(0, "jobQueue:processJob", { jobId: args.jobId });
  },
});

// Query job status
export const getJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

// Query jobs by status
export const getJobsByStatus = query({
  args: { 
    status: jobs.status,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const query = ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .order("desc");

    if (args.limit) {
      return await query.take(args.limit);
    }
    return await query.collect();
  },
});

// Query job metrics
export const getJobMetrics = query({
  handler: async (ctx) => {
    const jobs = await ctx.db.query("jobs").collect();
    
    const metrics = {
      total: jobs.length,
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      retrying: 0,
      successRate: 0,
      avgProcessingTime: 0,
    };

    let totalProcessingTime = 0;
    let processedCount = 0;

    for (const job of jobs) {
      metrics[job.status]++;
      
      if (job.completedAt && job.startedAt) {
        totalProcessingTime += job.completedAt - job.startedAt;
        processedCount++;
      }
    }

    if (metrics.completed + metrics.failed > 0) {
      metrics.successRate = (metrics.completed / (metrics.completed + metrics.failed)) * 100;
    }

    if (processedCount > 0) {
      metrics.avgProcessingTime = totalProcessingTime / processedCount;
    }

    return metrics;
  },
});

// Clean up old completed jobs (run daily)
export const cleanupOldJobs = internalMutation({
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    const oldJobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .filter((q) => q.lt(q.field("completedAt"), thirtyDaysAgo))
      .collect();

    for (const job of oldJobs) {
      await ctx.db.delete(job._id);
    }

    return { deleted: oldJobs.length };
  },
});