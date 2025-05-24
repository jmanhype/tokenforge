import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Update analytics every 5 minutes
crons.interval(
  "update analytics",
  { minutes: 5 },
  internal.analytics.batchUpdateAnalytics
);

// Clear expired cache entries every hour
crons.interval(
  "clear cache",
  { hours: 1 },
  internal.analytics.clearAnalyticsCache
);

export default crons;