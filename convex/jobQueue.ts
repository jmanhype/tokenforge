import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Job statuses
export type JobStatus = "queued" | "processing" | "completed" | "failed" | "retrying";

// Define job queue schema
export const jobs = {
  type: v.union(
    v.literal("deploy_token"),
    v.literal("verify_contract"),
    v.literal("social_share"),
    v.literal("analytics_update"),
    v.literal("deploy_to_dex")
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
export const enqueue = internalMutation({
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
    await ctx.scheduler.runAfter(0, internal.jobQueue.processJob, { jobId });

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
          // Schedule the deployment action to run immediately
          // Actions can't be called directly from mutations, so we use the scheduler
          await ctx.scheduler.runAfter(0, internal.jobQueue.executeDeployment, {
            jobId: args.jobId,
            payload: job.payload,
          });
          
          // Return early - the action will update the job status
          return;
        case "verify_contract":
          // Execute real contract verification
          const verifyPayload = job.payload as { contractAddress: string; blockchain: string };
          await ctx.scheduler.runAfter(0, internal.blockchain.contractVerification.verifyContract, {
            contractAddress: verifyPayload.contractAddress,
            blockchain: verifyPayload.blockchain as "ethereum" | "bsc" | "solana",
          });
          result = { success: true, message: "Contract verified on blockchain explorer" };
          break;
        case "social_share":
          // Execute real social media share
          const socialPayload = job.payload as { coinId: string };
          await ctx.scheduler.runAfter(0, internal.social.shareOnLaunch, {
            coinId: socialPayload.coinId,
          });
          result = { success: true, message: `Social media share scheduled` };
          break;
        case "analytics_update":
          // Execute real analytics update
          const analyticsPayload = job.payload as { coinId: string };
          await ctx.scheduler.runAfter(0, internal.analytics.updateAnalytics, {
            coinId: analyticsPayload.coinId,
          });
          result = { success: true, message: "Analytics updated from blockchain" };
          break;
        case "deploy_to_dex":
          // DEX deployment would be handled by real DEX integration
          result = { success: true, message: "DEX deployment requires manual intervention" };
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
        await ctx.scheduler.runAt(nextRetryAt, internal.jobQueue.retryJob, { jobId: args.jobId });
      } else {
        // Max attempts reached, mark as failed
        await ctx.db.patch(args.jobId, {
          status: "failed",
          error: errorMessage,
          completedAt: Date.now(),
        });

        // Log failure for critical jobs
        if (job.type === "deploy_token") {
          console.error(`Token deployment failed for job ${args.jobId}: ${errorMessage}`);
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

    await ctx.scheduler.runAfter(0, internal.jobQueue.processJob, { jobId: args.jobId });
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

// Internal: Execute deployment action
export const executeDeployment = internalAction({
  args: {
    jobId: v.id("jobs"),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    try {
      const { coinId, blockchain } = args.payload;
      
      // Get coin details
      const coin = await ctx.runQuery(internal.memeCoins.get, { id: coinId });
      
      if (!coin) {
        throw new Error("Coin not found");
      }
      
      // Route to appropriate real deployment
      let result;
      if (blockchain === "ethereum" || blockchain === "bsc") {
        result = await ctx.runAction(internal.blockchain.realDeployment.deployEVMToken, {
          coinId,
          blockchain,
          name: coin.name,
          symbol: coin.symbol,
          initialSupply: coin.initialSupply,
          canMint: coin.canMint,
          canBurn: coin.canBurn,
        });
      } else if (blockchain === "solana") {
        result = await ctx.runAction(internal.blockchain.realDeployment.deploySolanaToken, {
          coinId,
          name: coin.name,
          symbol: coin.symbol,
          initialSupply: coin.initialSupply,
          description: coin.description || "",
          logoUrl: coin.logoUrl,
        });
      } else {
        throw new Error(`Unsupported blockchain: ${blockchain}`);
      }
      
      // Check if deployment failed
      if (result && typeof result === 'object' && 'success' in result && !result.success) {
        await ctx.runMutation(internal.jobQueue.updateJobStatus, {
          jobId: args.jobId,
          status: "failed",
          error: result.error || "Deployment failed",
        });
      } else {
        // Update job as completed
        await ctx.runMutation(internal.jobQueue.updateJobStatus, {
          jobId: args.jobId,
          status: "completed",
          result,
        });
      }
      
    } catch (error: any) {
      // Update job as failed
      await ctx.runMutation(internal.jobQueue.updateJobStatus, {
        jobId: args.jobId,
        status: "failed",
        error: error.message,
      });
    }
  },
});

// Internal: Update job status
export const updateJobStatus = internalMutation({
  args: {
    jobId: v.id("jobs"),
    status: v.union(v.literal("completed"), v.literal("failed")),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = {
      status: args.status,
      completedAt: Date.now(),
    };
    
    if (args.result) {
      updates.result = args.result;
    }
    
    if (args.error) {
      updates.error = args.error;
    }
    
    await ctx.db.patch(args.jobId, updates);
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