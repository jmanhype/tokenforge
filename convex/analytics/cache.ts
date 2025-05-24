import { v } from "convex/values";

// Generic cache interface
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Cache configuration
export const CACHE_CONFIG = {
  DEFAULT_TTL: 5 * 60 * 1000, // 5 minutes
  PRICE_DATA_TTL: 2 * 60 * 1000, // 2 minutes for price data
  HOLDER_DATA_TTL: 10 * 60 * 1000, // 10 minutes for holder data
  HISTORICAL_DATA_TTL: 15 * 60 * 1000, // 15 minutes for historical data
  MAX_CACHE_SIZE: 1000, // Maximum number of entries
  CLEANUP_INTERVAL: 60 * 1000 // Run cleanup every minute
};

// Generic in-memory cache implementation
export class InMemoryCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private lastCleanup: number;
  private maxSize: number;

  constructor(maxSize: number = CACHE_CONFIG.MAX_CACHE_SIZE) {
    this.cache = new Map();
    this.lastCleanup = Date.now();
    this.maxSize = maxSize;
  }

  // Get cached data
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  // Set cached data
  set(key: string, data: T, ttl: number = CACHE_CONFIG.DEFAULT_TTL): void {
    // Run cleanup if needed
    if (Date.now() - this.lastCleanup > CACHE_CONFIG.CLEANUP_INTERVAL) {
      this.cleanup();
    }

    // Enforce size limit using LRU eviction
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  // Delete specific entry
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  // Clear all entries
  clear(): void {
    this.cache.clear();
  }

  // Get cache size
  size(): number {
    return this.cache.size;
  }

  // Clean up expired entries
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    this.lastCleanup = now;
    return removed;
  }

  // Get cache statistics
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    let oldest: number | null = null;
    let newest: number | null = null;

    for (const entry of this.cache.values()) {
      if (oldest === null || entry.timestamp < oldest) {
        oldest = entry.timestamp;
      }
      if (newest === null || entry.timestamp > newest) {
        newest = entry.timestamp;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need to track hits/misses for this
      oldestEntry: oldest,
      newestEntry: newest
    };
  }
}

// Singleton caches for different data types
export const priceCache = new InMemoryCache<any>();
export const analyticsCache = new InMemoryCache<any>();
export const dexCache = new InMemoryCache<any>();
export const blockchainCache = new InMemoryCache<any>();

// Cache key generators
export const cacheKeys = {
  price: (blockchain: string, address: string) => 
    `price:${blockchain}:${address.toLowerCase()}`,
  
  analytics: (blockchain: string, address: string) => 
    `analytics:${blockchain}:${address.toLowerCase()}`,
  
  pools: (blockchain: string, address: string) => 
    `pools:${blockchain}:${address.toLowerCase()}`,
  
  pool: (blockchain: string, poolAddress: string) => 
    `pool:${blockchain}:${poolAddress.toLowerCase()}`,
  
  holders: (blockchain: string, address: string) => 
    `holders:${blockchain}:${address.toLowerCase()}`,
  
  transactions: (blockchain: string, address: string, limit: number) => 
    `transactions:${blockchain}:${address.toLowerCase()}:${limit}`,
  
  historical: (blockchain: string, address: string, days: number) => 
    `historical:${blockchain}:${address.toLowerCase()}:${days}`,
  
  ohlcv: (blockchain: string, poolAddress: string, timeframe: string) => 
    `ohlcv:${blockchain}:${poolAddress.toLowerCase()}:${timeframe}`,
  
  trending: (blockchain: string) => 
    `trending:${blockchain}`,
  
  volume: (blockchain: string, address: string, days: number) => 
    `volume:${blockchain}:${address.toLowerCase()}:${days}`
};

// Cache warming utility
export async function warmCache(
  contractAddress: string,
  blockchain: "ethereum" | "bsc" | "solana"
): Promise<void> {
  // This would pre-fetch commonly accessed data
  // Implementation would call the various fetch functions
  console.log(`Warming cache for ${contractAddress} on ${blockchain}`);
}

// Export cache utilities for use in other modules
export const cacheUtils = {
  priceCache,
  analyticsCache,
  dexCache,
  blockchainCache,
  cacheKeys,
  warmCache,
  CACHE_CONFIG
};