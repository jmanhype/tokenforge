# Real Market Data Integration

This module implements Phase 3 of the MemeCoingen production roadmap, providing real-time market data from multiple sources.

## Features

### 1. CoinGecko Pro API Integration (`coingecko.ts`)
- Real-time token price data with on-chain DEX information
- Market cap, volume, and price change tracking
- Historical price data
- Token information (name, symbol, supply)

### 2. GeckoTerminal DEX Tracking (`geckoterminal.ts`)
- Real-time DEX pool data
- Liquidity and volume metrics
- Price charts (OHLCV data)
- Recent trades tracking
- Trending pools discovery

### 3. Blockchain Explorers Integration (`blockchain-explorers.ts`)
- Token holder counts and analytics
- Transaction history and volume
- Top holders with percentage ownership
- Support for Ethereum, BSC, and Solana

### 4. Caching & Rate Limiting
- In-memory caching to reduce API calls
- Configurable TTL for different data types
- Rate limiting with exponential backoff
- Automatic retry on failures

## Configuration

Add these environment variables to your `.env` file:

```env
# Market Data APIs
COINGECKO_API_KEY=your_coingecko_pro_key
ETHERSCAN_API_KEY=your_etherscan_key
BSCSCAN_API_KEY=your_bscscan_key
SOLSCAN_API_KEY=your_solscan_key
```

## Usage

### Fetch Real-Time Analytics

```typescript
// Fetch analytics for a specific coin
const analytics = await ctx.runAction(internal.analytics.fetchRealTimeAnalytics, {
  coinId: "coin_id_here"
});
```

### Get Historical Prices

```typescript
// Get 7-day price history
const history = await ctx.runAction(internal.analytics.getHistoricalPrices, {
  coinId: "coin_id_here",
  days: 7
});
```

### Get DEX Pools

```typescript
// Get all liquidity pools for a token
const pools = await ctx.runAction(internal.analytics.getDEXPools, {
  coinId: "coin_id_here"
});
```

## Scheduled Jobs

The system includes two scheduled jobs (defined in `crons.ts`):

1. **Update Analytics** - Runs every 5 minutes to fetch latest data for all deployed coins
2. **Clear Cache** - Runs hourly to remove expired cache entries

## Rate Limits

Each API has different rate limits:

- **CoinGecko Pro**: 30 requests/minute
- **GeckoTerminal**: 120 requests/minute  
- **Etherscan/BSCScan**: 5 requests/second
- **Solscan**: 10 requests/second

The system automatically handles rate limiting with:
- Minimum delays between requests
- Exponential backoff on 429 errors
- Request queuing

## Error Handling

- Automatic retries with exponential backoff
- Fallback to cached data on API failures
- Detailed error logging
- Graceful degradation

## Cache Configuration

Different data types have different cache durations:

- Price data: 2 minutes
- DEX data: 2 minutes
- Holder data: 10 minutes
- Historical data: 15 minutes

## Performance Considerations

1. **Batch Processing**: Analytics updates are processed in batches of 5 coins
2. **Parallel Fetching**: Data from different sources is fetched in parallel
3. **Cache Warming**: Frequently accessed data can be pre-cached
4. **Memory Management**: Cache has a maximum size limit with LRU eviction

## Future Enhancements

1. Redis integration for distributed caching
2. WebSocket connections for real-time price updates
3. More DEX integrations (PancakeSwap, Raydium, etc.)
4. Advanced analytics (liquidity depth, order book data)
5. Price alerts and notifications