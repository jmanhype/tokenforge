# Complete Guide to Getting All API Keys and Environment Variables

This guide provides step-by-step instructions for obtaining every API key and environment variable needed to run TokenForge in production.

## Table of Contents
1. [Core Requirements](#core-requirements)
2. [Blockchain RPC Endpoints](#blockchain-rpc-endpoints)
3. [Deployer Wallets](#deployer-wallets)
4. [Market Data APIs](#market-data-apis)
5. [Block Explorer APIs](#block-explorer-apis)
6. [Social Media APIs](#social-media-apis)
7. [Storage Services](#storage-services)
8. [Final Checklist](#final-checklist)

---

## Core Requirements

### 1. Convex Backend

**Time Required**: 5 minutes  
**Cost**: Free tier available

1. Go to https://www.convex.dev/
2. Click "Get Started" 
3. Sign up with GitHub or email
4. Create a new project
5. The following will be auto-generated:
   - `CONVEX_DEPLOYMENT` - Added automatically to `.env.local`
   - `VITE_CONVEX_URL` - Added automatically to `.env.local`

### 2. Authentication Secret

**Time Required**: 1 minute  
**Cost**: Free

Generate a secure random secret:

```bash
# macOS/Linux
openssl rand -base64 32

# Windows (PowerShell)
[System.Convert]::ToBase64String((1..32|ForEach{[byte](Get-Random -Max 256)}))

# Example output: k5J3kLm9Np2Qr7StUvWxYz1AbCdEfGhIj4KlMnOpQrS=
```

Add to `.env`:
```
AUTH_SECRET=your_generated_secret_here
```

---

## Blockchain RPC Endpoints

### Option 1: Alchemy (Recommended)

**Time Required**: 10 minutes  
**Cost**: Free tier (300M compute units/month)

1. **Sign Up**
   - Go to https://www.alchemy.com/
   - Click "Get started for free"
   - Sign up with email or Google

2. **Create Ethereum App**
   - Click "Create new app"
   - Name: "TokenForge-Ethereum"
   - Chain: "Ethereum Mainnet"
   - Click "Create app"

3. **Get Ethereum RPC URL**
   - Click on your app
   - Click "API Key"
   - Copy the HTTPS URL
   - Example: `https://eth-mainnet.g.alchemy.com/v2/your-api-key`

4. **Create BSC App** (Repeat for BSC)
   - Create another app
   - Chain: "BNB Smart Chain Mainnet"
   - Get the URL

5. **Add to `.env`**:
```
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-key
VITE_ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-key
BSC_RPC_URL=https://bnb-mainnet.g.alchemy.com/v2/your-key
VITE_BSC_RPC_URL=https://bnb-mainnet.g.alchemy.com/v2/your-key
```

### Option 2: Infura

**Time Required**: 10 minutes  
**Cost**: Free tier (100k requests/day)

1. **Sign Up**
   - Go to https://www.infura.io/
   - Click "Sign Up"
   - Verify email

2. **Create Project**
   - Click "Create New API Key"
   - Name: "TokenForge"
   - Select "Web3 API"

3. **Get Endpoints**
   - Go to project settings
   - Copy Ethereum endpoint
   - Enable BSC addon for BSC endpoint

### Solana RPC

**Option A: QuickNode (Recommended)**

**Time Required**: 10 minutes  
**Cost**: Free tier (10M requests/month)

1. Go to https://www.quicknode.com/
2. Sign up
3. Click "Create Endpoint"
4. Select "Solana" → "Mainnet"
5. Copy the HTTPS endpoint

**Option B: Public RPC (Free but less reliable)**
```
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
VITE_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

---

## Deployer Wallets

### EVM Wallet (Ethereum/BSC)

**Time Required**: 5 minutes  
**Cost**: Free to create, needs funds for deployments

**Option 1: Using MetaMask**
1. Install MetaMask: https://metamask.io/
2. Create a new wallet (NOT your main wallet!)
3. Click account menu → "Account details"
4. Click "Export Private Key"
5. Enter password and copy key

**Option 2: Command Line**
```bash
# Install ethers CLI
npm install -g ethers-cli

# Generate new wallet
ethers wallet create

# Output will include private key
```

**Add to `.env`**:
```
DEPLOYER_PRIVATE_KEY=0x_your_private_key_here
VITE_DEPLOYER_PRIVATE_KEY=0x_your_private_key_here
```

### Solana Wallet

**Time Required**: 5 minutes  
**Cost**: Free to create, needs SOL for deployments

1. **Install Solana CLI**
```bash
# macOS/Linux
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Windows
# Download from https://github.com/solana-labs/solana/releases
```

2. **Generate Keypair**
```bash
solana-keygen new --outfile ~/deployer-keypair.json

# View the keypair
cat ~/deployer-keypair.json
```

3. **Add to `.env`**:
```
SOLANA_DEPLOYER_KEYPAIR=[1,2,3,4,5...] # The JSON array from the file
```

**⚠️ SECURITY WARNING**: 
- Never use your personal wallet
- Only fund with amounts needed for deployments
- Keep private keys secure and never commit to git

---

## Market Data APIs

### CoinGecko API

**Time Required**: 5 minutes  
**Cost**: Free tier (10k calls/month) or Pro ($129/month)

1. **Sign Up**
   - Go to https://www.coingecko.com/en/api
   - Click "Get Your API Key"
   - Sign up with email

2. **Generate API Key**
   - Go to https://www.coingecko.com/en/developers/dashboard
   - Click "Add New Key"
   - Name: "TokenForge"
   - Copy the key (starts with "CG-")

3. **Add to `.env`**:
```
COINGECKO_API_KEY=CG-your_api_key_here
VITE_COINGECKO_API_KEY=CG-your_api_key_here
```

### GeckoTerminal API (Optional)

**Time Required**: 5 minutes  
**Cost**: Free tier available

1. Go to https://www.geckoterminal.com/dapp/api
2. Sign up for API access
3. Get your API key
4. Add to `.env`:
```
GECKOTERMINAL_API_KEY=your_key
VITE_GECKOTERMINAL_API_KEY=your_key
```

---

## Block Explorer APIs

### Etherscan API

**Time Required**: 5 minutes  
**Cost**: Free (5 calls/second)

1. **Sign Up**
   - Go to https://etherscan.io/register
   - Create account and verify email

2. **Get API Key**
   - Go to https://etherscan.io/myapikey
   - Click "Add" to create new key
   - Name: "TokenForge"
   - Copy the key

3. **Add to `.env`**:
```
ETHERSCAN_API_KEY=your_etherscan_key
VITE_ETHERSCAN_API_KEY=your_etherscan_key
```

### BscScan API

**Time Required**: 5 minutes  
**Cost**: Free (5 calls/second)

1. **Sign Up**
   - Go to https://bscscan.com/register
   - Same account works if you have Etherscan

2. **Get API Key**
   - Go to https://bscscan.com/myapikey
   - Create new key for BscScan
   - Copy the key

3. **Add to `.env`**:
```
BSCSCAN_API_KEY=your_bscscan_key
VITE_BSCSCAN_API_KEY=your_bscscan_key
```

### Solscan API (Optional)

**Time Required**: 10 minutes  
**Cost**: Free tier available

1. Go to https://pro.solscan.io/
2. Sign up for API access
3. Get API credentials

---

## Social Media APIs

### Twitter/X API

**Time Required**: 1-3 days (approval wait)  
**Cost**: Basic tier $100/month

1. **Apply for Developer Account**
   - Go to https://developer.twitter.com/
   - Click "Sign up"
   - Choose "Basic" tier ($100/month)
   - Fill application (be specific about use case)
   - Wait for approval (usually 1-3 days)

2. **Create App**
   - Go to Developer Portal
   - Click "Create Project"
   - Name: "TokenForge"
   - Create App within project

3. **Generate All Tokens**
   - Go to your app settings
   - Click "Keys and tokens"
   - Generate:
     - API Key & Secret
     - Access Token & Secret
   - Enable OAuth 2.0

4. **Add to `.env`**:
```
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_SECRET=your_access_secret
VITE_TWITTER_API_KEY=your_api_key
```

### Discord Webhook

**Time Required**: 2 minutes  
**Cost**: Free

1. **Create Webhook**
   - Open Discord
   - Go to your server
   - Click Server Settings → Integrations
   - Click "Webhooks" → "New Webhook"
   - Name: "TokenForge Announcements"
   - Select channel
   - Copy Webhook URL

2. **Add to `.env`**:
```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxx/yyy
VITE_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxx/yyy
```

### Telegram Bot

**Time Required**: 5 minutes  
**Cost**: Free

1. **Create Bot**
   - Open Telegram
   - Search for "@BotFather"
   - Send `/newbot`
   - Choose name: "TokenForge Bot"
   - Choose username: "tokenforge_bot"
   - Copy the token

2. **Get Chat ID**
   - Create a channel/group
   - Add your bot as admin
   - Send a message
   - Visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
   - Find your chat_id in the response

3. **Add to `.env`**:
```
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHANNEL_ID=-1001234567890
VITE_TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

---

## Storage Services

### Pinata (IPFS)

**Time Required**: 5 minutes  
**Cost**: Free tier (1GB storage)

1. **Sign Up**
   - Go to https://www.pinata.cloud/
   - Sign up with email

2. **Generate API Keys**
   - Go to API Keys section
   - Click "New Key"
   - Select permissions: "pinFileToIPFS"
   - Name: "TokenForge"
   - Copy API Key and Secret

3. **Add to `.env`**:
```
VITE_IPFS_GATEWAY=https://gateway.pinata.cloud
VITE_PINATA_API_KEY=your_api_key
VITE_PINATA_SECRET_KEY=your_secret_key
```

---

## Final Checklist

Copy this to track your progress:

### Required APIs
- [ ] Convex account created
- [ ] AUTH_SECRET generated
- [ ] Ethereum RPC URL obtained
- [ ] BSC RPC URL obtained
- [ ] Solana RPC URL obtained
- [ ] EVM deployer wallet created and funded
- [ ] Solana deployer wallet created and funded
- [ ] CoinGecko API key obtained

### Optional APIs (Recommended)
- [ ] Etherscan API key
- [ ] BscScan API key
- [ ] Twitter Developer account approved
- [ ] Discord webhook created
- [ ] Telegram bot created
- [ ] Pinata account created

### Deployment Ready
- [ ] All required variables in `.env`
- [ ] Deployer wallets funded with:
  - [ ] ETH for Ethereum deployments (~0.05 ETH)
  - [ ] BNB for BSC deployments (~0.01 BNB)
  - [ ] SOL for Solana deployments (~0.5 SOL)
- [ ] Test deployment successful

## Example Complete `.env`

```env
# Core
CONVEX_DEPLOYMENT=standing-oyster-615
VITE_CONVEX_URL=https://standing-oyster-615.convex.cloud
AUTH_SECRET=k5J3kLm9Np2Qr7StUvWxYz1AbCdEfGhIj4KlMnOpQrS=

# Blockchain RPCs
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/Kc5_xxxxxxxxxxxx
VITE_ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/Kc5_xxxxxxxxxxxx
BSC_RPC_URL=https://bnb-mainnet.g.alchemy.com/v2/Bsc_xxxxxxxxxxxx
VITE_BSC_RPC_URL=https://bnb-mainnet.g.alchemy.com/v2/Bsc_xxxxxxxxxxxx
SOLANA_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/Sol_xxxxxxxxxxxx
VITE_SOLANA_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/Sol_xxxxxxxxxxxx

# Deployer Wallets
DEPLOYER_PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
VITE_DEPLOYER_PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
SOLANA_DEPLOYER_KEYPAIR=[123,45,67,89,...]

# APIs
COINGECKO_API_KEY=CG-xxxxxxxxxxxxxxxxxxxx
VITE_COINGECKO_API_KEY=CG-xxxxxxxxxxxxxxxxxxxx
ETHERSCAN_API_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_ETHERSCAN_API_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXX
BSCSCAN_API_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_BSCSCAN_API_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Social Media
TWITTER_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWITTER_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWITTER_ACCESS_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWITTER_ACCESS_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1234567890/xxxxxxxxxxxx
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Storage
VITE_IPFS_GATEWAY=https://gateway.pinata.cloud
VITE_PINATA_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_PINATA_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Troubleshooting

### "Invalid API Key"
- Double-check you copied the entire key
- Ensure no extra spaces or line breaks
- Verify the key is active in the service dashboard

### "Insufficient permissions"
- Check API key permissions/scopes
- For Twitter, ensure you have write permissions
- For blockchain APIs, check rate limits

### "Connection refused"
- Verify RPC URLs include https://
- Check if service is down (status pages)
- Try alternative RPC endpoints

### Rate Limit Issues
- Implement caching
- Use multiple API keys
- Upgrade to paid tiers for production

## Support Links

- **Alchemy Support**: https://docs.alchemy.com/
- **Infura Support**: https://docs.infura.io/
- **CoinGecko Support**: https://support.coingecko.com/
- **Twitter API**: https://developer.twitter.com/en/support
- **Telegram Bot API**: https://core.telegram.org/bots/api
- **Pinata Docs**: https://docs.pinata.cloud/

---

**Remember**: Keep your private keys and API keys secure. Never share them or commit them to version control!