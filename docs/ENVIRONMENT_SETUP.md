# Environment Setup Guide

This guide will help you set up all the required environment variables for TokenForge.

## Quick Start

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Fill in the required values in `.env`

3. Generate an auth secret:
```bash
openssl rand -base64 32
```

## Required Services

### 1. Blockchain RPC Providers

You need RPC endpoints for each blockchain. Choose one of these options:

#### Option A: Public RPCs (Free, less reliable)
- **Ethereum**: `https://eth-mainnet.g.alchemy.com/v2/demo`
- **BSC**: `https://bsc-dataseed.binance.org/`
- **Solana**: `https://api.mainnet-beta.solana.com`

#### Option B: Premium RPCs (Recommended for production)

**Alchemy** (Ethereum & Polygon)
1. Sign up at https://www.alchemy.com/
2. Create a new app
3. Copy the HTTPS endpoint

**QuickNode** (All chains)
1. Sign up at https://www.quicknode.com/
2. Create endpoints for each chain
3. Copy the HTTPS endpoints

**Infura** (Ethereum)
1. Sign up at https://www.infura.io/
2. Create a new project
3. Copy the project ID

### 2. Deployer Wallets

**IMPORTANT**: Create new wallets specifically for deployments. Never use your personal wallet!

#### EVM Wallets (Ethereum/BSC)
```bash
# Using ethers.js (Node.js)
node -e "console.log(require('ethers').Wallet.createRandom().privateKey)"

# Or use MetaMask to create a new wallet and export the private key
```

#### Solana Wallet
```bash
# Install Solana CLI first
solana-keygen new --outfile deployer-keypair.json
# Convert to base58 format for the env file
```

### 3. CoinGecko API

1. Go to https://www.coingecko.com/en/api
2. Sign up for a free account (or Pro for higher limits)
3. Generate an API key
4. Add to `.env`: `COINGECKO_API_KEY=CG-xxxxxxxxxxxx`

## Optional Services

### Block Explorer APIs (for contract verification)

#### Etherscan
1. Sign up at https://etherscan.io/register
2. Go to https://etherscan.io/myapikey
3. Create a new API key

#### BscScan
1. Sign up at https://bscscan.com/register
2. Go to https://bscscan.com/myapikey
3. Create a new API key

### Social Media Integration

#### Twitter API v2
1. Apply for developer account at https://developer.twitter.com/
2. Create a new app
3. Generate all tokens (API Key, Secret, Access Token, Access Secret)

#### Discord Webhook
1. Go to your Discord server settings
2. Navigate to Integrations > Webhooks
3. Create a new webhook
4. Copy the webhook URL

#### Telegram Bot
1. Message @BotFather on Telegram
2. Send `/newbot` and follow instructions
3. Copy the bot token
4. Create a channel and add the bot as admin
5. Get the channel ID (usually starts with @)

### IPFS Storage (Pinata)

1. Sign up at https://www.pinata.cloud/
2. Go to API Keys section
3. Create a new API key
4. Copy both the API Key and Secret Key

## Environment Variables by Feature

### Minimum for Local Development
```env
# Convex (auto-generated)
CONVEX_DEPLOYMENT=
VITE_CONVEX_URL=

# Auth
AUTH_SECRET=<generate-with-openssl>

# Use public RPCs
VITE_ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/demo
VITE_BSC_RPC_URL=https://bsc-dataseed.binance.org/
VITE_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Mock deployer key (DO NOT USE IN PRODUCTION)
VITE_DEPLOYER_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000001
```

### For Token Deployment Feature
Add these to the minimum:
```env
# Real RPC endpoints (premium recommended)
ETHEREUM_RPC_URL=<your-ethereum-rpc>
BSC_RPC_URL=<your-bsc-rpc>
SOLANA_RPC_URL=<your-solana-rpc>

# Real deployer wallets with funds
DEPLOYER_PRIVATE_KEY=<your-evm-private-key>
SOLANA_DEPLOYER_KEYPAIR=<your-solana-keypair>
```

### For Market Data Feature
Add:
```env
COINGECKO_API_KEY=<your-coingecko-key>
VITE_COINGECKO_API_KEY=<your-coingecko-key>
```

### For Social Sharing Feature
Add:
```env
TWITTER_API_KEY=<your-twitter-key>
TWITTER_API_SECRET=<your-twitter-secret>
TWITTER_ACCESS_TOKEN=<your-twitter-token>
TWITTER_ACCESS_SECRET=<your-twitter-token-secret>

DISCORD_WEBHOOK_URL=<your-discord-webhook>
TELEGRAM_BOT_TOKEN=<your-telegram-bot-token>
```

## Security Best Practices

1. **Never commit `.env` files** - It's in `.gitignore` for a reason
2. **Use separate wallets** for deployment - Never use your personal wallet
3. **Rotate keys regularly** - Especially if exposed
4. **Use environment-specific files**:
   - `.env.local` for local development
   - `.env.production` for production (in your deployment platform)
5. **Limit key permissions** - Use read-only keys where possible
6. **Monitor usage** - Set up alerts for unusual API usage

## Deployment Platforms

### Vercel
1. Go to your project settings
2. Navigate to Environment Variables
3. Add each variable from your `.env` file
4. Deploy

### Netlify
1. Go to Site settings > Environment
2. Add environment variables
3. Deploy

### Railway
1. Go to your project
2. Click on Variables
3. Add from `.env` file or manually
4. Deploy

## Troubleshooting

### "Invalid RPC URL"
- Ensure the URL includes `https://`
- Check if the API key is correctly appended
- Try the public RPC first to isolate issues

### "Insufficient funds for deployment"
- Check deployer wallet balance
- Ensure you're on the right network
- Gas prices might be high - wait or increase gas

### "API rate limit exceeded"
- Upgrade to a paid tier
- Implement caching
- Use multiple API keys in rotation

### "Social media post failed"
- Verify API credentials
- Check API rate limits
- Ensure proper permissions (OAuth scopes)

## Next Steps

After setting up your environment:

1. Run `npm run dev` to start local development
2. Test each feature with your API keys
3. Monitor the console for any errors
4. Check the Convex dashboard for backend logs

For production deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md).