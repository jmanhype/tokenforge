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

// Update trending scores every 15 minutes
crons.interval(
  "update trending",
  { minutes: 15 },
  internal.social.trending.updateTrendingScores
);

// Reset 24h bonding curve volume daily
crons.daily(
  "reset bonding curve volume",
  { hourUTC: 0, minuteUTC: 0 },
  internal.bondingCurve.reset24hVolume
);

export default crons;