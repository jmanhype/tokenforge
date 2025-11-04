import { Counter, Histogram, Gauge, Registry, collectDefaultMetrics } from 'prom-client';

// Create a Registry
export const register = new Registry();

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  registers: [register],
});

export const activeUsers = new Gauge({
  name: 'memecoingen_active_users',
  help: 'Number of active users',
  registers: [register],
});

export const coinsCreatedTotal = new Counter({
  name: 'memecoingen_coins_created_total',
  help: 'Total number of coins created',
  labelNames: ['blockchain', 'status'],
  registers: [register],
});

export const deploymentDuration = new Histogram({
  name: 'memecoingen_deployment_duration_seconds',
  help: 'Duration of smart contract deployments in seconds',
  labelNames: ['blockchain'],
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [register],
});

export const deploymentGasCost = new Histogram({
  name: 'memecoingen_deployment_gas_cost',
  help: 'Gas cost of deployments in USD',
  labelNames: ['blockchain'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [register],
});

export const socialSharesTotal = new Counter({
  name: 'memecoingen_social_shares_total',
  help: 'Total number of social media shares',
  labelNames: ['platform'],
  registers: [register],
});

export const subscriptionRevenue = new Gauge({
  name: 'memecoingen_subscription_revenue_usd',
  help: 'Total subscription revenue in USD',
  labelNames: ['tier'],
  registers: [register],
});

export const databaseConnections = new Gauge({
  name: 'memecoingen_database_connections',
  help: 'Number of active database connections',
  registers: [register],
});

export const redisOperations = new Counter({
  name: 'memecoingen_redis_operations_total',
  help: 'Total number of Redis operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

export const blockchainRpcCalls = new Counter({
  name: 'memecoingen_blockchain_rpc_calls_total',
  help: 'Total number of blockchain RPC calls',
  labelNames: ['blockchain', 'method', 'status'],
  registers: [register],
});

export const blockchainRpcLatency = new Histogram({
  name: 'memecoingen_blockchain_rpc_latency_seconds',
  help: 'Latency of blockchain RPC calls in seconds',
  labelNames: ['blockchain', 'method'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

interface Request {
  route?: { path?: string };
  path?: string;
  method: string;
}

interface Response {
  on: (event: string, callback: () => void) => void;
  statusCode: number;
}

type NextFunction = () => void;

// Express middleware to track HTTP metrics
export const httpMetricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path || 'unknown';
    const method = req.method;
    const status = res.statusCode.toString();

    httpRequestsTotal.labels(method, route, status).inc();
    httpRequestDuration.labels(method, route, status).observe(duration);
  });

  next();
};

// Track deployment metrics
export const trackDeployment = (
  blockchain: string,
  status: 'success' | 'failed',
  duration: number,
  gasCost?: number
) => {
  coinsCreatedTotal.labels(blockchain, status).inc();
  deploymentDuration.labels(blockchain).observe(duration);
  
  if (gasCost !== undefined) {
    deploymentGasCost.labels(blockchain).observe(gasCost);
  }
};

// Track social shares
export const trackSocialShare = (platform: string) => {
  socialSharesTotal.labels(platform).inc();
};

// Track blockchain RPC calls
export const trackRpcCall = async <T>(
  blockchain: string,
  method: string,
  fn: () => Promise<T>
): Promise<T> => {
  const start = Date.now();
  
  try {
    const result = await fn();
    const duration = (Date.now() - start) / 1000;
    
    blockchainRpcCalls.labels(blockchain, method, 'success').inc();
    blockchainRpcLatency.labels(blockchain, method).observe(duration);
    
    return result;
  } catch (error) {
    blockchainRpcCalls.labels(blockchain, method, 'error').inc();
    throw error;
  }
};

// Health check data
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: boolean;
    redis: boolean;
    blockchain: {
      ethereum: boolean;
      bsc: boolean;
      solana: boolean;
    };
  };
  version: string;
  environment: string;
}

// Perform health checks
export const performHealthCheck = async (): Promise<HealthCheckResult> => {
  const checks = {
    database: false,
    redis: false,
    blockchain: {
      ethereum: false,
      bsc: false,
      solana: false,
    },
  };
  
  // TODO: Implement actual health checks
  // For now, returning mock data
  checks.database = true;
  checks.redis = true;
  checks.blockchain.ethereum = true;
  checks.blockchain.bsc = true;
  checks.blockchain.solana = true;
  
  const allHealthy = 
    checks.database &&
    checks.redis &&
    checks.blockchain.ethereum &&
    checks.blockchain.bsc &&
    checks.blockchain.solana;
  
  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  };
};

// Update metrics periodically
export const startMetricsCollection = () => {
  // Update active users every minute
  setInterval(async () => {
    try {
      // TODO: Get actual active user count from database
      const activeUserCount = Math.floor(Math.random() * 1000); // Mock data
      activeUsers.set(activeUserCount);
    } catch (error) {
      console.error('Error updating active users metric:', error);
    }
  }, 60000);
  
  // Update database connections every 30 seconds
  setInterval(async () => {
    try {
      // TODO: Get actual connection count from database pool
      const connectionCount = Math.floor(Math.random() * 50); // Mock data
      databaseConnections.set(connectionCount);
    } catch (error) {
      console.error('Error updating database connections metric:', error);
    }
  }, 30000);
};

// Structured logging
export interface LogContext {
  userId?: string;
  requestId?: string;
  blockchain?: string;
  coinId?: string;
  [key: string]: string | number | boolean | undefined;
}

export class Logger {
  private context: LogContext;
  
  constructor(context: LogContext = {}) {
    this.context = context;
  }
  
  private formatMessage(level: string, message: string, meta?: Record<string, unknown>) {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...meta,
    };
  }

  info(message: string, meta?: Record<string, unknown>) {
    console.log(JSON.stringify(this.formatMessage('info', message, meta)));
  }

  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(JSON.stringify(this.formatMessage('warn', message, meta)));
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>) {
    console.error(JSON.stringify(this.formatMessage('error', message, {
      ...meta,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : undefined,
    })));
  }

  debug(message: string, meta?: Record<string, unknown>) {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(JSON.stringify(this.formatMessage('debug', message, meta)));
    }
  }
}