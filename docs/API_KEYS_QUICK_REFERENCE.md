# API Keys Quick Reference Card

Print this page and check off each service as you complete it.

## 🚀 Essential Services (Required)

| Service | URL | Time | Cost | Notes |
|---------|-----|------|------|-------|
| **Convex** | https://www.convex.dev/ | 5 min | Free | Auto-generates deployment URL |
| **Alchemy** | https://www.alchemy.com/ | 10 min | Free tier | For Ethereum & BSC RPC |
| **QuickNode** | https://www.quicknode.com/ | 10 min | Free tier | Alternative to Alchemy |
| **CoinGecko** | https://www.coingecko.com/en/api | 5 min | Free/Pro | Market data API |

## 🔑 Quick Commands

### Generate Auth Secret
```bash
openssl rand -base64 32
```

### Create EVM Wallet
```bash
# Using Node.js
node -e "console.log(require('ethers').Wallet.createRandom().privateKey)"
```

### Create Solana Wallet
```bash
solana-keygen new --outfile ~/deployer-keypair.json
```

## 📋 Checklist

### Day 1 - Core Setup (30 minutes)
- [ ] Create Convex account
- [ ] Generate AUTH_SECRET
- [ ] Sign up for Alchemy/QuickNode
- [ ] Get Ethereum RPC URL
- [ ] Get BSC RPC URL
- [ ] Get Solana RPC URL
- [ ] Create deployer wallets

### Day 2 - Market Data (15 minutes)
- [ ] Sign up for CoinGecko
- [ ] Get CoinGecko API key
- [ ] (Optional) Etherscan API key
- [ ] (Optional) BscScan API key

### Day 3 - Social Media (Variable)
- [ ] Create Discord webhook (2 min)
- [ ] Create Telegram bot (5 min)
- [ ] Apply for Twitter API (1-3 days wait)

## 🎯 Minimum Viable Setup

Just want to test? Use these free options:

```env
# Minimum working configuration
CONVEX_DEPLOYMENT=<auto-generated>
VITE_CONVEX_URL=<auto-generated>
AUTH_SECRET=<generate-with-openssl>

# Free public RPCs (less reliable)
VITE_ETHEREUM_RPC_URL=https://eth.llamarpc.com
VITE_BSC_RPC_URL=https://bsc-dataseed.binance.org/
VITE_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Test wallet (DO NOT use in production!)
VITE_DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

## 💰 Estimated Costs

### Development/Testing
- **Total**: $0/month (using free tiers)

### Production (Basic)
- **Alchemy**: $0-49/month (free tier often sufficient)
- **CoinGecko Pro**: $129/month (optional)
- **Twitter API**: $100/month
- **Total**: ~$100-250/month

### Production (Scale)
- **Alchemy Growth**: $49-199/month
- **CoinGecko Pro**: $129/month
- **Twitter API**: $100/month
- **QuickNode**: $49-299/month
- **Total**: ~$350-750/month

## 🔗 All Services in One Place

### RPC Providers
- **Alchemy**: https://www.alchemy.com/
- **Infura**: https://www.infura.io/
- **QuickNode**: https://www.quicknode.com/
- **Ankr**: https://www.ankr.com/

### Market Data
- **CoinGecko**: https://www.coingecko.com/en/api
- **CoinMarketCap**: https://coinmarketcap.com/api/
- **CryptoCompare**: https://min-api.cryptocompare.com/

### Block Explorers
- **Etherscan**: https://etherscan.io/apis
- **BscScan**: https://bscscan.com/apis
- **Polygonscan**: https://polygonscan.com/apis
- **Solscan**: https://solscan.io/

### Social Media
- **Twitter Dev**: https://developer.twitter.com/
- **Discord Webhooks**: Via server settings
- **Telegram BotFather**: https://t.me/BotFather

### Storage
- **Pinata**: https://www.pinata.cloud/
- **Web3.Storage**: https://web3.storage/
- **Fleek**: https://fleek.co/

## 🚨 Security Reminders

1. **NEVER** commit API keys to Git
2. **NEVER** use your personal wallet as deployer
3. **ALWAYS** use separate API keys for dev/prod
4. **ALWAYS** set spending limits where possible
5. **ROTATE** keys every 90 days

## 📞 Quick Support

- **Can't get Ethereum RPC?** → Use https://eth.llamarpc.com temporarily
- **CoinGecko rate limited?** → Cache responses for 60 seconds
- **Twitter API rejected?** → Be specific about token launch use case
- **Wallet hacked?** → Revoke access immediately, rotate all keys
- **High gas fees?** → Wait for low network activity (weekends)

---

**Save Time**: Set up services in parallel - while waiting for Twitter API approval, set up everything else!